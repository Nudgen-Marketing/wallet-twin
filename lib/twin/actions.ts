import "server-only";
import type { Session } from "@/lib/auth/token";
import { db } from "@/lib/db";
import { publishTwin, unpublishTwin } from "@/lib/twin/publish";

/** A rule the caller broke, with the HTTP status the web routes answer with. */
export class TwinActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "TwinActionError";
  }
}

/** Opt a twin in or out of the leaderboard and public chat, with the same rules for every caller. */
export async function setPublished(session: Session, publish: boolean): Promise<void> {
  if (session.demo && !publish) throw new TwinActionError("Demo twins stay public so everyone can try them.", 403);
  if (!publish) {
    await unpublishTwin(session.address);
    return;
  }
  const synced = await db.syncState.findUnique({ where: { address: session.address } });
  if (!synced) throw new TwinActionError("Sync your wallet before publishing your twin.", 409);
  await publishTwin(session.address);
}
