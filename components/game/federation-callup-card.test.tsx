import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FederationCallupCard } from "./federation-callup-card";
import { FederationSelectionWorkbench } from "./federation-selection-workbench";
import type { FederationCallup } from "@/lib/game/federation-callups";
import type { FederationSelectionState } from "@/services/federation-selections";
import type { FederationSelectionRider } from "@/services/federation-selection-pool";

vi.mock("@/app/jeu/selections-internationales/actions", () => ({
  answerFederationCallupAction: vi.fn(),
  withdrawFederationCallupAction: vi.fn(),
}));

const callup: FederationCallup = {
  member_id: "member", country_code: "BE", country_name: "Belgique", slot_key: "cc-pro-road",
  competition_label: "CC Pros · Route", rider_id: "rider", rider_name: "Coureur test",
  rider_category: "professional", response_status: "pending", published_at: "2026-09-11T08:00:00Z",
  closes_at: "2026-09-25T11:00:00Z", can_respond: true, race_href: "/jeu/courses/test",
  conflicting_race_names: [],
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
    const forms = html.match(/<form\b[\s\S]*?<\/form>/g) ?? [];
    expect(forms).toHaveLength(2);
    for (const [index, decision] of ["confirm", "decline"].entries()) {
      // Successful hidden controls survive submission without a submitter.
      expect(forms[index]).toContain(`type="hidden" name="decision" value="${decision}"`);
      expect(forms[index]).toContain('type="hidden" name="memberId" value="member"');
      expect(forms[index]).toContain('type="hidden" name="audience" value="professional"');
      expect(forms[index]).not.toContain('name="decision" value="' + decision + '" disabled');
    }
    expect(html).toContain("Vous pouvez répondre dès maintenant");
    expect(html).toContain("Chaque convocation refusée retire 5 points de moral au coureur.");
    expect(html).toContain("Les refus de convocations distinctes se cumulent.");
  });
  it("does not offer a second decision for a confirmed or closed invitation", () => {
    for (const value of [
      { ...callup, response_status: "confirmed" as const },
      { ...callup, can_respond: false },
      { ...callup, response_status: "ineligible" as const },
    ]) {
      const html = renderToStaticMarkup(<FederationCallupCard callup={value} />);
      expect(html).not.toContain('<form');
      expect(html).not.toContain("Chaque convocation refusée retire 10 points");
    }
  });
  it("offers withdrawal for a confirmed junior and keeps the filtered context", () => {
    const raceEditionFilter = "a2f00814-872a-4bde-beef-3406775143c6";
    const html = renderToStaticMarkup(<FederationCallupCard
      callup={{
        ...callup,
        rider_category: "junior",
        response_status: "confirmed",
        can_respond: false,
        can_withdraw: true,
        withdrawal_closes_at: "2026-11-29T16:00:00Z",
      }}
      raceEditionFilter={raceEditionFilter}
    />);
    expect(html).toContain("<details");
    expect(html).toContain("Retirer le coureur");
    expect(html).toContain("29 novembre");
    expect(html).toContain("17:00");
    expect(html).toContain("10 points de moral");
    expect(html).toContain("Confirmer le retrait");
    expect(html).toContain('type="hidden" name="memberId" value="member"');
    expect(html).toContain('type="hidden" name="audience" value="junior"');
    expect(html).toContain(`type="hidden" name="epreuve" value="${raceEditionFilter}"`);
    expect(html).not.toContain("Confirmer la participation");
  });
  it("shows a withdrawn participation without offering another decision", () => {
    const html = renderToStaticMarkup(<FederationCallupCard callup={{
      ...callup, response_status: "withdrawn", can_respond: false, can_withdraw: false,
    }} />);
    expect(html).toContain("Participation retirée");
    expect(html).not.toContain("<form");
  });
  it("explains an ineligible call-up without describing it as a player refusal or expired deadline", () => {
    const html = renderToStaticMarkup(<FederationCallupCard callup={{ ...callup, response_status: "ineligible", can_respond: false }} />);
    expect(html).toContain("Convocation devenue inéligible");
    expect(html).toContain("Aucune réponse n’est attendue");
    expect(html).not.toContain("Participation refusée");
    expect(html).not.toContain("Délai de réponse dépassé");
  });
  it("names the conflicting race and explains the automatic withdrawal", () => {
    const html = renderToStaticMarkup(<FederationCallupCard callup={{ ...callup, conflicting_race_names: ["Tour des Alpes"] }} />);
    expect(html).toContain("Conflit de calendrier : Tour des Alpes");
    expect(html).toContain("désinscrira automatiquement le coureur de la course en conflit");
  });
  it("keeps a confirmed rider checked and disabled in the president's list", () => {
    const html = workbench(state);
    const input = html.match(/<input[^>]+aria-label="Sélectionner Coureur test"[^>]*>/)?.[0];
    expect(input).toContain('checked=""');
    expect(input).toContain('disabled=""');
    expect(html).toContain("Participation confirmée · verrouillée");
  });
  it("explains the morale consequence beside the manager's federation response forms", () => {
    const html = workbench({ ...state, pendingConfirmations: [{ memberId: "member", riderId: "rider", slotKey: "cc-pro-road" }] });
    expect(html).toContain("Chaque convocation refusée retire 5 points de moral au coureur.");
    expect(html).toContain("Les refus de convocations distinctes se cumulent.");
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
