import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function sample(page: any) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "A little clarity for your day." }),
  ).toBeVisible();
}
test("desktop sample routes, search, matrix entry and print are usable without writes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await sample(page);
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
  ).toBeDisabled();
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
  await sample(page);
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
    await sample(page);
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
