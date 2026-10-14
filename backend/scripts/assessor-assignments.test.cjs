const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const users = [
  ['hr','HR'], ['assessor-a','ASSESSOR'], ['assessor-b','ASSESSOR'], ['employee-a','EMPLOYEE'], ['employee-b','EMPLOYEE'],
  ['inactive-assessor','ASSESSOR',false], ['inactive-employee','EMPLOYEE',false], ['foreign-assessor','ASSESSOR',true,'other-org'],
].map(([id,role,isActive=true,organizationId='org']) => ({ id, role, isActive, organizationId }));
let assignments = [], assessments = [], failAssessment = false, sequence = 0;
function matches(row, where) {
  return Object.entries(where).every(([key,value]) => value && typeof value === 'object' ? ('gte' in value ? value.gte === undefined || row[key] >= value.gte : value.in.includes(row[key])) : row[key] === value);
}
const duplicate = () => Object.assign(new Error('duplicate'), { code: 'P2002' });
const mock = {
  user: {
    findUnique: async ({where}) => users.find(user => user.id === where.id) || null,
    findFirst: async ({where}) => users.find(user => matches(user,where)) || null,
  },
  assessorAssignment: {
    findUnique: async ({where}) => assignments.find(row => row.id === where.id) || null,
    findFirst: async ({where}) => assignments.find(row => matches(row,where)) || null,
    findMany: async ({where}) => assignments.filter(row => matches(row,where)),
    create: async ({data}) => {
      if (assignments.some(row => matches(row,data))) throw duplicate();
      const row = {id:`assignment-${++sequence}`, ...data}; assignments.push(row); return row;
    },
    update: async ({where,data}) => {
      const current = assignments.find(row => row.id === where.id);
      const next = {...current, ...Object.fromEntries(Object.entries(data).filter(([,value]) => value !== undefined))};
      if (assignments.some(row => row.id !== next.id && row.organizationId === next.organizationId && row.assessorId === next.assessorId && row.employeeId === next.employeeId)) throw duplicate();
      assignments = assignments.map(row => row.id === next.id ? next : row); return next;
    },
    delete: async ({where}) => { assignments = assignments.filter(row => row.id !== where.id); return {}; },
  },
  assessment: {
    findFirst: async ({where}) => assessments.find(row => matches(row,where)) || null,
    create: async ({data}) => {
      if (failAssessment) throw new Error('Simulated assessment failure');
      const row = {id:`assessment-${++sequence}`, createdAt:new Date(), ...data}; assessments.push(row); return row;
    },
  },
  $transaction: async fn => {
    const previousAssignments = structuredClone(assignments), previousAssessments = structuredClone(assessments);
    try { return await fn(mock); } catch(error) { assignments = previousAssignments; assessments = previousAssessments; throw error; }
  },
};
const config = require.resolve('../dist/config/prisma');
require.cache[config] = {id:config,filename:config,loaded:true,exports:{prisma:mock}};
process.env.JWT_SECRET = 'assignment-test-only';
const app = express(); app.use(express.json());
app.use('/assignments', require('../dist/routes/assignments').default);
app.use('/assessments', require('../dist/routes/assessments').default);

