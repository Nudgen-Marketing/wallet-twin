import { exploreAsDemo, expect, SCALPER, test } from "./fixtures";

test.describe("Wallet Wrapped", () => {
  test("renders the card and produces a working share link", async ({ page, context }) => {
    await exploreAsDemo(page, "The MAGMA scalper");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Wrapped" }).click();

    const card = page.getByRole("img", { name: /Wallet Wrapped:/ });
    await expect(card).toBeVisible();
    await expect.poll(() => card.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 30_000 }).toBe(1200);

    const download = page.getByRole("link", { name: "Download PNG" });
    await expect(download).toHaveAttribute("download", "wallet-wrapped.png");

    const share = page.getByRole("link", { name: "Share on X" });
    const intent = new URL((await share.getAttribute("href"))!);
    expect(intent.hostname).toBe("x.com");
    const shareUrl = intent.searchParams.get("url")!;
    expect(shareUrl).toContain(`/w/${SCALPER}?t=`);
    expect(intent.searchParams.get("text")).toContain("6 swaps · 67% win rate · +$30.00 realized");

    // A logged-out visitor with the link sees the card and the social preview tags.
    const visitor = await context.browser()!.newPage();
    await visitor.goto(shareUrl);
    await expect(visitor.getByRole("img", { name: "Wallet Wrapped card" })).toBeVisible();
    await expect(visitor.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/api\/wrapped\/og\?a=/);
    await expect(visitor.getByRole("link", { name: "Make your own twin →" })).toBeVisible();
    await visitor.close();
  });

  test("a share link with the wrong token reveals nothing", async ({ page }) => {
    await page.goto(`/w/${SCALPER}?t=wrong-token`);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
    await expect(page.locator('img[src*="/api/wrapped/og"]')).toHaveCount(0);
    // Next emits robots tags in <head> and in the streamed body; both must say noindex.
    const robots = page.locator('meta[name="robots"]');
    await expect(robots.first()).toHaveAttribute("content", /noindex/);
    await expect(robots.last()).toHaveAttribute("content", /noindex/);
  });
});
