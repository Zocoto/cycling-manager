import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RaceCourseJournal } from "./race-course-journal";

describe("RaceCourseJournal", () => {
  it("reste fermé par défaut et affiche un fait par ligne", () => {
    const markup = renderToStaticMarkup(
      <RaceCourseJournal
        entries={[
          {
            id: "start",
            kind: "start",
            distanceKm: 0,
            title: "Départ",
            detail: "120 coureurs prennent le départ.",
          },
          {
            id: "finish",
            kind: "finish",
            distanceKm: 172,
            title: "Victoire",
            detail: "Camille Rapide s’impose.",
          },
        ]}
      />,
    );

    expect(markup).toContain("Journal de course");
    expect(markup).toContain("2 faits marquants");
    expect(markup).toContain("Camille Rapide s’impose");
    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
    expect(markup.match(/<li/g)).toHaveLength(2);
  });
});
