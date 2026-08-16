import { describe, expect, it } from "vitest";

import {
  applyCyclogazetteInterviewReactionState,
  isCyclogazetteInterviewReactionEmoji,
} from "./cyclogazette-interview-reactions";

describe("Cyclogazette interview reactions", () => {
  it("recognizes only the published emoji palette", () => {
    expect(isCyclogazetteInterviewReactionEmoji("😂")).toBe(true);
    expect(isCyclogazetteInterviewReactionEmoji("❤️")).toBe(true);
    expect(isCyclogazetteInterviewReactionEmoji("👍")).toBe(false);
  });

  it("optimistically adds and removes the viewer reaction", () => {
    const added = applyCyclogazetteInterviewReactionState([], "😂", true);
    expect(added).toEqual([
      { emoji: "😂", count: 1, reactedByViewer: true },
    ]);

    expect(
      applyCyclogazetteInterviewReactionState(added, "😂", false),
    ).toEqual([]);
  });

  it("accepts the exact count returned by the database", () => {
    expect(
      applyCyclogazetteInterviewReactionState(
        [{ emoji: "👏", count: 2, reactedByViewer: false }],
        "👏",
        true,
        4,
      ),
    ).toEqual([{ emoji: "👏", count: 4, reactedByViewer: true }]);
  });
});
