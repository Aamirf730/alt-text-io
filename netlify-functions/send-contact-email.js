// Netlify Function for Sending Contact Form Emails
const nodemailer = require('nodemailer');
const { getEmailFrom, getSupportEmail } = require('./utils/email-config');
const {
  checkRateLimit,
  getClientIp,
  getCorsHeaders,
  handlePreflight,
  methodNotAllowedResponse,
  rateLimitExceededResponse,
} = require('./utils/cors');
const {
  LIMITS,
  parseJsonBody,
  validateEmail,
  validateString,
} = require('./utils/input-validator');

const CONTACT_RATE_LIMIT = 5;
const CONTACT_RATE_WINDOW_MS = 10 * 60 * 1000;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function singleLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

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

function createHandler({
  checkRateLimitFn = checkRateLimit,
  transporterFactory = createTransporter,
} = {}) {
  return async (event) => {
    const requestHeaders = event.headers || {};
    const headers = getCorsHeaders(requestHeaders, ['POST', 'OPTIONS']);
    const preflightResponse = handlePreflight({ ...event, headers: requestHeaders });
    if (preflightResponse) return preflightResponse;

    if (event.httpMethod !== 'POST') {
      return methodNotAllowedResponse(headers);
    }

    const clientIp = getClientIp({ ...event, headers: requestHeaders });
    const rateLimit = await checkRateLimitFn(
      `contact:${clientIp}`,
      CONTACT_RATE_LIMIT,
      CONTACT_RATE_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(headers, rateLimit);
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Contact email service is not configured');
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'Contact service is temporarily unavailable' }),
      };
    }

    const { data: body, error: parseError } = parseJsonBody(event.body);
    if (parseError) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: parseError }) };
    }

    // Quietly accept the hidden honeypot field so simple form bots do not learn
    // how they were detected. The public form leaves this field empty.
    if (typeof body.website === 'string' && body.website.trim()) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Message received' }),
      };
    }

    const { value: rawName, error: nameError } = validateString(body.name, 'Name', {
      required: true,
      maxLength: LIMITS.MAX_NAME_LENGTH,
    });
    if (nameError) return { statusCode: 400, headers, body: JSON.stringify({ error: nameError }) };

    const { value: email, error: emailError } = validateEmail(body.email, { required: true });
    if (emailError) return { statusCode: 400, headers, body: JSON.stringify({ error: emailError }) };

    const { value: rawSubject, error: subjectError } = validateString(body.subject, 'Subject', {
      maxLength: LIMITS.MAX_SUBJECT_LENGTH,
    });
    if (subjectError) return { statusCode: 400, headers, body: JSON.stringify({ error: subjectError }) };

    const { value: message, error: messageError } = validateString(body.message, 'Message', {
      required: true,
      maxLength: LIMITS.MAX_MESSAGE_LENGTH,
    });
    if (messageError) return { statusCode: 400, headers, body: JSON.stringify({ error: messageError }) };

    const name = singleLine(rawName);
    const subject = singleLine(rawSubject);
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    const mailOptions = {
      from: getEmailFrom(),
      to: getSupportEmail(),
      replyTo: email,
      subject: subject || `Contact Form: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3F3F46; border-bottom: 2px solid #FEE11C; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          <div style="background-color: #FFFBEA; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
            ${subject ? `<p><strong>Subject:</strong> ${safeSubject}</p>` : ''}
          </div>
          <div style="background-color: #ffffff; padding: 20px; border-left: 4px solid #FEE11C; margin: 20px 0;">
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap; line-height: 1.6;">${safeMessage}</p>
          </div>
          <p style="color: #6B6B73; font-size: 12px;">Sent from the Alt Text Pro contact form.</p>
        </div>
      `,
      text: `New Contact Form Submission\n\nName: ${name}\nEmail: ${email}\n${subject ? `Subject: ${subject}\n` : ''}\nMessage:\n${message}`,
    };

    try {
      const transporter = transporterFactory();
      await transporter.sendMail(mailOptions);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Message received' }),
      };
    } catch (error) {
      const { reportError } = require('./utils/error-reporter');
      reportError(error, { functionName: 'send-contact-email' });
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Could not send your message. Please try again later.' }),
      };
    }
  };
}

exports.handler = createHandler();
exports._private = {
  CONTACT_RATE_LIMIT,
  CONTACT_RATE_WINDOW_MS,
  createHandler,
  escapeHtml,
  singleLine,
};
