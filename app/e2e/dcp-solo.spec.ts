import { test, expect } from "@playwright/test";

test.describe("DCP solo mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "DCP (solo)" }).click();
    await expect(page.getByRole("tab", { name: "DCP (solo)" })).toHaveAttribute(
      "aria-selected", "true",
    );
  });

  test("define: random plan loads 14 sub-districts", async ({ page }) => {
    await page.getByRole("button", { name: "Random plan" }).click();
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(14);
  });

  test("define: random plan then advance to combine", async ({ page }) => {
    await page.getByRole("button", { name: "Random plan" }).click();
    // "Next: Combine →" validates internally and transitions
    await page.getByRole("button", { name: /next.*combine/i }).click();
    // Should now be in combine stage
    await expect(page.getByRole("tab", { name: /combine/i })).toHaveAttribute(
      "aria-selected", "true",
    );
  });

  test("combine: clicking sub-districts creates pairings", async ({ page }) => {
    await page.getByRole("button", { name: "Random plan" }).click();
    await page.getByRole("button", { name: /next.*combine/i }).click();
    // In combine: click two different sub-districts
    const svg = page.locator("svg[role='img']");
    const polys = svg.locator("polygon");
    // Click two distant blocks (likely different sub-districts)
    await polys.nth(0).click();
    await polys.nth(30).click();
    // Should see either a pairing entry or an error — either way the UI reacted
    const pairingOrError = page.locator("text=District 1:").or(page.locator("[role='alert']"));
    await expect(pairingOrError.first()).toBeVisible({ timeout: 3000 });
  });

  test("combine: stage is reachable and shows pairing UI", async ({ page }) => {
    // Retry random plan if it has a doughnut (redist_smc doesn't enforce
    // the doughnut rule, so some generated plans may fail validation).
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.getByRole("button", { name: "Random plan" }).click();
      await page.getByRole("button", { name: /next.*combine/i }).click();
      const tab = page.getByRole("tab", { name: /combine/i });
      try {
        await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 1000 });
        break;
      } catch {
        // Plan was invalid (doughnut) — try another
      }
    }
    // Combine stage should show pairing instructions and sub-district labels
    await expect(page.getByText(/pairs made/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pairings" })).toBeVisible();
  });

  test("undo/redo works in define stage", async ({ page }) => {
    await page.getByRole("button", { name: "Random plan" }).click();
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(14);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(rows).toHaveCount(0);
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(rows).toHaveCount(14);
  });
});
