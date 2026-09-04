import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const migration = read(
  "supabase/migrations/20260904016000_separate_s3_international_and_elite_calendar.sql",
);
const selectionWorkbench = read(
  "components/game/federation-selection-workbench.tsx",
);
const federationView = read("components/game/national-federation-view.tsx");

describe("calendrier international S3 sans collision Elite", () => {
  it("déplace les dix CC en J15 et le Mur de Catalogne en J28", () => {
    expect(migration).toContain(
      "race.competition_type = 'continental_championship' then 15",
    );
    expect(migration).toContain("race.slug = 'mur-de-catalogne'");
    expect(migration).toContain("else 28");
    expect(migration).toContain(
      "Les dix épreuves continentales S3 ne sont pas toutes en J15.",
    );
    expect(migration).toContain(
      "Le Mur de Catalogne S3 doit être en J28 à 14 h.",
    );
  });

  it("conserve explicitement la Ruta, Desert to Sky et le GP du Littoral", () => {
    expect(migration).toContain("race.slug = 'ruta-de-las-sierras'");
    expect(migration).toContain("where day.day_number between 17 and 22");
    expect(migration).toContain("race.slug = 'desert-to-sky-classic'");
    expect(migration).toContain(
      "Desert to Sky S3 doit rester en J22 à 18 h.",
    );
    expect(migration).toContain("race.slug = 'grand-prix-du-littoral'");
    expect(migration).toContain(
      "Le Grand Prix du Littoral S3 doit rester en J28 à 18 h.",
    );
  });

  it("refuse de toucher une étape simulée ou déjà classée", () => {
    expect(migration).toContain("stage.status = 'planned'");
    expect(migration).toContain(
      "edition.status not in ('in_progress', 'completed', 'cancelled')",
    );
    expect(migration).toContain("from public.stage_results as result");
    expect(migration).toContain(
      "from public.official_stage_simulations as simulation",
    );
    expect(migration).not.toMatch(/delete from public\.(stage_results|race_results|official_stage_simulations)/);
  });

  it("préserve les inscriptions et recalcule seulement leurs échéances", () => {
    expect(migration).toContain(
      "registration_closes_at = case",
    );
    expect(migration).toContain("withdrawal_closes_at = case");
    expect(migration).toContain("wildcard_closes_at = case");
    expect(migration).not.toMatch(
      /(?:delete|update)\s+public\.(?:race_registrations|race_rosters)/,
    );
  });

  it("bloque durablement toute nouvelle collision CC, NC ou CM avec Elite", () => {
    expect(migration).toContain(
      "create trigger enforce_international_elite_stage_calendar_trigger",
    );
    expect(migration).toContain(
      "create trigger guard_international_selection_slot_day_trigger",
    );
    expect(migration).toContain(
      "Une course Elite ne peut pas être programmée en J%",
    );
    expect(migration).toContain(
      "Une collision Elite / CC-NC-CM subsiste à partir de la S3.",
    );
  });

  it("neutralise les anciens générateurs J22, y compris côté juniors", () => {
    expect(migration).toContain(
      "create trigger align_development_international_calendar_trigger",
    );
    expect(migration).toContain("'continental_road', 'continental_time_trial'");
    expect(migration).toContain(
      "create trigger apply_international_selection_slot_day_trigger",
    );
    expect(migration).toContain(
      "create trigger align_international_season_event_day_trigger",
    );
  });

  it("affiche le même J15 dans les deux vues fédérales", () => {
    for (const slotKey of [
      "cc-pro-road",
      "cc-pro-itt",
      "cc-junior-road",
      "cc-junior-itt",
    ]) {
      expect(selectionWorkbench).toMatch(
        new RegExp(`id: "${slotKey}"[^\\n]+day: 15`),
      );
    }
    expect(federationView).toMatch(
      /day: 15,\n\s+name: "Championnats continentaux"/,
    );
  });
});
