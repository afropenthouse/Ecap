# HRM Office help assistant

Signed-in employees, assessors and HR users can open **Help** from the lower-right corner on workspace pages. The floating panel has an AI conversation and role-appropriate help guides. Users can ask follow-up questions, inspect supporting guides and open the relevant permitted page. On small screens the panel fits within the viewport.

## Knowledge and maintenance

The reviewed product guidance lives in `backend/src/knowledge/help-source.json`. It covers onboarding, permissions, profiles, invitations, departments, competencies, job profiling, assignments, employee and assessor reviews, consensus, gap analysis, performance appraisals, Recommendations, Succession Planning, reports and troubleshooting. Change this source when the product workflow changes.

`backend/scripts/build-help-knowledge.cjs` uses the configured OpenAI model to build two FAQ answers and search keywords for every source article. It sends only the product guidance, never environment files, source code, credentials or database records. Generated FAQs are saved in `backend/src/knowledge/help-enrichment.json` and should be reviewed before deployment. A source fingerprint disables outdated enrichment when the reviewed source changes.

Run from `backend` after approving transmission of these guides to the configured OpenAI API:

```powershell
node scripts/build-help-knowledge.cjs
npm run build
```

The bot itself also uses the existing `OPENAI_API_KEY` and optional `OPENAI_MODEL`; no extra account, database migration, vector database or background job is required. Source JSON is copied to the compiled backend by TypeScript.

## How answers work

`GET /api/help` returns guides authorized for the current account role. `POST /api/help/chat` accepts a question, current pathname and up to eight recent user/assistant messages. The server obtains the role from the authenticated account, retrieves relevant product guides and asks AI to explain them. Answers include steps, validated guide references and suggested follow-up questions. Page links come from approved guides, not model-generated URLs.

The bot does not query employee assessments, appraisals, scores or assignments. It cannot make changes or employment decisions. Users should avoid including private employee data, passwords or tokens in questions. Questions and short conversation history are sent to the configured AI provider with `store: false`; this is not a guarantee of zero retention under the provider's own policies. Conversations are kept in frontend memory, not browser storage or the application database, and reset on reload, new chat or account change.

AI is limited to 12 questions per account per five minutes and one in-flight answer. Help guides remain readable independently of AI; missing configuration, provider failures, timeouts and invalid citations fall back to clearly labelled source-guide instructions.

## Validation

```powershell
cd backend
npm run build
node scripts/help-assistant.test.cjs
```

Tests cover role filtering, retrieval, authentication, spoofed roles, bounded history, invalid citations, rate limits and fallback. `scripts/help-test-app.cjs` is a disposable localhost browser fixture using in-memory accounts and mocked AI, with no production connection.
