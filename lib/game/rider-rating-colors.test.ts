import { describe, expect, it } from "vitest";

import { getRiderRatingColorClasses } from "@/lib/game/rider-rating-colors";

describe("getRiderRatingColorClasses", () => {
  it.each([
    [49, "bg-white"],
    [50, "bg-[#DDF3E3]"],
    [60, "bg-[#A9DFB7]"],
    [70, "bg-[#3F8F5A]"],
    [81, "bg-[#F4B04D]"],
    [91, "bg-[#D84B4B]"],
  ])("applique la bonne couleur à la note %i", (value, expectedClass) => {
    expect(getRiderRatingColorClasses(value)).toContain(expectedClass);
  });
});
