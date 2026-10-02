# Configuration and deployment

This guide covers local setup, deployment, and the external services used by HRM Office. Keep real credentials in private environment settings; never commit `.env` files.

## Local development

Install dependencies in each app:

```sh
cd backend && npm install
cd ../frontend && npm install
```

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`, then fill in the required values. Generate the Prisma client and apply local migrations:

```sh
cd backend
npm run prisma:generate
npm run prisma:migrate:dev
npm run dev
```

In a second terminal:

```sh
cd frontend
npm run dev
```

The API defaults to `http://localhost:4000`; Vite defaults to `http://localhost:5173`.

## Environment variables

### Backend

| Variable | Purpose | Notes |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma | Neon is the current host. Another PostgreSQL-compatible provider can be used by replacing the connection URL. Apply the checked-in Prisma migrations to the new database before use. |
| `JWT_SECRET` | Signs and verifies API session tokens | Use a long, random, private value. |
| `PORT` | API listening port | Defaults to `4000`; set the port assigned by your hosting provider. |
| `CORS_ORIGIN` | Allowed frontend origins | A comma-separated list of exact origins, such as your local and production frontend URLs. |
| `FRONTEND_URL` | Public frontend address used in email links and the email logo | Set this to the deployed frontend's public HTTPS origin, without a trailing slash. A localhost value will not be reachable by email recipients. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Sends transactional email | Use credentials from an SMTP provider such as Amazon SES, Postmark SMTP, SendGrid SMTP, or your mail host. Production verification, invitation, and recovery emails require working SMTP configuration. |
| `SMTP_DEBUG` | Nodemailer connection diagnostics | Optional; keep `false` in production. |
| `SMTP_RETRIES` | Retries transient delivery errors | Optional; defaults to `3`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image upload credentials | Cloudinary account credentials. Uploads remain unavailable until configured. |
| `NODE_ENV` | Runtime mode | Set to `production` on the deployed API. |

### Frontend

| Variable | Purpose | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Express API address | Set to the deployed API URL plus `/api`. |
| `VITE_API_TIMEOUT_MS` | API request timeout | Optional; defaults to `30000`. |
| `VITE_W3FORMS_FORM_ID` | Public form ID used by Book a Demo | Create/configure a W3Forms form and set its public form ID. Switching form providers requires changing the submission code. |

Every `VITE_*` value is included in browser code and is public. Never put database credentials, SMTP passwords, Cloudinary secrets, or `JWT_SECRET` in a frontend variable.

## Hosting

The frontend can be deployed as a static site; the backend must run as a Node web service. Configure the variables above in each hosting service’s environment settings. The frontend build needs `VITE_API_BASE_URL` and `VITE_W3FORMS_FORM_ID` at build time.

Before serving traffic, apply production database migrations from the backend:

```sh
npm run prisma:migrate:deploy
```

A database URL can usually be switched through `DATABASE_URL` if the replacement is PostgreSQL-compatible. SMTP can usually be switched through credentials when the provider supports standard SMTP. Replacing Cloudinary or W3Forms requires an implementation change because their APIs are directly integrated in the current code.

## Current external services

- **PostgreSQL** stores organization and HR data; Prisma manages the schema and migrations.
- **SMTP** sends verification, invitation, welcome, and recovery emails.
- **Cloudinary** stores uploaded images.
- **W3Forms** receives Book a Demo form submissions.

The core HR records, assessments, competency framework, gap analysis, and job assignments are served by the HRM Office API. They do not require separate third-party APIs.
