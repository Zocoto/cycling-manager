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
} from "./race-roster-selector";

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
  form: 87.5,
  isSelected: false,
  isAvailable: true,
  unavailability: null,
  conflict: null,
} satisfies RaceRosterOption;

describe("RaceRosterSelector", () => {
  it("affiche la forme actuelle à côté du coureur et conserve les notes principales", () => {
    const markup = renderToStaticMarkup(
      <form>
        <RaceRosterSelector
          riders={[rider]}
          minimum={1}
          maximum={1}
          jersey={FREE_AGENT_RIDER_JERSEY}
          isStageRace={false}
        />
      </form>,
    );

    expect(markup).toContain("Forme 87,5/100");
    expect(markup).toContain("MON 78 · VAL 76 · PLA 69");
    expect(markup).toContain("CLM 66 · PAV 63 · SPR 61");
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
  });
});
