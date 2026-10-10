import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FederationEquipmentPreparationPanel } from "./federation-equipment-preparation-panel";
import type { FederationEquipmentState } from "@/services/federation-equipment";

vi.mock("@/app/jeu/federations/equipment-actions", () => ({
  chooseFederationEquipmentOfferAction: () => {},
  disabledFederationTacticalAction: () => {},
  saveFederationRacePreparationAction: () => {},
  saveFederationTimeTrialPreparationAction: () => {},
}));
vi.mock("@/components/game/race-preparation-workspace", () => ({
  RacePreparationWorkspace: () => null,
}));

const baseState: FederationEquipmentState = {
  balance: 0, canManage: true, offers: [], contract: null,
};
function render(state = baseState, confirmed = false) {
  return renderToStaticMarkup(
    <FederationEquipmentPreparationPanel
      countryCode="FR" gameYear={4} selectedView="equipment"
      equipmentState={state} preparationEditions={[]}
      nowIso="2026-10-10T10:00:00Z" saved={false} choiceConfirmed={confirmed}
    />,
  );
}

describe("federation no-equipment choice", () => {
  it("lets the president explicitly choose no equipment even with no budget", () => {
    const html = render();
    expect(html).toContain('name="offerKey" value="sans-equipement"');
    expect(html).toContain("Choisir sans équipement pour la saison");
    expect(html).not.toContain("disabled=");
  });
  it("does not offer a signing form to other members", () => {
    expect(render({ ...baseState, canManage: false })).not.toContain('name="offerKey"');
  });
  it("shows the registered decision and removes selection controls", () => {
    const html = render({ ...baseState, contract: {
      id: "contract", offerKey: null, offerName: "Sans équipement",
      supplierKey: null, pricePaid: 0, signedAt: "2026-10-10", items: [],
    } }, true);
    expect(html).toContain("l’alerte est levée");
    expect(html).toContain("enregistré et verrouillé");
    expect(html).not.toContain('name="offerKey"');
    expect(html).not.toContain("Le contrat équipementier est signé");
  });
});
