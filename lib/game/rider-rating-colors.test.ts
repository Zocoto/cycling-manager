import { describe, expect, it } from "vitest";

import { getRiderRatingColorClasses } from "@/lib/game/rider-rating-colors";

describe("getRiderRatingColorClasses", () => {
  it.each([
    [49, "bg-white"],
    [50, "bg-[#E2F1E6]"],
    [55, "bg-[#CCE8D3]"],
    [60, "bg-[#A7D6B2]"],
    [65, "bg-[#72B385]"],
    [70, "bg-[#478D62]"],
    [75, "bg-[#2F7650]"],
    [80, "bg-[#F2B94B]"],
    [85, "bg-[#E58A3F]"],
    [90, "bg-[#C84E47]"],
    [95, "bg-[#B93847]"],
  ])("applique la bonne couleur à la note %i", (value, expectedClass) => {
    expect(getRiderRatingColorClasses(value)).toContain(expectedClass);
  });

  it("uses a lighter palette for secondary ratings", () => {
    expect(getRiderRatingColorClasses(95, "primary")).toContain(
      "bg-[#B93847]",
    );
    expect(getRiderRatingColorClasses(95, "secondary")).toContain(
      "bg-[#F2D5D8]",
    );
    expect(getRiderRatingColorClasses(70, "secondary")).toContain(
      "bg-[#E0EDE3]",
    );
  });

  it("keeps each five-point band stable up to the next threshold", () => {
    for (let threshold = 50; threshold < 95; threshold += 5) {
      expect(getRiderRatingColorClasses(threshold + 4)).toBe(
        getRiderRatingColorClasses(threshold),
      );
      expect(getRiderRatingColorClasses(threshold + 5)).not.toBe(
        getRiderRatingColorClasses(threshold),
      );
    }
  });
});
