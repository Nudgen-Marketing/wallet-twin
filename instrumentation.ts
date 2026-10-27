/**
 * Runs once per server start. A fresh production deploy starts with an empty database, so
 * fill in any missing demo twins in the background; dev servers and `next build` skip this.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { seedDemoTwinsInBackground } = await import("@/lib/demo-seed");
  seedDemoTwinsInBackground();
}
