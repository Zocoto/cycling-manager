import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/jeu/objectifs/actions", () => ({ redeemDailyRewardAction: async () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { InjuryCareItemForm } from "./injury-care-item-form";

const props = { riderId: "rider", riderName: "Paul Martin", diagnosisCode: "contusion",
  items: [{ inventoryId: "stock", catalogKey: "care", name: "Soin ciblé", recoveryHours: 12, quantity: 3 }] };
describe("objets de soin sur la fiche du blessé", () => {
  it("pins the rider and a single use, with a return to injuries and explicit stock", () => {
    const html = renderToStaticMarkup(<InjuryCareItemForm {...props} />);
    expect(html).toContain('name="riderId" value="rider"');
    expect(html).toContain('name="quantity" value="1"');
    expect(html).toContain('name="effectKind" value="injury_care"');
    expect(html).toContain('/jeu/centre-de-soin?onglet=blessures');
    expect(html).toContain('Soin ciblé · −12 h · ×3');
    expect(html).toContain('name="inventoryId" required=""');
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).not.toContain('data-financial-expense');
  });
  it("does not offer a consumable for mandatory fatigue recovery", () => {
    const html = renderToStaticMarkup(<InjuryCareItemForm {...props} diagnosisCode="fatigue_exhaustion" />);
    expect(html).toContain('blessure de fatigue'); expect(html).not.toContain('<form');
  });
  it("offers the existing complete-healing relic for fatigue, without offering ordinary care", () => {
    const html = renderToStaticMarkup(<InjuryCareItemForm {...props} diagnosisCode="fatigue_exhaustion" items={[...props.items,
      { inventoryId: "halloween:mummy-resurrection", catalogKey: "mummy-resurrection", name: "Résurrection de la momie", recoveryHours: 0, quantity: 1, halloweenItem: "mummy-resurrection", fullRecovery: true }]} />);
    expect(html).toContain("Résurrection de la momie · guérison immédiate · ×1");
    expect(html).not.toContain("Soin ciblé ·");
  });
  it("distinguishes an empty inventory from a failed read", () => {
    expect(renderToStaticMarkup(<InjuryCareItemForm {...props} items={[]} />)).toContain('Aucun objet de soin en stock');
    const failed = renderToStaticMarkup(<InjuryCareItemForm {...props} items={[]} loadError />);
    expect(failed).toContain('role="alert"'); expect(failed).not.toContain('Aucun objet de soin en stock');
  });
});
