const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const calls = [];
const org = 'org-under-test';
let generatedRows = [];
const record = (name, result) => async args => { calls.push({ name, args }); return result; };
const mock = {
  user: { findUnique: async ({ where }) => ({ isActive: true, organizationId: org, role: where.id }) , findMany: record('employees', []) },
  job: { findMany: async args => { calls.push({ name: 'jobs', args }); return args.select?.id ? generatedRows : []; }, deleteMany: record('deleteJobs', { count: 0 }) },
  employeeJobAssignment: { findMany: record('assignments', []), deleteMany: record('deleteAssignments', { count: 0 }) },
  jobCompetency: { deleteMany: record('deleteRequirements', { count: 0 }) },
  assessment: { findMany: record('assessments', []) },
  assessorAssignment: { findMany: record('assessorAssignments', []) },
  performanceAppraisal: { findMany: record('appraisals', []) },
  proficiencyLevel: { findMany: record('levels', []) },
  $transaction: async fn => fn(mock),
};
const configPath = require.resolve('../dist/config/prisma');
require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: { prisma: mock } };
process.env.JWT_SECRET = 'isolated-test-secret-not-used-for-real-accounts';
const app = express(); app.use(express.json());
app.use('/talent', require('../dist/routes/talent').default);
app.use('/jobs', require('../dist/routes/jobs').default);

test('talent API access, validation, tenant scope and generated-job cleanup', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, role, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${jwt.sign({ id: role, role, organizationId: org }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    await t.test('recommendations require one person and assessor queries remain tenant scoped', async () => {
      assert.equal((await request('/talent/ai', 'HR', 'POST', { mode: 'succession' })).status, 400);
      assert.equal((await request('/talent/ai', 'HR', 'POST', { mode: 'succession', employeeIds: ['one', 'two'] })).status, 400);
      assert.equal((await request('/talent/ai', 'HR', 'POST', { mode: 'recommendations' })).status, 400);
      assert.equal((await request('/talent/ai', 'HR', 'POST', { mode: 'recommendations', employeeIds: ['one', 'two'] })).status, 400);
      assert.equal((await request('/talent/ai', 'HR', 'POST', { mode: 'recommendations', employeeId: 'one', employeeIds: ['two'] })).status, 400);
      calls.length = 0;
      assert.equal((await request('/talent?includeAssessors=true', 'HR')).status, 200);
      assert.deepEqual(calls.find(c => c.name === 'employees').args.where.role.in, ['EMPLOYEE', 'ASSESSOR']);
      assert.equal(calls.find(c => c.name === 'assessorAssignments').args.where.organizationId, org);
    });
    await t.test('requires authentication and HR role', async () => {
      assert.equal((await request('/talent')).status, 401);
      assert.equal((await request('/talent', 'EMPLOYEE')).status, 403);
      assert.equal((await request('/talent', 'ASSESSOR')).status, 403);
      assert.equal((await request('/talent/ai/status', 'EMPLOYEE')).status, 403);
      assert.equal((await request('/talent/ai', 'ASSESSOR', 'POST', { mode: 'reports' })).status, 403);
    });
    await t.test('AI validates inputs, returns only configuration status and rejects unscoped employee IDs', async () => {
      process.env.OPENAI_API_KEY = 'fictional-test-key';
      const status = await (await request('/talent/ai/status', 'HR')).json();
      assert.equal(status.configured, true); assert.equal(status.apiKey, undefined);
      assert.equal((await request('/talent/ai', 'HR', 'POST', { mode: 'invalid' })).status, 400);
      assert.equal((await request('/talent/ai', 'HR', 'POST', { mode: 'reports', from: '2026-02-31' })).status, 400);
      assert.equal((await request('/talent/ai', 'HR', 'POST', { mode: 'reports', brief: 'x'.repeat(1501) })).status, 400);
      assert.equal((await request('/talent/ai', 'HR', 'POST', { mode: 'reports', reportStyle: 'invalid' })).status, 400);
      assert.equal((await request('/talent/ai', 'HR', 'POST', { mode: 'reports', employeeId: 'foreign' })).status, 404);
      delete process.env.OPENAI_API_KEY;
    });
    await t.test('validates date ranges before reading data', async () => {
      assert.equal((await request('/talent?from=invalid', 'HR')).status, 400);
      assert.equal((await request('/talent?from=2026-10-13&to=2026-01-01', 'HR')).status, 400);
    });
    await t.test('all queries are scoped to the HR organisation and empty data remains empty', async () => {
      calls.length = 0;
      const response = await request('/talent?from=2026-01-01&to=2026-10-13', 'HR');
      assert.equal(response.status, 200);
      const data = await response.json(); assert.deepEqual(data.employees, []);
      assert.equal(calls.length, 6);
      for (const call of calls) assert.equal(call.args.where.organizationId, org);
      assert.deepEqual(calls.find(c => c.name === 'assessments').args.where.status.in, ['COMPLETED', 'REVIEWED']);
      assert.ok(calls.find(c => c.name === 'assignments').args.where.OR);
    });
    await t.test('normal job lists exclude generated jobs, with HR-only cleanup visibility', async () => {
      for (const role of ['EMPLOYEE', 'ASSESSOR', 'HR']) {
        calls.length = 0; assert.equal((await request('/jobs', role)).status, 200);
        assert.deepEqual(calls[0].args.where.OR, [{ title: { not: 'General' } }, { description: null }, { description: { not: 'Auto-created for department assignment' } }]);
      }
      calls.length = 0; await request('/jobs?includeGenerated=true', 'HR'); assert.equal(calls[0].args.where.OR, undefined);
      calls.length = 0; await request('/jobs?includeGenerated=true', 'EMPLOYEE'); assert.ok(calls[0].args.where.OR);
    });
    await t.test('cleanup requires HR and deletes only exact-marker jobs in the same organisation', async () => {
      assert.equal((await request('/jobs/generated', 'EMPLOYEE', 'DELETE')).status, 403);
      calls.length = 0;
      generatedRows = [{ id: 'generated-job-in-own-org' }];
      assert.equal((await request('/jobs/generated', 'HR', 'DELETE')).status, 200);
      const query = calls.find(c => c.name === 'jobs');
      assert.equal(query.args.where.organizationId, org);
      assert.equal(query.args.where.title, 'General');
      assert.equal(query.args.where.description, 'Auto-created for department assignment');
      for (const name of ['deleteJobs', 'deleteRequirements', 'deleteAssignments']) assert.equal(calls.find(c => c.name === name).args.where.organizationId, org);
      assert.deepEqual(calls.find(c => c.name === 'deleteJobs').args.where.id.in, ['generated-job-in-own-org']);
      assert.deepEqual(calls.find(c => c.name === 'deleteAssignments').args.where.jobId.in, ['generated-job-in-own-org']);
      assert.deepEqual(calls.find(c => c.name === 'deleteRequirements').args.where.jobId.in, ['generated-job-in-own-org']);
    });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
