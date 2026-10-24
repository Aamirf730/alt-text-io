// Scheduled entry point for the daily funnel report.
//
// The shared handler requires a secret for every invocation. This wrapper
// adds the configured secret only to Netlify schedule events; any other event
// is passed through unchanged and must provide the secret itself.

const { handler } = require('./daily-funnel-report');

// Netlify invokes a scheduled function with a JSON body holding the next run
// time (`next_run`), delivered as an HTTP POST in the Lambda-compatible event
// format. Netlify's edge refuses outside requests to scheduled functions in
// production ("you can't invoke them directly with a URL"; verified: the
// public URL returns an empty 403 from the platform), so a well-formed
// schedule body reaching this wrapper comes from the scheduler or "Run now".
// The shared handler stays URL-reachable and still requires its secret.
function parseScheduleBody(event) {
  let body = event?.body;
  if (typeof body === 'string') {
    if (event?.isBase64Encoded) {
      body = Buffer.from(body, 'base64').toString('utf8');
    }
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }

  const nextRun = body && typeof body === 'object' ? body.next_run : null;
  if (typeof nextRun !== 'string' || Number.isNaN(Date.parse(nextRun))) {
    return null;
  }
  return { next_run: nextRun };
}

function isNetlifyScheduleEvent(event) {
  return parseScheduleBody(event) !== null;
}

function buildDelegatedEvent(event = {}) {
  const scheduleBody = parseScheduleBody(event);
  if (!scheduleBody) {
    return event;
  }

  return {
    ...event,
    isBase64Encoded: false,
    body: JSON.stringify(scheduleBody),
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
  isNetlifyScheduleEvent,
};
