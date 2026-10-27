import type { CSSProperties } from "react";

/** Sets the `--i` index that `.rise` / `.bar-fill` use to stagger their entrance. */
export function stagger(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}
