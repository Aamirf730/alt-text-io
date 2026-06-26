// Daily scheduled funnel report for Alt Text Pro.

const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
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

exports.handler = async () => {
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
      from: process.env.EMAIL_USER,
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
