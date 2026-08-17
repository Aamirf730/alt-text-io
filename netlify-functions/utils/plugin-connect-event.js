const { normalizePluginVersion } = require('./plugin-version');

async function recordPluginConnectCompleted(supabase, {
  userId,
  userEmail,
  endpointName = 'auth-validate',
  occurredAt = new Date().toISOString(),
  pluginVersion = null,
} = {}) {
  if (!supabase || !userId) {
    return { recorded: false, reason: 'missing_context' };
  }

  const normalizedPluginVersion = normalizePluginVersion(pluginVersion);

  try {
    const { data: existingEvents, error: existingError } = await supabase
      .from('marketing_events')
      .select('id, properties, user_email')
      .eq('event_name', 'connect_completed')
      .eq('user_id', userId)
      .eq('source', 'wordpress_plugin_auth')
      .limit(1);

    if (existingError) {
      console.warn('plugin-connect-event: duplicate check failed', existingError.message);
      return { recorded: false, reason: 'duplicate_check_failed' };
    }

    if (existingEvents && existingEvents.length > 0) {
      const existingEvent = existingEvents[0];
      const nextProperties = {
        ...(existingEvent.properties && typeof existingEvent.properties === 'object' ? existingEvent.properties : {}),
        validation_endpoint: endpointName,
      };

      if (normalizedPluginVersion) {
        nextProperties.plugin_version = normalizedPluginVersion;
      }

      const currentPluginVersion = normalizePluginVersion(existingEvent?.properties?.plugin_version || null);
      const shouldUpdate = existingEvent.user_email !== (userEmail || null)
        || existingEvent?.properties?.validation_endpoint !== endpointName
        || (normalizedPluginVersion && currentPluginVersion !== normalizedPluginVersion);

      if (!shouldUpdate) {
        return { recorded: false, reason: 'already_recorded' };
      }

      const { error: updateError } = await supabase
        .from('marketing_events')
        .update({
          user_email: userEmail || null,
          properties: nextProperties,
        })
        .eq('id', existingEvent.id);

      if (updateError) {
        console.warn('plugin-connect-event: update failed', updateError.message);
        return { recorded: false, reason: 'update_failed' };
      }

      return { recorded: false, reason: 'updated_existing' };
    }

    const { error: insertError } = await supabase
      .from('marketing_events')
      .insert({
        event_name: 'connect_completed',
        source: 'wordpress_plugin_auth',
        user_id: userId,
        user_email: userEmail || null,
        properties: {
          validation_endpoint: endpointName,
          ...(normalizedPluginVersion ? { plugin_version: normalizedPluginVersion } : {}),
        },
        occurred_at: occurredAt,
      });

    if (insertError) {
      console.warn('plugin-connect-event: insert failed', insertError.message);
      return { recorded: false, reason: 'insert_failed' };
    }

    return { recorded: true, reason: 'inserted' };
  } catch (error) {
    console.warn('plugin-connect-event: unexpected failure', error.message);
    return { recorded: false, reason: 'unexpected_failure' };
  }
}

async function getPluginConnectionStatus(supabase, userId) {
  if (!supabase || !userId) {
    return {
      connected: false,
      connectedAt: null,
      source: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('marketing_events')
      .select('occurred_at, created_at, source')
      .eq('event_name', 'connect_completed')
      .eq('user_id', userId)
      .in('source', ['wordpress_plugin_auth', 'wordpress_connect'])
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('plugin-connect-event: status lookup failed', error.message);
      return {
        connected: false,
        connectedAt: null,
        source: null,
      };
    }

    return {
      connected: Boolean(data),
      connectedAt: data?.occurred_at || data?.created_at || null,
      source: data?.source || null,
    };
  } catch (error) {
    console.warn('plugin-connect-event: status lookup failed', error.message);
    return {
      connected: false,
      connectedAt: null,
      source: null,
    };
  }
}

module.exports = {
  recordPluginConnectCompleted,
  getPluginConnectionStatus,
};
