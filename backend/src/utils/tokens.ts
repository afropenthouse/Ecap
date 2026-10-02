import crypto from 'crypto';

export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateVerificationCode() {
  return crypto.randomInt(0, 100_000_000).toString().padStart(8, '0');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
