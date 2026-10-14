// Optional live API test using fictional employee evidence only.
require('dotenv').config({ quiet: true });
const { generateTalentAdvice } = require('../dist/utils/talentAI');
const { buildTalentInsights } = require('../dist/utils/talentInsights');
const mode = process.argv[2] || 'reports';
let report = {
  from: '2026-01-01T00:00:00Z', to: '2026-10-13T23:59:59Z', generatedAt: new Date().toISOString(),
  employees: [{ id: 'fictional-test-employee', firstName: 'Fictional', lastName: 'Test', email: 'test@example.invalid',
    competency: null, performance: null, selfCompetency: null, selfPerformance: null, source: null,
    competencyDate: null, performanceDate: null, aligned: false, fresh: false, currentJobIds: [], roleMatches: [], recommendations: [], history: [] }], correlations: [], succession: [],
};
if (process.argv.includes('--with-evidence')) {
  const now = new Date();
  report = buildTalentInsights({
    employees: [{ id: 'fictional-test-employee', firstName: 'Fictional', lastName: 'Test', email: 'test@example.invalid' }],
    jobs: [
      { id: 'current-role', title: 'Operations officer', departmentId: 'test-department', department: { name: 'Operations' }, requirements: [{ competencyId: 'planning', competency: { name: 'Planning' }, requiredLevel: 5 }] },
      { id: 'target-role', title: 'Project coordinator', departmentId: 'test-department', department: { name: 'Operations' }, requirements: [{ competencyId: 'planning', competency: { name: 'Planning' }, requiredLevel: 3 }] },
    ],
    assignments: [{ employeeId: 'fictional-test-employee', jobId: 'current-role' }],
    assessments: [{ employeeId: 'fictional-test-employee', assessorId: 'fictional-assessor', type: 'ASSESSOR', status: 'REVIEWED', createdAt: now, completedAt: now, ratings: [{ competencyId: 'planning', rating: 4 }] }],
    appraisals: [{ employeeId: 'fictional-test-employee', assessorId: 'fictional-assessor', type: 'ASSESSOR', status: 'COMPLETED', createdAt: now, completedAt: now, responses: [{ assessorRating: 4, employeeRating: null }] }],
    from: new Date(Date.now() - 86400000), to: now, maxLevel: 5, now,
  });
}
generateTalentAdvice('fictional-test-organisation', report, { mode }).then(result => {
  console.log(JSON.stringify({ success: true, mode, model: result.model, sections: result.advice.sections.length, findings: result.advice.findings.length, hasMissingEvidenceExplanation: /missing|no completed|not assessed|unassessed|unavailable/i.test(JSON.stringify(result.advice)), successionFindings: result.advice.findings.filter(f => f.category === 'succession').length, trainingFindings: result.advice.findings.filter(f => f.category === 'training').length }));
}).catch(error => { console.error(JSON.stringify({ success: false, status: error.status, message: error.message })); process.exitCode = 1; });
