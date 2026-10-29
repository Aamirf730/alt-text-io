import { beforeEach, describe, expect, it, vi } from 'vitest';
import contactModule from '../netlify-functions/send-contact-email.js';

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
    // The message to support, then the automatic reply to the sender.
    expect(sendMail).toHaveBeenCalledTimes(2);
    const options = sendMail.mock.calls[0][0];
    expect(options.subject).not.toContain('\n');
    expect(options.html).toContain('A &amp; B');
    expect(options.html).not.toContain('<script>');
    expect(options.text).toContain('Account: not signed in');

    const reply = sendMail.mock.calls[1][0];
    expect(reply.to).toBe('person@example.com');
    expect(reply.subject).toContain('We got your message');
    // Nothing the sender typed is echoed back.
    expect(reply.html).not.toContain('pricing');
    expect(reply.text).not.toContain('Question');
  });

  it('attaches the signed-in account to the message for support', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'test' });
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'owner@example.com' } }, error: null });
    const handler = createHandler({
      checkRateLimitFn: vi.fn().mockResolvedValue({ allowed: true }),
      transporterFactory: () => ({ sendMail }),
      supabaseClient: { auth: { getUser } },
    });

    const event = request({ name: 'Owner', email: 'owner@example.com', message: 'Help please' });
    event.headers = { ...event.headers, authorization: 'Bearer session-token' };
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(getUser).toHaveBeenCalledWith('session-token');
    expect(sendMail.mock.calls[0][0].text).toContain('Account (signed in): owner@example.com · user ID user-1');
  });

  it('still succeeds when the automatic reply fails', async () => {
    const sendMail = vi.fn()
      .mockResolvedValueOnce({ messageId: 'support' })
      .mockRejectedValueOnce(new Error('smtp down'));
    const handler = createHandler({
      checkRateLimitFn: vi.fn().mockResolvedValue({ allowed: true }),
      transporterFactory: () => ({ sendMail }),
    });

    const response = await handler(request({ name: 'A', email: 'person@example.com', message: 'Hi' }));
    expect(response.statusCode).toBe(200);
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
