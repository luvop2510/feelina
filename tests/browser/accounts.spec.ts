import { test, expect, type Page } from "@playwright/test";

// These tests use the real app with an isolated Auth/Data API boundary. No requests
// reach a live Supabase project and no real user credentials are used.
const actorId = "10000000-0000-4000-8000-000000000001";
const newId = "10000000-0000-4000-8000-000000000002";
const customerId = "10000000-0000-4000-8000-000000000003";
const syntheticPassword = "Isolated-browser-fixture-2026";

async function workspace(
  page: Page,
  options: { initialPassword?: boolean; role?: string } = {},
) {
  const profile = {
    id: actorId,
    email: "owner@example.test",
    full_name: "Test workspace owner",
    username: "test.owner",
    role: options.role || "owner",
    status: "active",
    partner_type: "staff",
    must_change_password: Boolean(options.initialPassword),
  };
  const user = {
    id: actorId,
    email: profile.email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const profiles = [profile];
  const requests = {
    businessReads: [] as string[],
    passwordUpdates: [] as unknown[],
    creations: [] as Record<string, unknown>[],
  };
  let rejectPassword = false;
  let failCreation = true;
  const token = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: actorId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
      }),
    ).toString("base64url"),
    "synthetic-signature",
  ].join(".");
  await page.route("**/*.supabase.co/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
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
    if (url.pathname === "/auth/v1/user") {
      if (req.method() === "PUT") {
        requests.passwordUpdates.push(req.postDataJSON());
        if (rejectPassword)
          return route.fulfill({
            status: 422,
            json: {
              msg: "Password update was rejected by the test provider.",
              code: "weak_password",
            },
          });
        profile.must_change_password = false;
      }
      return route.fulfill({ json: user });
    }
    if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204 });
    if (url.pathname === "/functions/v1/manage-users") {
      const body = req.postDataJSON();
      if (body.action === "change-initial-password") {
        requests.passwordUpdates.push(body);
        if (rejectPassword)
          return route.fulfill({
            status: 400,
            json: {
              error: "Password update was rejected by the test provider.",
            },
          });
        profile.must_change_password = false;
        return route.fulfill({ json: { changed: true } });
      }
      requests.creations.push(body);
      if (failCreation) {
        failCreation = false;
        return route.fulfill({
          status: 503,
          json: { error: "Account lookup failed. Try again." },
        });
      }
      profiles.push({
        ...profile,
        id: newId,
        email: body.email,
        full_name: body.full_name,
        username: body.username,
        role: body.role,
        partner_type: body.partner_type,
        must_change_password: true,
      });
      return route.fulfill({
        status: 201,
        json: { id: newId, status: "active", must_change_password: true },
      });
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/").at(-1)!;
      if (table === "profiles")
        return route.fulfill({
          json: url.searchParams.has("id") ? profile : profiles,
        });
      requests.businessReads.push(table);
      if (table === "customers")
        return route.fulfill({
          json: [
            {
              id: customerId,
              name: "Test buyer",
              shop_name: "Test distributor",
              email: "buyer@example.test",
            },
          ],
        });
      return route.fulfill({ json: [] });
    }
    throw new Error(
      `Unexpected mocked Supabase request: ${req.method()} ${url.pathname}`,
    );
  });
  await page.goto("/");
  await page.getByLabel("Email address", { exact: true }).fill(profile.email);
  await page.getByLabel("Password", { exact: true }).fill(syntheticPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return {
    profile,
    profiles,
    requests,
    rejectPassword: (value: boolean) => {
      rejectPassword = value;
    },
  };
}

test("issued-password users remain gated through navigation and errors until Auth confirms a replacement", async ({
  page,
}) => {
  const state = await workspace(page, { initialPassword: true });
  await expect(
    page.getByRole("heading", { name: "Replace your initial password" }),
  ).toBeVisible();
  expect(state.requests.businessReads).toEqual([]);
  await page.evaluate(() => {
    location.hash = "settings";
  });
  await expect(
    page.getByRole("heading", { name: "Replace your initial password" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
  await page.getByLabel(/^New password/).fill(syntheticPassword);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill(syntheticPassword + "-different");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "The passwords do not match.",
  );
  expect(state.requests.passwordUpdates).toEqual([]);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill(syntheticPassword);
  state.rejectPassword(true);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Password update was rejected",
  );
  expect(state.requests.businessReads).toEqual([]);
  state.rejectPassword(false);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(
    page.getByRole("heading", { name: "Workspace settings" }),
  ).toBeVisible();
  expect(state.requests.passwordUpdates).toHaveLength(2);
  expect(state.requests.businessReads).toContain("orders");
});

test("owner creates a linked distributor with stable retry identity and sees the new directory entry", async ({
  page,
}) => {
  const state = await workspace(page);
  await page.locator('nav a[href="#settings"]').click();
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Access role").locator('option[value="owner"]'),
  ).toHaveCount(1);
  await dialog
    .getByLabel("Full name", { exact: true })
    .fill("Test distributor user");
  await dialog
    .getByLabel("Email address", { exact: true })
    .fill("distributor@example.test");
  await dialog.getByLabel("Username / directory ID").fill("test.distributor");
  await dialog.getByLabel("Initial password").fill(syntheticPassword);
  await dialog.getByLabel("Partner category").selectOption("distributor");
  await dialog
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  expect(state.requests.creations).toHaveLength(0);
  await dialog.getByLabel("Linked customer profile").selectOption(customerId);
  await dialog
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Account lookup failed. Try again.",
  );
  await expect(dialog.getByLabel("Email address", { exact: true })).toHaveValue(
    "distributor@example.test",
  );
  await dialog
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "distributor@example.test" }),
  ).toContainText("@test.distributor");
  expect(state.requests.creations).toHaveLength(2);
  expect(state.requests.creations[1]).toEqual(state.requests.creations[0]);
  expect(state.requests.creations[0]).toMatchObject({
    action: "create",
    role: "retailer",
    partner_type: "distributor",
    customer_id: customerId,
    username: "test.distributor",
  });
  expect(state.requests.creations[0].request_id).toMatch(/^[0-9a-f-]{36}$/i);
});

test("administrators cannot select owner or admin roles or manage existing privileged accounts", async ({
  page,
}) => {
  await workspace(page, { role: "admin" });
  await page.locator('nav a[href="#settings"]').click();
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Manage access" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  const role = page.getByRole("dialog").getByLabel("Access role");
  await expect(role.locator('option[value="owner"]')).toHaveCount(0);
  await expect(role.locator('option[value="admin"]')).toHaveCount(0);
  await expect(role.locator('option[value="sales"]')).toHaveCount(1);
});
