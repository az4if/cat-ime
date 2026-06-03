# anikoto-proxy

Browser-safe proxy for [Anikoto API](https://anikotoapi.site/) (required for MegaPlay `/stream/s-2/` embeds on the live site).

Deploy once (from repo root, with [Supabase CLI](https://supabase.com/docs/guides/cli) linked to project `vmnpuvyfyzdquetkakde`):

```bash
supabase login
supabase link --project-ref vmnpuvyfyzdquetkakde
supabase functions deploy anikoto-proxy --no-verify-jwt
```

`verify_jwt = false` is set in `supabase/config.toml` so the public app can call it with the anon key.
