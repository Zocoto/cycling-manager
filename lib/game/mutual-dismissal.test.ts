import { describe, expect, it } from "vitest";

import {
  isMutualAgreementDismissal,
  resolveDismissalCost,
} from "@/lib/game/mutual-dismissal";

describe("licenciement à l’amiable", () => {
  it("devient gratuit uniquement avec une trésorerie strictement négative", () => {
    expect(isMutualAgreementDismissal(-0.01)).toBe(true);
    expect(resolveDismissalCost(-0.01, 25_000)).toBe(0);
  });

  it("conserve le coût normal à zéro et avec une trésorerie positive", () => {
    expect(isMutualAgreementDismissal(0)).toBe(false);
    expect(resolveDismissalCost(0, 25_000)).toBe(25_000);
    expect(resolveDismissalCost(10_000, 25_000)).toBe(25_000);
  });
});
