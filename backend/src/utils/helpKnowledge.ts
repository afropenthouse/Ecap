import { createHash } from 'node:crypto';
import source from '../knowledge/help-source.json';
import enrichment from '../knowledge/help-enrichment.json';
import type { AuthUser } from '../middleware/auth';

export type HelpArticle = { id: string; title: string; roles: string[]; path: string; keywords: string[]; summary: string; facts: string[]; steps: string[]; faqs: Array<{ question: string; answer: string }> };
const enrichmentCurrent = enrichment.sourceHash === createHash('sha256').update(JSON.stringify(source)).digest('hex');
const expanded = (enrichmentCurrent ? enrichment.articles : []) as Array<{ id: string; keywords: string[]; faqs: HelpArticle['faqs'] }>;
export const helpArticles: HelpArticle[] = source.map(article => {
  const extra = expanded.find(item => item.id === article.id);
  return { ...article, keywords: [...article.keywords, ...(extra?.keywords || [])], faqs: extra?.faqs || [] };
});
export const knowledgeBuiltAt = enrichmentCurrent ? enrichment.generatedAt : null;
export const articlesForRole = (role: AuthUser['role']) => helpArticles.filter(article => article.roles.includes(role));
const stopWords = new Set('a an the is are was were do does did can could would should how what why where when who i me my we our you your it this that to in on for of and or with please help tell explain use using have has not'.split(' '));
const tokens = (text: string) => [...new Set((text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(word => word.length > 2 && !stopWords.has(word)).map(word => word.replace(/(ments|ment|ing|ies|s)$/, suffix => suffix === 'ies' ? 'y' : '')))];
export function retrieveHelp(role: AuthUser['role'], question: string, page: string, history: Array<{ content: string }> = []): HelpArticle[] {
  const query = tokens(question);
  const previous = tokens(history.slice(-2).map(message => message.content).join(' '));
  const ranked = articlesForRole(role).map(article => {
    const title = tokens(article.title + ' ' + article.keywords.join(' '));
    const body = tokens([article.summary, ...article.facts, ...article.steps, ...article.faqs.map(faq => faq.question)].join(' '));
    const score = query.reduce((sum, word) => sum + (title.includes(word) ? 5 : body.includes(word) ? 1 : 0), 0) + previous.reduce((sum, word) => sum + (title.includes(word) ? 0.5 : 0), 0) + (article.path === page ? 2 : 0);
    return { article, score };
  }).sort((a, b) => b.score - a.score);
  const relevant = ranked.filter(item => item.score > 0).slice(0, 6).map(item => item.article);
  return relevant.length ? relevant : articlesForRole(role).filter(article => ['overview', 'access', `${role.toLowerCase()}-start`].includes(article.id));
}
