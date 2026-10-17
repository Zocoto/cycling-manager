import {
  normalizeNationalJerseyDraft,
  type NationalJerseyDraft,
  type NationalJerseyElement,
} from "./national-jersey-preview";

function layer(id: string, patch: Partial<NationalJerseyElement>): NationalJerseyElement {
  return {
    id, kind: "band", shape: "rectangle", color: "#FFFFFF", secondaryColor: "#FFFFFF",
    x: 60, y: 78, width: 180, height: 10, rotation: 0, opacity: 1, ...patch,
  };
}

// Owner-approved national selection design (17 October 2026), kept independently
// of preview fixtures. Reusing it is a draft operation, never an auto-publication.
export const MAURITIUS_NATIONAL_TEAM_JERSEY: NationalJerseyDraft = {
  schemaVersion: 2,
  baseColor: "#102E4D",
  elements: [
    layer("selection-red", { color: "#EA2839", secondaryColor: "#EA2839", y: 81, rotation: -24, height: 14 }),
    layer("selection-blue", { color: "#1646A0", secondaryColor: "#1646A0", y: 94, rotation: -24, height: 13 }),
    layer("selection-gold", { color: "#F4D233", secondaryColor: "#F4D233", y: 107, rotation: -24, height: 13 }),
    layer("selection-green", { color: "#159B61", secondaryColor: "#159B61", y: 120, rotation: -24, height: 13 }),
    layer("selection-flag", { kind: "flag", x: 75, y: 33, width: 15, height: 11 }),
    layer("selection-name", { kind: "text", text: "MAURITIUS", x: 60, y: 56, width: 50, height: 9, color: "#FFFFFF", secondaryColor: "#102E4D" }),
  ],
};

export function getNationalTeamJerseyPreset(countryCode: string): NationalJerseyDraft | null {
  return countryCode.trim().toUpperCase() === "MU"
    ? normalizeNationalJerseyDraft(MAURITIUS_NATIONAL_TEAM_JERSEY)
    : null;
}
