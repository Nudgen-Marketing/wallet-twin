import "server-only";

/**
 * Loads a Google Font as TTF for next/og. Without a browser User-Agent, the css2 API
 * serves truetype URLs, which Satori can parse. Memoized per process; failures fall
 * back to next/og's default font instead of breaking the card.
 */

export interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700 | 900;
  style: "normal" | "italic";
}

const cache = new Map<string, Promise<OgFont | null>>();

async function fetchFont(family: string, weight: OgFont["weight"], style: OgFont["style"]): Promise<OgFont | null> {
  const axis = style === "italic" ? `ital,wght@1,${weight}` : `wght@${weight}`;
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axis}`;
  try {
    const css = await (await fetch(cssUrl)).text();
    const match = /src: url\((https:[^)]+)\) format\('(?:truetype|opentype)'\)/.exec(css);
    if (!match) return null;
    const data = await (await fetch(match[1])).arrayBuffer();
    return { name: family, data, weight, style };
  } catch (error: unknown) {
    console.error("[wrapped] font load failed", family, error instanceof Error ? error.message : error);
    return null;
  }
}

export function loadFont(family: string, weight: OgFont["weight"], style: OgFont["style"] = "normal"): Promise<OgFont | null> {
  const key = `${family}|${weight}|${style}`;
  if (!cache.has(key)) {
    const pending = fetchFont(family, weight, style).then((font) => {
      if (!font) cache.delete(key); // retry on the next card instead of caching a miss
      return font;
    });
    cache.set(key, pending);
  }
  return cache.get(key)!;
}

/** The display and mono faces every card uses. Missing fonts fall back to next/og's default. */
export async function loadCardFonts(): Promise<OgFont[]> {
  const fonts = await Promise.all([
    loadFont("Chakra Petch", 700),
    loadFont("Chakra Petch", 400),
    loadFont("JetBrains Mono", 500),
  ]);
  return fonts.filter((font): font is OgFont => font !== null);
}
