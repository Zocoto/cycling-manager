import { describe, expect, it } from "vitest";

import {
  convertCsRatingDeltaToPcm,
  convertCsRatingToPcm,
  deriveGlobalRatingScale,
  type RatingSource,
} from "@/lib/game/pcm-export/ratings";

describe("conversion des notes CS vers PCM", () => {
  it("utilise une echelle absolue independante de la population exportee", () => {
    const ratings = [rating(35), rating(81)];
    const scale = deriveGlobalRatingScale(ratings);

    expect(scale.csMinimum).toBe(0);
    expect(scale.csMaximum).toBe(100);
    expect(scale.pcmMinimum).toBe(45);
    expect(scale.pcmMaximum).toBe(85);
    expect(convertCsRatingToPcm(35, scale)).toBe(59);
    expect(convertCsRatingToPcm(70, scale)).toBe(73);
    expect(convertCsRatingToPcm(81, scale)).toBe(77);
    expect(convertCsRatingToPcm(100, scale)).toBe(85);
  });

  it("borne les valeurs et conserve le rapport des ecarts", () => {
    const scale = deriveGlobalRatingScale([rating(35), rating(81)]);

    expect(convertCsRatingToPcm(-10, scale)).toBe(45);
    expect(convertCsRatingToPcm(120, scale)).toBe(85);
    expect(convertCsRatingDeltaToPcm(10, scale)).toBe(4);
  });
});

function rating(value: number): RatingSource {
  return {
    mountain: value,
    hills: value,
    flat: value,
    time_trial: value,
    cobbles: value,
    sprint: value,
    acceleration: value,
    downhill: value,
    endurance: value,
    resistance: value,
    recovery: value,
    breakaway: value,
    prologue: value,
  };
}
