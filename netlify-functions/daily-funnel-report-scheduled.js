// Scheduled entry point for the daily funnel report.
//
// The shared handler requires a secret for every invocation. Netlify's
// scheduler sends a schedule event without normal HTTP markers, so this
// wrapper supplies the configured secret only for that internal event shape.
// HTTP-shaped requests retain their original event and must provide the
// secret themselves.

const { handler } = require('./daily-funnel-report');

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

function buildDelegatedEvent(event = {}) {
  if (hasHttpInvocationMarkers(event)) {
    return event;
  }

  return {
    ...event,
    body: typeof event.body === 'string' ? event.body : JSON.stringify(event.body || {}),
    headers: {
      ...(event.headers || {}),
      'x-daily-funnel-report-secret': process.env.DAILY_FUNNEL_REPORT_SECRET || process.env.LIFECYCLE_AUTOMATION_SECRET || '',
    },
    __scheduledInvocation: true,
  };
}

exports.handler = (event) => handler(buildDelegatedEvent(event));

exports._private = {
  buildDelegatedEvent,
  hasHttpInvocationMarkers,
};
