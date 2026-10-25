import { exploreAsDemo, expect, SCALPER, short, test } from "./fixtures";

test.describe("demo twin (no wallet)", () => {
  test("shows the seeded stats, the demo notice and a locked publish toggle", async ({ page }) => {
    await exploreAsDemo(page, "The MAGMA scalper");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(short(SCALPER));
    await expect(page.getByText("Demo", { exact: true })).toBeVisible();
    await expect(page.getByText(/Demo mode: you're exploring a seeded mainnet wallet/)).toBeVisible();

    const numbers = page.getByRole("region", { name: "The numbers" });
    await expect(numbers.getByText("+$30.00")).toBeVisible(); // +50 −40 +20
    await expect(numbers.getByText("67%")).toBeVisible(); // 2 of 3 closed trades won
    // Favorite-token counts also show "6", so scope each figure by its label.
    const figure = (label: string) => numbers.locator("dl > div").filter({ hasText: label }).locator("dd").first();
    await expect(figure("Total swaps")).toHaveText("6");
    await expect(numbers.getByText("3.4 h")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Your twin is public" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeDisabled();
  });

  test("chat sends the question and always answers (reply or a friendly error)", async ({ page }) => {
    await exploreAsDemo(page, "The MAGMA scalper");
    const chat = page.getByRole("region", { name: "Chat with Your twin" });

    await chat.getByRole("button", { name: "What's my worst habit?" }).click();

    await expect(chat.getByText("What's my worst habit?")).toBeVisible();
    const reply = chat.locator("article").filter({ has: page.getByText("Twin", { exact: true }) });
    const failure = chat.getByRole("alert");
    await expect(reply.or(failure).first()).toBeVisible({ timeout: 60_000 });
    if (await failure.isVisible()) {
      await expect(failure).not.toHaveText("");
      test.info().annotations.push({ type: "llm", description: `Chat returned an error: ${await failure.textContent()}` });
    }
    await expect(chat.getByRole("textbox", { name: "Message your twin" })).toBeEnabled();
  });
});
