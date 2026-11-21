import { Suspense } from "react";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getDashboardRaceRosterAlerts,
  type DashboardRaceRosterAlert,
} from "@/lib/game/dashboard-assistant";
import type { RaceCalendarEdition, SeasonRaceCalendar } from "@/lib/game/race-calendar";
import {
  DashboardRaceRosterStatus,
  DashboardRaceRosterStatusPlaceholder,
} from "./dashboard-race-roster-status";

const now = new Date("2026-11-21T10:00:00.000Z");

function race(id: string, overrides: Partial<RaceCalendarEdition> = {}): RaceCalendarEdition {
  return {
    id,
    raceId: `race-${id}`,
    slug: id,
    name: `Course ${id}`,
    shortName: null,
    status: "registration_closed",
    countryName: "France",
    countryCode: "FR",
    categoryCode: "national",
    categoryName: "National",
    prestigeRank: 4,
    raceFormat: "one_day",
    competitionType: "standard",
    registrationClosesAt: null,
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "open",
    minimumReputation: null,
    minimumRosterSize: 8,
    maximumRosterSize: 8,
    engagedRiderCount: 6,
    engagedRiders: [],
    currentTeamRegistration: { status: "accepted", rosterCount: 6 },
    stages: [{
      id: `stage-${id}`,
      dayNumber: 17,
      stageNumber: 1,
      name: `Course ${id}`,
      stageType: "road",
      status: "planned",
      profileType: "flat",
      distanceKm: 150,
      daySlot: "early",
      departureAt: "2026-11-22T13:00:00.000Z",
      segments: [],
    }],
    ...overrides,
  };
}

function alerts(editions: RaceCalendarEdition[]): DashboardRaceRosterAlert[] {
  const calendar: SeasonRaceCalendar = {
    seasonId: "season-5",
    seasonName: "Saison 5",
    gameYear: 2026,
    startsOn: "2026-11-06",
    endsOn: "2026-12-03",
    currentDayNumber: 16,
    days: [],
    events: [],
    editions,
  };
  return getDashboardRaceRosterAlerts(calendar, now);
}

async function status(editions: RaceCalendarEdition[]) {
  return renderToStaticMarkup(await DashboardRaceRosterStatus({
    alertsPromise: Promise.resolve(alerts(editions)),
  })).replace(/<!--.*?-->/g, "");
}

describe("dashboard race roster status", () => {
  it("does not retain a replacement warning after the affected race has finished", async () => {
    const pastRace = race("caucase", {
      status: "completed",
      currentTeamRegistration: { status: "accepted", rosterCount: 7 },
    });
    pastRace.stages[0] = {
      ...pastRace.stages[0]!,
      dayNumber: 13,
      departureAt: "2026-11-18T13:00:00.000Z",
      status: "completed",
    };

    expect(await status([pastRace])).toContain("Saison ouverte");
  });

  it("counts one affected start-list when two riders are missing", async () => {
    const html = await status([race("future")]);
    expect(html).toContain("1 start-list à corriger");
    expect(html).not.toContain("2 start-lists");
  });

  it("counts separate actionable races using the same alerts as the assistant", async () => {
    expect(await status([race("future-a"), race("future-b")]))
      .toContain("2 start-lists à corriger");
  });

  it("excludes filled, withdrawn and already started compositions", async () => {
    expect(await status([
      race("filled", { currentTeamRegistration: { status: "accepted", rosterCount: 8 } }),
      race("withdrawn", { currentTeamRegistration: { status: "withdrawn", rosterCount: 6 } }),
      race("started", { status: "in_progress" }),
    ])).toContain("Saison ouverte");
  });

  it("keeps an unavailable calendar neutral instead of declaring no correction is needed", async () => {
    const html = renderToStaticMarkup(await DashboardRaceRosterStatus({
      alertsPromise: Promise.resolve(null),
    }));
    expect(html).toContain("Consulter le calendrier");
    expect(html).not.toContain("Saison ouverte");
    expect(html).not.toContain("à corriger");
  });

  it("uses a neutral status while the calendar is loading", () => {
    const html = renderToStaticMarkup(<DashboardRaceRosterStatusPlaceholder />);
    expect(html).toContain("Consulter le calendrier");
    expect(html).not.toContain("Saison ouverte");
    expect(html).not.toContain("à corriger");
  });

  it("streams the usable calendar link while its status is pending", async () => {
    let resolve!: (value: DashboardRaceRosterAlert[]) => void;
    const pending = new Promise<DashboardRaceRosterAlert[]>(done => { resolve = done; });
    const stream = await renderToReadableStream(<main>
      <a href="/jeu/calendrier">Inscriptions &amp; calendrier</a>
      <Suspense fallback={<DashboardRaceRosterStatusPlaceholder />}>
        <DashboardRaceRosterStatus alertsPromise={pending} />
      </Suspense>
    </main>);
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
      const initial = decoder.decode((await reader.read()).value);
      expect(initial).toContain('href="/jeu/calendrier"');
      expect(initial).toContain("Consulter le calendrier");
      expect(initial).not.toContain("start-list à corriger");

      resolve(alerts([race("future")]));
      let remaining = "";
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        remaining += decoder.decode(chunk.value);
      }
      expect(remaining.replace(/<!--.*?-->/g, "")).toContain("1 start-list à corriger");
    } finally {
      resolve([]);
      await reader.cancel();
    }
  });
});
