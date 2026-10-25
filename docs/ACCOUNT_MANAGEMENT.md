# Team and partner accounts

Owners use **Settings → Accounts → Create user** to issue an account with a full name, email, unique username, initial password, access role and partner category. Email is the login identifier; username is a directory identifier. Share the initial password privately. Closing a failed creation form starts a different request, so inspect the directory before resubmitting an existing email.

An owner may create or manage owners and administrators. Administrators may manage lower roles. The last active owner cannot be suspended, deactivated or demoted. Sales, inventory, accounts, fulfilment and retailer permissions remain separate. Partner categories (staff, retailer, distributor, investor, other) describe the relationship; they do not grant additional access. A retailer-role account must be linked to a customer and sees that customer's records. An investor category needs an explicitly selected existing role; there is no invented investor financial portal.

This is one Feelina workspace. The account directory groups staff and partners through categories and customer links; it does not implement separate tenant organizations or team billing.

## Issued passwords

New issued accounts remain pending until the trusted service sets `must_change_password`, then the guarded database transaction activates their role. Supabase may attach application metadata after its initial user insert, so the service explicitly sets this gate before activation. Self-service signup still creates a pending retailer and cannot choose privileges.

On first login, the user must choose a different password of at least 12 characters and at most 72 UTF-8 bytes. The database denies business reads and mutations while the flag is set. The Edge Function authenticates the caller through Auth, submits a caller-authenticated password update, and only after success calls a service-role-only completion RPC. Neither user-editable metadata nor a routine stored-hash rewrite clears the flag. If completion fails after Auth changes the password, retry with another new password; access stays locked.

The three human-designated owners were provisioned on 25 October 2026 with the explicitly requested initial password. All three email logins and their pre-change database restrictions were verified. Their permanent passwords have not been selected by the implementation agent. Future accounts created through the form require the 12-character policy.

## Deployment and validation

Migration `20261025103812_account_management.sql` and the `manage-users` Supabase Edge Function are deployed to `ttmrywjzmdfjsvuxgmpr`. The function uses built-in server credentials; no privileged key is in the frontend. Gateway JWT verification is delegated to explicit Auth `getUser` inside the handler to support the project's signing keys. Requests without valid user authorization are rejected before operations. Origins are restricted to production and the local preview.

Creation requests carry a UUID and trusted identity metadata for safe retries. A retry may finish its original pending identity, but cannot reactivate an already provisioned suspended account. The form freezes its submitted fields during retries so the password cannot silently differ from the issued identity. Passwords are absent from audit events and identity metadata.

Local checks cover database privilege boundaries, duplicate usernames, atomic directory changes, the first-password gate, handler authentication/role enforcement, creation retries and browser forms. `tests/cloud-accounts.mjs` is an opt-in hosted Auth/Edge/RLS check using disposable identities; it verifies password replacement, owner-created staff/distributor accounts, administrator escalation denial, suspended retry behavior, retailer scope and anonymous rejection. Fixture cleanup removes only test-owned records. Run it with Node 22+ and securely supplied environment variables; never use real account passwords.

Google OAuth remains visible but deferred until the user configures provider credentials. See `AUTH.md`.
