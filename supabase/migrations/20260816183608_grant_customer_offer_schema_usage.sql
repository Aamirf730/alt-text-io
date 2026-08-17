-- The customer-offer wrapper is SECURITY INVOKER and resolves a function in
-- the private schema as the authenticated caller. Restore the schema traversal
-- privilege for databases where the isolation migration is already applied.
grant usage on schema private to authenticated;

grant execute on function private.claim_wpgeared_customer_offer_for_caller(uuid)
  to authenticated;
