import { connectButton, expect, signInWithBurner, test } from "./fixtures";

test.describe("wallet sign-in and sync", () => {
  test("burner wallet signs in, syncs through Tatum, and signs out", async ({ page }) => {
    await signInWithBurner(page);

    await expect(page.getByRole("heading", { name: "Building your twin" })).toBeVisible();
    // First visit auto-starts the sync; a fresh burner has no history, so it completes quickly.
    await expect(page.getByText("Last sync complete")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Memory · local stand-in", { exact: false })).toBeVisible();
    await expect(page.getByText(/0 transactions · indexed since 2026-/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Talk to your twin →" })).toBeVisible();

    await page.getByRole("link", { name: "Talk to your twin →" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Twin of");
    await expect(page.getByRole("heading", { name: "Your twin is private" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(connectButton(page)).toContainText("Connect wallet");
    await page.goto("/twin/me");
    await expect(page.getByRole("heading", { name: "Your twin is waiting" })).toBeVisible();
  });
});

test.describe("API guards", () => {
  test("cross-site and unauthenticated requests are refused", async ({ request, baseURL }) => {
    const crossSite = await request.post("/api/auth/nonce", {
      headers: { Origin: "https://evil.example" },
      data: { address: "0x2" },
    });
    expect(crossSite.status()).toBe(403);

    const noSession = await request.post("/api/chat", {
      headers: { Origin: baseURL! },
      data: { messages: [] },
    });
    expect(noSession.status()).toBe(401);

    const forgedDemo = await request.post("/api/auth/demo", {
      headers: { Origin: baseURL! },
      data: { address: `0x${"1".repeat(64)}` },
    });
    expect(forgedDemo.status()).toBe(404);

    const badShare = await request.get(`/api/wrapped/og?a=0x2&t=nope`);
    expect(badShare.status()).toBe(404);
  });
});
