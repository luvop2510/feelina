import { createClient } from "npm:@supabase/supabase-js@2.109.0";

const allowedOrigins = new Set([
  "https://feelina.vercel.app",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);
export async function handleRequest(req: Request) {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin && allowedOrigins.has(origin))
    headers["Access-Control-Allow-Origin"] = origin;
  const respond = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowedOrigins.has(origin))
    return respond(403, { error: "This origin is not allowed." });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return respond(405, { error: "Use POST." });
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer "))
    return respond(401, { error: "Sign in to manage accounts." });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const {
      data: { user },
      error: authError,
    } = await caller.auth.getUser();
    if (authError || !user)
      return respond(401, { error: "Your session expired. Sign in again." });
    const { data: actor, error: actorError } = await caller
      .from("profiles")
      .select("role,status,must_change_password")
      .eq("id", user.id)
      .single();
    if (actorError || !actor || actor.status !== "active")
      return respond(403, { error: "An active account is required." });
    const raw = await req.text();
    if (raw.length > 8192)
      return respond(413, { error: "Account details are too long." });
    const body = JSON.parse(raw);
    const { action, password, role, partner_type, request_id } = body;
    const validPassword =
      typeof password === "string" &&
      password.length >= 12 &&
      password.length <= 128 &&
      new TextEncoder().encode(password).length <= 72;
    if (action === "change-initial-password") {
      if (!actor.must_change_password || !validPassword)
        return respond(400, {
          error:
            "Provide a new password of at least 12 characters and at most 72 UTF-8 bytes.",
        });
      const changed = await fetch(new URL("/auth/v1/user", url), {
        method: "PUT",
        headers: {
          Authorization: authorization,
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      const identity = await changed.json();
      if (!changed.ok || identity.id !== user.id)
        return respond(400, {
          error:
            "Password update failed. Choose a different password and try again.",
        });
      const { error } = await admin.rpc("complete_initial_password_change", {
        p_user_id: user.id,
      });
      if (error)
        return respond(503, {
          error:
            "Your password changed, but access could not be unlocked. Retry with another new password.",
        });
      return respond(200, { changed: true });
    }
    if (actor.must_change_password || !["owner", "admin"].includes(actor.role))
      return respond(403, {
        error:
          "An active owner or administrator must create accounts after changing their initial password.",
      });
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const username =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "";
    const full_name =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const customer_id = body.customer_id || null;
    if (
      action !== "create" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      !/^[a-z0-9_.-]{3,40}$/.test(username) ||
      !full_name ||
      full_name.length > 160 ||
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128 ||
      new TextEncoder().encode(password).length > 72 ||
      !/^[0-9a-f-]{36}$/i.test(request_id || "")
    )
      return respond(400, {
        error:
          "Provide a valid email, username, name and initial password (12–72 UTF-8 bytes).",
      });
    if (
      ![
        "owner",
        "admin",
        "sales",
        "inventory",
        "accounts",
        "fulfilment",
        "retailer",
      ].includes(role) ||
      !["staff", "retailer", "distributor", "investor", "other"].includes(
        partner_type,
      )
    )
      return respond(400, {
        error: "Choose a valid role and partner category.",
      });
    if (actor.role !== "owner" && ["owner", "admin"].includes(role))
      return respond(403, {
        error: "Only owners can create owners or administrators.",
      });
    if (role === "retailer" && !customer_id)
      return respond(400, {
        error: "Link a customer profile before granting retailer access.",
      });
    if (customer_id) {
      const { data, error } = await caller
        .from("customers")
        .select("id")
        .eq("id", customer_id)
        .single();
      if (error || !data)
        return respond(400, {
          error: "The selected customer profile is unavailable.",
        });
    }
    const spec = JSON.stringify({
      email,
      username,
      full_name,
      role,
      partner_type,
      customer_id,
    });
    const lookups = await Promise.all([
      admin.from("profiles").select("id,email,username").eq("email", email),
      admin
        .from("profiles")
        .select("id,email,username")
        .eq("username", username),
    ]);
    const taken = [
      ...new Map(
        lookups.flatMap((x) => x.data || []).map((x) => [x.id, x]),
      ).values(),
    ];
    if (lookups.some((x) => x.error))
      return respond(503, { error: "Account lookup failed. Try again." });
    let targetId: string | undefined;
    for (const match of taken || []) {
      const { data: identity } = await admin.auth.admin.getUserById(match.id);
      if (
        match.email === email &&
        identity.user?.app_metadata.feelina_creation_request === request_id &&
        identity.user?.app_metadata.feelina_created_by === user.id &&
        identity.user?.app_metadata.feelina_creation_spec === spec
      )
        targetId = match.id;
      else
        return respond(409, {
          error:
            "This email or username already has an account. Manage its existing access instead.",
        });
    }
    let justCreated = false;
    if (!targetId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
        app_metadata: {
          feelina_password_issued: true,
          feelina_creation_request: request_id,
          feelina_created_by: user.id,
          feelina_creation_spec: spec,
        },
      });
      if (error || !data.user)
        return respond(400, {
          error:
            "Account creation failed. Check whether the email already exists and whether the password meets the provider policy.",
        });
      targetId = data.user.id;
      justCreated = true;
    }
    // Auth may attach app_metadata after the INSERT trigger runs. Keep the
    // identity pending until the trusted service has set the password gate.
    const { error: gateError } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", targetId)
      .is("provisioned_at", null);
    if (gateError)
      return respond(503, {
        error:
          "The identity is pending. Retry this form to finish secure account setup.",
      });
    const { error } = await caller.rpc("manage_team_user", {
      p_user_id: targetId,
      p_username: username,
      p_partner_type: partner_type,
      p_full_name: full_name,
      p_role: role,
      p_status: "active",
      p_customer_id: role === "retailer" ? customer_id : null,
      p_only_if_unconfigured: true,
    });
    if (error) {
      // New identities remain pending and cannot access business records on a partial failure.
      // Preserve them for an explicit retry using the same request ID; never delete an existing account.
      return respond(409, {
        error:
          "The identity exists but access setup failed. Retry this form, or review the pending account in Team accounts.",
        id: targetId,
      });
    }
    const { data: completed, error: completedError } = await admin
      .from("profiles")
      .select("id,status,must_change_password")
      .eq("id", targetId)
      .single();
    if (completedError)
      return respond(503, {
        error:
          "Account created; refresh Team accounts to confirm its status before retrying.",
      });
    return respond(justCreated ? 201 : 200, completed);
  } catch {
    return respond(400, {
      error:
        "Unable to process the account request. Check the details and try again.",
    });
  }
}

if (import.meta.main) Deno.serve(handleRequest);
