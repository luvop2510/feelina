# Feelina — Start Here

Open **Feelina.code-workspace** in VS Code or open this folder in Codex to work on the project.

## Project locations

- Finder shortcut: `Documents/Feelina`
- Source folder: `Documents/ChatGPT/feelina`
- Live website: https://feelina.vercel.app
- Local preview: http://127.0.0.1:5173
- GitHub: https://github.com/luvop2510/feelina

## Start the website locally

In a terminal opened in this folder:

```sh
nvm use
npm run dev
```

The existing `.env.local` contains local configuration. Keep it private and preserve its values. On a new checkout, follow README.md to install dependencies and configure the public Supabase settings.

## Where to work

- `src/` — website screens, components and styles
- `design-system/feelina/MASTER.md` — design system
- `docs/PRD.md` — product requirements
- `docs/ACCOUNT_MANAGEMENT.md` — owner and team accounts
- `supabase/` — database migrations and server functions
- `tests/` — automated checks
- `README.md` — setup, deployment and operations references

Run `npm test` and `npm run build` before publishing code changes.

Owner accounts can add users through **Settings → Accounts**. Google login still needs the provider credentials previously deferred. Verified business details and the reference invoice remain outstanding before statutory document activation.
