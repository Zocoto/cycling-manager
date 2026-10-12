import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OlympicNations } from "./olympic-nations";

describe("Olympic qualification display", () => {
  it("shows quotas, confirmations and best finish without division controls", () => {
    const markup = renderToStaticMarkup(<OlympicNations overview={{ qualificationFrozenAt: "2026-10-12T10:00:00Z", nations: [
      { country_id: "FR", country_code: "FR", country_name: "France", qualification_rank: 1, uci_rank: 1, rider_quota: 8, registered_riders: 2, pending_riders: 3, best_finish: 7 },
      { country_id: "XX", country_code: "XX", country_name: "Excluded", qualification_rank: 61, uci_rank: 61, rider_quota: 0, registered_riders: 0, pending_riders: 0, best_finish: null },
    ] }} />);
    expect(markup).toContain("France");
    expect(markup).not.toContain("Excluded");
    expect(markup).toContain("2/8");
    expect(markup).toContain("#7");
    expect(markup).toContain("8 places attribuées / 220 maximum");
    expect(markup).toContain("Sans réponse, aucune inscription ni retrait");
    expect(markup).not.toContain("select");
  });
  it("announces J4 rather than making empty invitations look final", () => {
    const markup = renderToStaticMarkup(<OlympicNations overview={{ nations: [], qualificationFrozenAt: null }} />);
    expect(markup).toContain("Les invitations seront publiées à J4");
  });
  it("shows Japan's true rank and the S4-only replacement without listing the excluded nation", () => {
    const markup = renderToStaticMarkup(<OlympicNations overview={{ qualificationFrozenAt: "2026-10-12T10:00:00Z", nations: [
      { country_id: "JP", country_code: "JP", country_name: "Japon", qualification_rank: 67, uci_rank: 67, rider_quota: 2, registered_riders: 1, pending_riders: 0, best_finish: null, exception_reason: "existing_confirmed_selection" },
      { country_id: "XX", country_code: "XX", country_name: "Excluded", qualification_rank: 60, uci_rank: 60, rider_quota: 0, registered_riders: 0, pending_riders: 0, best_finish: null, exception_reason: "reallocated_for_confirmed_selection" },
    ] }} />);
    expect(markup).toContain("#67");
    expect(markup).toContain("Invitation exceptionnelle");
    expect(markup).toContain("Exception de transition en S4");
    expect(markup).toContain("1/2");
    expect(markup).not.toContain("Excluded");
  });
});
