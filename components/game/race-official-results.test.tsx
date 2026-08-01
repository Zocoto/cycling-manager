import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/jeu/resultats/interview-actions", () => ({
  submitPostRaceInterviewAction: vi.fn(),
}));


import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "@/lib/game/race-calendar";
import type { OfficialRaceEditionResults } from "@/lib/game/race-results";

import { RaceOfficialResults } from "./race-official-results";

const stage = {
  id: "stage-1",
  dayNumber: 1,
  stageNumber: 1,
  name: "Course test",
  stageType: "road",
  status: "completed",
  profileType: "flat",
  distanceKm: 150,
  daySlot: "early",
  departureAt: null,
  segments: [],
} satisfies RaceCalendarStage;

const edition = {
  id: "edition-1",
  name: "Course test",
  raceFormat: "one_day",
  engagedRiders: [],
  stages: [stage],
} as unknown as RaceCalendarEdition;

function buildResults(
  teamProfileId: string | null
): OfficialRaceEditionResults {
  return {
    editionId: edition.id,
    isComplete: true,
    stages: [
      {
        stageId: "stage-1",
        stageNumber: 1,
        stageName: "Course test",
        results: [
          {
            riderId: "rider-1",
            riderName: "Camille Rapide",
            teamId: teamProfileId ?? "history-registration-1",
            teamProfileId,
            teamName: "Vélo Club Amateur",
            rank: 1,
            status: "finished",
            elapsedTimeMs: 3_600_000,
            gapToWinnerMs: 0,
            mountainPoints: 0,
            sprintPoints: 0,
            abandonmentReason: null,
          },
        ],
      },
    ],
    general: [],
    generalIsProvisional: false,
    secondary: [],
    attackParticipants: [],
  };
}

it("n'affiche pas les favoris dans les resultats officiels", () => {
  const markup = renderToStaticMarkup(
    <RaceOfficialResults
      edition={edition}
      selectedStageId="stage-1"
      officialResults={buildResults("team-active")}
    />
  );

  expect(markup).not.toContain("data-race-favorites");
  expect(markup).not.toContain("Pronostic d&#x27;avant-course");
});

describe("RaceOfficialResults", () => {
  it("affiche le nom d'une équipe supprimée sans lien persistant", () => {
    const markup = renderToStaticMarkup(
      <RaceOfficialResults
        edition={edition}
        selectedStageId="stage-1"
        officialResults={buildResults(null)}
      />
    );

    expect(markup).toContain("Vélo Club Amateur");
    expect(markup).not.toContain("/jeu/equipes/history-registration-1");
  });

  it("conserve le lien vers le profil d'une équipe active", () => {
    const markup = renderToStaticMarkup(
      <RaceOfficialResults
        edition={edition}
        selectedStageId="stage-1"
        officialResults={buildResults("team-active")}
      />
    );

    expect(markup).toContain('href="/jeu/equipes/team-active"');
  });
});
