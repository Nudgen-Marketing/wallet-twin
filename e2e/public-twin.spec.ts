import { expect, PRIVATE_FACT, SAVER, SCALPER, short, test } from "./fixtures";

test.describe("leaderboard and public twins", () => {
  test("ranks published twins by simulated copy return", async ({ page }) => {
    await page.goto("/leaderboard");

    const rows = page.getByRole("main").getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(short(SCALPER));
    await expect(rows.nth(0)).toContainText("+12.5%");
    await expect(rows.nth(1)).toContainText(short(SAVER));
    await expect(rows.nth(1)).toContainText("−3.0%");
  });

  test("public page shows profile, insights and milestones, never private chat facts", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.getByRole("main").getByRole("link").filter({ hasText: short(SCALPER) }).click();
    await page.waitForURL(`**/twin/${SCALPER}`);

    // Client navigation keeps the leaderboard mounted (hidden); assert on what's visible.
    await expect(page.getByText("This wallet scalps MAGMA in hours.").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
    await expect(page.getByText("Sells within a few hours of buying.")).toBeVisible();
    await expect(page.getByText("Biggest win: +$50.00 on the first round trip.")).toBeVisible();
    await expect(page.getByText("Sign in to paper-copy this twin")).toBeVisible();

    const html = await page.content();
    expect(html).not.toContain(PRIVATE_FACT);
    expect(html).not.toContain("swapped 1,000 MAGMA for 150 USDC"); // [trade] memories stay private too
  });

  test("unknown or malformed twin addresses show not found", async ({ page }) => {
    await page.goto(`/twin/0x${"ab".repeat(32)}`);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
    await page.goto("/twin/not-an-address");
    await expect(page.getByText(/could not be found/i)).toBeVisible();
  });
});
