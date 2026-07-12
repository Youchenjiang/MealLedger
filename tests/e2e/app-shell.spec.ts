import { expect, test, type Page } from "@playwright/test";

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  return errors;
}

async function openWorkspace(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
}

async function addAccount(page: Page, name: string) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Account name").fill(name);
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByLabel("Available accounts")).toContainText(name);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1))
    .toBe(true);
}

async function expectHorizontallyWithinViewport(page: Page, selector: string) {
  const viewport = page.viewportSize();
  const boxes = await page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }),
  );

  if (!viewport) {
    throw new Error("Playwright viewport size is unavailable.");
  }

  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(viewport.width);
  }
}

test("creates a local draft and keeps the confirmed ledger empty", async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await openWorkspace(page);
  await addAccount(page, "Daily wallet");
  await page.getByRole("button", { name: "Capture" }).click();
  await page.getByLabel("Account").selectOption("Daily wallet");
  await page.getByLabel("Merchant").fill("全聯");
  await page.getByLabel("Item name").fill("香蕉");
  await page.getByLabel("Amount").fill("417");
  await page.getByRole("button", { name: "Create draft" }).click();

  await expect(page.getByRole("heading", { name: "Draft ready for review" })).toBeVisible();
  await page.getByRole("button", { name: "Review in Ledger" }).click();

  await expect(page.getByRole("heading", { name: "Ledger", exact: true })).toBeVisible();
  await expect(page.getByLabel("Draft records waiting for review")).toContainText("全聯");
  await expect(page.getByText("No confirmed ledger records yet.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps the desktop shell within its viewport", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await openWorkspace(page);
  await expect(page.locator("aside[aria-label='MealLedger navigation']")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("keeps mobile navigation usable without horizontal overflow", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await openWorkspace(page);
  await page.getByRole("button", { name: "Capture" }).click();
  await expect(page.getByRole("heading", { name: "Capture", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ledger", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ledger", exact: true })).toBeVisible();
  await expectHorizontallyWithinViewport(page, "aside[aria-label='MealLedger navigation'] .nav-item");
  await expectHorizontallyWithinViewport(page, ".table-card");
  await expect
    .poll(() => page.locator(".table-card").evaluate((element) => element.scrollWidth > element.clientWidth))
    .toBe(true);
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("keeps compact navigation stable near its breakpoint", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 720, height: 900 });

  await openWorkspace(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
