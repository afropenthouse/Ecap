// Browser fixture: in-memory authentication and a mocked AI; never reads real employee data or contacts OpenAI.
const { app } = require('./assessment-test-app.cjs');
const sdkPath = require.resolve('openai');
class MockOpenAI {
  constructor() { this.responses = { create: async body => {
    if (process.env.HELP_FIXTURE_MODE === 'fallback') throw new Error('Simulated unavailable AI provider');
    const input = JSON.parse(body.input);
    const source = input.articles[0];
    return { status: 'completed', output_text: JSON.stringify({ answer: source.summary, steps: source.steps, articleIds: [source.id], followUps: ['What is the difference between competency assessment and performance appraisal?', 'How do I update my profile?'] }) };
  } }; }
}
require.cache[sdkPath] = { id: sdkPath, filename: sdkPath, loaded: true, exports: { __esModule: true, default: MockOpenAI } };
process.env.OPENAI_API_KEY = 'fictional-help-fixture-key';
app.use('/api/help', require('../dist/routes/help').default);
app.listen(4015, '127.0.0.1', () => console.log('Isolated help fixture on localhost:4015. No real database or external AI.'));
