import { describe, expect, it } from "vitest";
import { getYouthScoutingCandidateAge, getYouthScoutingCandidateStatus } from "./youth-scouting-candidate-age";

describe("âge actuel des jeunes repérés", () => {
  it.each([[15, 4, 4, 15], [17, 3, 4, 18], [18, 3, 4, 19], [15, 1, 4, 18], [16, 1, 4, 19], [18, 4, 8, 22]])(
    "vieillit un jeune de %i ans en S%i jusqu'à S%i : %i ans",
    (reportedAge, reportGameYear, currentGameYear, expected) => {
      expect(getYouthScoutingCandidateAge({ reportedAge, reportGameYear, currentGameYear })).toBe(expected);
    },
  );
  it("garde 18 ans éligible et expire dès 19 ans sans annuler les recrutements passés", () => {
    expect(getYouthScoutingCandidateStatus("spotted", 18)).toBe("spotted");
    expect(getYouthScoutingCandidateStatus("spotted", 19)).toBe("expired");
    expect(getYouthScoutingCandidateStatus("signed", 20)).toBe("signed");
    expect(getYouthScoutingCandidateStatus("expired", 17)).toBe("expired");
  });
});
