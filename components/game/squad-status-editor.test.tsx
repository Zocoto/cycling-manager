import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SquadStatusEditor, SquadStatusesBulkEditor } from "./squad-status-editor";

vi.mock("@/app/jeu/effectif/actions", () => ({
  updateRiderSquadStatusAction: vi.fn(),
  updateRiderSquadStatusesAction: vi.fn(),
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

  it("uses one sibling save form for desktop/mobile selectors without per-row validation buttons",()=>{
    const markup=renderToStaticMarkup(<SquadStatusesBulkEditor initialStatuses={[{riderId:"a",squadStatus:"lieutenant"}]}>
      <button type="button">Comparer à</button>
      <SquadStatusEditor riderId="a" riderName="Coureur A" status="lieutenant" returnTo="/jeu/effectif" compact/>
      <SquadStatusEditor riderId="a" riderName="Coureur A" status="lieutenant" returnTo="/jeu/effectif" compact/>
    </SquadStatusesBulkEditor>);
    expect(markup.match(/<form\b/g)).toHaveLength(1);
    expect(markup.match(/<select\b/g)).toHaveLength(2);
    expect(markup.match(/<option value="lieutenant" selected="">/g)).toHaveLength(2);
    expect(markup).toContain('name="updates" value="[]"');
    expect(markup).not.toContain('data-squad-status-dock');
    expect(markup).not.toContain('>Valider</button>');
    expect(markup).toContain('>Comparer à</button>');
    expect(markup).toContain('xl:w-40');
  });

  it("preserves the independent rider-profile save button",()=>{
    const markup=renderToStaticMarkup(<SquadStatusEditor riderId="a" status="road_captain" returnTo="/jeu/coureurs/a" tone="dark"/>);
    expect(markup).toContain('>Enregistrer</button>');
    expect(markup).toContain('name="returnTo" value="/jeu/coureurs/a"');
    expect(markup).not.toContain('name="updates"');
  });
});
