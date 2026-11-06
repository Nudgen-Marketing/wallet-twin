import { describe, expect, it } from "vitest";

import { splitBold } from "@/lib/twin/chat-format";

describe("splitBold", () => {
  it("returns plain text as a single segment", () => {
    expect(splitBold("We win 42% of trades.")).toEqual([{ text: "We win 42% of trades.", bold: false }]);
  });

  it("turns **double-star** spans into bold segments and drops the markers", () => {
    expect(splitBold("- **MAGMA:** −$2,173 over 407 trades")).toEqual([
      { text: "- ", bold: false },
      { text: "MAGMA:", bold: true },
      { text: " −$2,173 over 407 trades", bold: false },
    ]);
  });

  it("handles several bold spans on one line", () => {
    expect(splitBold("**a** and **b**")).toEqual([
      { text: "a", bold: true },
      { text: " and ", bold: false },
      { text: "b", bold: true },
    ]);
  });

  it("leaves an unclosed marker as literal text while a reply is still streaming", () => {
    expect(splitBold("- **Win rate")).toEqual([{ text: "- **Win rate", bold: false }]);
  });

  it("does not bold across a line break", () => {
    expect(splitBold("**a\nb**")).toEqual([{ text: "**a\nb**", bold: false }]);
  });

  it("returns no segments for empty text", () => {
    expect(splitBold("")).toEqual([]);
  });
});
