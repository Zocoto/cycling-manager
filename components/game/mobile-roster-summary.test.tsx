import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MobileRosterSummary,
  toggleMobileRosterCustomRating,
  type MobileRosterSummaryRating,
} from "./mobile-roster-summary";

const ratings: MobileRosterSummaryRating[] = [
  ["mountain", "MON", "Montagne", "primary", 81],
  ["hills", "VAL", "Vallon", "primary", 77],
  ["flat", "PLA", "Plaine", "primary", 69],
  ["time_trial", "CLM", "Contre-la-montre", "primary", 72],
  ["cobbles", "PAV", "Pavés", "primary", 64],
  ["sprint", "SPR", "Sprint", "primary", 73],
  ["acceleration", "ACC", "Accélération", "secondary", 74],
  ["downhill", "DES", "Descente", "secondary", 70],
  ["endurance", "END", "Endurance", "secondary", 79],
  ["resistance", "RES", "Résistance", "secondary", 76],
  ["recovery", "REC", "Récupération", "secondary", 75],
  ["breakaway", "BAR", "Baroudeur", "secondary", 68],
  ["prologue", "PRO", "Prologue", "secondary", 71],
].map(([key, label, fullLabel, importance, value]) => ({
  key: key as MobileRosterSummaryRating["key"],
  label: String(label),
  fullLabel: String(fullLabel),
  importance: importance as MobileRosterSummaryRating["importance"],
  value: Number(value),
}));

describe("mobile roster summary", () => {
  it("affiche les six notes principales sans tableau horizontal", () => {
    const markup = renderToStaticMarkup(
      <MobileRosterSummary
        riders={[
          {
            riderId: "rider-1",
            riderName: "Augusto Silva",
            profile: "Grimpeur",
            form: 82,
            morale: 71,
            ratings,
          },
        ]}
        availableRatings={ratings}
        currentSortKey={null}
        currentDirection="asc"
      />,
    );

    expect(markup).toContain("data-mobile-roster-summary");
    expect(markup).toContain("table-fixed");
    expect(markup.match(/data-summary-rating=/g)).toHaveLength(6);
    expect(markup).toContain("Augusto Silva");
    expect(markup).toContain("Santé : forme 82 %, moral 71 %");
    expect(markup).not.toContain("overflow-x-auto");
    expect(markup).toContain("Montagne : 81");
    expect(markup).toContain("Vallon : 77");
    expect(markup).toContain("Plaine : 69");
    expect(markup).toContain("Contre-la-montre : 72");
    expect(markup).toContain("Pavés : 64");
    expect(markup).toContain("Sprint : 73");
  });

  it("limite une sélection personnalisée à six notes", () => {
    expect(
      toggleMobileRosterCustomRating(
        ["mountain", "hills", "flat", "time_trial", "cobbles", "sprint"],
        "acceleration",
      ),
    ).toEqual([
      "hills",
      "flat",
      "time_trial",
      "cobbles",
      "sprint",
      "acceleration",
    ]);

    expect(
      toggleMobileRosterCustomRating(
        ["mountain", "hills", "flat"],
        "hills",
      ),
    ).toEqual(["mountain", "flat"]);
  });
});
