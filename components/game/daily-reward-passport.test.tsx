import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DailyRewardRedemptionForm } from "./daily-reward-redemption-form";
import { ITEM_TARGET_RATING_KEYS, type ItemTargetRider } from "@/lib/game/item-target-values";
import type { DailyRewardInventoryItem } from "@/lib/game/daily-rewards";
import { EMPTY_SCOUTING_SUPERVISION_STATUS } from "@/lib/game/scouting-supervision";

vi.mock("@/app/jeu/objectifs/actions", () => ({ redeemDailyRewardAction: vi.fn() }));
const item: DailyRewardInventoryItem = {
  id: "passport", key: "automatic-naturalization", name: "Passeport sportif", effectKind: "naturalization",
  description: "", effectSummary: "", iconKey: "passport", importance: 7, payload: {}, quantity: 1,
  acquiredAt: "2026-10-22T08:00:00Z", expiresAfterGameYear: 5,
};
const rider: ItemTargetRider = {
  id: "foreign-rider", firstName: "Eligible", lastName: "Rider", name: "Eligible Rider", countryName: "France",
  form: 75, experienceDays: 0, potentialSteps: 4, abilityCodes: [],
  ratings: Object.fromEntries(ITEM_TARGET_RATING_KEYS.map(key => [key, 60])) as ItemTargetRider["ratings"],
};
function render(riders: ItemTargetRider[], reward = item) {
  return renderToStaticMarkup(<DailyRewardRedemptionForm item={reward} riders={riders} abilities={[]}
    eligibleRaces={[]} academyRiders={[]} countries={[]} staffAcademyBuilt={false} constructionProjects={[]}
    staffMembers={[]} scoutingSupervision={EMPTY_SCOUTING_SUPERVISION_STATUS} />);
}
describe("sporting passport redemption", () => {
  it("disables both controls when no eligible target exists, without discarding the passport", () => {
    const markup = render([{ ...rider, canNaturalizeWithPassport: false }]);
    expect(markup).toMatch(/name="riderId"[^>]*disabled=""/);
    expect(markup).toMatch(/type="submit"[^>]*disabled=""/);
    expect(markup).toContain("Aucun coureur éligible à la naturalisation");
    expect(markup).toContain('name="inventoryId" value="passport"');
    expect(markup).not.toContain("Eligible Rider");
  });
  it("allows a newly recruited foreign non-champion without imposing tenure", () => {
    const markup = render([{ ...rider, canNaturalizeWithPassport: true }]);
    expect(markup).toContain("Eligible Rider · Nationalité France");
    expect(markup).not.toMatch(/type="submit"[^>]*disabled=""/);
  });
  it("never hides same-country riders or champions from other consumables", () => {
    const markup = render([{ ...rider, canNaturalizeWithPassport: false }], { ...item, effectKind: "form_boost" });
    expect(markup).toContain("Eligible Rider · Forme 75/100");
    expect(markup).not.toMatch(/type="submit"[^>]*disabled=""/);
  });
});
