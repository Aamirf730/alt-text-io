-- Keep the public plan catalogue aligned with capabilities that are present in
-- the shipped product. Language-count and around-the-clock support claims can
-- be reintroduced only after those services exist and have release evidence.

update public.subscription_plans
set features = case id
  when 'free' then '["150 bonus credits on signup (never expire)", "15 AI alt texts every month", "WordPress plugin included", "Media library workflow"]'::jsonb
  when 'tier1' then '["150 AI alt text generations", "Auto-generate on upload", "Single-image workflow", "Email support"]'::jsonb
  when 'tier2' then '["1,000 AI alt text generations", "Bulk media-library fixes", "Post and page image workflows", "Email support"]'::jsonb
  when 'tier3' then '["2,000 AI alt text generations", "Context-aware generation", "WooCommerce workflows", "Custom post type support"]'::jsonb
  when 'tier4' then '["3,500 AI alt text generations", "Multi-site friendly workflow", "Context-aware generation", "Custom post type support"]'::jsonb
  else features
end
where id in ('free', 'tier1', 'tier2', 'tier3', 'tier4');
