// Netlify Function for Sending Contact Form Emails
const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;

  // Check if it's a custom domain (not @gmail.com)
  const isCustomDomain = emailUser && !emailUser.includes('@gmail.com');

  // For Gmail or Google Workspace, use service: 'gmail'
  // For custom domains, we might need explicit SMTP settings
  if (emailService === 'gmail' || !isCustomDomain) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
  } else {
    // For custom domains, try Gmail SMTP (works for Google Workspace)
    // If this doesn't work, you may need to configure custom SMTP settings
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
  }
};

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Check if environment variables are set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Missing email environment variables:', {
        hasUser: !!process.env.EMAIL_USER,
        hasPassword: !!process.env.EMAIL_PASSWORD,
        hasService: !!process.env.EMAIL_SERVICE
      });
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Email service not configured',
          details: 'EMAIL_USER or EMAIL_PASSWORD environment variables are missing'
        }),
      };
    }

    const { name, email, subject, message } = JSON.parse(event.body);

    // Validate required fields
    if (!name || !email || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Name, email, and message are required' }),
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email format' }),
      };
    }

    const transporter = createTransporter();

    // Verify transporter was created
    if (!transporter) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to create email transporter',
          details: 'Could not initialize email service'
        }),
      };
    }

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER || 'help@wpgeared.com',
      to: 'help@wpgeared.com', // Recipient email address
      replyTo: email, // Allow replying directly to the sender
      subject: subject || `Contact Form: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1AB5AC; border-bottom: 2px solid #1AB5AC; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong style="color: #0B4F5E;">Name:</strong> ${name}</p>
            <p><strong style="color: #0B4F5E;">Email:</strong> <a href="mailto:${email}">${email}</a></p>
            ${subject ? `<p><strong style="color: #0B4F5E;">Subject:</strong> ${subject}</p>` : ''}
          </div>
          
          <div style="background-color: #ffffff; padding: 20px; border-left: 4px solid #1AB5AC; margin: 20px 0;">
            <p><strong style="color: #0B4F5E;">Message:</strong></p>
            <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <p>This email was sent from the Alt Text Pro contact form.</p>
            <p>You can reply directly to this email to respond to ${name}.</p>
          </div>
        </div>
      `,
      text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
${subject ? `Subject: ${subject}` : ''}

Message:
${message}
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Email sent successfully'
      }),
    };
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('Error stack:', error.stack);
    console.error('Environment check:', {
      hasUser: !!process.env.EMAIL_USER,
      hasPassword: !!process.env.EMAIL_PASSWORD,
      hasService: !!process.env.EMAIL_SERVICE,
      userEmail: process.env.EMAIL_USER
    });

    // Return more detailed error for debugging (but don't expose sensitive info)
    let errorMessage = 'Failed to send email';
    let errorDetails = error.message || 'Unknown error';

    // Common Gmail errors
    if (error.message && error.message.includes('Invalid login')) {
      errorDetails = 'Invalid email credentials. Please check your email and app password.';
    } else if (error.message && error.message.includes('EAUTH')) {
      errorDetails = 'Authentication failed. Please verify your email credentials are correct.';
    } else if (error.message && error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
      errorDetails = 'Connection timeout. Please check your network or try again later.';
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: errorMessage,
        details: errorDetails
      }),
    };
  }
};

