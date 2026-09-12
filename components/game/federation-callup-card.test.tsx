import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FederationCallupCard } from "./federation-callup-card";
import { FederationSelectionWorkbench } from "./federation-selection-workbench";
import type { FederationCallup } from "@/lib/game/federation-callups";
import type { FederationSelectionState } from "@/services/federation-selections";
import type { FederationSelectionRider } from "@/services/federation-selection-pool";

vi.mock("@/app/jeu/selections-internationales/actions", () => ({ answerFederationCallupAction: vi.fn() }));

const callup: FederationCallup = {
  member_id: "member", country_code: "BE", country_name: "Belgique", slot_key: "cc-pro-road",
  competition_label: "CC Pros · Route", rider_id: "rider", rider_name: "Coureur test",
  rider_category: "professional", response_status: "pending", published_at: "2026-09-11T08:00:00Z",
  closes_at: "2026-09-25T11:00:00Z", can_respond: true, race_href: "/jeu/courses/test",
};
const rider: FederationSelectionRider = {
  id: "rider", teamId: "team", teamName: "Équipe", name: "Coureur test", age: 25,
  category: "professional", juniorAffiliation: null, profile: "Vallons", overall: 70,
  ratings: { mountain: 70, hills: 70, flat: 70, timeTrial: 70, cobbles: 70, sprint: 70, acceleration: 70,
    downhill: 70, endurance: 70, resistance: 70, recovery: 70, breakaway: 70, prologue: 70 },
};
const state: FederationSelectionState = {
  canManage: true, automaticSelection: false, competitionHosts: {}, forecasts: {}, pendingConfirmations: [],
  selections: { "cc-pro-road": { status: "pending_confirmation", revision: 1, riderIds: ["rider"],
    confirmedRiderIds: ["rider"], responses: { rider: "confirmed" } } },
  schedules: { "cc-pro-road": { slot_key: "cc-pro-road", label: "CC", rider_category: "professional", race_edition_id: "edition",
    race_href: "/jeu/courses/test", departure_at: "2026-09-25T12:00:00Z", closes_at: "2026-09-25T11:00:00Z", is_open: true } },
};
const workbench = (selectionState: FederationSelectionState) => renderToStaticMarkup(
  <FederationSelectionWorkbench countryCode="BE" countryName="Belgique" riders={[rider]} gameYear={3} selectionState={selectionState} />,
);

describe("federation call-up interface", () => {
  it("offers real confirm and decline submissions for an early published invitation", () => {
    const html = renderToStaticMarkup(<FederationCallupCard callup={callup} />);
    expect(html).toContain('name="memberId" value="member"');
    expect(html).toMatch(/<button(?=[^>]*name="decision")(?=[^>]*value="confirm")[^>]*>/);
    expect(html).toMatch(/<button(?=[^>]*name="decision")(?=[^>]*value="decline")[^>]*>/);
    expect(html).toContain("Vous pouvez répondre dès maintenant");
  });
  it("does not offer a second decision for a confirmed or closed invitation", () => {
    for (const value of [{ ...callup, response_status: "confirmed" as const }, { ...callup, can_respond: false }]) {
      expect(renderToStaticMarkup(<FederationCallupCard callup={value} />)).not.toContain('<form');
    }
  });
  it("keeps a confirmed rider checked and disabled in the president's list", () => {
    const html = workbench(state);
    const input = html.match(/<input[^>]+aria-label="Sélectionner Coureur test"[^>]*>/)?.[0];
    expect(input).toContain('checked=""');
    expect(input).toContain('disabled=""');
    expect(html).toContain("Participation confirmée · verrouillée");
  });
  it("leaves an unconfirmed rider editable before closure, but not after it", () => {
    const editable: FederationSelectionState = { ...state,
      selections: { "cc-pro-road": { ...state.selections["cc-pro-road"], confirmedRiderIds: [], responses: { rider: "pending" } } } };
    expect(workbench(editable).match(/<input[^>]+aria-label="Sélectionner Coureur test"[^>]*>/)?.[0]).not.toContain('disabled=""');
    const closed = workbench({ ...editable, schedules: { "cc-pro-road": { ...state.schedules!["cc-pro-road"], is_open: false } } });
    expect(closed.match(/<input[^>]+aria-label="Sélectionner Coureur test"[^>]*>/)?.[0]).toContain('disabled=""');
    expect(closed).toContain("Date limite dépassée");
    expect(closed.match(/<button[^>]+>Soumettre aux DS<\/button>/)?.[0]).toContain('disabled=""');
  });
});
