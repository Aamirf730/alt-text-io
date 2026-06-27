async function recordPluginConnectCompleted(supabase, {
  userId,
  userEmail,
  endpointName = 'auth-validate',
  occurredAt = new Date().toISOString(),
} = {}) {
  if (!supabase || !userId) {
    return { recorded: false, reason: 'missing_context' };
  }

  try {
    const { data: existingEvents, error: existingError } = await supabase
      .from('marketing_events')
      .select('id')
      .eq('event_name', 'connect_completed')
      .eq('user_id', userId)
      .limit(1);

    if (existingError) {
      console.warn('plugin-connect-event: duplicate check failed', existingError.message);
      return { recorded: false, reason: 'duplicate_check_failed' };
    }

    if (existingEvents && existingEvents.length > 0) {
      return { recorded: false, reason: 'already_recorded' };
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

module.exports = {
  recordPluginConnectCompleted,
};
