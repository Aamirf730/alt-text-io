-- Ensure the new Agency catalogue row is visible to plan consumers.
update public.subscription_plans
set is_active = true
where id = 'tier4';