test('assessor assignment lifecycle, role/tenant guards, and assessment handoff', async t => {
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve => server.once('listening',resolve));
  const request = (path,id='hr',method='GET',body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers:{'Content-Type':'application/json',...(id ? {Authorization:`Bearer ${jwt.sign({id,organizationId:'org',role:users.find(user=>user.id===id)?.role},process.env.JWT_SECRET)}`} : {})}, ...(body ? {body:JSON.stringify(body)} : {}),
  });
  try {
    await t.test('requires HR for mutations and validates IDs, roles, active status and tenant', async () => {
      assert.equal((await request('/assignments',null,'POST',{})).status,401);
      for (const id of ['employee-a','assessor-a']) for (const method of ['POST','PUT','DELETE']) assert.equal((await request(method==='POST'?'/assignments':'/assignments/unknown',id,method,{})).status,403);
      for (const body of [{}, {assessorId:[],employeeId:'employee-a'}, {assessorId:'assessor-a',employeeId:10}, {assessorId:' ',employeeId:'employee-a'}, {assessorId:'employee-a',employeeId:'employee-b'}, {assessorId:'assessor-a',employeeId:'hr'}, {assessorId:'inactive-assessor',employeeId:'employee-a'}, {assessorId:'assessor-a',employeeId:'inactive-employee'}]) assert.equal((await request('/assignments','hr','POST',body)).status,400);
      assert.equal((await request('/assignments','hr','POST',{assessorId:'foreign-assessor',employeeId:'employee-a'})).status,403);
      assert.equal(assignments.length,0);
      assignments.push({id:'foreign-assignment',organizationId:'other-org',assessorId:'foreign-assessor',employeeId:'foreign-employee'});
      assert.equal((await request('/assignments/foreign-assignment','hr','PUT',{assessorId:'assessor-a'})).status,404);
      assert.equal((await request('/assignments/foreign-assignment','hr','DELETE')).status,404);
      assert.equal((await (await request('/assignments')).json()).length,0);
    });
    let first, second;
    await t.test('creates assignments, rejects duplicates, and starts assessments after completed self assessment', async () => {
      assessments.push({id:'self',organizationId:'org',employeeId:'employee-a',type:'SELF',status:'COMPLETED',createdAt:new Date('2024-01-01')});
      const response = await request('/assignments','hr','POST',{assessorId:'assessor-a',employeeId:'employee-a'});
      assert.equal(response.status,201); first = await response.json();
      assert.equal(assessments.filter(row=>row.type==='ASSESSOR').length,1);
      assert.equal((await request('/assignments','hr','POST',{assessorId:'assessor-a',employeeId:'employee-a'})).status,409);
      assert.equal(assessments.filter(row=>row.type==='ASSESSOR').length,1);
      const pending = await request('/assignments','hr','POST',{assessorId:'assessor-b',employeeId:'employee-b'});
      assert.equal(pending.status,201); second = await pending.json();
      assert.equal(assessments.some(row=>row.type==='ASSESSOR'&&row.employeeId==='employee-b'),false);
    });
    await t.test('scopes assignment lists even when users request someone else', async () => {
      const assessorRows = await (await request('/assignments?assessorId=assessor-b','assessor-a')).json();
      assert.equal(assessorRows.length,1); assert.equal(assessorRows[0].assessorId,'assessor-a');
      const employeeRows = await (await request('/assignments?employeeId=employee-b','employee-a')).json();
      assert.equal(employeeRows.length,1); assert.equal(employeeRows[0].employeeId,'employee-a');
    });
    await t.test('edits safely, rejects duplicates and inactive users, and revokes prior assessor write access', async () => {
      for(const body of [{}, {assessorId:[]}, {employeeId:null}, {assessorId:'inactive-assessor'}, {employeeId:'inactive-employee'}]) assert.equal((await request(`/assignments/${first.id}`,'hr','PUT',body)).status,400);
      assert.equal((await request(`/assignments/${first.id}`,'hr','PUT',{assessorId:'assessor-b',employeeId:'employee-b'})).status,409);
      assert.equal((await request(`/assignments/${first.id}`,'hr','PUT',{assessorId:'assessor-b'})).status,200);
      const old = assessments.find(row=>row.type==='ASSESSOR'&&row.assessorId==='assessor-a');
      assert.equal((await request(`/assessments/${old.id}/status`,'assessor-a','PUT',{status:'IN_PROGRESS'})).status,403);
      assert.equal(assessments.some(row=>row.type==='ASSESSOR'&&row.assessorId==='assessor-b'&&row.employeeId==='employee-a'),true);
    });
    await t.test('deletion preserves assessment history and removes write permission', async () => {
      assert.equal((await request(`/assignments/${first.id}`,'hr','DELETE')).status,200);
      const retained = assessments.find(row=>row.type==='ASSESSOR'&&row.assessorId==='assessor-b');
      assert.ok(retained);
      assert.equal((await request(`/assessments/${retained.id}/status`,'assessor-b','PUT',{status:'IN_PROGRESS'})).status,403);
      assert.equal((await request(`/assignments/${first.id}`,'hr','DELETE')).status,404);
    });
    await t.test('rolls assignment back if automatic assessment creation fails', async () => {
      assessments.push({id:'self-b',organizationId:'org',employeeId:'employee-b',type:'SELF',status:'COMPLETED',createdAt:new Date('2024-01-01')});
      failAssessment = true;
      assert.equal((await request('/assignments','hr','POST',{assessorId:'assessor-a',employeeId:'employee-b'})).status,500);
      assert.equal(assignments.some(row=>row.assessorId==='assessor-a'&&row.employeeId==='employee-b'),false);
      failAssessment = false;
    });
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
