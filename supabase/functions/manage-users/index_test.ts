import { handleRequest } from "./index.ts";
const actorId = "10000000-0000-4000-8000-000000000001";
const targetId = "10000000-0000-4000-8000-000000000002";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const payload = {
  action: "create",
  email: "new@example.test",
  username: "new.user",
  full_name: "New user",
  password: "Synthetic-fixture-only-2026",
  role: "sales",
  partner_type: "staff",
  request_id: "10000000-0000-4000-8000-000000000003",
};
function request(body: unknown, bearer = true) {
  return new Request("https://edge.example.test", {
    method: "POST",
    headers: {
      origin: "https://feelina.vercel.app",
      ...(bearer ? { authorization: "Bearer fixture" } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function mocked(
  run: (calls: { path: string; method: string; body: any }[]) => Promise<void>,
  config: {
    initial?: boolean;
    role?: string;
    authFailure?: boolean;
    passwordFailure?: boolean;
    reused?: boolean;
  } = {},
) {
  Deno.env.set("SUPABASE_URL", "https://isolated.example.test");
  Deno.env.set("SUPABASE_ANON_KEY", "fixture-anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  const original = globalThis.fetch;
  const calls: { path: string; method: string; body: any }[] = [];
  const spec = JSON.stringify({
    email: payload.email,
    username: payload.username,
    full_name: payload.full_name,
    role: payload.role,
    partner_type: payload.partner_type,
    customer_id: null,
  });
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ path: url.pathname, method, body });
    if (url.pathname === "/auth/v1/user") {
      if (config.authFailure) return json({ message: "Invalid token" }, 401);
      if (method === "PUT" && config.passwordFailure)
        return json({ message: "Same password" }, 422);
      return json({ id: actorId, app_metadata: {}, user_metadata: {} });
    }
    if (url.pathname === "/rest/v1/profiles") {
      const selected = url.searchParams.get("select");
      if (selected === "role,status,must_change_password")
        return json({
          role: config.role || "owner",
          status: "active",
          must_change_password: !!config.initial,
        });
      if (selected === "id,status,must_change_password")
        return json({
          id: targetId,
          status: config.reused ? "suspended" : "active",
          must_change_password: true,
        });
      return json(
        config.reused && url.searchParams.has("email")
          ? [{ id: targetId, email: payload.email, username: payload.username }]
          : [],
      );
    }
    if (url.pathname.startsWith("/auth/v1/admin/users/"))
      return json({
        id: targetId,
        app_metadata: {
          feelina_creation_request: payload.request_id,
          feelina_created_by: actorId,
          feelina_creation_spec: spec,
        },
      });
    if (url.pathname === "/auth/v1/admin/users") return json({ id: targetId });
    if (url.pathname.startsWith("/rest/v1/rpc/")) return json(null);
    throw new Error(`Unexpected isolated request ${method} ${url.pathname}`);
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}
Deno.test(
  "anonymous and non-owner callers cannot provision privileged accounts",
  async () => {
    assert((await handleRequest(request(payload, false))).status === 401);
    await mocked(
      async (calls) => {
        assert(
          (await handleRequest(request({ ...payload, role: "owner" })))
            .status === 403,
        );
        assert(!calls.some((x) => x.path.includes("/admin/")));
      },
      { role: "admin" },
    );
    await mocked(
      async (calls) => {
        assert((await handleRequest(request(payload))).status === 403);
        assert(!calls.some((x) => x.path.includes("/admin/")));
      },
      { initial: true },
    );
  },
);
Deno.test(
  "initial password unlock requires successful caller-authenticated update",
  async () => {
    await mocked(
      async (calls) => {
        assert(
          (
            await handleRequest(
              request({
                action: "change-initial-password",
                password: payload.password,
              }),
            )
          ).status === 400,
        );
        assert(
          !calls.some((x) =>
            x.path.endsWith("complete_initial_password_change"),
          ),
        );
      },
      { initial: true, passwordFailure: true },
    );
    await mocked(
      async (calls) => {
        assert(
          (
            await handleRequest(
              request({ action: "change-initial-password", password: "short" }),
            )
          ).status === 400,
        );
        assert(!calls.some((x) => x.method === "PUT"));
        const response = await handleRequest(
          request({
            action: "change-initial-password",
            password: payload.password,
          }),
        );
        assert(response.status === 200);
        const update = calls.findIndex((x) => x.method === "PUT");
        const unlock = calls.findIndex((x) =>
          x.path.endsWith("complete_initial_password_change"),
        );
        assert(update >= 0 && unlock > update);
        assert(calls[unlock].body.p_user_id === actorId);
      },
      { initial: true, role: "retailer" },
    );
  },
);
Deno.test(
  "provisioning retries retain identity and never reactivate a suspended account",
  async () => {
    await mocked(async (calls) => {
      const response = await handleRequest(request(payload));
      assert(response.status === 201);
      const creation = calls.find((x) => x.path === "/auth/v1/admin/users")!;
      assert(creation.body.app_metadata.feelina_password_issued === true);
      assert(
        !JSON.stringify(creation.body.app_metadata).includes(payload.password),
      );
      assert(
        calls.find((x) => x.path.endsWith("manage_team_user"))?.body
          .p_only_if_unconfigured === true,
      );
    });
    await mocked(
      async (calls) => {
        const response = await handleRequest(request(payload));
        assert(response.status === 200);
        assert((await response.json()).status === "suspended");
        assert(!calls.some((x) => x.path === "/auth/v1/admin/users"));
      },
      { reused: true },
    );
  },
);
