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
  const skipSetup = page.getByRole("button", { name: "Skip setup" });
  if (await skipSetup.isVisible()) {
    await skipSetup.click();
  }
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

test("creates a local official record and shows it in Ledger", async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await openWorkspace(page);
  await addAccount(page, "Daily wallet");
  await page.getByRole("button", { name: "Capture" }).click();
  await page.getByLabel("Account", { exact: true }).selectOption("Daily wallet");
  await page.getByLabel("Category", { exact: true }).selectOption("Daily");
  await page.getByLabel("Merchant", { exact: true }).fill("全聯");
  await page.getByLabel("Item name", { exact: true }).fill("香蕉");
  await page.getByLabel("Amount", { exact: true }).fill("417");
  await page.getByRole("button", { name: "Save record" }).click();

  await expect(page.getByText("Record saved to the local ledger.")).toBeVisible();
  await page.getByRole("button", { name: "Open Ledger" }).click();

  await expect(page.getByRole("heading", { name: "Ledger", exact: true })).toBeVisible();
  await expect(page.getByLabel("Confirmed ledger records")).toContainText("全聯");
  await expect(page.getByText("No confirmed ledger records yet.")).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("captures a meal with multiple photos without a ledger write", async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await openWorkspace(page);
  await page.getByRole("button", { name: "Capture" }).click();
  await page.getByRole("button", { name: /Record meal/ }).click();
  await page.getByLabel("Meal photos").setInputFiles([
    { name: "meal-1.jpg", mimeType: "image/jpeg", buffer: Buffer.from("one") },
    { name: "meal-2.jpg", mimeType: "image/jpeg", buffer: Buffer.from("two") },
  ]);
  await page.getByRole("button", { name: "Save meal" }).click();

  await expect(page.getByText("Meal saved locally with 2 photos.")).toBeVisible();
  await page.getByRole("button", { name: "Ledger", exact: true }).click();
  await expect(page.getByText("No confirmed ledger records yet.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps invoice scans in review without creating a ledger record", async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await openWorkspace(page);
  await page.getByRole("button", { name: "Capture" }).click();
  await page.getByRole("button", { name: /Scan invoice/ }).click();
  await page.getByLabel("Scan images").setInputFiles({
    name: "invoice.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("invoice"),
  });
  await page.getByRole("button", { name: "Save scan drafts" }).click();

  await expect(page.getByText("1 scan draft saved locally for review.")).toBeVisible();
  await expect(page.getByText("invoice.jpg")).toBeVisible();
  await page.getByRole("button", { name: "Ledger", exact: true }).click();
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

test("keeps account option controls compact and aligned", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/");
  await page.getByRole("button", { name: "Open workspace" }).click();
  const onboardingControls = await page.locator(".onboarding-form input[type='checkbox'], .onboarding-form input[type='radio']").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );

  expect(onboardingControls).toHaveLength(3);
  for (const control of onboardingControls) {
    expect(control.width).toBeLessThanOrEqual(20);
    expect(control.height).toBeLessThanOrEqual(20);
  }

  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settingsControls = await page.locator(".draft-form input[type='checkbox'], .draft-form input[type='radio']").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );

  expect(settingsControls).toHaveLength(3);
  for (const control of settingsControls) {
    expect(control.width).toBeLessThanOrEqual(20);
    expect(control.height).toBeLessThanOrEqual(20);
  }
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
