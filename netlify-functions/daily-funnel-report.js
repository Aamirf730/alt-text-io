// Daily scheduled funnel report for Alt Text Pro.

const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { getEmailFrom } = require('./utils/email-config');
const {
  getMarketingFunnelReport,
  renderFunnelReportHtml,
  renderFunnelReportText,
} = require('./utils/marketing-funnel');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

function getReportRecipients() {
  return (process.env.MARKETING_REPORT_EMAILS || process.env.SUPERUSER_EMAILS || '')
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);
}

function createTransporter() {
  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const isCustomDomain = emailUser && !emailUser.includes('@gmail.com');

  if (emailService === 'gmail' || !isCustomDomain) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
}

function getHeader(headers, name) {
  const target = name.toLowerCase();
  const key = Object.keys(headers || {}).find(header => header.toLowerCase() === target);
  return key ? headers[key] : undefined;
}

function getReportSecret() {
  // Keep the existing automation secret as a migration fallback so moving the
  // schedule to its protected wrapper does not require a second credential on
  // an already-configured site. A dedicated secret can be used when desired.
  return process.env.DAILY_FUNNEL_REPORT_SECRET || process.env.LIFECYCLE_AUTOMATION_SECRET || '';
}

function secretsMatch(providedSecret, configuredSecret) {
  if (!providedSecret || !configuredSecret) return false;

  const provided = Buffer.from(String(providedSecret));
  const configured = Buffer.from(String(configuredSecret));
  return provided.length === configured.length && crypto.timingSafeEqual(provided, configured);
}

function isAuthorizedRun(event) {
  const providedSecret = getHeader(event?.headers, 'x-daily-funnel-report-secret');
  const allowed = secretsMatch(providedSecret, getReportSecret());

  return {
    allowed,
    mode: allowed && event?.__scheduledInvocation === true ? 'scheduled' : allowed ? 'manual' : 'blocked',
  };
}

exports.handler = async (event = {}) => {
  const authorization = isAuthorizedRun(event);
  if (!authorization.allowed) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Daily funnel reporting requires a valid secret.' }),
    };
  }

  try {
    if (!supabase) {
      console.error('daily-funnel-report: Supabase is not configured.');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, sent: false, reason: 'supabase_not_configured' }),
      };
    }

    const recipients = getReportRecipients();
    if (recipients.length === 0) {
      console.warn('daily-funnel-report: no MARKETING_REPORT_EMAILS or SUPERUSER_EMAILS configured.');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, sent: false, reason: 'no_recipients' }),
      };
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('daily-funnel-report: email credentials are not configured.');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, sent: false, reason: 'email_not_configured' }),
      };
    }

    const report = await getMarketingFunnelReport(supabase, { days: 1 });
    const transporter = createTransporter();
    const date = report.range.end_at.slice(0, 10);

    await transporter.sendMail({
      from: getEmailFrom(),
      to: recipients.join(','),
      subject: `Alt Text Pro daily funnel report - ${date}`,
      text: renderFunnelReportText(report),
      html: renderFunnelReportHtml(report),
    });

    console.log('daily-funnel-report: sent report', {
      recipients: recipients.length,
      events: report.totals.events,
      uniqueActors: report.totals.unique_actors,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, sent: true }),
    };
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'daily-funnel-report' });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send daily funnel report',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};

exports._private = {
  getReportSecret,
  isAuthorizedRun,
  secretsMatch,
};
