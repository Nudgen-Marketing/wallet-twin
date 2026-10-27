import type { ReactNode } from "react";

/** Remounts per top-level route, so the scene wipe replays on every navigation. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="route-wipe" />
      {children}
    </>
  );
}
