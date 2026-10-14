import { Router, Request, Response } from 'express';
import { authMiddleware, rbac } from '../middleware/auth';
import { loadTalentReport, talentPeriod } from '../utils/talentData';
import { aiConfiguration, generateTalentAdvice, TalentAIError } from '../utils/talentAI';

const router = Router();
router.use(authMiddleware, rbac(['HR']));
router.get('/', async (req: Request, res: Response) => {
  let period;
  try { period = talentPeriod(req.query.from, req.query.to); }
  catch { return res.status(400).json({ error: 'Choose a valid date range.' }); }
  try { res.json(await loadTalentReport(req.user!.organizationId, period.from, period.to, req.query.includeAssessors === 'true')); }
  catch { res.status(500).json({ error: 'Failed to load competency and performance insights.' }); }
});
router.get('/ai/status', (_req: Request, res: Response) => res.json(aiConfiguration()));
router.post('/ai', async (req: Request, res: Response) => {
  const { mode, employeeId, employeeIds, jobId, departmentId, from, to, brief, reportStyle } = req.body ?? {};
  if (!['recommendations', 'succession', 'reports'].includes(mode)) return res.status(400).json({ error: 'Choose recommendations, succession, or reports.' });
  if ([employeeId, jobId, departmentId].some(value => value !== undefined && (typeof value !== 'string' || value.length > 100))) return res.status(400).json({ error: 'Invalid employee, job, or department filter.' });
  if (employeeIds !== undefined && (!Array.isArray(employeeIds) || employeeIds.length > 80 || employeeIds.some(value => typeof value !== 'string' || value.length > 100))) return res.status(400).json({ error: 'Select at most 80 employees for AI analysis.' });
  if (mode === 'recommendations' || mode === 'succession') {
    const subjects = new Set([...(employeeId ? [employeeId] : []), ...(employeeIds || [])]);
    if (subjects.size !== 1 || [...subjects].some(id => !id.trim())) return res.status(400).json({ error: mode === 'succession' ? 'Choose one employee for succession planning.' : 'Choose one employee or assessor for recommendations.' });
  }
  if (brief !== undefined && (typeof brief !== 'string' || brief.length > 1500)) return res.status(400).json({ error: 'Keep your AI request under 1,500 characters.' });
  if (reportStyle !== undefined && !['executive', 'detailed', 'development'].includes(reportStyle)) return res.status(400).json({ error: 'Choose a valid report format.' });
  let period;
  try { period = talentPeriod(from, to); }
  catch { return res.status(400).json({ error: 'Choose a valid date range.' }); }
  try {
    if (!aiConfiguration().configured) throw new TalentAIError(503, 'AI is not configured. Add OPENAI_API_KEY to the backend environment.');
    const report = await loadTalentReport(req.user!.organizationId, period.from, period.to, mode === 'recommendations');
    res.json(await generateTalentAdvice(req.user!.organizationId, report, { mode, employeeId, employeeIds, jobId, departmentId, brief, reportStyle }));
  } catch (error) {
    if (error instanceof TalentAIError) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Could not generate AI advice. Existing assessment results are still available.' });
  }
});
export default router;
