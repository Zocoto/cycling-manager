import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderPersonalityBadge, RiderPersonalityCard } from "./rider-personality";
import { RIDER_PERSONALITIES, type RiderPersonalityKey } from "@/lib/game/rider-personalities";
import { translateUiText } from "@/lib/i18n/ui-translations";

const englishLabels: Record<RiderPersonalityKey, string> = {
  franc_tireur: "Lone attacker",
  opportuniste: "Opportunist",
  calculateur: "Calculating",
  solidaire: "Selfless",
  sociable: "Sociable",
  ambitieux: "Ambitious",
  colerique: "Hot-headed",
  charismatique: "Charismatic",
  assidu: "Diligent",
  imprevisible: "Unpredictable",
  fonceur: "Bold",
  cooperatif: "Cooperative",
  metronome: "Steady",
  tenace: "Tenacious",
  prudent: "Cautious",
  fidele: "Loyal",
  mentor: "Mentor",
  collectif: "Collective",
  globe_trotteur: "Globetrotter",
  meticuleux: "Meticulous",
  perfectionniste: "Perfectionist",
  force_tranquille: "Even-tempered",
  discret: "Private",
  franc_parleur: "Straight talker",
  chambreur: "Banterer",
};

describe("rider personality descriptions", () => {
  it("keeps every effect short, qualitative and translated into English", () => {
    for (const [key, personality] of Object.entries(RIDER_PERSONALITIES)) {
      const english = translateUiText(personality.description);
      expect(translateUiText(personality.label), key).toBe(englishLabels[key as RiderPersonalityKey]);
      expect(english, key).not.toBe(personality.description);
      for (const description of [personality.description, english]) {
        expect(description, key).not.toMatch(/[\d%]/);
        expect(description.trim().split(/\s+/).length, key).toBeLessThanOrEqual(22);
      }
    }
  });

  it("provides the same effect on hover even when the inline description is visible", () => {
    for (const key of Object.keys(RIDER_PERSONALITIES) as RiderPersonalityKey[]) {
      const { description } = RIDER_PERSONALITIES[key];
      for (const showDescription of [false, true]) {
        const markup = renderToStaticMarkup(<RiderPersonalityBadge personality={key} compact showDescription={showDescription} />);
        expect(markup).toContain(`title="${description}"`);
      }
      const card = renderToStaticMarkup(<RiderPersonalityCard personality={key} />);
      expect(card).toContain(`title="${description}"`);
    }
  });
});
