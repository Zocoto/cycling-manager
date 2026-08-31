import { describe, expect, it } from "vitest";

import {
  decodeNationalJerseyDraft,
  DEFAULT_NATIONAL_JERSEY_DRAFT,
  getNationalJerseyDraftStorageKey,
  normalizeNationalJerseyDraft,
} from "./national-jersey-preview";

describe("national jersey preview draft", () => {
  it("isolates a local draft by country", () => {
    expect(getNationalJerseyDraftStorageKey(" FR ")).toBe(
      "cyclostratege:federation-jersey-draft:v1:fr",
    );
  });

  it("normalizes untrusted browser values", () => {
    expect(
      normalizeNationalJerseyDraft({
        pattern: "invalid" as "classic",
        primaryColor: "url(javascript:bad)",
        motifX: 500,
        motifY: -20,
        motifScale: 99,
        motifRotation: -90,
      }),
    ).toMatchObject({
      pattern: DEFAULT_NATIONAL_JERSEY_DRAFT.pattern,
      primaryColor: DEFAULT_NATIONAL_JERSEY_DRAFT.primaryColor,
      motifX: 95,
      motifY: 30,
      motifScale: 1.8,
      motifRotation: -45,
    });
  });

  it("rejects malformed local storage and restores valid drafts", () => {
    expect(decodeNationalJerseyDraft("not-json")).toBeNull();
    expect(
      decodeNationalJerseyDraft(
        JSON.stringify({ pattern: "cross", accentColor: "#112233" }),
      ),
    ).toMatchObject({ pattern: "cross", accentColor: "#112233" });
  });
});
