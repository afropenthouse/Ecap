import { api, apiFetch } from './client';

export type HelpArticle = { id: string; title: string; path: string; keywords: string[]; summary: string; facts: string[]; steps: string[]; faqs: Array<{ question: string; answer: string }> };
export type HelpKnowledge = { configured: boolean; knowledgeBuiltAt: string | null; articles: HelpArticle[] };
export type HelpAnswer = { answer: string; steps: string[]; sources: Array<{ id: string; title: string; path: string }>; followUps: string[]; mode: 'ai' | 'guide' };
export const getHelpKnowledge = () => api.get<HelpKnowledge>('/help');
export const askHelp = (question: string, page: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) => apiFetch<HelpAnswer>('/help/chat', { method: 'POST', body: { question, page, history }, timeoutMs: 45000 });
