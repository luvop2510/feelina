import { test, expect } from "@playwright/test";

test("order PDF uses the approved size chart and a padded tabular summary on one A4 page", async ({
  page,
}) => {
  await page.goto("/tests/browser/fixtures/pdf-order.html");
  await page.emulateMedia({ media: "print", colorScheme: "light" });
  await page.evaluate(() => document.fonts.ready);
  for (const [size, label] of Object.entries({
    "38": "XXL",
    "40": "XXXL",
    "42": "4XL",
    "44": "5XL",
  })) {
    await expect(
      page
        .locator(".print-matrix thead th")
        .filter({ hasText: size })
        .locator("small"),
    ).toHaveText(label);
  }
  await expect(
    page.getByRole("table", { name: "Order amount summary" }),
  ).toBeVisible();
  const geometry = await page.locator(".print-matrix").evaluate((table) => {
    const cell = table.querySelector("tbody td")!;
    const style = getComputedStyle(cell);
    return {
      top: parseFloat(style.paddingTop),
      bottom: parseFloat(style.paddingBottom),
      border: parseFloat(style.borderLeftWidth),
      overflowing: [...table.querySelectorAll("td")].some(
        (td) => td.scrollWidth > td.clientWidth + 1,
      ),
    };
  });
  expect(geometry.top).toBeGreaterThan(7);
  expect(geometry.bottom).toBeGreaterThan(7);
  expect(geometry.border).toBeGreaterThan(0);
  expect(geometry.overflowing).toBe(false);
  const pdf = await page.pdf({
    path: "test-results/order-layout.pdf",
    format: "A4",
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(
    (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length,
  ).toBe(1);
});

test("order document remains contained on a 390px phone with a scrollable size matrix", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/fixtures/pdf-order.html");
  await expect(page.locator(".document-summary")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".order-document .table-wrap")
      .evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/order-mobile.png",
    fullPage: true,
  });
});
