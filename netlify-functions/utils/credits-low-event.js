const LOW_CREDIT_THRESHOLD = 5;

async function fetchLatestEvent(supabase, userId, eventName) {
  const { data, error } = await supabase
    .from('marketing_events')
    .select('id,occurred_at')
    .eq('user_id', userId)
    .eq('event_name', eventName)
    .order('occurred_at', { ascending: false })
    .limit(1);

  if (error) {
    return { event: null, error };
  }

  return { event: data?.[0] || null, error: null };
}

async function recordCreditsLowEvent(supabase, {
  userId,
  userEmail,
  creditsRemaining,
  occurredAt = new Date().toISOString(),
  source = 'wordpress_plugin_usage',
} = {}) {
  if (!supabase || !userId) {
    return { recorded: false, reason: 'missing_context' };
  }

  if (!Number.isFinite(Number(creditsRemaining)) || Number(creditsRemaining) > LOW_CREDIT_THRESHOLD) {
    return { recorded: false, reason: 'not_low_credit' };
  }

  try {
    const [{ event: latestLowCredit, error: lowCreditError }, { event: latestPurchase, error: purchaseError }] = await Promise.all([
      fetchLatestEvent(supabase, userId, 'credits_low'),
      fetchLatestEvent(supabase, userId, 'purchase_completed'),
    ]);

    if (lowCreditError) {
      console.warn('credits-low-event: latest credits_low lookup failed', lowCreditError.message);
      return { recorded: false, reason: 'low_credit_lookup_failed' };
    }

    if (purchaseError) {
      console.warn('credits-low-event: latest purchase lookup failed', purchaseError.message);
      return { recorded: false, reason: 'purchase_lookup_failed' };
    }

    if (latestLowCredit) {
      const latestLowCreditAt = new Date(latestLowCredit.occurred_at || 0).getTime();
      const latestPurchaseAt = latestPurchase ? new Date(latestPurchase.occurred_at || 0).getTime() : 0;

      if (!latestPurchase || latestLowCreditAt >= latestPurchaseAt) {
        return { recorded: false, reason: 'already_recorded_current_cycle' };
      }
    }

    const { error: insertError } = await supabase
      .from('marketing_events')
      .insert({
        event_name: 'credits_low',
        source,
        user_id: userId,
        user_email: userEmail || null,
        properties: {
          credits_remaining: Number(creditsRemaining),
          trigger: 'server_generation',
        },
        occurred_at: occurredAt,
      });

    if (insertError) {
      console.warn('credits-low-event: insert failed', insertError.message);
      return { recorded: false, reason: 'insert_failed' };
    }

    return { recorded: true, reason: 'inserted' };
  } catch (error) {
    console.warn('credits-low-event: unexpected failure', error.message);
    return { recorded: false, reason: 'unexpected_failure' };
  }
}

module.exports = {
  LOW_CREDIT_THRESHOLD,
  recordCreditsLowEvent,
};
