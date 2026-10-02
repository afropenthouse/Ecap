import https from 'https';

const postmarkToken = process.env.POSTMARK_SERVER_TOKEN || '';
const postmarkFrom = process.env.POSTMARK_FROM || '';
const postmarkMessageStream = process.env.POSTMARK_MESSAGE_STREAM || 'outbound';

type PostmarkResult = { statusCode: number; body: any };

function postmarkRequest(path: string, method: 'GET' | 'POST', payload?: Record<string, unknown>): Promise<PostmarkResult> {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : undefined;
    const req = https.request({
      hostname: 'api.postmarkapp.com',
      path,
      method,
      headers: {
        'Accept': 'application/json',
        'X-Postmark-Server-Token': postmarkToken,
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
      },
      timeout: 20000,
    }, (res) => {
      let response = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { response += chunk; });
      res.on('end', () => {
        let parsed: any = {};
        try { parsed = response ? JSON.parse(response) : {}; } catch { parsed = { Message: response }; }
        resolve({ statusCode: res.statusCode || 0, body: parsed });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Postmark API request timed out')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export function isPostmarkConfigured() {
  return Boolean(postmarkToken && postmarkFrom);
}

export async function verifyPostmark() {
  if (!isPostmarkConfigured()) return { configured: false, verified: false };
  const result = await postmarkRequest('/server', 'GET');
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(`Postmark API returned HTTP ${result.statusCode}`);
  }
  return { configured: true, verified: true };
}

export async function sendMail(to: string, subject: string, html: string, text?: string) {
  if (!isPostmarkConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('POSTMARK_SERVER_TOKEN and POSTMARK_FROM must be configured in production');
    }
    console.info(`[mailer] Postmark not configured; simulated email to ${to}: ${subject}`);
    return { simulated: true };
  }
  const maxRetries = 3;
  let attempt = 0;
  const payload = {
    From: postmarkFrom,
    To: to,
    Subject: subject,
    HtmlBody: html,
    ...(text ? { TextBody: text } : {}),
    MessageStream: postmarkMessageStream,
  };
  while (true) {
    try {
      const result = await postmarkRequest('/email', 'POST', payload);
      if (result.statusCode >= 200 && result.statusCode < 300) return result.body;
      const error = new Error(`Postmark API error (${result.statusCode}): ${result.body?.Message || 'Email was not accepted'}`) as Error & { statusCode?: number };
      error.statusCode = result.statusCode;
      throw error;
    } catch (err: any) {
      attempt += 1;
      const status = err?.statusCode;
      const isRetryable = !status || status === 408 || status === 429 || status >= 500;
      console.error(`[mailer] Postmark send attempt ${attempt} failed:`, String(err?.message || err));
      if (!isRetryable || attempt > maxRetries) throw err;
      await new Promise((resolve) => setTimeout(resolve, Math.min(30000, 1000 * Math.pow(2, attempt))));
    }
  }
}

type EmailContent = { subject: string; preheader: string; heading: string; body: string; text: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://ecap-project.vercel.app' : 'http://localhost:5173')).replace(/\/$/, '');
}

function emailLayout({ subject, preheader, heading, body, text }: EmailContent) {
  const safeSubject = escapeHtml(subject);
  const safePreheader = escapeHtml(preheader);
  const safeHeading = escapeHtml(heading);
  const safeBody = body;
  const logoUrl = escapeHtml(`${getFrontendUrl()}/images/logo/logo-icon.svg`);
  return {
    subject,
    text,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#172033;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${safePreheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px">
<tr><td style="padding:0 4px 18px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" width="38" height="38" style="width:38px;height:38px"><img src="${logoUrl}" width="38" height="38" alt="HRM Office logo" style="display:block;width:38px;height:38px;border:0;border-radius:11px" /></td><td style="padding-left:11px"><div style="font-size:16px;line-height:20px;font-weight:700;color:#172033">HRM Office</div><div style="font-size:11px;line-height:16px;letter-spacing:1.1px;text-transform:uppercase;color:#64748b">People. Progress. Performance.</div></td></tr></table></td></tr>
<tr><td style="border:1px solid #e2e8f0;border-radius:16px;background:#fff;overflow:hidden"><div style="height:5px;background:#2563eb;font-size:0;line-height:0">&nbsp;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:32px 30px 30px"><p style="margin:0 0 9px;color:#2563eb;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">HRM Office</p><h1 style="margin:0 0 15px;font-size:26px;line-height:34px;color:#172033">${safeHeading}</h1>${safeBody}</td></tr></table></td></tr>
<tr><td align="center" style="padding:20px 12px 0;color:#64748b;font-size:12px;line-height:19px">A thoughtful way to support your people.<br>© ${new Date().getFullYear()} HRM Office</td></tr>
</table></td></tr></table></body></html>`,
  };
}

function button(label: string, href: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:25px 0 18px"><tr><td align="center" style="border-radius:8px;background:#1d4ed8"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 21px;border-radius:8px;color:#fff;text-decoration:none;font-size:14px;font-weight:700">${escapeHtml(label)}</a></td></tr></table>`;
}

export function buildWelcomeEmail(orgName: string) {
  const name = escapeHtml(orgName);
  const url = `${getFrontendUrl()}/auth/login`;
  return emailLayout({
    subject: `Your ${orgName} workspace is ready`,
    preheader: `Your ${orgName} workspace is ready to use.`,
    heading: `Welcome to ${orgName}`,
    body: `<p style="margin:0;color:#475569;font-size:15px;line-height:24px">Your company workspace and HR administrator account are ready. Invite your team and start building a stronger people program.</p>${button('Sign in to your workspace', url)}<p style="margin:0;color:#64748b;font-size:12px;line-height:19px">If the button does not work, open this address:<br><a href="${escapeHtml(url)}" style="color:#1d4ed8;word-break:break-all">${escapeHtml(url)}</a></p>`,
    text: `Welcome to HRM Office, ${orgName}. Your company workspace and HR administrator account are ready. Sign in to invite your team: ${url}`,
  });
}

export function buildResetEmail(orgName: string, resetLink: string) {
  const name = escapeHtml(orgName);
  return emailLayout({
    subject: `${orgName}: Reset your password`,
    preheader: `Reset your ${orgName} password. This link expires in 24 hours.`,
    heading: 'Reset your password',
    body: `<p style="margin:0;color:#475569;font-size:15px;line-height:24px">We received a request to reset the password for your <strong style="color:#172033">${name}</strong> workspace.</p>${button('Choose a new password', resetLink)}<p style="margin:0;color:#64748b;font-size:13px;line-height:21px">This link expires in 24 hours. If you did not request a reset, you can safely ignore this email.</p>`,
    text: `Reset your HRM Office password for ${orgName}: ${resetLink}. This link expires in 24 hours. Ignore this message if you did not request a reset.`,
  });
}

export function buildVerifyEmail(orgName: string, verifyLink: string) {
  const name = escapeHtml(orgName);
  return emailLayout({
    subject: `${orgName}: Verify your email address`,
    preheader: `Confirm your email to activate your ${orgName} account.`,
    heading: 'Verify your email',
    body: `<p style="margin:0;color:#475569;font-size:15px;line-height:24px">Confirm your email address to activate your account with <strong style="color:#172033">${name}</strong> on HRM Office.</p>${button('Verify email address', verifyLink)}<p style="margin:0;color:#64748b;font-size:13px;line-height:21px">This link expires in 24 hours. If you did not create this account, you can ignore this message.</p>`,
    text: `Verify your email to activate your ${orgName} account: ${verifyLink}. This link expires in 24 hours.`,
  });
}

export function buildVerifyCodeEmail(orgName: string, code: string) {
  const name = escapeHtml(orgName);
  const safeCode = escapeHtml(code);
  return emailLayout({
    subject: `${orgName}: Your HRM Office verification code`,
    preheader: 'Your 8-digit verification code expires in 15 minutes.',
    heading: 'Verify your work email',
    body: `<p style="margin:0;color:#475569;font-size:15px;line-height:24px">Use this code to finish setting up the HR administrator account for <strong style="color:#172033">${name}</strong>.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0"><tr><td align="center" style="border:1px solid #dbeafe;border-radius:12px;background:#eff6ff;padding:21px 12px"><span style="font-size:32px;line-height:40px;letter-spacing:8px;font-weight:700;color:#1e40af;font-variant-numeric:tabular-nums">${safeCode}</span></td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px"><tr><td style="border-left:3px solid #f59e0b;background:#fffbeb;padding:12px 14px;color:#92400e;font-size:13px;line-height:20px"><strong>For your security:</strong> this code expires in 15 minutes and should only be entered on HRM Office.</td></tr></table><p style="margin:0;color:#64748b;font-size:13px;line-height:21px">If you did not start this setup, you can ignore this email. No one can use this code without access to your inbox.</p>`,
    text: `Your HRM Office verification code for ${orgName} is ${code}. Enter it on the signup page. It expires in 15 minutes. If you did not start this setup, ignore this email.`,
  });
}

export function buildInvitationEmail(orgName: string, firstName: string, role: string, temporaryPassword: string, loginLink: string) {
  const safeOrg = escapeHtml(orgName);
  const safeRole = escapeHtml(role.toLowerCase());
  return emailLayout({
    subject: `You’re invited to join ${orgName} on HRM Office`,
    preheader: `You have been invited to join ${orgName}. Your temporary password is inside.`,
    heading: `You’re invited, ${firstName}`,
    body: `<p style="margin:0;color:#475569;font-size:15px;line-height:24px"><strong style="color:#172033">${safeOrg}</strong> invited you to join its HRM Office workspace as an <strong style="color:#172033">${safeRole}</strong>.</p><p style="margin:20px 0 6px;color:#475569;font-size:14px">Your temporary password</p><div style="border:1px solid #dbeafe;border-radius:10px;background:#eff6ff;padding:14px 16px;color:#1e3a8a;font-size:18px;font-weight:700;letter-spacing:1px;word-break:break-all">${escapeHtml(temporaryPassword)}</div><p style="margin:12px 0 20px;color:#64748b;font-size:13px;line-height:21px">Sign in with your work email and this temporary password. HRM Office will ask you to create a new password before opening your account. This invitation expires in 7 days.</p>${button('Sign in and activate account', loginLink)}<p style="margin:0;color:#64748b;font-size:13px;line-height:21px">If you were not expecting this invitation, contact your HR team.</p>`,
    text: `Hello ${firstName}, ${orgName} invited you to HRM Office as ${role.toLowerCase()}. Sign in at ${loginLink} with your work email and temporary password: ${temporaryPassword}. You will be asked to create a new password before using your account. This invitation expires in 7 days.`,
  });
}
