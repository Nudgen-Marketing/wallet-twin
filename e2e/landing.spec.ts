import { connectButton, expect, test } from "./fixtures";

test.describe("landing page", () => {
  test("pitches the product, offers demo twins and shows the top twins", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your wallet has a memory.");
    await expect(page.getByRole("heading", { name: "No wallet handy? Try a demo twin" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Explore as this wallet" })).toHaveCount(2);

    const topTwins = page.getByRole("region", { name: "Top twins" });
    await expect(topTwins.getByRole("link")).toHaveCount(3); // 2 twins + "Full leaderboard"
    await expect(topTwins).toContainText("+12.5%");

    await expect(page.getByRole("contentinfo")).toContainText("Data via Tatum");
    await expect(connectButton(page)).toContainText("Connect wallet");
  });

  test("main navigation reaches every section", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main navigation" });

    await nav.getByRole("link", { name: "Leaderboard" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(nav.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "My twin" }).click();
    await expect(page.getByRole("heading", { name: "Your twin is waiting" })).toBeVisible();

    await nav.getByRole("link", { name: "Wrapped" }).click();
    await expect(page.getByText("sign in (top right) to get your Wrapped")).toBeVisible();

    await nav.getByRole("link", { name: "Paper portfolio" }).click();
    await expect(page.getByText("Sign in (top right) to see your paper portfolio.")).toBeVisible();
  });
});
