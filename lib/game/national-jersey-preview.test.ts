import { describe, expect, it } from "vitest";

import {
  decodeNationalJerseyDraft,
  DEFAULT_NATIONAL_JERSEY_DRAFT,
  getNationalJerseyDraftStorageKey,
  NATIONAL_JERSEY_ELEMENT_SHAPES,
  normalizeNationalJerseyDraft,
} from "./national-jersey-preview";

describe("national jersey preview draft", () => {
  it("préserve les anciens contours et conserve un choix explicite sans cadre après relecture", () => {
    const legacy = normalizeNationalJerseyDraft({ elements: [{ id: "flag", kind: "flag" }] as never });
    expect(legacy.elements[0].border).toBeUndefined();
    const borderless = normalizeNationalJerseyDraft({ elements: [{ ...legacy.elements[0], border: false }] });
    expect(decodeNationalJerseyDraft(JSON.stringify(borderless))?.elements[0].border).toBe(false);
    expect(normalizeNationalJerseyDraft({ elements: [{ ...legacy.elements[0], border: "false" }] as never }).elements[0].border).not.toBe(false);
  });
  it.each(NATIONAL_JERSEY_ELEMENT_SHAPES)("conserve la forme %s lors de l’enregistrement du brouillon", shape => {
    const design = normalizeNationalJerseyDraft({ elements: [{ id: "pattern", kind: "shape", shape, border: false }] as never });
    expect(decodeNationalJerseyDraft(JSON.stringify(design))?.elements[0]).toMatchObject({ shape, border: false });
  });
  it("keeps the two role drafts separate without losing the old selection draft key", () => {
    expect(getNationalJerseyDraftStorageKey("MU", "national_champion")).not.toBe(getNationalJerseyDraftStorageKey("MU"));
  });
  it("bounds and normalizes text without treating it as markup", () => {
    const result = normalizeNationalJerseyDraft({ elements: [{ id: "text", kind: "text", text: "MAURITIUS\n" + "X".repeat(40) }] as never });
    expect(result.elements[0].text).toHaveLength(32);
    expect(result.elements[0].text).not.toContain("\n");
  });
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
