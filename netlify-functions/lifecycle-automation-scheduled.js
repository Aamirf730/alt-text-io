// Scheduled entry point for lifecycle automation.
//
// The shared handler is secret-protected for every invocation. Netlify's
// scheduler sends a schedule body without HTTP request markers, so this
// wrapper adds the configured secret only for that internal event shape.
// HTTP-shaped requests retain their original event and must provide the
// secret themselves; they never receive the scheduler credential implicitly.

const { handler } = require('./lifecycle-automation');

function hasHttpInvocationMarkers(event) {
  return Boolean(
    event?.httpMethod ||
    event?.path ||
    event?.rawUrl ||
    event?.rawQuery ||
    event?.rawQueryString ||
    event?.requestContext?.path ||
    event?.requestContext?.http?.path
  );
}

function buildDelegatedEvent(event) {
  if (hasHttpInvocationMarkers(event)) {
    return event;
  }

  return {
    body: typeof event?.body === 'string'
      ? event.body
      : JSON.stringify(event?.body || {}),
    headers: {
      'x-lifecycle-automation-secret': process.env.LIFECYCLE_AUTOMATION_SECRET || '',
    },
    queryStringParameters: {},
    __scheduledInvocation: true,
  };
}

exports.handler = (event) => handler(buildDelegatedEvent(event));

exports._private = {
  hasHttpInvocationMarkers,
  buildDelegatedEvent,
};
