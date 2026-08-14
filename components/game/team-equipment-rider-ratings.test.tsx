import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TeamEquipmentRiderRatings } from "@/components/game/team-equipment-rider-ratings";

describe("TeamEquipmentRiderRatings", () => {
  it("affiche les treize notes avec leur libellé complet accessible", () => {
    const markup = renderToStaticMarkup(
      createElement(TeamEquipmentRiderRatings, {
        riderName: "Lina Martin",
        ratings: {
          mountain: 70,
          hills: 71,
          recovery: 72,
          endurance: 73,
          resistance: 74,
          breakaway: 75,
          downhill: 76,
          acceleration: 77,
          sprint: 78,
          flat: 79,
          cobbles: 80,
          prologue: 81,
          timeTrial: 82,
        },
      }),
    );

    expect(markup).toContain('aria-label="Notes de Lina Martin"');
    expect(markup.match(/<dt/g)).toHaveLength(13);
    expect(markup).toContain('title="Montagne : 70"');
    expect(markup).toContain(">MON<");
    expect(markup).toContain(">CLM<");
  });

  it("reste explicite si une note manque pendant une transition de saison", () => {
    const markup = renderToStaticMarkup(
      createElement(TeamEquipmentRiderRatings, {
        riderName: "Lina Martin",
        ratings: null,
      }),
    );

    expect(markup).toContain("Notes indisponibles");
  });
});
