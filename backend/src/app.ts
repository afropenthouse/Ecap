import express, { Request, Response } from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import rolesRouter from './routes/roles';
import orgRouter from './routes/organizations';
import depRouter from './routes/departments';
import jobsRouter from './routes/jobs';
import compRouter from './routes/competencies';
import assessRouter from './routes/assessments';
import analyticsRouter from './routes/analytics';
import uploadsRouter from './routes/uploads';
import assignmentsRouter from './routes/assignments';
import jobAssignmentsRouter from './routes/employeeJobAssignments';
import employeesRouter from './routes/employees';
import appraisalsRouter from './routes/appraisals';
import { isPostmarkConfigured, verifyPostmark } from './utils/email';

const app = express();

app.use(express.json());

// Keep known frontend origins available while allowing deployments to add their own.
const configuredOrigins = (process.env.CORS_ORIGIN || '').split(',').map(origin => origin.trim().replace(/\/+$/, '')).filter(Boolean);
const allowedOrigins = new Set([
  'https://hrmecap.vercel.app',
  'https://ecap-project.vercel.app',
  'https://ecap-project.onrender.com',
  'http://localhost:5173',
  'ecap-project.vercel.app',
  ...configuredOrigins,
]);

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // If no origin (e.g., server-to-server), allow it
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};
app.use(cors(corsOptions));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'hrmoffice-backend' });
});

// Email provider health verification
const emailHealthCheck = async (_req: Request, res: Response) => {
  try {
    if (!isPostmarkConfigured()) return res.json({ provider: 'postmark', configured: false, verified: false });
    return res.json({ provider: 'postmark', ...await verifyPostmark() });
  } catch (e: any) {
    return res.json({ provider: 'postmark', configured: true, verified: false, error: String(e?.message || e) });
  }
};
app.get('/health/email', emailHealthCheck);
// Keep the former endpoint working for existing deployment checks.
app.get('/health/smtp', emailHealthCheck);

// Root route - useful for Render/Vercel probes and quick checks
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'HRM Office API', base: '/api' });
});

// Routes will be mounted here
app.use('/api/auth', authRouter);
app.use('/api/organizations', orgRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/departments', depRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/competencies', compRouter);
app.use('/api/assessments', assessRouter);
app.use('/api/appraisals', appraisalsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/job-assignments', jobAssignmentsRouter);
app.use('/api/employees', employeesRouter);

export default app;
