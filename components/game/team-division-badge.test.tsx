import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TeamDivisionBadge } from "./team-division-badge";

describe("TeamDivisionBadge", () => {
  it.each([
    ["la division amateur", "amateur"],
    ["une division absente", null],
    ["une division inconnue", "unknown"],
  ])("n’affiche rien pour %s", (_, division) => {
    expect(
      renderToStaticMarkup(
        <TeamDivisionBadge division={division} />
      )
    ).toBe("");
  });

  it.each([
    ["elite", "Division Élite"],
    ["world", "Division World"],
    ["continental", "Division Continentale"],
    ["national", "Division Nationale"],
  ])(
    "conserve le badge %s",
    (division, expectedLabel) => {
      expect(
        renderToStaticMarkup(
          <TeamDivisionBadge division={division} />
        )
      ).toContain(expectedLabel);
    }
  );
});
