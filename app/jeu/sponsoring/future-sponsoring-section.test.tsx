import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ signSponsorOfferAction: vi.fn() }));
vi.mock("./sponsoring-controls", () => ({ ConfirmSponsorButton: () => null, SponsorJerseySelector: () => null }));
vi.mock("./sponsor-negotiation-control", () => ({ SponsorNegotiationControl: () => null }));
import { FutureSponsoringSection } from "./future-sponsoring-section";
import type { FutureSponsoringState } from "@/services/sponsoring-workflow";
import {SPONSORS} from "@/data/sponsors";
describe("future sponsoring unavailable notice", () => {
  it("shows the saved next-season ambition and signed objectives instead of only the current-season programme", () => {
    const sponsor=SPONSORS.find(s=>s.id==="lima-maki")!;
    const state={kind:"planned",mode:"renewal",season:{id:"s5",name:"Saison 5",gameYear:5},isRenewal:true,renewalBudgetIsFinal:false,
      contract:{id:"contract",sponsor,sportingPhilosophy:"ardennes_classics",budgetPerSeason:1390000,currencyCode:"EUR",contractDurationSeasons:2,
        selectedJerseyId:null,objectives:[{id:"goal",name:"Top 20 sur Doyenne des Collines",satisfactionPoints:15,
          targetDetails:{kind:"race_result",objectiveDifficulty:"ambitious",raceSlug:"doyenne-des-collines",raceLabel:"Doyenne des Collines",achievementType:"top_n",targetRank:20},mainObjectiveTerms:null}]}} as unknown as FutureSponsoringState;
    const html=renderToStaticMarkup(<FutureSponsoringSection reputationPoints={2000} state={state}/>);
    expect(html).toContain("Engagements signés · Saison 5");
    expect(html).toContain("Objectifs ambitieux");
    expect(html).toContain("Top 20 sur Doyenne des Collines");
    expect(html).not.toContain("statut planned");
  });
  it("shows an honest, retryable partial error instead of a ready contract or signing form", () => {
    const html = renderToStaticMarkup(<FutureSponsoringSection reputationPoints={30} state={{ kind: "unavailable", targetGameYear: 4, targetSeasonName: "Saison 4" }} />);
    expect(html).toContain("Saison 4");
    expect(html).toContain('role="alert"');
    expect(html).toContain("temporairement indisponible");
    expect(html).toContain('href="/jeu/sponsoring"');
    expect(html).not.toContain("Votre prochain sponsor est prêt");
    expect(html).not.toContain("<form");
  });
  it("clearly reports refusal and its contract-wide threshold without promising a guaranteed offer", () => {
    const state: FutureSponsoringState = { kind: "offers", mode: "renewal", season: { id: "s5", name: "Saison 5", gameYear: 5 },
      renewalBudgetIsFinal: false, offers: [], renewalAssessment: { contractId: "contract", sponsorId: "sponsor",
        averageSatisfaction: 25, minimumSatisfaction: 35, seasonsEvaluated: 2, reputationDiscount: 10, refused: true } };
    const html = renderToStaticMarkup(<FutureSponsoringSection reputationPoints={1000} state={state} />);
    expect(html).toContain("refuse la reconduction"); expect(html).toContain("25 %"); expect(html).toContain("35 %");
    expect(html).toContain("2 saison(s)"); expect(html).toContain("Votre contrat actuel reste respecté");
    expect(html).toContain("amélioration du bilan"); expect(html).not.toContain("garanti");
  });
});
