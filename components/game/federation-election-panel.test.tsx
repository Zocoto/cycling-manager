import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FederationElectionPanel } from "./federation-election-panel";

describe("FederationElectionPanel", () => {
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
