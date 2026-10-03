import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderPotentialChip } from "@/components/game/rider-potential-chip";

describe("potentiel dans les aperçus de coureur", () => {
  it("affiche le potentiel connu avec ses étoiles", () => {
    const html = renderToStaticMarkup(
      <RiderPotentialChip potentialSteps={6} />,
    );

    expect(html).toContain("data-rider-potential");
    expect(html).toContain("Potentiel");
    expect(html).toContain("Potentiel : 3 étoiles");
  });

  it("préserve la confidentialité d'un potentiel inconnu", () => {
    const html = renderToStaticMarkup(
      <RiderPotentialChip potentialSteps={null} />,
    );

    expect(html).toContain("Potentiel à découvrir");
    expect(html).not.toContain("★");
  });

  it("est utilisé dans le survol du nom et la tuile du chat", () => {
    const hoverPreview = readFileSync(
      join(process.cwd(), "components/game/rider-preview-link.tsx"),
      "utf8",
    );
    const chatPreview = readFileSync(
      join(process.cwd(), "components/game/global-chat-share-preview.tsx"),
      "utf8",
    );

    expect(hoverPreview).toContain(
      "<RiderPotentialChip potentialSteps={preview.potentialSteps} />",
    );
    expect(chatPreview).toContain("<RiderPotentialChip");
    expect(chatPreview).toContain(
      "potentialSteps={riderDetails?.potentialSteps ?? null}",
    );
  });
});
