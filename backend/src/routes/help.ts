import { Router } from 'express';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth';
import { articlesForRole, knowledgeBuiltAt, retrieveHelp } from '../utils/helpKnowledge';
import { answerHelp, HelpError } from '../utils/helpAI';

const router = Router();
router.use(authMiddleware);
const usage = new Map<string, { start: number; count: number; busy: boolean }>();
router.get('/', (req, res) => res.json({ configured: Boolean(process.env.OPENAI_API_KEY?.trim()), knowledgeBuiltAt, articles: articlesForRole(req.user!.role) }));
router.post('/chat', async (req, res) => {
  const { question, page = '', history = [] } = req.body || {};
  if (typeof question !== 'string' || !question.trim() || question.length > 2000 || typeof page !== 'string' || page.length > 200 || !Array.isArray(history) || history.length > 8 || history.some(message => !message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 4000)) return res.status(400).json({ error: 'Ask a question of up to 2,000 characters with a short conversation history.' });
  const now = Date.now();
  for (const [key, entry] of usage) if (now - entry.start > 300000 && !entry.busy) usage.delete(key);
  const key = `${req.user!.organizationId}:${req.user!.id}`;
  const entry = usage.get(key) || { start: now, count: 0, busy: false };
  if (entry.busy || entry.count >= 12) { res.set('Retry-After', '30'); return res.status(429).json({ error: entry.busy ? 'Please wait for the current answer.' : 'Please wait a few minutes before asking more AI questions. You can still browse the help guides.' }); }
  if (usage.size >= 5000 && !usage.has(key)) return res.status(503).json({ error: 'Help is busy. Please try again shortly.' });
  entry.count += 1; entry.busy = true; usage.set(key, entry);
  try {
    const articles = retrieveHelp(req.user!.role, question, page, history);
    res.json(await answerHelp(req.user!.role, question.trim(), page, history, articles));
  } catch (error) {
    if (error instanceof HelpError) return res.status(error.status).json({ error: error.message });
    if (error instanceof OpenAI.APIError) return res.status(503).json({ error: 'AI help is temporarily unavailable. Browse the help guides or try again shortly.' });
    res.status(500).json({ error: 'Could not load an answer. Browse the help guides or try again.' });
  } finally { entry.busy = false; }
});
export default router;
