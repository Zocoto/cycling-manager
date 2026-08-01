export type RiderPreviewLinkComponent =
  (typeof import("@/components/game/rider-preview-link"))["RiderPreviewLink"];

export type RacePreviewLinkComponent =
  (typeof import("@/components/game/race-preview-link"))["RacePreviewLink"];

let riderPreviewPromise: Promise<RiderPreviewLinkComponent> | null = null;
let racePreviewPromise: Promise<RacePreviewLinkComponent> | null = null;

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
