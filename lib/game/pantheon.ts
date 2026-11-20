import type { CareerPalmaresCategory } from "./career-palmares";

export const PANTHEON_PAGE_SIZE = 25;
export const PANTHEON_PATH = "/jeu/pantheon";

export const PANTHEON_CATEGORIES = {
  grand_tour_monument: "Grands Tours et Monuments",
  elite: "Élite",
  world: "Mondial",
  continental: "Continental",
  national: "National",
  regional: "Régional",
  local: "Local",
  junior: "Juniors",
} satisfies Record<CareerPalmaresCategory, string>;

export type PantheonCategory = keyof typeof PANTHEON_CATEGORIES;
export type PantheonKind = "race" | "general" | "stage" | "team";
export type PantheonView = "palmares" | "classement";
export type PantheonSort = "prestige" | "wins" | "points";

export type PantheonFilters = {
  view: PantheonView;
  category: PantheonCategory | "all";
  kind: PantheonKind | "all";
  sort: PantheonSort;
  query: string;
  season: number | null;
  raceKey: string | null;
  page: number;
};

export type PantheonSearchParams = Record<string, string | string[] | undefined>;

export function readPantheonFilters(params: PantheonSearchParams): PantheonFilters {
  function value(key: string) {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  }

  const view = value("vue") === "classement" ? "classement" : "palmares";
  const category = value("categorie");
  const kind = value("type");
  const season = Number(value("saison"));
  const raceKey = value("course").trim();
  const page = Number(value("page"));
  return {
    view,
    category: Object.hasOwn(PANTHEON_CATEGORIES, category) ? category as PantheonCategory : "all",
    kind: view === "palmares" && (kind === "race" || kind === "general" || kind === "stage" || kind === "team") ? kind : "all",
    sort: value("tri") === "victoires" ? "wins" : value("tri") === "points" ? "points" : "prestige",
    query: value("q").trim().slice(0, 80),
    season: view === "palmares" && Number.isSafeInteger(season) && season > 0 ? season : null,
    raceKey: view === "palmares" && raceKey.length <= 160 && raceKey ? raceKey : null,
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export function getPantheonHref(filters: PantheonFilters, overrides: Partial<PantheonFilters> = {}) {
  const { view, category, kind, sort, query, season, raceKey, page } = { ...filters, ...overrides };
  const search = new URLSearchParams();
  if (view === "classement") search.set("vue", view);
  if (category !== "all") search.set("categorie", category);
  if (query) search.set("q", query);
  if (view === "classement" && sort === "wins") search.set("tri", "victoires");
  if (view === "classement" && sort === "points") search.set("tri", "points");
  if (view === "palmares") {
    if (kind !== "all") search.set("type", kind);
    if (season) search.set("saison", String(season));
    if (raceKey) search.set("course", raceKey);
  }
  if (page > 1) search.set("page", String(page));
  return search.size ? `${PANTHEON_PATH}?${search}` : PANTHEON_PATH;
}
