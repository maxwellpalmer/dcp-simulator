import { test, expect } from "@playwright/test";

test.describe("Uni solo mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Should default to Uni mode
    await expect(page.getByRole("tab", { name: "Uni (solo)" })).toHaveAttribute(
      "aria-selected", "true",
    );
  });

  test("loads and renders map SVG", async ({ page }) => {
    const svg = page.locator("svg[role='img']");
    await expect(svg).toBeVisible();
    // Should have hex polygons
    const polys = svg.locator("polygon");
    expect(await polys.count()).toBeGreaterThanOrEqual(70);
  });

  test("random plan loads and validates", async ({ page }) => {
    await page.getByRole("button", { name: "Random plan" }).click();
    // Stats should show 7 district rows
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(7);
    // Click validate
    await page.getByRole("button", { name: /validate/i }).click();
    await expect(page.getByText("Plan is valid")).toBeVisible();
  });

  test("clicking a block changes its color", async ({ page }) => {
    const svg = page.locator("svg[role='img']");
    const firstPoly = svg.locator("polygon").first();
    const fillBefore = await firstPoly.getAttribute("fill");
    await firstPoly.click();
    const fillAfter = await firstPoly.getAttribute("fill");
    expect(fillAfter).not.toBe(fillBefore);
  });

  test("undo reverses the last action", async ({ page }) => {
    await page.getByRole("button", { name: "Random plan" }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(7);
    await page.getByRole("button", { name: "Undo" }).click();
    // After undo the assignment should be empty so no 7-row table
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(0);
  });

  test("switching grid resets the map", async ({ page }) => {
    await page.getByRole("button", { name: "Random plan" }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(7);
    // Switch to 140 grid
    await page.locator("select").first().selectOption("140");
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(0);
  });

  test("validation catches unassigned blocks", async ({ page }) => {
    // No plan loaded → all unassigned
    await page.getByRole("button", { name: /validate/i }).click();
    await expect(page.getByText(/blocks? unassigned/i)).toBeVisible();
  });

  test("keyboard shortcuts switch district", async ({ page }) => {
    // Press "3" to select district 3
    await page.keyboard.press("3");
    const btn = page.locator("button", { hasText: "3" }).first();
    await expect(btn).toHaveClass(/ring-2/);
  });
});
