import { describe, expect, it } from "vitest";

import { isPostRaceInterviewWindowOpen } from "./post-race-interview-window";

describe("fenêtre des interviews après-course", () => {
  it("reste ouverte le jour de course jusqu'à 20 h de Paris", () => {
    expect(
      isPostRaceInterviewWindowOpen(
        "2026-08-07",
        new Date("2026-08-07T17:59:00.000Z"),
      ),
    ).toBe(true);
  });

  it("se ferme à 20 h et pour les courses précédentes", () => {
    expect(
      isPostRaceInterviewWindowOpen(
        "2026-08-07",
        new Date("2026-08-07T18:00:00.000Z"),
      ),
    ).toBe(false);
    expect(
      isPostRaceInterviewWindowOpen(
        "2026-08-06",
        new Date("2026-08-07T12:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
