const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildTalentInsights, correlation } = require('../dist/utils/talentInsights');
const now = new Date('2026-10-13T12:00:00Z');
const employee = { id: 'employee', firstName: 'Test', lastName: 'Employee', email: 'test@example.invalid' };
const job = { id: 'job', title: 'Team lead', description: '', departmentId: 'department', department: { name: 'Operations' }, requirements: [{ competencyId: 'skill', competency: { name: 'Leadership' }, requiredLevel: 4 }] };
const assessment = (overrides = {}) => ({ id: 'assessment', employeeId: employee.id, assessorId: 'assessor', type: 'ASSESSOR', status: 'REVIEWED', createdAt: now, completedAt: now, ratings: [{ competencyId: 'skill', rating: 4 }], ...overrides });
const appraisal = (overrides = {}) => ({ id: 'appraisal', employeeId: employee.id, assessorId: 'assessor', type: 'ASSESSOR', status: 'COMPLETED', createdAt: now, completedAt: now, responses: [{ assessorRating: 4, employeeRating: null }], ...overrides });
const build = (overrides = {}) => buildTalentInsights({ employees: [employee], jobs: [job], assignments: [], assessments: [assessment()], appraisals: [appraisal()], maxLevel: 5, from: new Date('2025-01-01'), to: new Date('2026-10-14'), now, ...overrides });

test('completed assessor reviews remain available when performance appraisal is missing', () => {
  for (const status of ['COMPLETED', 'REVIEWED']) {
    const person = build({ assessments: [assessment({ status })], appraisals: [] }).employees[0];
    assert.equal(person.competency, 80);
    assert.equal(person.source, 'ASSESSOR');
    assert.equal(person.performance, null);
    assert.equal(person.aligned, false);
  }
});

test('actual company roles remain visible without employees or readiness evidence', () => {
  const jobs = ['IT Support Officer', 'HR Officer', 'Procurement Officer'].map((title, index) => ({ ...job, id: `role-${index}`, title, requirements: [] }));
  const report = build({ employees: [], jobs, assessments: [], appraisals: [] });
  assert.deepEqual(report.companyRoles.map(role => role.title), jobs.map(role => role.title));
  assert.ok(report.companyRoles.every(role => role.requirementCount === 0));
  assert.deepEqual(report.employees, []);
});

test('assessor recommendations use review activity without inferring own performance or succession readiness', () => {
  const report = build({ employees: [{ ...employee, id: 'assessor', role: 'ASSESSOR' }], assessorAssignments: [{ assessorId: 'assessor', employeeId: 'employee' }, { assessorId: 'assessor', employeeId: 'employee' }],
    assessments: [assessment({ ratings: [{ competencyId: 'skill', rating: 4, comment: 'Evidence recorded' }] }), assessment({ type: 'SELF', assessorId: null, createdAt: new Date('2026-09-01'), ratings: [{ competencyId: 'skill', rating: 2 }] }), assessment({ type: 'SELF', assessorId: null, createdAt: new Date('2026-10-14'), ratings: [{ competencyId: 'skill', rating: 5 }] })] });
  const person = report.employees[0];
  assert.equal(person.role, 'ASSESSOR');
  assert.equal(person.competency, null); assert.equal(person.performance, null);
  assert.deepEqual(person.roleMatches, []); assert.deepEqual(report.succession[0].candidates, []);
  assert.equal(person.assessorActivity.assignedEmployees, 1);
  assert.equal(person.assessorActivity.competencyReviews, 1);
  assert.equal(person.assessorActivity.performanceReviews, 1);
  assert.equal(person.assessorActivity.reviewedEmployees, 1);
  assert.equal(person.assessorActivity.commentedRatings, 1);
  assert.equal(person.assessorActivity.meanSelfDifference, 2);
});

