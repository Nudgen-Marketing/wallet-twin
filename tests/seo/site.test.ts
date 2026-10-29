import { afterEach, describe, expect, test, vi } from "vitest";
import { absoluteUrl, serializeJsonLd, siteUrl } from "@/lib/seo/site";

describe("site URLs", () => {
  afterEach(() => vi.unstubAllEnvs());

  test("builds absolute URLs on the configured public origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://wallet-twin.example.com");
    expect(siteUrl().origin).toBe("https://wallet-twin.example.com");
    expect(absoluteUrl("/twin/0xabc")).toBe("https://wallet-twin.example.com/twin/0xabc");
  });

  test("falls back to localhost when no public URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(absoluteUrl("/sitemap.xml")).toBe("http://localhost:3000/sitemap.xml");
  });
});

describe("serializeJsonLd", () => {
  test("escapes < so a value cannot close the script tag", () => {
    const json = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("</script>");
    expect(JSON.parse(json).name).toBe("</script><script>alert(1)</script>");
  });
});
