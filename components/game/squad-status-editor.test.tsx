import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SquadStatusEditor } from "./squad-status-editor";

vi.mock("@/app/jeu/effectif/actions", () => ({
  updateRiderSquadStatusAction: vi.fn(),
}));

describe("SquadStatusEditor", () => {
  it("laisse le sélecteur visible et modifiable dans le tableau compact", () => {
    const markup = renderToStaticMarkup(
      <SquadStatusEditor
        riderId="11111111-1111-4111-8111-111111111111"
        status="lieutenant"
        returnTo="/jeu/effectif?vue=statistiques"
        compact
      />,
    );

    expect(markup).toMatch(/<label class="min-w-0 flex-1">/);
    expect(markup).toContain('name="squadStatus"');
    expect(markup).toContain('<option value="lieutenant" selected="">Lieutenant</option>');
    expect(markup).toContain(">Valider</button>");
  });

  it("affiche aussi la sélection sans statut attribué", () => {
    const markup = renderToStaticMarkup(
      <SquadStatusEditor
        riderId="11111111-1111-4111-8111-111111111111"
        status={null}
        returnTo="/jeu/effectif?vue=statistiques"
        compact
      />,
    );

    expect(markup).toContain('<option value="" selected="">Non défini</option>');
    expect(markup).toContain("Leader absolu");
    expect(markup).toContain("Porteur de bidons");
  });
});
