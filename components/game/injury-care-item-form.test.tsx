import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/jeu/objectifs/actions", () => ({ redeemDailyRewardAction: async () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { getMaxInjuryCareQuantity, InjuryCareItemForm } from "./injury-care-item-form";

const item = { inventoryId: "stock", catalogKey: "care", name: "Soin ciblé", recoveryHours: 12, quantity: 3 };
const resurrection = { inventoryId: "halloween:mummy-resurrection", catalogKey: "mummy-resurrection", name: "Résurrection de la momie", recoveryHours: 0, quantity: 5, halloweenItem: "mummy-resurrection", fullRecovery: true } as const;
const props = { riderId: "rider", riderName: "Paul Martin", injuryId: "injury", diagnosisCode: "contusion", remainingHours: 25, items: [item] };
describe("objets de soin sur la fiche du blessé", () => {
  it("pins the rider and injury, with a default dose and explicit stock", () => {
    const html = renderToStaticMarkup(<InjuryCareItemForm {...props} />);
    expect(html).toContain('name="riderId" value="rider"');
    expect(html).toContain('name="injuryId" value="injury"');
    expect(html).toContain('name="quantity" value="1"');
    expect(html).toContain('name="effectKind" value="injury_care"');
    expect(html).toContain('/jeu/centre-de-soin?onglet=blessures');
    expect(html).toContain('Soin ciblé · −12 h · ×3');
    expect(html).toContain('name="inventoryId" required=""');
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).not.toContain('data-financial-expense');
  });
  it.each([
    [item, 25, 3],
    [item, 24, 2],
    [item, 1, 1],
    [item, 0, 0],
    [{ ...item, quantity: 100 }, 700, 30],
    [{ ...item, quantity: 0 }, 100, 0],
    [resurrection, 100, 1],
    [resurrection, 0, 0],
  ] as const)("bounds doses by stock, remaining recovery, and the per-request limit (%j, %i h)", (careItem, remainingHours, expected) => {
    expect(getMaxInjuryCareQuantity(careItem, remainingHours)).toBe(expected);
  });
  it("does not offer a consumable for mandatory fatigue recovery", () => {
    const html = renderToStaticMarkup(<InjuryCareItemForm {...props} diagnosisCode="fatigue_exhaustion" />);
    expect(html).toContain('blessure de fatigue'); expect(html).not.toContain('<form');
  });
  it("offers the existing complete-healing relic for fatigue, without offering ordinary care", () => {
    const html = renderToStaticMarkup(<InjuryCareItemForm {...props} diagnosisCode="fatigue_exhaustion" items={[...props.items, resurrection]} />);
    expect(html).toContain("Résurrection de la momie · guérison immédiate · ×5");
    expect(html).not.toContain("Soin ciblé ·");
  });
  it("cannot submit care when recovery has already ended", () => {
    const html = renderToStaticMarkup(<InjuryCareItemForm {...props} remainingHours={0} />);
    expect(html).toContain("La convalescence est terminée.");
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });
  it("distinguishes an empty inventory from a failed read", () => {
    expect(renderToStaticMarkup(<InjuryCareItemForm {...props} items={[]} />)).toContain('Aucun objet de soin en stock');
    const failed = renderToStaticMarkup(<InjuryCareItemForm {...props} items={[]} loadError />);
    expect(failed).toContain('role="alert"'); expect(failed).not.toContain('Aucun objet de soin en stock');
  });
});