test('all requirements met and strong performance suggests successor for HR review', () => {
  const report = build();
  assert.equal(report.employees[0].roleMatches[0].readiness, 'Ready for HR review');
  assert.equal(report.succession[0].candidates.length, 1);
  assert.equal(report.employees[0].competency, 80);
});
test('missing evidence remains unassessed and cannot produce successor', () => {
  const report = build({ assessments: [] });
  assert.equal(report.employees[0].competency, null);
  assert.equal(report.employees[0].roleMatches[0].gaps[0].currentLevel, null);
  assert.equal(report.succession[0].candidates.length, 0);
});
test('self-only ratings and drafts do not establish readiness', () => {
  const report = build({ assessments: [assessment({ type: 'SELF' }), assessment({ status: 'IN_PROGRESS' })], appraisals: [appraisal({ type: 'SELF', responses: [{ employeeRating: 5, assessorRating: null }] })] });
  assert.equal(report.employees[0].performance, null);
  assert.equal(report.employees[0].selfPerformance, 100);
  assert.equal(report.succession[0].candidates.length, 0);
});
test('partial coverage blocks readiness even if assessed competencies exceed requirements', () => {
  const report = build({ jobs: [{ ...job, requirements: [...job.requirements, { competencyId: 'other', competency: { name: 'Planning' }, requiredLevel: 2 }] }] });
  assert.equal(report.employees[0].roleMatches[0].coverage, 50);
  assert.equal(report.employees[0].roleMatches[0].readiness, 'Insufficient evidence');
});
test('newer completed assessor record overrides older consensus and ignores new drafts', () => {
  const report = build({ assessments: [assessment({ type: 'CONSENSUS', assessorId: null, completedAt: new Date('2026-09-01'), ratings: [{ competencyId: 'skill', rating: 1 }] }), assessment(), assessment({ status: 'PENDING', ratings: [] })] });
  assert.equal(report.employees[0].source, 'ASSESSOR');
  assert.equal(report.employees[0].competency, 80);
});
test('latest consensus supersedes assessor evidence', () => {
  const report = build({ assessments: [assessment(), assessment({ type: 'CONSENSUS', assessorId: null, ratings: [{ competencyId: 'skill', rating: 5 }] })] });
  assert.equal(report.employees[0].source, 'CONSENSUS');
  assert.equal(report.employees[0].competency, 100);
});
test('uses latest per assessor and averages independent assessor sources', () => {
  const report = build({ assessments: [assessment(), assessment({ completedAt: new Date('2026-09-01'), ratings: [{ competencyId: 'skill', rating: 1 }] }), assessment({ assessorId: 'second', ratings: [{ competencyId: 'skill', rating: 2 }] })] });
  assert.equal(report.employees[0].roleMatches[0].gaps[0].currentLevel, 3);
});
test('different review periods and stale evidence block succession', () => {
  assert.equal(build({ assessments: [assessment({ completedAt: new Date('2026-01-01') })] }).succession[0].candidates.length, 0);
  assert.equal(build({ assessments: [assessment({ completedAt: new Date('2025-01-01') })], appraisals: [appraisal({ completedAt: new Date('2025-01-01') })] }).succession[0].candidates.length, 0);
});
test('no requirements never implies full role match', () => {
  const report = build({ jobs: [{ ...job, requirements: [] }] });
  assert.equal(report.employees[0].roleMatches[0].fit, null);
  assert.equal(report.succession[0].candidates.length, 0);
});
test('current-role gaps produce specific training actions and omit incumbent from succession', () => {
  const report = build({ assignments: [{ employeeId: employee.id, jobId: job.id }], assessments: [assessment({ ratings: [{ competencyId: 'skill', rating: 3 }] })] });
  assert.match(report.employees[0].recommendations.find(r => r.kind === 'TRAINING').actions[0], /Leadership: current 3, required 4/);
  assert.equal(report.succession[0].candidates.length, 0);
});
test('role match and performance establish needs-development category', () => {
  const report = build({ assessments: [assessment({ ratings: [{ competencyId: 'skill', rating: 3.5 }] })], appraisals: [appraisal({ responses: [{ assessorRating: 3, employeeRating: null }] })] });
  assert.equal(report.employees[0].roleMatches[0].readiness, 'Needs development');
});
test('configured proficiency maximum changes competency normalization', () => {
  assert.equal(build({ maxLevel: 8 }).employees[0].competency, 50);
});
test('includes named competency and appraisal factors for actionable AI evidence', () => {
  const report = build({ assessments: [assessment({ ratings: [{ competencyId: 'skill', rating: 4, competency: { name: 'Leadership' } }] })], appraisals: [appraisal({ responses: [{ questionId: 'delivery', question: { title: 'Delivery of objectives', key: 'delivery' }, assessorRating: 4, employeeRating: null }] })] });
  assert.equal(report.employees[0].competencyRatings[0].name, 'Leadership');
  assert.equal(report.employees[0].performanceFactors[0].title, 'Delivery of objectives');
  assert.equal(report.employees[0].performanceFactors[0].assessorScore, 80);
});
test('excludes only generated General jobs, preserving legitimate roles named General', () => {
  const report = build({ jobs: [{ ...job, title: 'General', description: 'Auto-created for department assignment' }, { ...job, id: 'real', title: 'General', description: 'Real role' }] });
  assert.deepEqual(report.succession.map(r => r.jobId), ['real']);
});
test('correlation handles positive/negative associations, small samples and constant scores', () => {
  assert.equal(correlation([[1, 2], [2, 4], [3, 6]]), 1);
  assert.equal(correlation([[1, 6], [2, 4], [3, 2]]), -1);
  assert.equal(correlation([[1, 2], [2, 3]]), null);
  assert.equal(correlation([[1, 2], [1, 3], [1, 4]]), null);
});
test('empty organisation produces genuine empty results', () => {
  const report = build({ employees: [], jobs: [], assessments: [], appraisals: [] });
  assert.deepEqual(report.employees, []);
  assert.deepEqual(report.succession, []);
});
