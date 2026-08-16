import { describe, expect, it } from "vitest";

import {
  describeRecruitmentAlert,
  formatPotentialStars,
  type RecruitmentAlert,
} from "@/lib/game/recruitment-alerts";

const baseAlert: RecruitmentAlert = {
  id: "00000000-0000-0000-0000-000000000001",
  type: "rider",
  countryId: null,
  countryName: null,
  countryCode: null,
  minimumOverall: null,
  ratingKey: null,
  minimumRating: null,
  minimumPotentialSteps: null,
  staffRole: null,
  minimumStaffLevel: null,
  staffTrainerSpecialty: null,
  createdAt: "2026-08-16T12:00:00.000Z",
};

describe("alertes de recrutement", () => {
  it("décrit tous les critères cumulés d’un coureur", () => {
    expect(
      describeRecruitmentAlert({
        ...baseAlert,
        countryId: "country-fr",
        countryName: "France",
        countryCode: "FR",
        ratingKey: "mountain",
        minimumRating: 68,
        minimumPotentialSteps: 7,
      }),
    ).toBe("France · montagne ≥ 68 · talent potentiel ≥ 3,5 ★");
  });

  it("décrit tous les critères cumulés d’un staff", () => {
    expect(
      describeRecruitmentAlert({
        ...baseAlert,
        type: "staff",
        countryId: "country-it",
        countryName: "Italie",
        countryCode: "IT",
        staffRole: "trainer",
        minimumStaffLevel: 4,
        staffTrainerSpecialty: "hills",
      }),
    ).toBe("Italie · Entraîneur · 4 étoiles minimum · spécialité vallons");
  });

  it("présente les huit demi-étoiles du potentiel", () => {
    expect(formatPotentialStars(1)).toBe("0,5 ★");
    expect(formatPotentialStars(8)).toBe("4 ★");
  });
});
