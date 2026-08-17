const { createClient } = require('@supabase/supabase-js');
const { verifyUnsubscribeToken } = require('./utils/lifecycle-unsubscribe');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

function htmlResponse(statusCode, title, message) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:Arial,sans-serif;max-width:620px;margin:64px auto;padding:24px;color:#0f172a"><h1>${title}</h1><p>${message}</p></body></html>`,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return htmlResponse(405, 'Method not allowed', 'Please use the unsubscribe link from your email.');
  }

  if (!supabase) {
    return htmlResponse(500, 'Unsubscribe unavailable', 'Please contact support to update your email preferences.');
  }

  const token = event.queryStringParameters?.token;
  const identity = verifyUnsubscribeToken(token);
  if (!identity) {
    return htmlResponse(400, 'Invalid unsubscribe link', 'This link is invalid or has expired.');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ marketing_unsubscribed_at: new Date().toISOString() })
    .eq('id', identity.userId)
    .eq('email', identity.email);

  if (error) {
    console.error('Failed to record lifecycle unsubscribe:', error.message);
    return htmlResponse(500, 'Unsubscribe unavailable', 'Please contact support to update your email preferences.');
  }

  return htmlResponse(200, 'You are unsubscribed', 'You will no longer receive Alt Text Pro lifecycle emails.');
};

exports._private = { htmlResponse };
