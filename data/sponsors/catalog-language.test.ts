import { describe, expect, it } from "vitest";

import { usesRomanAlphabet } from "../../lib/roman-alphabet";
import { SPONSORS } from "./index";

const FRENCH_DESCRIPTION_START_PATTERN =
  /^(?:Un|Une|Le|La|Les|L[’']|Des|Ce|Cet|Cette|Ces|Fondé|Fondée|Créé|Créée|Né|Née)\b/u;

const FRENCH_DESCRIPTION_MARKER_PATTERN =
  /(?:\bqui\b|\bdont\b|\bavec\b|\bpour\b|\bdans\b|\bdes\b|\bune\b|\bles\b|\bdu\b|\bde la\b|\baux\b|d[’']|l[’'])/iu;

describe("langue du catalogue sponsors", () => {
  it("utilise l’alphabet latin pour tous les noms publics", () => {
    for (const sponsor of SPONSORS) {
      expect(usesRomanAlphabet(sponsor.name), sponsor.id).toBe(true);
      expect(usesRomanAlphabet(sponsor.shortName), sponsor.id).toBe(true);
    }
  });

  it("conserve toutes les descriptions en français", () => {
    for (const sponsor of SPONSORS) {
      expect(sponsor.description, sponsor.id).toMatch(
        FRENCH_DESCRIPTION_START_PATTERN,
      );
      expect(sponsor.description, sponsor.id).toMatch(
        FRENCH_DESCRIPTION_MARKER_PATTERN,
      );
    }
  });
});

