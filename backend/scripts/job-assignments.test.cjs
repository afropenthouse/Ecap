const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const users = [
  {id:'hr',role:'HR',isActive:true,organizationId:'org'},
  {id:'assessor',role:'ASSESSOR',isActive:true,organizationId:'org'},
  {id:'employee',role:'EMPLOYEE',isActive:true,organizationId:'org'},
  {id:'employee-two',role:'EMPLOYEE',isActive:true,organizationId:'org'},
  {id:'inactive',role:'EMPLOYEE',isActive:false,organizationId:'org'},
  {id:'foreign',role:'EMPLOYEE',isActive:true,organizationId:'other'},
];
const jobs = ['job-a','job-b','job-c'].map(id=>({id,title:id,organizationId:'org'}));
jobs.push({id:'foreign-job',title:'foreign',organizationId:'other'}, {id:'generated',title:'General',description:'Auto-created for department assignment',organizationId:'org'});
let rows=[],sequence=0;
const match=(row,where)=>Object.entries(where).every(([key,value])=>key==='OR' ? value.some(condition=>match(row,condition)) : value && typeof value==='object' && value.lte ? row[key]!==null&&row[key]<=value.lte : row[key]===value);
const decorate=row=>({...row,job:jobs.find(job=>job.id===row.jobId)});
const duplicate=()=>Object.assign(new Error('duplicate'),{code:'P2002'});
const mock={
  user:{findUnique:async({where})=>users.find(user=>user.id===where.id)||null},
  job:{findUnique:async({where})=>jobs.find(job=>job.id===where.id)||null},
  employeeJobAssignment:{
    findMany:async({where})=>rows.filter(row=>match(row,where)).map(decorate),
    findUnique:async({where})=>rows.find(row=>row.id===where.id)||null,
    findFirst:async({where,orderBy})=>{
      assert.deepEqual(orderBy,[{startDate:{sort:'desc',nulls:'last'}},{createdAt:'desc'}]);
      return rows.filter(row=>match(row,where)).sort((a,b)=>(b.startDate?.getTime()||0)-(a.startDate?.getTime()||0)||b.createdAt-a.createdAt).map(decorate)[0]||null;
    },
    create:async({data})=>{
      if(rows.some(row=>row.employeeId===data.employeeId&&row.jobId===data.jobId&&row.organizationId===data.organizationId))throw duplicate();
      const row={id:`row-${++sequence}`,createdAt:new Date(),...data,startDate:data.startDate??null};rows.push(row);return decorate(row);
    },
    update:async({where,data})=>{
      const current=rows.find(row=>row.id===where.id), next={...current,...Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined))};
      if(rows.some(row=>row.id!==next.id&&row.employeeId===next.employeeId&&row.jobId===next.jobId&&row.organizationId===next.organizationId))throw duplicate();
      rows=rows.map(row=>row.id===next.id?next:row);return decorate(next);
    },
    delete:async({where})=>{rows=rows.filter(row=>row.id!==where.id);return{};},
  },
};
const config=require.resolve('../dist/config/prisma');require.cache[config]={id:config,filename:config,loaded:true,exports:{prisma:mock}};
process.env.JWT_SECRET='test-job-role-secret';
const app=express();app.use(express.json());app.use('/jobs',require('../dist/routes/employeeJobAssignments').default);
test('job role assignment validation, lifecycle and current-role selection',async t=>{
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const request=(path='',id='hr',method='GET',body)=>fetch(`http://127.0.0.1:${server.address().port}/jobs${path}`,{method,headers:{'Content-Type':'application/json',...(id?{Authorization:`Bearer ${jwt.sign({id,organizationId:'org',role:users.find(user=>user.id===id)?.role},process.env.JWT_SECRET)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let first,second;
  try{
    await t.test('requires HR and rejects invalid IDs, dates, roles, inactive users and foreign records',async()=>{
      assert.equal((await request('',null,'POST',{})).status,401);
      for(const id of ['employee','assessor'])for(const method of ['POST','PUT','DELETE'])assert.equal((await request(method==='POST'?'':'/unknown',id,method,{})).status,403);
      for(const body of [{},{employeeId:[],jobId:'job-a'},{employeeId:' ',jobId:'job-a'},{employeeId:'hr',jobId:'job-a'},{employeeId:'inactive',jobId:'job-a'},{employeeId:'employee',jobId:'generated'},...['2026-02-30','2025-02-29','garbled',12,{},'2026-13-01'].map(startDate=>({employeeId:'employee',jobId:'job-a',startDate}))])assert.equal((await request('','hr','POST',body)).status,400);
      assert.equal((await request('','hr','POST',{employeeId:'foreign',jobId:'job-a'})).status,403);
      assert.equal((await request('','hr','POST',{employeeId:'employee',jobId:'foreign-job'})).status,403);
      assert.equal(rows.length,0);
      rows.push({id:'foreign-row',organizationId:'other',employeeId:'foreign',jobId:'foreign-job',startDate:null,createdAt:new Date()});
      for(const method of ['PUT','DELETE'])assert.equal((await request('/foreign-row','hr',method,{startDate:'2026-01-01'})).status,404);
    });
    await t.test('creates assignments and prevents duplicate create and edit',async()=>{
      const response=await request('','hr','POST',{employeeId:'employee',jobId:'job-a',startDate:'2024-02-29'});assert.equal(response.status,201);first=await response.json();
      assert.equal(first.startDate,'2024-02-29T00:00:00.000Z');
      assert.equal((await request('','hr','POST',{employeeId:'employee',jobId:'job-a'})).status,409);
      second=await(await request('','hr','POST',{employeeId:'employee',jobId:'job-b'})).json();
      assert.equal((await request(`/${second.id}`,'hr','PUT',{jobId:'job-a'})).status,409);
    });
    await t.test('validates edits and preserves or clears dates intentionally',async()=>{
      for(const body of [{},{employeeId:null},{jobId:''},{startDate:'2026-02-30'},{employeeId:'inactive'},{employeeId:'assessor'},{jobId:'generated'},{jobId:'foreign-job'}])assert.equal((await request(`/${first.id}`,'hr','PUT',body)).status,400);
      const unchanged=await(await request(`/${first.id}`,'hr','PUT',{employeeId:'employee'})).json();assert.equal(unchanged.startDate,first.startDate);
      const cleared=await(await request(`/${first.id}`,'hr','PUT',{startDate:null})).json();assert.equal(cleared.startDate,null);
      assert.equal((await request(`/${first.id}`,'hr','PUT',{startDate:'2024-02-29'})).status,200);
    });
    await t.test('scopes employee lists and picks effective dated role ahead of undated and future roles',async()=>{
      await request('','hr','POST',{employeeId:'employee-two',jobId:'job-a'});
      const list=await(await request('?employeeId=employee-two','employee')).json();assert.equal(list.length,2);assert.ok(list.every(row=>row.employeeId==='employee'));
      await request('','hr','POST',{employeeId:'employee',jobId:'job-c',startDate:'2099-01-01'});
      const current=await(await request('/current','employee')).json();assert.equal(current.id,first.id);
      assert.equal((await request('/current','assessor')).status,403);
      assert.ok((await(await request()).json()).every(row=>row.organizationId==='org'));
    });
    await t.test('deletes only the selected assignment',async()=>{
      assert.equal((await request(`/${first.id}`,'hr','DELETE')).status,200);
      assert.equal((await request(`/${first.id}`,'hr','DELETE')).status,404);
      assert.equal((await(await request('/current','employee')).json()).id,second.id);
    });
  }finally{await new Promise(resolve=>server.close(resolve));}
});
