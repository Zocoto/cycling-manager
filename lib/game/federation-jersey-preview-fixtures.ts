import type { NationalJerseyDraft, NationalJerseyElement, PublishedNationalJersey } from "./national-jersey-preview";
import { MAURITIUS_NATIONAL_TEAM_JERSEY } from "./national-team-jersey-presets";

function layer(id: string, patch: Partial<NationalJerseyElement>): NationalJerseyElement {
  return { id, kind: "band", shape: "rectangle", color: "#FFFFFF", secondaryColor: "#FFFFFF", x: 60, y: 78,
    width: 180, height: 10, rotation: 0, opacity: 1, ...patch };
}

export const PREVIEW_MAURITIUS_SELECTION = MAURITIUS_NATIONAL_TEAM_JERSEY;

export const PREVIEW_MAURITIUS_CHAMPION: NationalJerseyDraft = {
  schemaVersion: 2, baseColor: "#FFFFFF", elements: [
    layer("champion-flag", { kind: "flag", width: 220, height: 41, y: 78 }),
  ],
};

export function previewPublishedJersey(design: NationalJerseyDraft): PublishedNationalJersey {
  return { design, version: 1, publishedAt: "2026-10-17T08:00:00Z", activationGameYear: 4, isActive: true };
}
