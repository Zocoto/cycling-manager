export type RiderPreviewLinkComponent =
  (typeof import("@/components/game/rider-preview-link"))["RiderPreviewLink"];

export type RacePreviewLinkComponent =
  (typeof import("@/components/game/race-preview-link"))["RacePreviewLink"];

export type TeamPreviewLinkComponent =
  (typeof import("@/components/game/team-preview-link"))["TeamPreviewLink"];

let riderPreviewPromise: Promise<RiderPreviewLinkComponent> | null = null;
let racePreviewPromise: Promise<RacePreviewLinkComponent> | null = null;
let teamPreviewPromise: Promise<TeamPreviewLinkComponent> | null = null;

export function loadRiderPreviewLink() {
  riderPreviewPromise ??= import("@/components/game/rider-preview-link").then(
    (module) => module.RiderPreviewLink,
  );
  return riderPreviewPromise;
}

export function loadRacePreviewLink() {
  racePreviewPromise ??= import("@/components/game/race-preview-link").then(
    (module) => module.RacePreviewLink,
  );
  return racePreviewPromise;
}

export function loadTeamPreviewLink() {
  teamPreviewPromise ??= import("@/components/game/team-preview-link").then(
    (module) => module.TeamPreviewLink,
  );
  return teamPreviewPromise;
}
