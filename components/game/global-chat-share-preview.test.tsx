import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderPrimaryRatings } from "@/components/game/global-chat-share-preview";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import type { RiderQuickPreview } from "@/lib/game/rider-quick-preview";

const details: RiderQuickPreview = {
  id: "rider-1",
  name: "Coureur exemple",
  age: 24,
  potentialSteps: 6,
  country: { name: "France", code: "FR" },
  team: { id: "team-1", name: "Équipe exemple" },
  ratings: Object.fromEntries(
    RIDER_RATING_AXES.map((axis, index) => [axis.key, { kind: "exact", value: 60 + index }]),
  ) as NonNullable<RiderQuickPreview["ratings"]>,
  equipmentRatingBonuses: {},
  ratingVisibility: "exact",
};

describe("aperçu de coureur partagé dans le chat", () => {
  it("affiche seulement les six notes primaires de la fiche", () => {
    const html = renderToStaticMarkup(
      <RiderPrimaryRatings details={details} unavailable={false} />,
    );

    for (const axis of RIDER_RATING_AXES.filter((entry) => entry.importance === "primary")) {
      expect(html).toContain(`>${axis.shortLabel}</span>`);
    }
    expect(html).not.toContain(">REC</span>");
    expect(html).toContain("data-chat-primary-ratings");
  });

  it("conserve une indication de chargement puis d’indisponibilité", () => {
    const loading = renderToStaticMarkup(
      <RiderPrimaryRatings details={null} unavailable={false} />,
    );
    const unavailable = renderToStaticMarkup(
      <RiderPrimaryRatings details={null} unavailable />,
    );

    expect(loading).toContain("Chargement des notes primaires");
    expect(unavailable).toContain("Notes indisponibles");
  });
});
