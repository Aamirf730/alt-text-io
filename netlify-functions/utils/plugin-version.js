function normalizePluginVersion(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(trimmed)) {
    return null;
  }

  return trimmed.slice(0, 40);
}

function extractPluginVersion(event) {
  const headers = event?.headers || {};
  const headerValue =
    headers['x-alt-text-pro-version']
    || headers['X-Alt-Text-Pro-Version']
    || headers['x_alt_text_pro_version']
    || headers['X_ALT_TEXT_PRO_VERSION']
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
  getEventPluginVersion,
  normalizePluginVersion,
};
