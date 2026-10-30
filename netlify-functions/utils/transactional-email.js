// One-off service emails (account deleted, support auto-reply). Lifecycle
// marketing emails live in lifecycle-automation.js and carry an unsubscribe
// link; these are replies to something the person just did, so they don't.
const nodemailer = require('nodemailer');
const { getCustomerEmailFrom, getSupportEmail } = require('./email-config');

function createTransporter() {
  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const isCustomDomain = emailUser && !emailUser.includes('@gmail.com');

  if (emailService === 'gmail' || !isCustomDomain) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPassword },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: emailUser, pass: emailPassword },
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders the yellow + white layout used by the other emails. Paragraphs and
 * list items are plain text and are escaped here.
 */
function renderTransactionalEmail({ title, paragraphs = [], listItems = [], closing = '' }) {
  const paragraphHtml = paragraphs
    .map(text => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#6B6B73;">${escapeHtml(text)}</p>`)
    .join('');
  const listHtml = listItems.length > 0
    ? `<ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.6;color:#6B6B73;">${listItems.map(item => `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  const closingHtml = closing
    ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#6B6B73;">${escapeHtml(closing)}</p>`
    : '';

  const html = `
    <div style="margin:0;padding:32px 16px;background:#FFFBEA;font-family:Arial,'Helvetica Neue',sans-serif;color:#3F3F46;">
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #EFE3A3;border-radius:16px;overflow:hidden;">
        <div style="padding:28px 32px 8px;">
          <img src="https://www.alt-text.pro/logo-alt-text-pro.png" width="56" height="56" alt="Alt Text Pro" style="display:block;width:56px;height:56px;border:0;">
        </div>
        <div style="padding:12px 32px 32px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;font-weight:700;color:#3F3F46;">${escapeHtml(title)}</h1>
          ${paragraphHtml}
          ${listHtml}
          ${closingHtml}
        </div>
      </div>
      <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#6B6B73;text-align:center;">Alt Text Pro &middot; AI alt text for WordPress</p>
    </div>
  `;

  const text = [
    'Alt Text Pro',
    '',
    title,
    '',
    ...paragraphs.flatMap(paragraph => [paragraph, '']),
    ...listItems.map(item => `- ${item}`),
    ...(listItems.length > 0 ? [''] : []),
    ...(closing ? [closing] : []),
  ].join('\n').trim();

  return { html, text };
}

/** Sends one service email. Throws when email is not configured or fails. */
async function sendTransactionalEmail({ to, subject, content, transporter = null }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Email transport is not configured');
  }
  const { html, text } = renderTransactionalEmail(content);
  const mailer = transporter || createTransporter();
  await mailer.sendMail({
    from: getCustomerEmailFrom(),
    replyTo: getSupportEmail(),
    to,
    subject,
    text,
    html,
  });
}

function buildAccountDeletedEmail({ email, subscriptionCancellation, deletedAt = new Date() }) {
  const date = deletedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const paragraphs = [
    `We deleted the Alt Text Pro account for ${email} on ${date}, as you asked.`,
  ];
  if (subscriptionCancellation === 'cancelled') {
    paragraphs.push('Your subscription was cancelled at the same time, so there will be no further charges.');
  } else if (subscriptionCancellation === 'pending') {
    paragraphs.push('Your subscription is being cancelled. If you are charged again, reply to this email and we will refund it.');
  }
  return {
    subject: 'Your Alt Text Pro account has been deleted',
    content: {
      title: 'Your account has been deleted',
      paragraphs,
      listItems: [
        'Removed: your profile, credits, API key and generation history. The plugin stops working on your connected sites.',
        'Kept: payment records, for as long as tax and accounting law requires. Polar keeps its own receipts and invoices.',
        'Alt text already saved on your WordPress images stays on your sites.',
      ],
      closing: 'If you did not delete this account, reply to this email straight away.',
    },
  };
}

function buildSupportAutoReply() {
  return {
    subject: 'We got your message - Alt Text Pro',
    content: {
      title: 'Thanks, we got your message',
      paragraphs: [
        'This is an automatic reply to say your message reached Alt Text Pro support.',
        'We usually reply within one to two business days. To add anything, just reply to this email.',
      ],
      listItems: [
        'Plugin not connecting? Settings in the plugin has a Test button and a Connect Account button.',
        'Out of credits? Your dashboard at www.alt-text.pro/dashboard shows your balance and how to add more.',
      ],
    },
  };
}

module.exports = {
  buildAccountDeletedEmail,
  buildSupportAutoReply,
  createTransporter,
  escapeHtml,
  renderTransactionalEmail,
  sendTransactionalEmail,
};
