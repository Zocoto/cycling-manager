import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FederationElectionPanel } from "./federation-election-panel";
import type { FederationGovernanceOverview } from "@/services/federation-governance";

describe("FederationElectionPanel", () => {
  it("shows a nominated president in office without claiming a vote took place", () => {
    const overview: FederationGovernanceOverview = {
      phase: "automatic", electionType: "regular", termStartGameYear: 3,
      termEndGameYear: 4, applicationsCloseAt: null, votingCloseAt: null,
      eligibleTeamCount: 0, voteCount: 0, viewerIsEligible: false,
      viewerCandidateId: null, viewerVotedCandidateId: null, canApply: false,
      canVote: false, candidacyBlockReason: null, viewerIsPresident: true,
      presidentName: "sevrinovitch", candidates: [], journal: [],
    };
    const markup = renderToStaticMarkup(<FederationElectionPanel countryCode="RW" overview={overview} />);
    expect(markup).toContain("Président en fonction");
    expect(markup).toContain("sevrinovitch préside la fédération jusqu’à la fin de la Saison 4");
    expect(markup).toContain("l’unique DS est nommé automatiquement");
    expect(markup).not.toContain("Aucun candidat n’a réuni de voix");
    expect(markup).not.toContain("sevrinovitch a été élu");
    expect(markup).not.toContain("Vote des équipes");
    expect(markup).not.toContain("Participation");
    const vacantMarkup = renderToStaticMarkup(<FederationElectionPanel countryCode="RW" overview={{ ...overview, presidentName: null, viewerIsPresident: false }} />);
    expect(vacantMarkup).toContain("Administration automatique");
    expect(vacantMarkup).toContain("Aucun candidat n’a réuni de voix");
  });
  it("explains an exceptional election and a sponsor-nationality candidacy block", () => {
    const markup = renderToStaticMarkup(
      <FederationElectionPanel
        countryCode="FR"
        overview={{
          phase: "applications",
          electionType: "exceptional",
          termStartGameYear: 3,
          termEndGameYear: 4,
          applicationsCloseAt: "2026-09-08T18:00:00.000Z",
          votingCloseAt: "2026-09-10T18:00:00.000Z",
          eligibleTeamCount: 8,
          voteCount: 0,
          viewerIsEligible: true,
          viewerCandidateId: null,
          viewerVotedCandidateId: null,
          canApply: false,
          canVote: false,
          candidacyBlockReason:
            "Votre prochain sponsor principal affiliera votre équipe à une autre fédération pendant ce mandat : vous ne pouvez pas vous présenter.",
          viewerIsPresident: false,
          presidentName: null,
          candidates: [],
          journal: [],
        }}
      />,
    );

    expect(markup).toContain("Élection exceptionnelle");
    expect(markup).toContain("Une élection exceptionnelle est ouverte");
    expect(markup).toContain("48 h suivantes");
    expect(markup).toContain("vous ne pouvez pas vous présenter");
    expect(markup).toContain("disabled");
  });
});
