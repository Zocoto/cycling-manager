import { describe, expect, it } from "vitest";

import {
  getRaceJobPackFromSlot,
  selectRaceJobPack,
} from "@/lib/game/race-job-packs";

describe("race job packs", () => {
  it("assigns every edition to exactly one deterministic pack", () => {
    const editions = Array.from({ length: 30 }, (_, index) => `edition-${index}`);
    const runs = [0, 1, 2].map((packIndex) =>
      selectRaceJobPack({
        items: editions,
        getId: (edition) => edition,
        packIndex,
        packCount: 3,
        limit: 30,
      }).items,
    );

    expect(new Set(runs.flat())).toEqual(new Set(editions));
    expect(runs[0].filter((edition) => runs[1].includes(edition))).toEqual([]);
    expect(
      selectRaceJobPack({
        items: editions,
        getId: (edition) => edition,
        packIndex: 1,
        packCount: 3,
        limit: 30,
      }).items,
    ).toEqual(runs[1]);
  });

  it("keeps a bounded remainder for the next retry", () => {
    const selection = selectRaceJobPack({
      items: ["a", "b", "c", "d", "e"],
      getId: (item) => item,
      packIndex: 0,
      packCount: 1,
      limit: 3,
    });

    expect(selection.items).toEqual(["a", "b", "c"]);
    expect(selection.eligibleItems).toBe(5);
    expect(selection.deferredItems).toBe(2);
  });

  it("reads packed slots while keeping legacy cron URLs bounded", () => {
    expect(getRaceJobPackFromSlot("early-summer-pre-p2")).toEqual({
      packIndex: 1,
      packCount: 3,
    });
    expect(getRaceJobPackFromSlot("early-summer-pre")).toEqual({
      packIndex: 0,
      packCount: 1,
    });
    expect(() => getRaceJobPackFromSlot("early-summer-pre-p4")).toThrow(
      RangeError,
    );
  });
});
