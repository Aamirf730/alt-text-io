import { beforeEach, describe, expect, it, vi } from 'vitest';
import contactModule from './send-contact-email.js';

const { createHandler, escapeHtml } = contactModule._private;

function request(body, overrides = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      origin: 'https://www.alt-text.pro',
      'x-forwarded-for': '203.0.113.10',
    },
    body: JSON.stringify(body),
    ...overrides,
  };
}

describe('send-contact-email', () => {
  beforeEach(() => {
    process.env.EMAIL_USER = 'sender@example.com';
    process.env.EMAIL_PASSWORD = 'test-password';
  });

  it('escapes customer-provided HTML characters', () => {
    expect(escapeHtml('<img src=x> & "quoted"')).toBe('&lt;img src=x&gt; &amp; &quot;quoted&quot;');
  });

  it('rate limits before sending email', async () => {
    const sendMail = vi.fn();
    const handler = createHandler({
      checkRateLimitFn: vi.fn().mockResolvedValue({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAt: new Date(Date.now() + 60_000),
      }),
      transporterFactory: () => ({ sendMail }),
    });

    const response = await handler(request({
      name: 'Aamir',
      email: 'aamir@example.com',
      message: 'Hello',
    }));

    expect(response.statusCode).toBe(429);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends sanitized content with CORS headers', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'test' });
    const handler = createHandler({
      checkRateLimitFn: vi.fn().mockResolvedValue({ allowed: true }),
      transporterFactory: () => ({ sendMail }),
    });

    const response = await handler(request({
      name: 'A & B',
      email: 'person@example.com',
      subject: 'Question\r\nBcc: attacker@example.com',
      message: 'Please explain <script>alert(1)</script> & pricing.',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://www.alt-text.pro');
    expect(sendMail).toHaveBeenCalledOnce();
    const options = sendMail.mock.calls[0][0];
    expect(options.subject).not.toContain('\n');
    expect(options.html).toContain('A &amp; B');
    expect(options.html).not.toContain('<script>');
  });

  it('does not send honeypot submissions', async () => {
    const sendMail = vi.fn();
    const handler = createHandler({
      checkRateLimitFn: vi.fn().mockResolvedValue({ allowed: true }),
      transporterFactory: () => ({ sendMail }),
    });

    const response = await handler(request({ website: 'spam.example' }));

    expect(response.statusCode).toBe(200);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
