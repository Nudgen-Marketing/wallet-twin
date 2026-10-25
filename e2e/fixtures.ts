import { test as base, expect, type Page } from "@playwright/test";

export { expect };

export const SCALPER = "0x854b8c1993e4396468f166a628e9926a2b18b398f104d8d3046c67bc32a2c940";
export const SAVER = "0x4999139366a0c303b7cf1e683d24d1d8adb0de38e342fdfdee8788f8d1976c58";
/** Seeded as the scalper's private [chat] memory; must never reach a public page. */
export const PRIVATE_FACT = "E2E-PRIVATE-FACT";

/** Browser noise that isn't an app bug. */
const IGNORED_CONSOLE = [
  /Failed to load resource/, // expected 4xx from guarded APIs; 5xx are caught via responses below
  /Download the React DevTools/,
  /unsafe burner wallet/i,
  /Lit is in dev mode/,
];

/**
 * Every test fails on uncaught page errors, unexpected console errors, or any 5xx from
 * our own server, so silent breakage surfaces even when assertions pass.
 */
/** In dev, Next replays server-side console output in the browser, tagged "Server". */
const isForwardedServerLog = (text: string) => /^%c%s%c .*\bServer\b/.test(text);

export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page, baseURL }, use, testInfo) => {
      const problems: string[] = [];
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
        // Server logs aren't browser errors (real server failures surface as 5xx below),
        // but keep them visible in the report.
        if (isForwardedServerLog(text)) {
          testInfo.annotations.push({ type: "server-log", description: text.replace(/%c|%s|background:[^ ]+|color:[^ ]+|border-radius:[^ ]+/g, "").trim().slice(0, 300) });
          return;
        }
        problems.push(`console: ${text.slice(0, 300)}`);
      });
      page.on("response", (response) => {
        if (response.status() >= 500 && baseURL && response.url().startsWith(baseURL)) {
          problems.push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
        }
      });
      await use(problems);
      expect(problems, "unexpected browser errors").toEqual([]);
    },
    { auto: true },
  ],
});

/** dApp Kit's connect button is a web component; its label is slotted into an open shadow root. */
export const connectButton = (page: Page) => page.locator("mysten-dapp-kit-connect-button");

/** Connects the dev-only burner wallet and signs the sign-in message; lands on /sync. */
export async function signInWithBurner(page: Page): Promise<void> {
  await page.goto("/");
  await connectButton(page).click();
  await page.getByRole("button", { name: "Unsafe Burner Wallet" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/sync");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

/** Signs in as one of the seeded demo wallets via the landing page; lands on /twin/me. */
export async function exploreAsDemo(page: Page, label: string): Promise<void> {
  await page.goto("/");
  const card = page.getByRole("listitem").filter({ hasText: label });
  await card.getByRole("button", { name: "Explore as this wallet" }).click();
  await page.waitForURL("**/twin/me");
}

export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
