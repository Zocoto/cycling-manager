import { describe, expect, it } from "vitest";

import { getDailyConditionHistoryLabel } from "./rider-form-history";

describe("historique récent de forme", () => {
  it("masque le journal quotidien qui duplique une séance d’entraînement", () => {
    expect(getDailyConditionHistoryLabel("training")).toBeNull();
  });

  it("conserve les autres variations quotidiennes réelles", () => {
    expect(getDailyConditionHistoryLabel("form_camp")).toBe(
      "Stage de remise en forme",
    );
    expect(getDailyConditionHistoryLabel("rest")).toBe(
      "Récupération quotidienne",
    );
    expect(getDailyConditionHistoryLabel("other")).toBe(
      "Évolution quotidienne",
    );
  });
});
