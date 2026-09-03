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
      "cyclostratege:federation-jersey-draft:v2:fr",
    );
  });

  it("normalizes untrusted browser values", () => {
    expect(
      normalizeNationalJerseyDraft({
        baseColor: "url(javascript:bad)",
        elements: [
          {
            id: "invalid id",
            kind: "shape",
            shape: "shield",
            color: "red",
            secondaryColor: "#112233",
            x: 500,
            y: -100,
            width: 999,
            height: 0,
            rotation: -900,
            opacity: 9,
          },
        ],
      }),
    ).toMatchObject({
      schemaVersion: 2,
      baseColor: DEFAULT_NATIONAL_JERSEY_DRAFT.baseColor,
      elements: [
        {
          id: "element-1",
          color: "#111111",
          secondaryColor: "#112233",
          x: 180,
          y: -60,
          width: 220,
          height: 4,
          rotation: -180,
          opacity: 1,
        },
      ],
    });
  });

  it("rejects malformed local storage and restores valid drafts", () => {
    expect(decodeNationalJerseyDraft("not-json")).toBeNull();
    expect(
      decodeNationalJerseyDraft(
        JSON.stringify({
          schemaVersion: 2,
          baseColor: "#F0F0F0",
          elements: [
            {
              id: "band-1",
              kind: "band",
              shape: "rectangle",
              color: "#112233",
              secondaryColor: "#445566",
              x: 60,
              y: 70,
              width: 160,
              height: 18,
              rotation: 15,
              opacity: 0.8,
            },
          ],
        }),
      ),
    ).toMatchObject({
      schemaVersion: 2,
      baseColor: "#F0F0F0",
      elements: [{ kind: "band", rotation: 15 }],
    });
  });
});
