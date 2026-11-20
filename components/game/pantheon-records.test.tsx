import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { readPantheonFilters } from "@/lib/game/pantheon";
import type { PantheonData } from "@/services/pantheon";
import { PantheonRecords } from "./pantheon-records";

vi.mock("@/components/ui/app-link", () => ({ default: "a" }));

describe("Panthéon", () => {
  it("links to the historical race and retired rider while preserving filters on pagination", () => {
    const filters = readPantheonFilters({ categorie: "elite", saison: "2", type: "general" });
    const records: PantheonData = {
      view: "palmares", total: 26, seasons: [{ game_year: 2, season_name: "Saison 2" }],
      items: [{
        id: "tour-2", race_key: "corsa-delle-regioni", race_name: "Corsa delle Regioni",
        result_href: null, season_name: "Saison 2", game_year: 2, category: "elite", kind: "general",
        stage_name: null, rider_key: "retired-rider", rider_id: "retired-rider", rider_name: "Alessio Bellini",
        country_code: "IT", team_name: "Veloria", retired: true, points: 12,
      }],
    };
    const html = renderToStaticMarkup(<PantheonRecords filters={filters} records={records} />);

    expect(html).toContain("course=corsa-delle-regioni");
    expect(html).toContain('href="/jeu/coureurs/retired-rider"');
    expect(html).toContain("Retraité");
    expect(html).toContain("categorie=elite&amp;type=general&amp;saison=2&amp;page=2");
    expect(html).not.toContain("/jeu/resultats/");
  });

  it("defaults to points and keeps explicit ranking modes in pagination", () => {
    const filters = readPantheonFilters({ vue: "classement" });
    const records: PantheonData = {
      view: "classement", total: 31,
      items: [{
        rank: 1, rider_key: "rider", rider_id: "rider", rider_name: "Alessio Bellini", country_code: "IT",
        retired: false, wins: 13, points: 112, category_wins: { elite: 6, junior: 7 },
      }],
    };
    const html = renderToStaticMarkup(<PantheonRecords filters={filters} records={records} />);

    expect(filters.sort).toBe("points");
    expect(html).toContain('<option value="points" selected="">');
    expect(html).toContain("112 pts");
    expect(html).toMatch(/>6<\/span>Élite/);
    expect(html).toMatch(/>7<\/span>Juniors/);
    expect(html).toContain("vue=classement&amp;page=2");

    const olympic = readPantheonFilters({ vue: "classement", tri: "prestige" });
    const olympicHtml = renderToStaticMarkup(<PantheonRecords filters={olympic} records={records} />);
    expect(olympicHtml).toContain('<option value="prestige" selected="">');
    expect(olympicHtml).toContain("vue=classement&amp;tri=prestige&amp;page=2");
  });
});
