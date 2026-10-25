# Deployment record — 25 October 2026

- Primary site: https://feelina.vercel.app
- Local preview: http://127.0.0.1:5173 while the development server is running.
- Repository: https://github.com/luvop2510/feelina, branch `main`.
- Application source release: `3f2f93d18e54d5bae7fef5c1bfbf6862a95b017a`.
- Verified Vercel deployment: `dpl_JCPdrXQcMrm83hXMn36V7P6aJCaF`, https://feelina-jcoh67kf5-yug19.vercel.app, production alias applied.
- Supabase backend: `ttmrywjzmdfjsvuxgmpr`; migrations `20261025100930`, `20261025100931`, `20261025100933`, `20261025101956` applied and matched to local filenames.
- Optional Render static mirror: https://feelina.onrender.com, service `srv-dbetbmvb9u1s73asr2tg`. No Render backend is required for the chosen Vercel + Supabase stack.

Local checks: 28 automated database/design checks, 7 browser checks, production build and dependency audit pass. Browser tests also pass with isolated public test configuration matching CI. Production smoke check confirms HTTP 200, expected CSP origin, visible Google option, actual disabled-provider recovery and usable email fallback. The local preview has the same login option.

Google provider credentials and full Google account callback remain deferred by the user. Email login and the authenticated draft/retailer journey were verified with temporary cloud identities before this source release; fixtures were removed. Owner/business/invoice inputs, real email delivery, company handover, cloud contention and off-site recovery are still acceptance gates. See `docs/ACCEPTANCE.md` and `docs/AUTH.md`.

CI browser tests use a clearly synthetic Supabase URL/key and intercept OAuth requests. They never authenticate a real Google user or store provider secrets. Hosting variables contain the actual project's public configuration; privileged credentials are excluded from Git.
