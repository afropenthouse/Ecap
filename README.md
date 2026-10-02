# HRM Office

HRM Office is a multi-organization HR management app. The React/Vite frontend calls an Express API; the API uses Prisma ORM with PostgreSQL on Neon.

## Stack

- Frontend: React, TypeScript, Vite
- API: Node.js, Express, TypeScript
- Data: Neon PostgreSQL, Prisma ORM
- Roles: HR, Assessor, Employee

Each user belongs to one organization. Authentication uses the organization ID, not an organization slug. HR administrators can edit their company profile and invite team members. Invitees set their own password from a time-limited email link. HRM Office is the platform; HR users administer their own organization only.

## Local setup

Install dependencies in each app:

```sh
cd backend && npm install
cd ../frontend && npm install
```

Set `DATABASE_URL` in `backend/.env` to the PostgreSQL connection string from Neon. Keep this file private. Add the API's other required environment values there, including `JWT_SECRET`; configure SMTP values to deliver verification, recovery, and invitation emails. Set `FRONTEND_URL` to the frontend origin used in email links.

Generate the Prisma client and apply local migrations:

```sh
cd backend
npm run prisma:generate
npm run prisma:migrate:dev
npm run dev
```

In another terminal:

```sh
cd frontend
npm run dev
```

The API defaults to `http://localhost:4000` and the frontend to `http://localhost:5173`. Set `VITE_API_BASE_URL` in `frontend/.env` if your API uses a different address.

## Production database migrations

Apply checked-in migrations during deployment with:

```sh
cd backend
npm run prisma:migrate:deploy
```

The current migration removes the obsolete organization slug and adds secure, expiring team invitations. Use `npm run prisma:studio` in the backend to inspect the database.
## Environment variables and external services

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`. The example files contain names and safe placeholders only. Never commit real `.env` files.

### Backend configuration

| Variable | Purpose | Provider / notes |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma | Neon is the current host. Any compatible PostgreSQL provider can be used by replacing this URL. Keep `sslmode=require` where the host requires TLS. Apply schema changes with the Prisma migration scripts. |
| `JWT_SECRET` | Signs and verifies API session tokens | Generate a long, random, private secret. No external API account is needed. |
| `PORT` | API listening port | Set to the port assigned by your API host; defaults to `4000`. |
| `CORS_ORIGIN` | Allowed browser origins | Comma-separated exact origins, for example local and production frontend URLs. |
| `FRONTEND_URL` | Links included in account emails | Set to the deployed frontend origin, without a trailing slash. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Transactional email delivery | Credentials from any SMTP provider (for example Amazon SES, Postmark SMTP, SendGrid SMTP, or a company mail server). Production signup, invitation, verification, and recovery emails require these. |
| `SMTP_DEBUG` | Nodemailer protocol diagnostics | Optional; keep `false` in production. |
| `SMTP_RETRIES` | Retry count for transient email failures | Optional; defaults to `3`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Profile and organization image uploads | Cloudinary account credentials. Uploads remain disabled until configured. |
| `NODE_ENV` | Runtime environment behavior | Use `production` in production deployments. |

### Frontend configuration

| Variable | Purpose | Provider / notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Base URL for the Express API | Point this to your deployed API plus `/api`. |
| `VITE_API_TIMEOUT_MS` | API request timeout in milliseconds | Optional; defaults to `30000`. |
| `VITE_W3FORMS_FORM_ID` | Public form ID for the Book a Demo form | Create/configure a W3Forms form and enter its public form ID. This is browser-visible by design; do not put a private API key here. Replacing W3Forms with another demo lead service requires changing the form submission code, not just an environment variable. |

Vite variables are bundled into client-side JavaScript. Treat all `VITE_*` values as public. Keep database credentials, SMTP passwords, Cloudinary secrets, and the JWT secret on the backend only.

### Service switching

- **PostgreSQL host:** usually environment-only; use a PostgreSQL-compatible provider and update `DATABASE_URL`. Prisma migrations must be applied to the new database before serving traffic.
- **SMTP provider:** usually environment-only when the provider offers standard SMTP credentials. A provider requiring a custom API may need a mail adapter/code change.
- **Image hosting:** Cloudinary is currently wired into the upload endpoint. Switching to S3, R2, or another host requires replacing the upload adapter and its environment variables.
- **Demo form provider:** W3Forms is called directly from the browser. Switching providers requires replacing the endpoint/payload in `BookDemoPage` or adding a backend proxy; the form ID alone is not provider-neutral.
- **Authentication:** local JWT auth is implemented by this API. Google OAuth is not configured; add an OAuth provider and callback implementation before offering social login.

The API does not require a separate paid API for its core HR records, assessments, competency framework, gap analytics, or job assignments; those are served by this backend and stored in PostgreSQL.
