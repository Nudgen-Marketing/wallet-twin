import { expect, SCALPER, short, signInWithBurner, test } from "./fixtures";

test.describe("paper copy trading (simulated)", () => {
  test("follow a published twin, see the $1,000 paper portfolio, then stop", async ({ page }) => {
    await signInWithBurner(page);

    await page.goto(`/twin/${SCALPER}`);
    await page.getByRole("button", { name: "Paper-copy this twin · $1,000 simulated" }).click();
    await expect(page.getByRole("link", { name: "See your paper portfolio →" })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: "See your paper portfolio →" }).click();
    await expect(page.getByText("Simulated · no real funds")).toBeVisible();
    const card = page.getByRole("article").filter({ hasText: `Copying ${short(SCALPER)}` });
    await expect(card).toBeVisible();
    await expect(card.getByText("$1,000").first()).toBeVisible();
    // The page polls Tatum on load; the outcome is reported either way.
    await expect(page.getByRole("status")).toBeVisible({ timeout: 60_000 });

    await page.goto(`/twin/${SCALPER}`);
    await page.getByRole("button", { name: "Stop paper-copying" }).click();
    await expect(page.getByRole("button", { name: "Paper-copy this twin · $1,000 simulated" })).toBeVisible();
    await page.goto("/portfolio");
    await expect(page.getByText("You aren't paper-copying anyone yet.", { exact: false })).toBeVisible();
  });
});

test.describe("publishing", () => {
  test("a synced twin can be published to the leaderboard and unpublished again", async ({ page }) => {
    await signInWithBurner(page);
    await expect(page.getByText("Last sync complete")).toBeVisible({ timeout: 60_000 });
    const me = (await page.getByRole("button", { name: "Sign out" }).locator("..").textContent()) ?? "";
    const address = /0x[0-9a-f]{4}…[0-9a-f]{4}/.exec(me)?.[0];
    expect(address).toBeTruthy();

    await page.goto("/twin/me");
    await page.getByRole("button", { name: "Publish my twin" }).click();
    await expect(page.getByRole("heading", { name: "Your twin is public" })).toBeVisible();

    await page.goto("/leaderboard");
    await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: address! })).toBeVisible();

    await page.goto("/twin/me");
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByRole("heading", { name: "Your twin is private" })).toBeVisible();
    await page.goto("/leaderboard");
    await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: address! })).toHaveCount(0);
  });
});
