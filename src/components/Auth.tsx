import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Layers3,
  Grid2X2,
  Eye,
  EyeOff,
} from "lucide-react";
import { configured, supabase } from "../lib/api";
import { Field, ErrorMessage, Submit } from "./ui";
export function Auth({ onSample }: { onSample: () => void }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (!supabase)
        throw new Error(
          "Secure sign-in is being configured. You can explore the read-only sample workspace.",
        );
      const email = String(f.get("email")).trim();
      const password = String(f.get("password") || "");
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/#reset-password",
        });
        if (error) throw error;
        setMessage(
          "If this email has an account, a password reset link will arrive shortly.",
        );
      } else if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(f.get("name")) },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage(
          "Registration received. Check your email to confirm your address. Feelina must approve your account before you can order.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <a className="wordmark" href="#">
          feelina<span>PARTNER WORKSPACE</span>
        </a>
        <div className="auth-copy">
          <div className="eyebrow">MADE FOR YOUR EVERYDAY</div>
          <h1>
            Beautiful essentials.
            <br />
            <em>Thoughtful business.</em>
          </h1>
          <p>
            Your collection, your retailers, your next order.
            <br />
            One calm place to bring it all together.
          </p>
          <div className="fabric-art" aria-hidden="true">
            <div />
            <div />
            <div />
            <span>THE FEELINA WAY</span>
          </div>
        </div>
        <div className="auth-benefits">
          <span>
            <Grid2X2 size={17} />
            Size-wise ordering
          </span>
          <span>
            <Layers3 size={17} />
            Connected inventory
          </span>
        </div>
      </section>
      <main className="auth-form-wrap">
        <div className="auth-form">
          <div className="auth-mark">
            <ShieldCheck size={23} />
          </div>
          <div className="eyebrow">YOUR BUSINESS, IN GOOD ORDER</div>
          <h2>
            {mode === "login"
              ? "Welcome to Feelina"
              : mode === "register"
                ? "Become a retail partner"
                : "Reset your password"}
          </h2>
          <p className="muted">
            {mode === "login"
              ? "Sign in to your workspace to pick up where you left off."
              : mode === "register"
                ? "Tell us a little about yourself. Our team reviews every partner account."
                : "We’ll send a secure reset link to your email."}
          </p>
          <form onSubmit={submit}>
            {mode === "register" && (
              <Field label="Full name">
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={120}
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@yourbusiness.com"
                required
              />
            </Field>
            {mode !== "reset" && (
              <Field
                label="Password"
                hint={
                  mode === "register"
                    ? "Use at least 12 characters."
                    : undefined
                }
              >
                <div className="password-field">
                  <input
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    minLength={mode === "register" ? 12 : undefined}
                    required
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
            )}
            <ErrorMessage error={error} />
            {message && (
              <p className="success-message" role="status">
                {message}
              </p>
            )}
            <Submit busy={busy}>
              {mode === "login" ? (
                <>
                  Sign in <ArrowRight size={17} />
                </>
              ) : mode === "register" ? (
                "Request partner access"
              ) : (
                "Send reset link"
              )}
            </Submit>
          </form>
          {mode === "login" && (
            <button
              className="text-button auth-reset"
              onClick={() => {
                setMode("reset");
                setMessage("");
                setError("");
              }}
            >
              Forgot password?
            </button>
          )}
          <div className="auth-switch">
            {mode === "login" ? "New to Feelina? " : ""}
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setMessage("");
                setError("");
              }}
            >
              {mode === "login"
                ? "Apply for partner access"
                : "Back to sign in"}
            </button>
          </div>
          <div className="auth-divider">
            <span>Take a look around</span>
          </div>
          <button className="button secondary full" onClick={onSample}>
            Explore sample workspace <ArrowRight size={16} />
          </button>
          <p className="fine-print">
            Read-only sample data. No account required.
          </p>
          {!configured && (
            <p className="fine-print">
              Live account access will be available once database configuration
              is complete.
            </p>
          )}
        </div>
        <footer className="auth-footer">
          Feelina partner workspace <span>Private by design</span>
        </footer>
      </main>
    </div>
  );
}
export function ResetPassword({ done }: { done: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="center-page">
      <div className="panel auth-form">
        <h1>Choose a new password</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const { error } = await supabase!.auth.updateUser({
                password: String(f.get("password")),
              });
              if (error) throw error;
              done();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="New password" hint="Use at least 12 characters.">
            <input
              type="password"
              name="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </Field>
          <ErrorMessage error={error} />
          <Submit busy={busy}>Update password</Submit>
        </form>
      </div>
    </div>
  );
}
