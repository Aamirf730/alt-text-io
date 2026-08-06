# Historical SQL archive

These files document the hand-applied schema changes that predate the tracked
Supabase migration chain. They are not an execution path anymore.

Use `supabase/migrations/` for every new schema change and for disaster
recovery. The canonical bootstrap migration captures the foundational objects
from this directory; running both directories would apply parts of the schema
twice and can restore retired or insecure definitions.
