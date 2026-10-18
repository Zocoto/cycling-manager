import { describe, expect, it } from "vitest";
import { buildCyclogazetteJerseyStories, type GazetteJerseyChangeRow } from "./cyclogazette-jerseys";
import { normalizeNationalJerseyDraft } from "./national-jersey-preview";

const design = normalizeNationalJerseyDraft({ baseColor: "#123456", elements: [{ id: "flag", kind: "flag", shape: "roundel" }] as never });
const row: GazetteJerseyChangeRow = {
  country_id: "france", country_code: "FR", country_name: "France", jersey_kind: "national_team",
  version: 2, design, previous_design: normalizeNationalJerseyDraft({ baseColor: "#FFFFFF" }),
  published_at: "2026-10-18T09:00:00Z", rider_id: "rider", rider_name: "Jean Martin",
  avatar_profile_key: "europe_west", avatar_seed: "123456789123456789", championship_type: null,
};

describe("annonces de nouveaux maillots", () => {
  it("ne crée aucune nouvelle sans publication", () => expect(buildCyclogazetteJerseyStories([])).toEqual([]));
  it("ignore une republication identique, y compris les identifiants de calques et le contour implicite", () => {
    expect(buildCyclogazetteJerseyStories([{ ...row, previous_design: { ...design, elements: design.elements.map(e => ({ ...e, id: "other", border: true })) } }])).toEqual([]);
  });
  it("ignore les options sans effet visuel sur une bande ou un drapeau", () => {
    const band = normalizeNationalJerseyDraft({ elements: [{ kind: "band", border: false, shape: "star" }] as never });
    expect(buildCyclogazetteJerseyStories([{ ...row, design: band, previous_design: { ...band, elements: band.elements.map(e => ({ ...e, border: true, shape: "rectangle" })) } }])).toEqual([]);
    expect(buildCyclogazetteJerseyStories([{ ...row, previous_design: { ...design, elements: design.elements.map(e => ({ ...e, color: "#ABCDEF" })) } }])).toEqual([]);
  });
  it("garde une seule dernière tenue par pays et par rôle", () => {
    const stories = buildCyclogazetteJerseyStories([row, { ...row, version: 3, published_at: "2026-10-18T10:00:00Z" }, { ...row, jersey_kind: "national_champion", championship_type: "road" }]);
    expect(stories.map(s => s.kind)).toEqual(["national_team_jersey", "national_champion_jersey"]);
    expect(stories[0].jerseyReveal?.version).toBe(3);
  });
  it("ne présente rien si la dernière publication revient au maillot initial", () => {
    expect(buildCyclogazetteJerseyStories([row, { ...row, version: 3, published_at: "2026-10-18T10:00:00Z", design: row.previous_design! }])).toEqual([]);
  });
  it("présente une première publication et conserve son portrait ainsi que sa composition", () => {
    const story = buildCyclogazetteJerseyStories([{ ...row, previous_design: null }])[0];
    expect(story.jerseyReveal?.design).toEqual(design);
    expect(story.jerseyReveal?.rider?.avatarSeed).toBe(row.avatar_seed);
    expect(story.titleEn).toContain("France");
    row.design.baseColor = "#654321";
    expect(story.jerseyReveal?.design.baseColor).toBe("#123456");
    row.design.baseColor = "#123456";
  });
  it.each(["France", "Japon", "Pays-Bas", "Iran", "Madagascar"])("emploie un titre correct sans déclinaison hasardeuse pour %s", country => {
    expect(buildCyclogazetteJerseyStories([{ ...row, country_name: country }])[0].title).toBe(`${country} : le nouveau maillot de sélection dévoilé`);
  });
  it("ne baptise pas un coureur quelconque champion lorsque aucun champion n’est disponible", () => {
    const story = buildCyclogazetteJerseyStories([{ ...row, jersey_kind: "national_champion", rider_id: null }])[0];
    expect(story.jerseyReveal?.rider).toBeNull();
    expect(story.kind).toBe("national_champion_jersey");
  });
});
