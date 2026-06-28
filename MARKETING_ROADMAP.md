# Alt Text Pro Marketing Roadmap

Use this file as the shared source of truth for acquisition and lifecycle work after Week 1.

## Current Status

- Week 1 is closed out in `WEEK1_CLOSEOUT.md`.
- Week 2 item 1, WordPress.org listing optimization, is completed and published to WordPress.org SVN.
- Keep live mutations scoped: verify first, then deploy/publish only when approved.

## Week 2: Conversion And Acquisition Foundation

1. WordPress.org listing optimization
   - Improve plugin title, short description, screenshots, FAQ, tags, and readme copy so organic WordPress.org traffic converts better.
   - Status: completed.

2. Website conversion polish
   - Tighten homepage CTA, pricing copy, plugin install flow, dashboard onboarding, and docs.
   - Goal: move new users faster from landing page to plugin connected to first alt text generation.
   - Suggested deliverables: clearer homepage CTA, "install plugin" section, pricing clarity, dashboard next-step prompts, docs quick-start cleanup.
   - Status: implemented locally; needs production deploy after approval.

3. SEO content foundation
   - Publish 2-3 targeted pages or posts.
   - Target page: AI alt text generator for WordPress. Status: implemented locally at `/ai-alt-text-generator-for-wordpress`; needs production deploy after approval.
   - Target page: WooCommerce product image alt text.
   - Target page: How to bulk generate alt text in WordPress.

4. Lifecycle email templates
   - Improve the 5 lifecycle emails before scheduled automation reaches real users regularly.
   - Keep the tone helpful and product-led, not spammy.
   - Confirm each email has one clear CTA and no unsupported claims.

5. Launch/outreach assets
   - Prepare a launch kit.
   - Product Hunt style description.
   - Reddit and WordPress community post.
   - LinkedIn/X post.
   - Cold outreach email to accessibility and SEO agencies.

6. Monitoring
   - Check admin Lifecycle/Funnel daily.
   - Monitor signups.
   - Monitor plugin connects.
   - Monitor first generations.
   - Monitor low-credit users.
   - Monitor email sends and failures.

## Week 3: SEO And Distribution Push

1. Publish and internally link the Week 2 SEO pages
   - Add links from homepage, docs, footer, and relevant dashboard/help surfaces.
   - Add metadata, canonical URLs, and schema where appropriate.

2. Create comparison and use-case pages
   - Page: Alt Text Pro for WooCommerce.
   - Page: Alt Text Pro for agencies.
   - Page: Bulk alt text generator for WordPress.

3. Start outreach
   - Send the launch email to a small agency list first.
   - Post to selected WordPress, accessibility, SEO, and indie maker communities.
   - Track replies and signups manually before automating more outreach.

4. Improve onboarding from real funnel data
   - Review where users drop: signup, email confirmation, API key copy, plugin connection, first generation.
   - Patch the biggest drop-off point first.

5. Collect early proof
   - Ask early users for short testimonials.
   - Capture before/after examples of missing alt text fixed by the plugin.
   - Build a small proof section for the homepage.

## Week 4: Scale What Works

1. Double down on the best channel
   - Compare WordPress.org traffic, organic search, outreach replies, community posts, and lifecycle email conversions.
   - Put more effort only into channels that produced signups or plugin connects.

2. Add lightweight referral or agency offer
   - Create a simple agency-friendly message for bulk client sites.
   - Consider a manual referral offer before building any referral system.

3. Expand lifecycle automation
   - Add segments for connected-but-unused, first-generation-complete, low-credit, and paid-user onboarding.
   - Keep send frequency conservative.

4. Improve product trust
   - Add clearer privacy/security copy.
   - Add examples of generated alt text.
   - Add a small FAQ for credits, image processing, WooCommerce, and accessibility compliance.

5. Review pricing and activation
   - Check whether free credits are enough to reach the first useful outcome.
   - Check whether paid plan copy is clear.
   - Do not change pricing until there is enough user behavior data.

## Operating Rules

- Do not add non-essential plugin telemetry.
- Use server-side account lifecycle events where needed for onboarding.
- Verify live endpoints and dashboards after deploys.
- Keep secrets out of logs, commits, and summaries.
- Prefer small weekly deployable changes over large marketing rewrites.
