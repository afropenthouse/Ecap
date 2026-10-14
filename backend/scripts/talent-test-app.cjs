// Disposable localhost fixture: real talent routes, in-memory evidence, mocked AI provider.
const { app, tables, mock } = require('./assessment-test-app.cjs');
const sdkPath = require.resolve('openai');
class MockOpenAI {
  constructor() { this.responses = { create: async request => {
    const payload = JSON.parse(request.input);
    const person = payload.employees[0];
    if (payload.mode === 'succession' && person.hasCareerEvidence) return { status: 'completed', output_text: JSON.stringify({ title: 'Possible next roles', summary: 'Explore coordination work using the assessed planning strength and performance evidence.',
      findings: [{ category: 'role_suggestion', suggestedRole: 'Project Coordinator', employeeId: person.id, jobId: null, title: 'Explore project coordination', explanation: 'Planning evidence supports exploring coordination work; communication needs development before taking on wider responsibilities.', evidenceIds: [`${person.id}:scores`], actions: ['Try a supervised coordination assignment and review communication evidence.'] }],
      sections: [{ heading: 'Development needs', body: 'Confirm employee interest and relevant experience.', evidenceIds: [`${person.id}:scores`] }], nextSteps: ['Discuss a supervised assignment.'], limitations: ['Fixture AI response for UI verification only.'] }) };
    return { status: 'completed', output_text: JSON.stringify({ title: 'A focused development plan', summary: `Agree practical development goals with ${person.label}.`,
      findings: [{ category: 'coaching', employeeId: person.id, jobId: null, title: 'Agree a measurable next step', explanation: 'Use the available evidence in a development conversation.', evidenceIds: [`${person.id}:scores`], actions: ['Agree one development goal and review the evidence after four weeks.'] }],
      sections: [{ heading: 'Development conversation', body: 'Discuss the evidence and agree practical support.', evidenceIds: [`${person.id}:scores`] }], nextSteps: ['Arrange a development conversation.'], limitations: ['Fixture AI response for UI verification only.'] }) };
  } }; }
}
require.cache[sdkPath] = { id: sdkPath, filename: sdkPath, loaded: true, exports: { __esModule: true, default: MockOpenAI } };
process.env.OPENAI_API_KEY = 'isolated-fixture-not-a-real-key';
const date = new Date('2026-10-01T12:00:00Z');
tables.proficiencyLevel = [1,2,3,4,5].map(levelNumber => ({ id: `level-${levelNumber}`, organizationId: 'test-organization', levelNumber, label: `Level ${levelNumber}` }));
tables.assessment = ['SELF','ASSESSOR'].map(type => ({ id: type.toLowerCase(), organizationId: 'test-organization', employeeId: 'employee', assessorId: type === 'ASSESSOR' ? 'assessor' : null, type, status: type === 'SELF' ? 'COMPLETED' : 'REVIEWED', createdAt: date, completedAt: date }));
tables.assessmentRating = tables.assessment.flatMap(a => tables.competency.map((c,i) => ({ id: `${a.id}-${c.id}`, assessmentId: a.id, competencyId: c.id, rating: a.type === 'SELF' ? (i ? 1 : 5) : (i ? 5 : 1), comment: 'Fixture evidence' })));
tables.performanceAppraisal = [{ id: 'performance', organizationId: 'test-organization', employeeId: 'employee', assessorId: 'assessor', type: 'ASSESSOR', status: 'COMPLETED', createdAt: date, completedAt: date }];
if (!tables.performanceAppraisalQuestion.length) tables.performanceAppraisalQuestion.push({ id: 'delivery', organizationId: 'test-organization', key: 'delivery', title: 'Delivery of agreed objectives', howToMeasure: 'Review completion evidence.', ratingCriteria: '1 to 5', order: 1 });
tables.performanceAppraisalResponse = tables.performanceAppraisalQuestion.map(question => ({ id: `response-${question.id}`, appraisalId: 'performance', questionId: question.id, assessorRating: 4, employeeRating: null }));
mock.job = { findMany: async () => [{ id: 'test-job', title: 'Test Analyst', departmentId: 'test-department', department: { name: 'Test Department' }, requirements: tables.competency.map(c => ({ competencyId: c.id, requiredLevel: 3, competency: { name: c.name } })) }] };
app.use('/api/talent', require('../dist/routes/talent').default);
app.listen(4015, '127.0.0.1', () => console.log('Isolated gap/talent fixture on localhost:4015; no real database or AI provider.'));
