const { test } = require('node:test');
const assert = require('node:assert/strict');
let requests = [];
let responseError = null;
let responseAdvice = null;
class MockAPIError extends Error { constructor(status, code) { super('Provider error'); this.status = status; this.code = code; } }
const adviceFor = payload => ({ title: 'Development review', summary: 'Review assessment evidence with HR.',
  findings: [{ category: 'training', employeeId: payload.employees[0].id, jobId: null, title: 'Agree development goals', explanation: 'Use the completed evidence to guide development.', evidenceIds: [`${payload.employees[0].id}:scores`], actions: ['Agree measurable goals and review after supervised practice.'] }],
  sections: [{ heading: 'Evidence', body: 'HR must verify readiness.', evidenceIds: ['period'] }], nextSteps: ['HR reviews this draft.'], limitations: ['No automatic role assignment.'] });
class MockOpenAI {
  static APIError = MockAPIError;
  constructor(options) {
    this.responses = { create: async body => {
      requests.push({ options, body });
      if (responseError) throw responseError;
      const payload = JSON.parse(body.input);
      return { status: 'completed', output_text: JSON.stringify(responseAdvice ? responseAdvice(payload) : adviceFor(payload)) };
    } };
  }
}
const sdkPath = require.resolve('openai');
require.cache[sdkPath] = { id: sdkPath, filename: sdkPath, loaded: true, exports: { __esModule: true, default: MockOpenAI } };
const { prepareTalentEvidence, validateAdvice, normalizeAdvice, schemaForEvidence, requireSpecificRoles, generateTalentAdvice, aiConfiguration } = require('../dist/utils/talentAI');
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
const { talentPeriod } = require('../dist/utils/talentData');
// talentData imports database configuration; this dummy URL never connects in these tests.
const role = { jobId: 'job', title: 'Lead', departmentId: 'dep', department: 'Operations', current: false, coverage: 100, fit: 100, readiness: 'Ready for HR review', gaps: [{ competencyId: 'skill', competency: 'Planning', requiredLevel: 4, currentLevel: 4, gap: 0 }] };
const employee = { id: 'employee', firstName: 'PRIVATE-FIRST', lastName: 'PRIVATE-LAST', email: 'private@example.invalid', competency: 80, performance: 80, selfCompetency: 100, selfPerformance: 100, source: 'CONSENSUS', competencyDate: '2026-10-01', performanceDate: '2026-10-02', aligned: true, fresh: true, currentJobIds: [], roleMatches: [role], recommendations: [], history: [] };
const report = { from: '2026-01-01', to: '2026-10-13', generatedAt: '2026-10-13', employees: [employee], correlations: [{ jobId: 'job', title: 'Lead', coefficient: null, sampleSize: 1 }], succession: [] };

