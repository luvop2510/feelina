# Authentication setup and acceptance

Production uses Supabase project `ttmrywjzmdfjsvuxgmpr` and https://feelina.vercel.app. Email/password sign-in, order persistence after reload, sign-out and suspended-user data denial were exercised with disposable cloud accounts. Those accounts and their records were removed. Real email verification/reset delivery still needs a controlled recipient test.

## Google login

The login and partner-registration screens include **Continue with Google**. The browser starts Supabase OAuth using PKCE/S256 and returns to the current site's root. It never receives a Google client secret. New users pass through the same database trigger as email users: pending retailer status, with no business access until approved. Google authentication does not grant staff privileges.

The user deferred Google credentials on 25 October 2026. The provider is currently disabled. Clicking the option displays a recoverable setup message and leaves email sign-in usable. Automated browser tests verify this state and inspect a mocked OAuth authorization request; they do **not** establish that a real Google account can sign in yet.

To activate:

1. In a Feelina-controlled Google Cloud project, configure the Google Auth Platform audience, app name/support contacts and a **Web application** OAuth client. Use only identity scopes (`openid`, email and profile). Complete Google's publishing/verification requirements for the intended audience; an app in testing permits only its configured test users.
2. Add this exact authorized redirect URI to that client: `https://ttmrywjzmdfjsvuxgmpr.supabase.co/auth/v1/callback`. This is the Supabase callback.
3. In [Supabase Google provider settings](https://supabase.com/dashboard/project/ttmrywjzmdfjsvuxgmpr/auth/providers), enable Google and enter the client ID and secret directly. Store credentials in the company's password manager. Do not put them in chat, GitHub, Vite variables or source files. Keep nonce/email verification checks enabled.
4. In Supabase URL Configuration, use Site URL `https://feelina.vercel.app` and allow `https://feelina.vercel.app/`. Email recovery additionally needs `https://feelina.vercel.app/#reset-password`. Add exact localhost callbacks only if intentionally testing local OAuth; do not allow arbitrary preview domains.
5. From a clean browser session, click Google on the production site, select an intended test account, finish consent, and confirm the return to Feelina. A new account must see the pending approval screen. After trusted approval, verify its assigned retailer access; then sign out and sign in again. Test cancellation as well. Record the date and result here without tokens or secrets.

No frontend redeploy is required after provider activation: the button checks current Supabase settings when clicked. The site's current origin must be in Supabase's redirect allowlist.

## Recovery and session behavior

The client persists the Supabase session and refreshes it. API reads validate the current user, while database policies check the current profile's active status. OAuth errors are rendered as escaped text; a failed provider check leaves the email form available. Password recovery uses a separate reset screen and Supabase's recovery event. Production email delivery, reset-link expiry/reuse and Google's full callback still require real recipient/provider verification.

References: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [OAuth client API](https://supabase.com/docs/reference/javascript/auth-signinwithoauth).
