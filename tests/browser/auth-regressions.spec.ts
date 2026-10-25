import { test, expect, type Page } from "@playwright/test";

// All authentication and business requests are intercepted. These checks never
// create, modify, or sign out a real account.
async function isolatedSignIn(
  page: Page,
  options: { status?: string; failProfile?: boolean } = {},
) {
  const profile = {
    id: "10000000-0000-4000-8000-000000000010",
    email: "owner@example.test",
    full_name: "Yashvardhan Sijala",
    role: "owner",
    status: options.status || "active",
    must_change_password: false,
  };
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
        sub: profile.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
      }),
    ).toString("base64url"),
    "synthetic-signature",
  ].join(".");
  let releaseProfile!: () => void;
  const profileGate = new Promise<void>((resolve) => {
    releaseProfile = resolve;
  });
  const state = {
    logouts: 0,
    failProfile: Boolean(options.failProfile),
    releaseProfile,
  };
  await page.addInitScript(() => {
    (window as any).accessWarningSeen = false;
    new MutationObserver(() => {
      if (document.body?.textContent?.includes("Account access is unavailable"))
        (window as any).accessWarningSeen = true;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.route("**/*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/token")
      return route.fulfill({
        json: {
          access_token: token,
          refresh_token: "isolated-refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          user,
        },
      });
    if (url.pathname === "/auth/v1/user") return route.fulfill({ json: user });
    if (url.pathname === "/auth/v1/logout") {
      state.logouts++;
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      if (url.pathname.endsWith("/profiles")) {
        await profileGate;
        if (state.failProfile)
          return route.fulfill({
            status: 400,
            json: { message: "Workspace temporarily unavailable" },
          });
        return route.fulfill({
          json: url.searchParams.has("id") ? profile : [profile],
        });
      }
      return route.fulfill({ json: [] });
    }
    throw new Error(`Unexpected mocked request: ${url.pathname}`);
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Explore sample workspace" }),
  ).toHaveCount(0);
  await page.getByLabel("Email address", { exact: true }).fill(profile.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Isolated-browser-fixture-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return state;
}

test("sign-in waits for profile resolution without flashing account unavailable", async ({
  page,
}) => {
  const state = await isolatedSignIn(page);
  await expect(page.getByRole("status")).toContainText("Loading workspace");
  await expect(page.getByText("Account access is unavailable")).toHaveCount(0);
  state.releaseProfile();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).accessWarningSeen)).toBe(
    false,
  );
});

test("a failed profile fetch offers retry without treating the account as disabled", async ({
  page,
}) => {
  const state = await isolatedSignIn(page, { failProfile: true });
  state.releaseProfile();
  await expect(
    page.getByRole("heading", { name: "We couldn’t load your workspace" }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).accessWarningSeen)).toBe(
    false,
  );
  state.failProfile = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
});

test("mobile profile name opens account details and only explicit Sign out ends the session", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await isolatedSignIn(page);
  state.releaseProfile();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  const profile = page.getByRole("button", {
    name: /Yashvardhan Sijala owner/,
  });
  await profile.click();
  await expect(profile).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#account-actions")).toContainText(
    "owner@example.test",
  );
  expect(state.logouts).toBe(0);
  await page.keyboard.press("Escape");
  await expect(profile).toBeFocused();
  await expect(profile).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".sidebar")).toBeVisible();
  await profile.click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(state.logouts).toBe(1);
});

test("confirmed pending accounts still require administrator approval", async ({
  page,
}) => {
  const state = await isolatedSignIn(page, { status: "pending" });
  state.releaseProfile();
  await expect(
    page.getByRole("heading", { name: "Your application is with us" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
