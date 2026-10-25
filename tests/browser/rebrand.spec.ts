import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { openAuthenticatedWorkspace } from "./fixtures/authenticated";
const routes = [
  "dashboard",
  "orders",
  "catalogue",
  "customers",
  "inventory",
  "payments",
  "reports",
  "settings",
];
const output = "test-results/rebrand-after";
for (const width of [320, 390, 768, 1024, 1440]) {
  test(`all workspace screens fit ${width}px and use the Superior typeface`, async ({
    page,
  }) => {
    mkdirSync(output, { recursive: true });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await openAuthenticatedWorkspace(page);
    for (const route of routes) {
      if (width <= 800)
        await page.getByRole("button", { name: "Open navigation" }).click();
      await page.locator(`nav a[href="#${route}"]`).click();
      await expect(page.locator("main h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route,
      ).toBe(true);
      expect(
        await page.evaluate(() => document.fonts.check("400 14px Inter")),
        route,
      ).toBe(true);
      if (route === "dashboard" && width <= 390) {
        const track = await page
          .locator(".pipeline-track")
          .first()
          .boundingBox();
        expect(track?.width).toBeGreaterThan(40);
      }
      await page.screenshot({
        path: `${output}/${route}-${width}.png`,
        fullPage: true,
      });
      if (width === 1440) {
        mkdirSync(".taste-skill/snapshots", { recursive: true });
        const body = await page.locator("body").innerHTML();
        const origin = new URL(page.url()).origin;
        const css = (await page.locator("style").allTextContents())
          .join("\n")
          .replaceAll("/fonts/", `${origin}/fonts/`);
        writeFileSync(
          `.taste-skill/snapshots/${route}.html`,
          `<!doctype html><html lang="en"><head><base href="${origin}/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")}</body></html>`,
        );
      }
    }
  });
}
test("mobile navigation contains focus, closes with Escape, and restores its trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedWorkspace(page);
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(
    await page
      .locator(".sidebar")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: `${output}/mobile-navigation.png` });
  await page.locator(".profile-button").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".sidebar .wordmark")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".profile-button")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.locator(".sidebar")).toBeHidden();
  await trigger.click();
  await page.locator('nav a[href="#orders"]').click();
  await expect(page.locator("main h1")).toBeFocused();
});
for (const colorScheme of ["light", "dark"] as const) {
  test(`auth modes and dialogs remain accessible in ${colorScheme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/");
    for (const mode of ["login", "register", "reset"]) {
      if (mode === "register")
        await page
          .getByRole("button", { name: "Apply for partner access" })
          .click();
      if (mode === "reset") {
        await page.getByRole("button", { name: "Back to sign in" }).click();
        await page.getByRole("button", { name: "Forgot password?" }).click();
      }
      await expect(page.locator("h1")).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `${output}/auth-${mode}-${colorScheme}.png`,
        fullPage: true,
      });
    }
    await openAuthenticatedWorkspace(page);
    await page
      .getByRole("button", { name: "Create order", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add product", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `${output}/product-dialog-${colorScheme}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Add product", exact: true }),
    ).toBeFocused();
  });
}

test("phone dialogs keep touch actions separated and product photos fill their frame", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const fixture = await openAuthenticatedWorkspace(page);
  const photoUrl = "https://images.example.test/portrait.svg";
  await page.route(photoUrl, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="600"><rect width="200" height="600" fill="#c66b41"/><rect x="40" y="100" width="120" height="400" fill="#eadac0"/></svg>',
    }),
  );
  fixture.data.products[0].image_url = photoUrl;
  await page.getByRole("button", { name: "Refresh workspace" }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator('nav a[href="#catalogue"]').click();
  const art = page.locator(".product-art").first();
  const photo = art.locator("img");
  await expect(photo).toBeVisible();
  await expect
    .poll(() =>
      photo.evaluate(
        (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const frameBox = await art.boundingBox();
  const imageBox = await photo.boundingBox();
  expect(Math.abs(frameBox!.width - imageBox!.width)).toBeLessThan(1);
  expect(Math.abs(frameBox!.height - imageBox!.height)).toBeLessThan(1);
  expect(await photo.evaluate((el) => getComputedStyle(el).objectFit)).toBe(
    "cover",
  );
  await page.screenshot({
    path: `${output}/product-photo-320.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const actions = dialog.locator(".modal-actions button");
    await actions.last().scrollIntoViewIfNeeded();
    const boxes = await actions.evaluateAll((elements) =>
      elements.map((el) => el.getBoundingClientRect().toJSON()),
    );
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(24);
      expect(box.right).toBeLessThanOrEqual(width - 24);
    }
    expect(boxes[1].top - boxes[0].bottom).toBeGreaterThanOrEqual(8);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: `${output}/product-actions-${width}.png`,
      fullPage: true,
    });
  }
  expect(fixture.unexpectedRequests).toEqual([]);
});
