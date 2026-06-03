# SQL migrations

Migrations apply in **lexicographic filename order** (`packages/db/src/migrate.ts`). Each file runs once; its filename is stored in `schema_migrations`.

## Greenfield deploy

This repository is sequenced for a **new** database (no prior HydroFoil install). Apply all files from `001` through `017` on first boot.

```bash
npm run migrate
```

Or Docker: `migrate` service / `RUN_MIGRATIONS_ON_START=true` on control-api.

## Sequence (current)

| File | Purpose |
|------|---------|
| `001`–`008` | Core schema, gateway rename, storage, recording |
| `009` | Input policy/profile assignments |
| `010` | Protocol config |
| `011` | VOD routes |
| `012` | Local storage and recording archives |
| `013_dvr_watchlist` | DVR watchlist |
| `014_users` | Users and roles |
| `015_user_password` | Password hashes |
| `016_user_access_scopes` | Moderator app/policy/VOD assignments |
| `017_user_access_scopes_phase2` | Moderator privacy policy and storage scopes |

## Verify after deploy

```sql
SELECT name FROM schema_migrations ORDER BY name;
```

The last row should be `017_user_access_scopes_phase2.sql`.

## Rules

- **Do not rename** migration files after they have been applied in any environment.
- New schema changes: add `018_description.sql` (next free number).
- If you already applied an older duplicate `013_users.sql` name from a previous checkout, reset the database or reconcile `schema_migrations` manually before upgrading.
