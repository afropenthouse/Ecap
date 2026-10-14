import { RequestHandler } from 'express';

type Field = { kind: 'text' | 'integer'; required?: boolean; nullable?: boolean; allowBlank?: boolean };

// Validate before database lookups and normalize text consistently for create/edit.
export function validateBody(fields: Record<string, Field>): RequestHandler {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Provide valid form fields' });
    let supplied = false;
    for (const [name, field] of Object.entries(fields)) {
      const value = req.body[name];
      if (value === undefined) {
        if (req.method === 'POST' && field.required) return res.status(400).json({ error: `${name} is required` });
        continue;
      }
      supplied = true;
      if (value === null && field.nullable) continue;
      if (field.kind === 'integer') {
        if (!Number.isInteger(value) || value < 1 || value > 2147483647) return res.status(400).json({ error: `${name} must be a positive whole number` });
      } else {
        if (typeof value !== 'string' || (!field.allowBlank && !value.trim())) return res.status(400).json({ error: `${name} must be non-empty text` });
        req.body[name] = value.trim();
      }
    }
    if (!supplied) return res.status(400).json({ error: 'Provide at least one field to update' });
    next();
  };
}
