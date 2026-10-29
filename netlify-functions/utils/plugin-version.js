function normalizePluginVersion(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(trimmed)) {
    return null;
  }

  return trimmed.slice(0, 40);
}

// Header names arrive in any case depending on the runtime and proxy.
function getHeaderValue(headers, name) {
  if (!headers || typeof headers !== 'object') return null;

  const wanted = String(name).toLowerCase();
  const underscored = wanted.replace(/-/g, '_');
  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = String(key).toLowerCase();
    if (normalizedKey === wanted || normalizedKey === underscored) {
      return Array.isArray(value) ? value[0] : value;
    }
  }

  return null;
}

function extractPluginVersion(event) {
  const headers = event?.headers || {};
  const headerValue =
    getHeaderValue(headers, 'x-plugin-version')
    || getHeaderValue(headers, 'x-alt-text-pro-version')
    || null;

  const normalizedHeader = normalizePluginVersion(headerValue);
  if (normalizedHeader) {
    return normalizedHeader;
  }

  if (typeof event?.body !== 'string' || !event.body) {
    return null;
  }

  try {
    const parsedBody = JSON.parse(event.body);
    return normalizePluginVersion(
      parsedBody?.plugin_version
      || parsedBody?.pluginVersion
      || parsedBody?.properties?.plugin_version
      || null
    );
  } catch (_error) {
    return null;
  }
}

function getEventPluginVersion(eventRow) {
  return normalizePluginVersion(eventRow?.properties?.plugin_version || null);
}

module.exports = {
  extractPluginVersion,
  getHeaderValue,
  getEventPluginVersion,
  normalizePluginVersion,
};
