import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";
import type { RaceRosterOption } from "@/services/race-calendar";

import {
  RaceRosterSelector,
  formatRosterForm,
  getRosterFormClasses,
  sortAndFilterRaceRosterOptions,
} from "./race-roster-selector";
import { SeasonRaceDaysBadge } from "./season-race-days-badge";

const rider = {
  riderId: "00000000-0000-4000-8000-000000000001",
  firstName: "Émile",
  lastName: "Martin",
  countryName: "France",
  countryCode: "FR",
  avatarProfileKey: "western_europe",
  avatarSeed: 42,
  age: 24,
  mountain: 78,
  hills: 76,
  flat: 69,
  timeTrial: 66,
  cobbles: 63,
  sprint: 61,
  breakaway: 73,
  form: 87.5,
  morale: 72,
  seasonRaceDays: 0,
  squadStatus: "lieutenant",
  climateProfile: { strength: "sun", weakness: "rain" },
  isSelected: false,
  currentRole: "auto",
  isAvailable: true,
  unavailability: null,
  conflict: null,
} satisfies RaceRosterOption;

describe("RaceRosterSelector", () => {
  it("affiche la forme actuelle à côté du coureur et conserve les notes principales", () => {
    const markup = renderToStaticMarkup(
      <form>
        <RaceRosterSelector
          riders={[
            rider,
            {
              ...rider,
              riderId: "00000000-0000-4000-8000-000000000002",
              seasonRaceDays: 24,
              projectedSeasonRaceDays: 32,
            },
          ]}
          minimum={1}
          maximum={1}
          jersey={FREE_AGENT_RIDER_JERSEY}
          isStageRace={false}
        />
      </form>,
    );

    expect(markup).toContain("Forme 87,5/100");
    expect(markup).toContain(">0 JDC</span>");
    expect(markup).toContain(">32 JDC prév.</span>");
    expect(markup).toContain('title="Jours de course projetés · 32 (24 disputés, 8 à venir)"');
    expect(markup).toContain("Surcharge prévue");
    expect(markup).toContain("Au-delà de 30 JDC, le malus est de 1 point de moral par jour supplémentaire pour les coureurs sans le talent Étapovore.");
    expect(markup).toContain("Lieutenant");
    expect(markup).toContain("MON 78 · VAL 76 · PLA 69");
    expect(markup).toContain("CLM 66 · PAV 63 · SPR 61 · BAR 73");
    expect(markup).toContain("Trier par");
    expect(markup).toContain("Jours de course disputés (JDC)");
    expect(markup).toContain("Baroudeur (BAR)");
    expect(markup).toContain("Masquer les coureurs déjà engagés");
    expect(markup).toContain("+ Soleil");
    expect(markup).toContain("− Pluie");
    expect(markup).toContain("bonus de 1,5 point");
    expect(markup).toContain("malus de 1,25 point");
  });

  it("signale le dépassement du seuil pour les coureurs soumis au malus de moral", () => {
    const atThreshold = renderToStaticMarkup(<SeasonRaceDaysBadge seasonRaceDays={30} />);
    const overThreshold = renderToStaticMarkup(<SeasonRaceDaysBadge seasonRaceDays={31} />);
    const noPenalty = renderToStaticMarkup(
      <SeasonRaceDaysBadge seasonRaceDays={31} projectedSeasonRaceDays={32} warnOnOverload={false} />,
    );
    const etapovore = renderToStaticMarkup(
      <SeasonRaceDaysBadge seasonRaceDays={29} projectedSeasonRaceDays={32} hasEtapovore />,
    );

    expect(atThreshold).not.toContain("bg-red-100");
    expect(overThreshold).toContain("bg-red-100");
    expect(overThreshold).toContain("Calendrier surchargé");
    expect(noPenalty).toContain(">32 JDC prév.</span>");
    expect(noPenalty).not.toContain("bg-red-100");
    expect(etapovore).toContain("bg-emerald-100");
    expect(etapovore).toContain("+0,5 de moral par JDC au-delà de 30.");
    expect(etapovore).not.toContain("Surcharge prévue");
  });

  it("permet de modifier la sélection et les rôles existants dans le même formulaire", () => {
    const markup = renderToStaticMarkup(
      <form>
        <RaceRosterSelector
          riders={[{ ...rider, isSelected: true, isAvailable: false, currentRole: "leader" }]}
          minimum={1}
          maximum={2}
          jersey={FREE_AGENT_RIDER_JERSEY}
          isStageRace={true}
          selectionOnly
          allowRoleEditing
          submitLabel="Enregistrer la composition"
        />
      </form>,
    );

    expect(markup).toContain('name="riderIds"');
    expect(markup).toContain("checked");
    expect(markup).toContain("Rôle en course");
    expect(markup).toContain(`${rider.riderId}:leader`);
    expect(markup).toContain("rôles généraux de la course");
    expect(markup).toContain("disabled");
  });

  it("garde inscrit le leader annoncé en conférence même si sa case est verrouillée", () => {
    const markup = renderToStaticMarkup(
      <form>
        <RaceRosterSelector
          riders={[{ ...rider, isSelected: true }]}
          minimum={1}
          maximum={2}
          jersey={FREE_AGENT_RIDER_JERSEY}
          isStageRace={true}
          selectionOnly
          lockedRiderIds={[rider.riderId]}
        />
      </form>,
    );

    expect(markup).toContain("Leader annoncé en conférence");
    expect(markup).toContain(
      `type="hidden" name="riderIds" value="${rider.riderId}"`,
    );
  });

  it("trie les coureurs par statistique dans les deux sens", () => {
    const strongerClimber = {
      ...rider,
      riderId: "00000000-0000-4000-8000-000000000002",
      firstName: "Lina",
      lastName: "Durand",
      mountain: 84,
      breakaway: 65,
    } satisfies RaceRosterOption;

    expect(
      sortAndFilterRaceRosterOptions({
        riders: [rider, strongerClimber],
        sortKey: "mountain",
        sortDirection: "descending",
        hideConflicting: false,
      }).map((option) => option.riderId),
    ).toEqual([strongerClimber.riderId, rider.riderId]);

    expect(
      sortAndFilterRaceRosterOptions({
        riders: [rider, strongerClimber],
        sortKey: "breakaway",
        sortDirection: "ascending",
        hideConflicting: false,
      }).map((option) => option.riderId),
    ).toEqual([strongerClimber.riderId, rider.riderId]);
  });

  it("masque les conflits sans faire disparaître un coureur déjà sélectionné", () => {
    const conflictingRider = {
      ...rider,
      riderId: "00000000-0000-4000-8000-000000000003",
      firstName: "Noah",
      lastName: "Bernard",
      isAvailable: false,
      conflict: {
        raceSlug: "course-concurrente",
        raceName: "Course concurrente",
        startDay: 12,
        endDay: 14,
      },
    } satisfies RaceRosterOption;

    expect(
      sortAndFilterRaceRosterOptions({
        riders: [conflictingRider, rider],
        sortKey: "roster",
        sortDirection: "descending",
        hideConflicting: true,
      }).map((option) => option.riderId),
    ).toEqual([rider.riderId]);

    expect(
      sortAndFilterRaceRosterOptions({
        riders: [conflictingRider, rider],
        sortKey: "roster",
        sortDirection: "descending",
        hideConflicting: true,
        selectedRiderIds: new Set([conflictingRider.riderId]),
      }).map((option) => option.riderId),
    ).toEqual([conflictingRider.riderId, rider.riderId]);
  });

  it("trie les JDC disputés sans confondre zéro, projections et données manquantes", () => {
    const options: RaceRosterOption[] = [
      { ...rider, riderId: "unknown", seasonRaceDays: undefined, projectedSeasonRaceDays: 2 },
      { ...rider, riderId: "ten", seasonRaceDays: 10 },
      { ...rider, riderId: "zero", seasonRaceDays: 0, projectedSeasonRaceDays: 20 },
      { ...rider, riderId: "another-zero", seasonRaceDays: 0 },
    ];
    const sortedIds = (sortDirection: "ascending" | "descending") =>
      sortAndFilterRaceRosterOptions({
        riders: options,
        sortKey: "seasonRaceDays",
        sortDirection,
        hideConflicting: false,
      }).map(({ riderId }) => riderId);

    expect(sortedIds("ascending")).toEqual(["zero", "another-zero", "ten", "unknown"]);
    expect(sortedIds("descending")).toEqual(["ten", "zero", "another-zero", "unknown"]);
  });

  it("borne l’affichage et distingue visuellement les niveaux de forme", () => {
    expect(formatRosterForm(103)).toBe("100");
    expect(formatRosterForm(-4)).toBe("0");
    expect(getRosterFormClasses(90)).toContain("emerald");
    expect(getRosterFormClasses(70)).toContain("amber");
    expect(getRosterFormClasses(50)).toContain("rose");
  });

  it("charge la dernière forme de la saison depuis la base", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260822154500_expose_rider_form_in_race_roster_options.sql",
      ),
      "utf8",
    );
    const service = readFileSync(
      join(process.cwd(), "services/race-calendar.ts"),
      "utf8",
    );

    expect(migration).toContain("current_form numeric");
    expect(migration).toContain("order by season_day.day_number desc");
    expect(migration).toContain("coalesce(latest_condition.form, 75::numeric)");
    expect(service).toContain("form: Number(rider.current_form)");
    expect(service).toContain("climateProfile: getRiderClimateProfile({");
  });

  it("expose la note baroudeur dans les options d’inscription", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260913100000_expose_breakaway_in_race_roster_options.sql",
      ),
      "utf8",
    );
    const service = readFileSync(
      join(process.cwd(), "services/race-calendar.ts"),
      "utf8",
    );

    expect(migration).toContain("breakaway integer");
    expect(migration).toContain("coalesce(rating.breakaway, 50)::integer");
    expect(service).toContain("breakaway: rider.breakaway");
  });
});
