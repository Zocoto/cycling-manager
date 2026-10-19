import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RaceCourseJournal, RaceJournalTimeline } from "./race-course-journal";
import { createRaceJournalFixture } from "@/test/race-journal-fixture";
import { LocaleProvider } from "@/components/i18n/locale-provider";

describe("RaceCourseJournal", () => {
  it("reste fermé par défaut et ne monte pas le récit ni les détails avant ouverture", () => {
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
    expect(markup).not.toContain("Camille Rapide s’impose");
    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
    expect(markup).not.toContain("<li");
  });

  it("préserve un fait par ligne lorsque la chronologie est montée", () => {
    const { entries } = createRaceJournalFixture();
    const markup = renderToStaticMarkup(<RaceJournalTimeline entries={entries} />);
    expect(markup.match(/<li/g)).toHaveLength(entries.length);
    expect(markup).toContain("Camille Rapide s’impose");
    expect(markup.indexOf("Échappée")).toBeLessThan(markup.indexOf("Victoire"));
  });

  it("absorbe le bilan sans exposer le nom ni les détails de l’équipe avant ouverture", () => {
    const { entries, report } = createRaceJournalFixture();
    const markup = renderToStaticMarkup(<RaceCourseJournal entries={entries} teamReport={report} />);
    expect(markup.match(/data-race-course-journal/g)).toHaveLength(1);
    expect(markup).not.toContain(report.teamName);
    expect(markup).not.toContain("data-rider-journal");
    expect(markup).toContain("les faits marquants de votre équipe");
  });

  it("reste disponible pour les résultats sans scénario et n’invente pas de faits", () => {
    const { report } = createRaceJournalFixture();
    report.hasTimeline = false; report.events = [];
    const markup = renderToStaticMarkup(<RaceCourseJournal entries={[]} teamReport={report} />);
    expect(markup).toContain("Journal de course");
    expect(markup).not.toContain("0 faits marquants");
    expect(renderToStaticMarkup(<RaceCourseJournal entries={[]} />)).toBe("");
    expect(renderToStaticMarkup(<RaceCourseJournal entries={[]} teamReport={{...report, riders: []}} />)).toBe("");
  });

  it("localise l’en-tête sans charger le catalogue global pour le rendu français", () => {
    const { entries } = createRaceJournalFixture();
    const markup = renderToStaticMarkup(<LocaleProvider initialLocale="en"><RaceCourseJournal entries={entries} /></LocaleProvider>);
    expect(markup).toContain("Race report");
    expect(markup).toContain("key moments");
    expect(markup).not.toContain("Journal de course");
  });
});
