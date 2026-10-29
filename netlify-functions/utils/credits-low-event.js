// The smallest "running low" level. Larger plans are warned earlier: at 10%
// of the monthly allowance, up to 100 credits.
const LOW_CREDIT_THRESHOLD = 5;
const MAX_LOW_CREDIT_THRESHOLD = 100;

function getLowCreditThreshold(monthlyAllowance) {
  const allowance = Number(monthlyAllowance);
  if (!Number.isFinite(allowance) || allowance <= 0) return LOW_CREDIT_THRESHOLD;
  return Math.min(MAX_LOW_CREDIT_THRESHOLD, Math.max(LOW_CREDIT_THRESHOLD, Math.ceil(allowance * 0.1)));
}

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

/**
 * Records "credits_low" or "credits_exhausted" at most once per credit cycle.
 * A cycle starts at the later of the last purchase and the last credit refill
 * (cycleStartedAt), so subscribers are warned again in later months.
 */
async function recordCreditEvent(supabase, {
  eventName = 'credits_low',
  userId,
  userEmail,
  creditsRemaining,
  monthlyAllowance = null,
  cycleStartedAt = null,
  occurredAt = new Date().toISOString(),
  source = 'wordpress_plugin_usage',
} = {}) {
  if (!supabase || !userId) {
    return { recorded: false, reason: 'missing_context' };
  }

  const credits = Number(creditsRemaining);
  if (!Number.isFinite(credits)) {
    return { recorded: false, reason: 'not_low_credit' };
  }
  if (eventName === 'credits_exhausted' ? credits > 0 : credits > getLowCreditThreshold(monthlyAllowance)) {
    return { recorded: false, reason: 'not_low_credit' };
  }

  try {
    const [{ event: latestLowCredit, error: lowCreditError }, { event: latestPurchase, error: purchaseError }] = await Promise.all([
      fetchLatestEvent(supabase, userId, eventName),
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
      const cycleStartAt = cycleStartedAt ? new Date(cycleStartedAt).getTime() : 0;
      const currentCycleStart = Math.max(latestPurchaseAt, Number.isFinite(cycleStartAt) ? cycleStartAt : 0);

      if (latestLowCreditAt >= currentCycleStart) {
        return { recorded: false, reason: 'already_recorded_current_cycle' };
      }
    }

    const { error: insertError } = await supabase
      .from('marketing_events')
      .insert({
        event_name: eventName,
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

function recordCreditsLowEvent(supabase, options = {}) {
  return recordCreditEvent(supabase, { ...options, eventName: 'credits_low' });
}

module.exports = {
  LOW_CREDIT_THRESHOLD,
  getLowCreditThreshold,
  recordCreditEvent,
  recordCreditsLowEvent,
};
