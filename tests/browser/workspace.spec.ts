import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openAuthenticatedWorkspace } from "./fixtures/authenticated";
test("desktop authenticated routes, search, matrix entry and print are usable without writes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openAuthenticatedWorkspace(page);
  for (const route of [
    "catalogue",
    "customers",
    "inventory",
    "payments",
    "reports",
    "settings",
    "orders",
  ]) {
    await page.locator(`nav a[href="#${route}"]`).click();
    await expect(page.locator("main h1")).toBeVisible();
  }
  await page.getByPlaceholder("Search order or customer").fill("SAMPLE-1048");
  await page.getByRole("button", { name: "SAMPLE-1048", exact: true }).click();
  await expect(page.getByText("ORDER FORM", { exact: true })).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.pdf({
    path: "test-results/sample-order.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "All orders", exact: true }).click();
  await page.getByRole("button", { name: "Create order", exact: true }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByPlaceholder("Search product name or SKU").fill("FL-101");
  await page.locator(".product-picker button").click();
  const q = page.getByRole("spinbutton", {
    name: "Everyday Comfort, Rose, size 30 quantity",
    exact: true,
  });
  await q.fill("3");
  await page
    .getByRole("spinbutton", {
      name: "Everyday Comfort, Rose, size 32 quantity",
      exact: true,
    })
    .fill("2");
  await expect(page.locator(".grand-total")).toContainText("1,425");
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/order-matrix.png",
    fullPage: true,
  });
});
test("375px mobile navigation and matrix contain horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openAuthenticatedWorkspace(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator('nav a[href="#orders"]').click();
  await page.getByRole("button", { name: "Create order", exact: true }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.locator(".product-picker button").first().click();
  await page
    .getByRole("spinbutton", {
      name: "Everyday Comfort, Rose, size 30 quantity",
      exact: true,
    })
    .fill("2");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-matrix.png",
    fullPage: true,
  });
});
for (const colorScheme of ["light", "dark"] as const)
  test(`accessibility in ${colorScheme} appearance`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await openAuthenticatedWorkspace(page);
    for (const route of [
      "dashboard",
      "orders",
      "catalogue",
      "customers",
      "inventory",
      "payments",
      "reports",
      "settings",
    ]) {
      await page.locator(`nav a[href="#${route}"]`).click();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((x) => ({
          id: x.id,
          nodes: x.nodes.map((n) => n.target),
        })),
        route,
      ).toEqual([]);
    }
    await page.screenshot({
      path: `test-results/dashboard-${colorScheme}.png`,
      fullPage: true,
    });
  });

test("unsaved matrix navigation can be cancelled without losing quantities", async ({
  page,
}) => {
  await openAuthenticatedWorkspace(page);
  await page.getByRole("button", { name: "Create order", exact: true }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.locator(".product-picker button").first().click();
  const quantity = page.getByRole("spinbutton", {
    name: "Everyday Comfort, Rose, size 30 quantity",
    exact: true,
  });
  await quantity.fill("7");
  page.once("dialog", (d) => d.dismiss());
  await page.locator('nav a[href="#catalogue"]').click();
  await expect(quantity).toHaveValue("7");
  await expect(page).toHaveURL(/#orders\/new$/);
  page.once("dialog", (d) => d.accept());
  await page.locator('nav a[href="#catalogue"]').click();
  await expect(
    page.getByRole("heading", { name: "Catalogue", exact: true }),
  ).toBeVisible();
});

test("Google sign-in is visible and a disabled provider gives a recoverable error", async ({
  page,
}) => {
  await page.route("**/auth/v1/settings", (route) =>
    route.fulfill({ json: { external: { google: false } } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Google sign-in is awaiting provider setup",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Apply for partner access", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeVisible();
});
test("Google sign-in starts a PKCE flow at Supabase with the approved callback", async ({
  page,
}) => {
  await page.route("**/auth/v1/settings", (route) =>
    route.fulfill({ json: { external: { google: true } } }),
  );
  let requested = "";
  await page.route("**/auth/v1/authorize?**", (route) => {
    requested = route.request().url();
    return route.fulfill({
      contentType: "text/html",
      body: "<h1>Isolated OAuth redirect test</h1>",
    });
  });
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Isolated OAuth redirect test" }),
  ).toBeVisible();
  const query = new URL(requested).searchParams;
  expect(query.get("provider")).toBe("google");
  expect(query.get("redirect_to")).toBe(origin + "/");
  expect(query.get("code_challenge_method")).toBe("s256");
  expect(query.get("code_challenge")).toBeTruthy();
  expect(query.get("prompt")).toBe("select_account");
});

test("100 long product rows print on A4 without clipping or losing the final totals", async ({
  page,
}) => {
  await page.goto("/tests/browser/fixtures/long-order.html");
  await expect(page.locator(".order-document .matrix tbody tr")).toHaveCount(
    100,
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(
    page.getByText("PRINT-END-MARKER", { exact: false }),
  ).toBeVisible();
  const pdf = await page.pdf({
    path: "test-results/long-order.pdf",
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  // Chromium emits uncompressed page dictionaries even when content streams are compressed.
  const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || [])
    .length;
  expect(pageCount).toBeGreaterThan(2);
  expect(pageCount).toBeLessThan(25);
  expect(
    await page
      .locator(".order-document")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});