test('AI evidence preparation, validation and provider handling', async t => {
  await t.test('succession output requires named roles, not general development advice', () => {
    const payload = prepareTalentEvidence(report, { mode: 'succession', employeeId: employee.id });
    const findings = schemaForEvidence(payload).properties.findings;
    assert.equal(findings.minItems, 1); assert.equal(findings.maxItems, 3);
    assert.deepEqual(findings.items.properties.category.enum, ['role_suggestion']);
    assert.equal(findings.items.properties.suggestedRole.type, 'string');
    assert.throws(() => requireSpecificRoles(adviceFor(payload), payload), /specific job titles/);
    const advice = adviceFor(payload);
    advice.findings[0] = { ...advice.findings[0], category: 'role_suggestion', suggestedRole: 'Project Coordinator' };
    assert.doesNotThrow(() => requireSpecificRoles(advice, payload));
    advice.findings.push({ ...advice.findings[0] });
    assert.throws(() => requireSpecificRoles(advice, payload), /specific job titles/);
  });
  await t.test('generic provider answer is corrected once into a specific role without requiring performance', async () => {
    process.env.OPENAI_API_KEY = 'fictional-test-key'; requests = [];
    responseAdvice = payload => {
      const advice = adviceFor(payload);
      if (requests.length > 1) advice.findings[0] = { ...advice.findings[0], category: 'role_suggestion', suggestedRole: 'Project Coordinator' };
      return advice;
    };
    try {
      const result = await generateTalentAdvice('specific-role-correction-org', { ...report, employees: [{ ...employee, performance: null }] }, { mode: 'succession', employeeId: employee.id });
      assert.equal(requests.length, 2);
      assert.equal(result.advice.findings[0].suggestedRole, 'Project Coordinator');
      assert.equal(result.advice.findings[0].roleAvailability, 'Not listed in company');
      assert.match(requests[1].body.instructions, /previous answer did not contain specific job titles/);
    } finally { responseAdvice = null; delete process.env.OPENAI_API_KEY; }
  });
  await t.test('repeated generic replies never become cached successful role suggestions', async () => {
    process.env.OPENAI_API_KEY = 'fictional-test-key'; requests = [];
    try {
      await assert.rejects(generateTalentAdvice('generic-role-failure-org', report, { mode: 'succession', employeeId: employee.id }), /specific job titles/);
      assert.equal(requests.length, 2);
      await assert.rejects(generateTalentAdvice('generic-role-failure-org', report, { mode: 'succession', employeeId: employee.id }), /specific job titles/);
      assert.equal(requests.length, 4);
    } finally { delete process.env.OPENAI_API_KEY; }
  });
  await t.test('career suggestions can name new occupations without inventing company job IDs', () => {
    const payload = prepareTalentEvidence(report, { mode: 'succession', employeeId: employee.id });
    const schema = schemaForEvidence(payload);
    assert.ok(schema.properties.findings.items.properties.category.enum.includes('role_suggestion'));
    const advice = adviceFor(payload);
    advice.findings[0] = { ...advice.findings[0], category: 'role_suggestion', jobId: null, suggestedRole: 'Project Coordinator' };
    assert.equal(validateAdvice(advice, payload).findings[0].suggestedRole, 'Project Coordinator');
    advice.findings[0].jobId = 'invented-company-job';
    assert.throws(() => validateAdvice(advice, payload), /verify/);
    advice.findings[0].jobId = null;
    assert.throws(() => validateAdvice(advice, prepareTalentEvidence(report, { mode: 'recommendations' })), /verify/);
    const competencyOnly = prepareTalentEvidence({ ...report, employees: [{ ...employee, performance: null }] }, { mode: 'succession' });
    assert.equal(validateAdvice(advice, competencyOnly).findings[0].suggestedRole, 'Project Coordinator');
    assert.ok(schemaForEvidence(competencyOnly).properties.findings.items.properties.category.enum.includes('role_suggestion'));
    const incomplete = prepareTalentEvidence({ ...report, employees: [{ ...employee, competency: null, performance: null }] }, { mode: 'succession' });
    assert.throws(() => validateAdvice(advice, incomplete), /verify/);
    assert.ok(!schemaForEvidence(incomplete).properties.findings.items.properties.category.enum.includes('role_suggestion'));
  });
  await t.test('role exploration names company jobs without inventing readiness or vacancies', () => {
    const payload = prepareTalentEvidence({ ...report, employees: [{ ...employee, roleMatches: [{ ...role, title: 'Procurement Officer', readiness: 'Insufficient evidence', fit: null }] }] }, { mode: 'succession' });
    assert.match(payload.evidence.find(item => item.id === 'company-roles').fact, /Procurement Officer/);
    assert.match(payload.evidence.find(item => item.id === 'company-roles').fact, /does not establish an open vacancy/);
    assert.deepEqual(payload.employees[0].eligibleSuccessionJobIds, []);
    const advice = adviceFor(payload);
    advice.findings[0] = { ...advice.findings[0], category: 'assessment', jobId: 'job', evidenceIds: ['employee:role:job'], title: 'Assess requirements for Procurement Officer' };
    assert.equal(validateAdvice(advice, payload).findings[0].jobId, 'job');
    advice.findings[0].category = 'succession';
    assert.throws(() => validateAdvice(advice, payload), /verify/);
  });
  await t.test('assessor evidence uses an anonymised reviewer perspective and cannot create succession readiness', () => {
    const payload = prepareTalentEvidence({ ...report, employees: [{ ...employee, role: 'ASSESSOR', roleMatches: [], assessorActivity: { assignedEmployees: 2, competencyReviews: 3, performanceReviews: 1, reviewedEmployees: 2, commentedRatings: 4, totalRatings: 6, meanSelfDifference: 1, comparisonCount: 6, lastReviewAt: '2026-10-01' } }] }, { mode: 'recommendations', employeeId: employee.id });
    assert.equal(payload.employees[0].label, 'Assessor 1');
    assert.deepEqual(payload.employees[0].eligibleSuccessionJobIds, []);
    assert.doesNotMatch(JSON.stringify(payload), /PRIVATE-FIRST|PRIVATE-LAST|private@example/);
    assert.match(JSON.stringify(payload), /calibration|review activity/i);
    assert.match(JSON.stringify(payload), /No own competency or performance rating/);
  });
  await t.test('excludes employee names, emails and private comments', () => {
    const payload = prepareTalentEvidence(report, { mode: 'recommendations' });
    assert.doesNotMatch(JSON.stringify(payload), /PRIVATE-FIRST|PRIVATE-LAST|private@example/);
    assert.match(JSON.stringify(payload), /self competency 100/);
  });
  await t.test('scopes report departments to current employees and rejects unknown identifiers', () => {
    assert.throws(() => prepareTalentEvidence(report, { mode: 'reports', departmentId: 'dep' }), /No employees match/);
    assert.throws(() => prepareTalentEvidence(report, { mode: 'reports', employeeId: 'foreign' }), /Employee not found/);
    assert.throws(() => prepareTalentEvidence(report, { mode: 'reports', jobId: 'foreign' }), /Job not found/);
    assert.throws(() => prepareTalentEvidence(report, { mode: 'reports', employeeIds: ['foreign'] }), /not found/);
    const subset = prepareTalentEvidence({ ...report, employees: [employee, { ...employee, id: 'other' }] }, { mode: 'succession', employeeIds: ['other'] });
    assert.deepEqual(subset.employees.map(e => e.id), ['other']);
  });
  await t.test('missing evidence cannot create successor eligibility', () => {
    const payload = prepareTalentEvidence({ ...report, employees: [{ ...employee, competency: null, performance: null, roleMatches: [{ ...role, readiness: 'Insufficient evidence' }] }] }, { mode: 'succession' });
    assert.deepEqual(payload.employees[0].eligibleSuccessionJobIds, []);
    const advice = adviceFor(payload); advice.findings[0].category = 'succession'; advice.findings[0].jobId = 'job';
    assert.throws(() => validateAdvice(advice, payload), /verify/);
    const partial = normalizeAdvice(advice, payload);
    assert.equal(partial.findings.length, 0);
    assert.equal(partial.sections.length, 1);
    assert.match(partial.limitations.join(' '), /omitted/);
  });
  await t.test('rejects invented citations and another employee evidence', () => {
    const payload = prepareTalentEvidence({ ...report, employees: [employee, { ...employee, id: 'other' }] }, { mode: 'reports' });
    let advice = adviceFor(payload); advice.findings[0].evidenceIds = ['invented']; assert.throws(() => validateAdvice(advice, payload), /verify/);
    advice = adviceFor(payload); advice.findings[0].evidenceIds = ['other:scores']; assert.throws(() => validateAdvice(advice, payload), /verify/);
  });
  await t.test('repairs known labels and missing pair references while preserving valid analysis', () => {
    const payload = prepareTalentEvidence(report, { mode: 'succession' });
    const advice = adviceFor(payload);
    advice.findings[0].employeeId = 'Employee 1'; advice.findings[0].category = 'succession'; advice.findings[0].jobId = 'job';
    const normalized = normalizeAdvice(advice, payload);
    assert.equal(normalized.findings[0].employeeId, 'employee');
    assert.ok(normalized.findings[0].evidenceIds.includes('employee:role:job'));
    advice.findings.push({ ...advice.findings[0], employeeId: 'invented-person' });
    assert.equal(normalizeAdvice(advice, payload).findings.length, 1);
  });
  await t.test('provider schema restricts reference IDs and disallows unsupported successor categories', () => {
    const payload = prepareTalentEvidence({ ...report, employees: [{ ...employee, roleMatches: [] }] }, { mode: 'reports', brief: 'Write a training plan', reportStyle: 'development' });
    const schema = schemaForEvidence(payload);
    assert.deepEqual(schema.properties.findings.items.properties.employeeId.enum, ['employee', null]);
    assert.ok(!schema.properties.findings.items.properties.category.enum.includes('succession'));
    assert.ok(schema.properties.sections.items.properties.evidenceIds.items.enum.includes('employee:scores'));
    assert.equal(payload.focus, 'Write a training plan'); assert.equal(payload.reportStyle, 'development');
  });
  await t.test('validates calendar dates including impossible dates', () => {
    assert.throws(() => talentPeriod('2026-02-31', '2026-10-13'));
    assert.throws(() => talentPeriod('2026-10-13', '2026-01-01'));
    assert.equal(talentPeriod('2026-02-28', '2026-10-13').from.toISOString().slice(0, 10), '2026-02-28');
  });
  await t.test('calls provider with structured output, no storage, and caches identical tenant evidence', async () => {
    process.env.OPENAI_API_KEY = 'fictional-test-key'; process.env.OPENAI_MODEL = 'test-model';
    requests = [];
    const result = await generateTalentAdvice('cache-org', report, { mode: 'reports' });
    assert.equal(result.cached, false);
    assert.equal(requests[0].body.store, false);
    assert.equal(requests[0].body.text.format.strict, true);
    assert.equal(requests[0].options.maxRetries, 0);
    assert.equal((await generateTalentAdvice('cache-org', report, { mode: 'reports' })).cached, true);
    assert.equal(requests.length, 1);
    await assert.rejects(generateTalentAdvice('cache-org', { ...report, employees: [{ ...employee, performance: 60 }] }, { mode: 'reports' }), /wait 30 seconds/);
    await generateTalentAdvice('separate-org', report, { mode: 'reports' }); assert.equal(requests.length, 2);
  });
  await t.test('quota failures produce actionable fallback messages and never expose secrets', async () => {
    responseError = new MockAPIError(429, 'insufficient_quota');
    await assert.rejects(generateTalentAdvice('quota-org', report, { mode: 'reports' }), /credits are unavailable/);
    responseError = null;
  });
  await t.test('configuration status never exposes the key', () => {
    assert.equal(aiConfiguration().configured, true);
    assert.doesNotMatch(JSON.stringify(aiConfiguration()), /fictional-test-key/);
  });
});
