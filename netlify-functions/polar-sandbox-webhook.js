// Temporary non-production receiver for Polar Sandbox webhook delivery tests.
// It intentionally does not access Supabase, send email, or grant credits.

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (process.env.POLAR_SANDBOX_RECEIVER_ENABLED !== 'true') {
    return jsonResponse(404, { error: 'Sandbox receiver disabled' });
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'POST required' });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_) {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const order = payload.data || payload.order || {};
  const product = order.product || {};
  const customer = order.customer || {};

  // Never log the raw payload or customer email. This endpoint is only for
  // confirming delivery and the product/order fields needed for QA.
  console.log('polar-sandbox-webhook received', {
    event_type: payload.type || payload.event || null,
    order_id: order.id || null,
    order_status: order.status || null,
    product_name: product.name || null,
    product_id: product.id || null,
    has_customer_email: Boolean(customer.email),
  });

  return jsonResponse(200, {
    success: true,
    dry_run: true,
    received: true,
    event_type: payload.type || payload.event || null,
  });
};
