# Ailaeclass Version State

## Frozen v4 Baseline

- Frozen tag: `v4.0-final`
- Frozen branch: `freeze/v4-final`
- Baseline commit: `55d8581 fix: lazy init server supabase during build`
- Railway production deployment: `45768cec-bb15-4fa0-b936-2d558c6fefac`
- Railway production URL: `https://ailaeclass-production.up.railway.app/`
- Supabase project ref: `kiqzanfkpivkuvlvxqsp`

This v5 workspace was created from `v4.0-final`. Treat that tag as immutable.

## Active v5 Workspace

- Local folder: `E:\Class\ailaeclass-v5`
- Git branch: `v5-development`
- Development rule: every v5 change must be committed on `v5-development` or a child branch.

## Do Not Change

- Do not move, delete, or overwrite `v4.0-final`.
- Do not force-push `freeze/v4-final`.
- Do not run `supabase db push --include-all` against production.
- Do not modify `E:\Class\ailaeclass-v3` for v5 work unless explicitly requested.

## Database Note

The v4 production database already has:

```sql
public.option.metadata jsonb
```

For future migrations, use narrow, explicit SQL migrations only. Avoid replaying historical migrations on production.

