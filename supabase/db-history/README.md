# Database-only migration history

This directory records migrations that are present in the live Supabase migration ledger but were not originally committed under `supabase/migrations/`.

These files are **historical records only**. They must not be copied into the active migration sequence or applied to production again unless a later migration deliberately reimplements the required behaviour.

Why this exists:

- Supabase production already recorded these migrations as applied.
- Newer migrations may have subsequently replaced or extended the same functions/constraints.
- Adding the old SQL back into the active migration directory could execute it out of order on a fresh environment and regress newer definitions.

Recorded gaps:

- `20260825175558_prevent_self_confirmation.sql`
- `20260826222839_phase26_beta_validation_metrics.sql`

The SQL in each file is preserved from `supabase_migrations.schema_migrations.statements` on the live project for audit/reconciliation purposes.
