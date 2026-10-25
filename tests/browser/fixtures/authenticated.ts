import { expect, type Page } from "@playwright/test";
import { sampleWorkspace } from "./workspace-data";

/** Synthetic data lives only in the test runner. Every Supabase request is intercepted. */
export async function openAuthenticatedWorkspace(page: Page) {
  const data = structuredClone(sampleWorkspace);
  const profile = {
    ...data.profile!,
    id: "10000000-0000-4000-8000-000000000001",
    email: "owner@example.test",
    full_name: "Test workspace owner",
    must_change_password: false,
  };
  data.profile = profile;
  data.profiles = [profile];
  const user = {
    id: profile.id,
    email: profile.email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const token = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
      }),
    ).toString("base64url"),
    "synthetic-signature",
  ].join(".");
  const unexpectedRequests: string[] = [];
  await page.route("**/*.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/token")
      return route.fulfill({
        json: {
          access_token: token,
          refresh_token: "isolated-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user,
        },
      });
    if (url.pathname === "/auth/v1/user" && request.method() === "GET")
      return route.fulfill({ json: user });
    if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204 });
    if (request.method() === "GET" && url.pathname.startsWith("/rest/v1/")) {
      const name = url.pathname.split("/").at(-1)!;
      if (name === "profiles")
        return route.fulfill({
          json: url.searchParams.has("id") ? profile : data.profiles,
        });
      if (name === "settings") return route.fulfill({ json: [data.settings] });
      if (name in data)
        return route.fulfill({ json: data[name as keyof typeof data] });
    }
    unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    return route.fulfill({
      status: 500,
      json: {
        message: "Unexpected operation blocked by isolated test fixture.",
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Email address", { exact: true }).fill(profile.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Isolated-browser-fixture-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main h1")).toHaveText("Dashboard");
  return { data, unexpectedRequests };
}
