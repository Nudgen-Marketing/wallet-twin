import { absoluteUrl, SITE, serializeJsonLd } from "@/lib/seo/site";

/**
 * Site-wide structured data (schema.org): who publishes WalletTwin and what the app does.
 * Search engines and AI answer engines read it to describe the site without guessing.
 */
export function SiteJsonLd() {
  const url = absoluteUrl("/");
  const organizationId = `${url}#organization`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: SITE.name,
        url,
        logo: absoluteUrl("/icons/icon-512.png"),
      },
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: SITE.name,
        url,
        description: SITE.description,
        inLanguage: "en",
        publisher: { "@id": organizationId },
      },
      {
        "@type": "WebApplication",
        "@id": `${url}#app`,
        name: SITE.name,
        url,
        description: SITE.description,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Any (web browser)",
        browserRequirements: "Requires JavaScript. A Sui wallet is needed to create your own twin.",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "AI twin built from a Sui wallet's on-chain trading history",
          "Chat with any published wallet twin",
          "Wallet Wrapped share cards",
          "Public leaderboard of wallet twins",
          "Simulated paper copy-trading with no real funds",
          "MCP server for Claude, ChatGPT, Cursor and other AI agents",
        ],
        publisher: { "@id": organizationId },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Static data from SITE; serializeJsonLd escapes `<` regardless.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  );
}
