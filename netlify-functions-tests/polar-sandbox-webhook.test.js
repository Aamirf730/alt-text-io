import { describe, expect, it, vi } from 'vitest';

const { handler } = require('../netlify-functions/polar-sandbox-webhook.js');

describe('temporary Polar Sandbox webhook receiver', () => {
  it('stays disabled unless explicitly enabled', async () => {
    const original = process.env.POLAR_SANDBOX_RECEIVER_ENABLED;
    delete process.env.POLAR_SANDBOX_RECEIVER_ENABLED;

    await expect(handler({ httpMethod: 'POST', body: '{}' })).resolves.toMatchObject({
      statusCode: 404,
    });

    if (original === undefined) delete process.env.POLAR_SANDBOX_RECEIVER_ENABLED;
    else process.env.POLAR_SANDBOX_RECEIVER_ENABLED = original;
  });

  it('accepts a sandbox webhook without logging raw customer data', async () => {
    const original = process.env.POLAR_SANDBOX_RECEIVER_ENABLED;
    process.env.POLAR_SANDBOX_RECEIVER_ENABLED = 'true';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        type: 'order.paid',
        data: {
          id: 'order_test_123',
          status: 'paid',
          product: { id: 'product_test_123', name: 'Value Pack' },
          customer: { email: 'test@example.com' },
        },
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      success: true,
      dry_run: true,
      received: true,
      event_type: 'order.paid',
    });
    expect(log.mock.calls[0][1]).toMatchObject({
      order_id: 'order_test_123',
      product_name: 'Value Pack',
      has_customer_email: true,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('test@example.com');

    log.mockRestore();
    if (original === undefined) delete process.env.POLAR_SANDBOX_RECEIVER_ENABLED;
    else process.env.POLAR_SANDBOX_RECEIVER_ENABLED = original;
  });
});
