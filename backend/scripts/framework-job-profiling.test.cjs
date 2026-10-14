const {test}=require('node:test');const assert=require('node:assert/strict');const express=require('express');const jwt=require('jsonwebtoken');
const tables={domains:[],categories:[],competencies:[],levels:[],jobs:[],requirements:[]};let sequence=0,employeeJobUsage=0,ratingUsage=0;
const matches=(row,where={})=>Object.entries(where).every(([key,value])=>value&&typeof value==='object' ? ('not' in value?row[key]!==value.not:'in' in value?value.in.includes(row[key]):true):row[key]===value);
const constraint=code=>Object.assign(new Error(`Test database constraint ${code}`),{code});
const models={};
function model(table){return {
 findMany:async({where}={})=>tables[table].filter(row=>matches(row,where)),
 findFirst:async({where})=>tables[table].find(row=>matches(row,where))||null,
 findUnique:async({where})=>tables[table].find(row=>row.id===where.id)||null,
 count:async({where})=>tables[table].filter(row=>matches(row,where)).length,
 create:async({data})=>{
  if(table==='levels'&&tables.levels.some(row=>row.organizationId===data.organizationId&&row.levelNumber===data.levelNumber))throw constraint('P2002');
  if(table==='requirements'&&tables.requirements.some(row=>row.organizationId===data.organizationId&&row.jobId===data.jobId&&row.competencyId===data.competencyId))throw constraint('P2002');
  const row={id:`${table}-${++sequence}`,...data};tables[table].push(row);return row;
 },
 update:async({where,data})=>{
  const row=tables[table].find(row=>row.id===where.id);const next={...row,...Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined))};
  if(table==='levels'&&tables.levels.some(other=>other.id!==next.id&&other.organizationId===next.organizationId&&other.levelNumber===next.levelNumber))throw constraint('P2002');
  if(table==='requirements'&&tables.requirements.some(other=>other.id!==next.id&&other.organizationId===next.organizationId&&other.jobId===next.jobId&&other.competencyId===next.competencyId))throw constraint('P2002');
  tables[table]=tables[table].map(other=>other.id===row.id?next:other);return next;
 },
 delete:async({where})=>{
  if(table==='domains'&&tables.categories.some(row=>row.domainId===where.id))throw constraint('P2003');
  if(table==='categories'&&tables.competencies.some(row=>row.categoryId===where.id))throw constraint('P2003');
  if(table==='competencies'&&(tables.requirements.some(row=>row.competencyId===where.id)||ratingUsage))throw constraint('P2003');
  tables[table]=tables[table].filter(row=>row.id!==where.id);return{};
 },
 deleteMany:async({where})=>{const before=tables[table].length;tables[table]=tables[table].filter(row=>!matches(row,where));return{count:before-tables[table].length};},
};}
const mock={user:{findUnique:async({where})=>({id:where.id,role:where.id,isActive:true,organizationId:'org'})},department:{findUnique:async({where})=>({id:where.id,organizationId:where.id==='foreign'?'other':'org'})},employeeJobAssignment:{count:async()=>employeeJobUsage},assessmentRating:{count:async()=>ratingUsage},$transaction:async operations=>Array.isArray(operations)?Promise.all(operations):operations(mock)};
for(const [name,table] of [['competencyDomain','domains'],['competencyCategory','categories'],['competency','competencies'],['proficiencyLevel','levels'],['job','jobs'],['jobCompetency','requirements']])mock[name]=model(table);
const config=require.resolve('../dist/config/prisma');require.cache[config]={id:config,filename:config,loaded:true,exports:{prisma:mock}};process.env.JWT_SECRET='test-framework-secret';
const app=express();app.use(express.json());app.use('/competencies',require('../dist/routes/competencies').default);app.use('/jobs',require('../dist/routes/jobs').default);
test('competency framework and job profiling lifecycle, validation and safeguards',async t=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const request=(path,method='GET',body,role='HR')=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{'Content-Type':'application/json',...(role?{Authorization:`Bearer ${jwt.sign({id:role,role,organizationId:'org'},process.env.JWT_SECRET)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const create=async(path,body,role='HR')=>{const response=await request(path,'POST',body,role);assert.equal(response.status,201,await response.clone().text());return response.json();};
 let domain,category,competency,level,job,requirement;
 try{
  await t.test('employees can read but only HR and assessors can modify',async()=>{
   for(const path of ['/competencies/domains','/competencies/categories','/competencies','/competencies/levels','/jobs','/jobs/unknown/requirements']){
    assert.equal((await request(path,'POST',{},null)).status,401);assert.equal((await request(path,'POST',{},'EMPLOYEE')).status,403);
   }
   for(const path of ['/competencies/domains','/competencies/categories','/competencies','/competencies/levels','/jobs'])assert.equal((await request(path,'GET',undefined,'EMPLOYEE')).status,200);
  });
  await t.test('rejects missing, blank and wrong-type values before database writes',async()=>{
   for(const [path,bodies] of [
    ['/competencies/domains',[{}, {domainName:' '},{domainName:12},{domainName:null}]],
    ['/competencies/categories',[{}, {name:'ok',domainId:[]},{name:' ',domainId:'domain'}]],
    ['/competencies',[{}, {name:'ok',categoryId:null},{name:'ok',categoryId:'cat',description:{}}]],
    ['/competencies/levels',[{}, {levelNumber:0,label:'zero'},{levelNumber:1.5,label:'bad'},{levelNumber:2147483648,label:'bad'},{levelNumber:1,label:12}]],
    ['/jobs',[{}, {title:[]},{title:' '},{title:'ok',departmentId:{}},{title:'ok',description:false}]],
    ['/jobs/unknown/requirements',[{}, {competencyId:[],requiredLevel:1},{competencyId:'competency',requiredLevel:'1'}]],
   ])for(const body of bodies)assert.equal((await request(path,'POST',body)).status,400);
   assert.ok(Object.values(tables).every(table=>table.length===0));
  });
  await t.test('creates the hierarchy and job requirements with normalized names',async()=>{
   domain=await create('/competencies/domains',{domainName:'  Technical  '});assert.equal(domain.domainName,'Technical');
   category=await create('/competencies/categories',{name:' Engineering ',domainId:domain.id},'ASSESSOR');
   competency=await create('/competencies',{name:' Testing ',description:' Test design ',categoryId:category.id});
   level=await create('/competencies/levels',{levelNumber:1,label:' Foundation '});
   job=await create('/jobs',{title:' Engineer ',departmentId:'department'},'ASSESSOR');assert.equal(job.title,'Engineer');
   requirement=await create(`/jobs/${job.id}/requirements`,{competencyId:competency.id,requiredLevel:1});
   assert.equal((await request(`/jobs/${job.id}/requirements`,'POST',{competencyId:competency.id,requiredLevel:1})).status,409);
   assert.equal((await request('/competencies/levels','POST',{levelNumber:1,label:'Duplicate'})).status,409);
  });
  await t.test('keeps all relations scoped to the organization',async()=>{
   for(const table of Object.keys(tables))tables[table].push({id:`foreign-${table}`,organizationId:'other'});
   assert.equal((await request('/competencies/categories','POST',{name:'x',domainId:'foreign-domains'})).status,403);
   assert.equal((await request('/competencies','POST',{name:'x',categoryId:'foreign-categories'})).status,403);
   assert.equal((await request('/jobs','POST',{title:'x',departmentId:'foreign'})).status,400);
   assert.equal((await request(`/jobs/${job.id}/requirements`,'POST',{competencyId:'foreign-competencies',requiredLevel:1})).status,404);
   for(const [path,id] of [['/competencies/domains','foreign-domains'],['/competencies/categories','foreign-categories'],['/competencies','foreign-competencies'],['/competencies/levels','foreign-levels'],['/jobs','foreign-jobs']]){
    assert.equal((await request(`${path}/${id}`,'DELETE')).status,path==='/jobs'?404:403);
    assert.ok((await(await request(path)).json()).every(row=>row.organizationId==='org'));
   }
  });
  await t.test('edits definitions, preserves configured levels and prevents invalid or duplicate requirements',async()=>{
   for(const [path,id,body] of [['/competencies/domains',domain.id,{domainName:'Revised'}],['/competencies/categories',category.id,{name:'Revised'}],['/competencies',competency.id,{description:'Updated'}],['/competencies/levels',level.id,{label:'Revised'}],['/jobs',job.id,{title:'Senior Engineer'}]]){
    assert.equal((await request(`${path}/${id}`,'PUT',{})).status,400);assert.equal((await request(`${path}/${id}`,'PUT',body,'ASSESSOR')).status,200);
   }
   assert.equal((await request(`/jobs/${job.id}/requirements/${requirement.id}`,'PUT',{competencyId:''})).status,400);
   assert.equal((await request(`/jobs/${job.id}/requirements/${requirement.id}`,'PUT',{requiredLevel:999})).status,400);
   assert.equal((await request(`/jobs/${job.id}/requirements/${requirement.id}`,'PUT',{})).status,400);
   const other=await create('/competencies',{name:'Other',categoryId:category.id});
   const second=await create(`/jobs/${job.id}/requirements`,{competencyId:other.id,requiredLevel:1});
   assert.equal((await request(`/jobs/${job.id}/requirements/${second.id}`,'PUT',{competencyId:competency.id})).status,409);
   const otherJob=await create('/jobs',{title:'Other job'});
   assert.equal((await request(`/jobs/${otherJob.id}/requirements/${requirement.id}`,'DELETE')).status,404);
  });
  await t.test('protects linked hierarchy records, assigned jobs and used proficiency levels',async()=>{
   for(const path of [`/competencies/domains/${domain.id}`,`/competencies/categories/${category.id}`,`/competencies/${competency.id}`,`/competencies/levels/${level.id}`])assert.equal((await request(path,'DELETE')).status,409);
   assert.equal((await request(`/competencies/levels/${level.id}`,'PUT',{levelNumber:2})).status,409);
   employeeJobUsage=1;assert.equal((await request(`/jobs/${job.id}`,'DELETE')).status,409);employeeJobUsage=0;
   assert.equal((await request(`/jobs/${job.id}/requirements/${requirement.id}`,'DELETE')).status,200);
   assert.equal((await request(`/jobs/${job.id}`,'DELETE')).status,200);
   assert.equal(tables.requirements.filter(row=>row.jobId===job.id).length,0);
   ratingUsage=1;assert.equal((await request(`/competencies/levels/${level.id}`,'DELETE')).status,409);assert.equal((await request(`/competencies/${competency.id}`,'DELETE')).status,409);
   ratingUsage=0;assert.equal((await request(`/competencies/${competency.id}`,'DELETE')).status,200);assert.equal((await request(`/competencies/levels/${level.id}`,'DELETE')).status,200);
  });
 }finally{await new Promise(resolve=>server.close(resolve));}
});
