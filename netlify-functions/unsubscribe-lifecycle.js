// Lifecycle email unsubscribe.
//
// GET  shows a confirmation page and changes nothing, so link scanners and
//      prefetchers that open the link cannot unsubscribe anyone.
// POST unsubscribes. This is both the confirm button and the RFC 8058
//      one-click request mail clients send for List-Unsubscribe-Post
//      ("List-Unsubscribe=One-Click"), with the token in the query string.

const { createClient } = require('@supabase/supabase-js');
const { inspectUnsubscribeToken } = require('./utils/lifecycle-unsubscribe');
const { getSupportEmail } = require('./utils/email-config');
const { withErrorReporting } = require('./utils/error-reporter');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const UNSUBSCRIBE_PATH = '/.netlify/functions/unsubscribe-lifecycle';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function htmlResponse(statusCode, title, message, extraHtml = '') {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'no-referrer',
    },
    body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head><body style="font-family:Arial,sans-serif;max-width:620px;margin:64px auto;padding:24px;color:#3F3F46;background:#FFFBEA"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${extraHtml}</body></html>`,
  };
}

function getFormToken(event) {
  if (!event?.body) return null;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : String(event.body);
  if (raw.length > 4096) return null;
  try {
    return new URLSearchParams(raw).get('token');
  } catch (_error) {
    return null;
  }
}

function contactMessage() {
  return `Email ${getSupportEmail()} and we will update your email preferences.`;
}

function confirmPage(token) {
  const action = `${UNSUBSCRIBE_PATH}?token=${encodeURIComponent(token)}`;
  return htmlResponse(
    200,
    'Unsubscribe from Alt Text Pro emails?',
    'You will stop receiving setup tips and reminder emails. Receipts and account emails are not affected.',
    `<form method="post" action="${escapeHtml(action)}"><button type="submit" style="background:#FEE11C;color:#3F3F46;border:0;border-radius:12px;padding:14px 24px;font-size:16px;font-weight:700;cursor:pointer">Unsubscribe</button></form>`
  );
}

function createHandler({ supabaseClient = supabase, now = () => Date.now() } = {}) {
  return async (event) => {
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
      return htmlResponse(405, 'Method not allowed', 'Please use the unsubscribe link from your email.');
    }

    const token = event.queryStringParameters?.token
      || (event.httpMethod === 'POST' ? getFormToken(event) : null);
    const inspected = inspectUnsubscribeToken(token, { now: now() });

    if (inspected.status === 'invalid') {
      return htmlResponse(400, 'Invalid unsubscribe link', `This link is not valid. ${contactMessage()}`);
    }
    if (inspected.status === 'expired') {
      return htmlResponse(410, 'This unsubscribe link has expired', `Use the link in a more recent email. ${contactMessage()}`);
    }

    if (event.httpMethod === 'GET') {
      return confirmPage(token);
    }

    if (!supabaseClient) {
      return htmlResponse(500, 'Unsubscribe unavailable', contactMessage());
    }

    // The signed token already proves the user ID. Matching the email as well
    // silently skipped profiles whose stored email differs in case or changed.
    const { error } = await supabaseClient
      .from('profiles')
      .update({ marketing_unsubscribed_at: new Date(now()).toISOString() })
      .eq('id', inspected.identity.userId)
      .is('marketing_unsubscribed_at', null)
      .select('id');

    if (error) {
      const { reportError } = require('./utils/error-reporter');
      reportError(new Error(`Lifecycle unsubscribe failed: ${error.message}`), { functionName: 'unsubscribe-lifecycle' });
      return htmlResponse(500, 'Unsubscribe unavailable', contactMessage());
    }

    // No row updated means already unsubscribed or the account is gone.
    // Either way no more lifecycle email, so confirm in every case.
    return htmlResponse(200, 'You are unsubscribed', 'You will no longer receive Alt Text Pro lifecycle emails.');
  };
}

exports.handler = withErrorReporting('unsubscribe-lifecycle', createHandler());
exports._private = { createHandler, htmlResponse, getFormToken };
