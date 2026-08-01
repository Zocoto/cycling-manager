import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { TeamRiderMemoryEntry } from "@/lib/game/team-rider-memory";
import { TeamRiderGlossary } from "./team-rider-glossary";

describe("TeamRiderGlossary", () => {
  it("rend un bouton compact sans charger visuellement la liste avant le clic", () => {
    const markup = renderToStaticMarkup(
      <TeamRiderGlossary riders={[formerRider]} currentGameYear={3} />,
    );

    expect(markup).toContain("Glossaire des anciens coureurs");
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("1 coureur");
    expect(markup).not.toContain("Louise Dupont");
  });
});

const formerRider: TeamRiderMemoryEntry = {
  id: "former-rider",
  firstName: "Louise",
  lastName: "Dupont",
  countryName: "France",
  countryCode: "FR",
  avatarProfileKey: "default",
  avatarSeed: 2,
  age: 29,
  firstSeasonName: "Saison 1",
  firstGameYear: 1,
  lastSeasonName: "Saison 2",
  lastGameYear: 2,
  seasonsCount: 2,
  isCurrent: false,
  isArchived: false,
  retirementSeasonName: null,
};
