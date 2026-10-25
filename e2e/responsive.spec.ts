import { exploreAsDemo, expect, SCALPER, test } from "./fixtures";

const noHorizontalOverflow = async (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe("phone layout", () => {
  test("public pages fit the screen", async ({ page }) => {
    for (const path of ["/", "/leaderboard", `/twin/${SCALPER}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await noHorizontalOverflow(page), `overflow on ${path}`).toBe(true);
    }
  });

  test("signed-in pages fit the screen", async ({ page }) => {
    await exploreAsDemo(page, "The MAGMA scalper");
    for (const path of ["/twin/me", "/wrapped", "/portfolio", "/sync"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await noHorizontalOverflow(page), `overflow on ${path}`).toBe(true);
    }
  });
});
