import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const currentOffersSource = readFileSync(
  join(process.cwd(), "app/jeu/sponsoring/page.tsx"),
  "utf8",
);
const futureOffersSource = readFileSync(
  join(process.cwd(), "app/jeu/sponsoring/future-sponsoring-section.tsx"),
  "utf8",
);

describe("visibilité de la nationalité des sponsors", () => {
  it("affiche le badge pays lors d'une première signature", () => {
    expect(currentOffersSource).toContain("<SponsorCountryBadge");
    expect(currentOffersSource).toContain(
      "countryCode={sponsor.countryCode}",
    );
  });

  it("affiche le badge pays pour renouveler ou changer de sponsor", () => {
    expect(futureOffersSource).toContain("<FutureSponsorOfferCard");
    expect(futureOffersSource).toContain("<SponsorCountryBadge");
    expect(futureOffersSource).toContain(
      "countryCode={sponsor.countryCode}",
    );
  });
});
