// Scheduled entry point for lifecycle automation.
//
// Netlify scheduled functions do not accept incoming web requests. Keep the
// schedule on this wrapper so lifecycle-automation.js remains available for
// secret-protected manual dry-run previews while both paths share one handler.
// The scheduler event includes HTTP-shaped metadata, so pass only its signed
// schedule payload to the shared handler. This prevents the handler from
// mistaking a trusted cron invocation for an unauthenticated public request.

const { handler } = require('./lifecycle-automation');

exports.handler = (event) => handler({
  body: typeof event?.body === 'string'
    ? event.body
    : JSON.stringify(event?.body || {}),
  headers: {},
  queryStringParameters: {},
});
