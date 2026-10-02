export type PerformanceSample = {
  source: "web" | "rpc";
  route: string;
  metric: string;
  value: number;
  device: "mobile" | "desktop" | "server";
  ok: boolean;
};

const WEB_METRICS = new Set(["CLS", "FCP", "FID", "INP", "LCP", "TTFB", "Next.js-hydration", "Next.js-render", "Next.js-route-change-to-render"]);
const PUBLIC_ROUTES = new Set(["connexion", "inscription", "classements", "actualites"]);
const GAME_ROUTES = new Set(["entrainement", "centre-de-formation", "materiel", "centre-de-soin", "calendrier", "chat", "gazette", "sponsoring", "effectif", "finances", "infrastructures", "objectifs", "federations", "resultats", "championnats-nationaux", "preparation-course", "transferts", "staff", "equipe", "inventaire", "selections-internationales"]);

/** Route families only: never persist rider/team IDs, names or search parameters. */
export function normalizePerformanceRoute(pathname: string): string {
  const parts = pathname.split(/[?#]/, 1)[0].split("/").filter(Boolean);
  if (!parts.length) return "/";
  if (parts[0] === "jeu") return parts.length === 1 ? "/jeu" : GAME_ROUTES.has(parts[1]) ? `/jeu/${parts[1]}` : "/jeu/autre";
  return PUBLIC_ROUTES.has(parts[0]) ? `/${parts[0]}` : "/autre";
}

export function parseWebPerformanceSample(input: unknown): PerformanceSample | null {
  if (!input || typeof input !== "object") return null;
  const m = input as Record<string, unknown>;
  if (typeof m.name !== "string" || !WEB_METRICS.has(m.name) ||
    typeof m.value !== "number" || !Number.isFinite(m.value) || m.value < 0 ||
    m.value > (m.name === "CLS" ? 10 : 300_000) ||
    typeof m.pathname !== "string" || !m.pathname.startsWith("/") || m.pathname.length > 300 ||
    typeof m.viewportWidth !== "number" || !Number.isFinite(m.viewportWidth) || m.viewportWidth < 1 || m.viewportWidth > 20_000) return null;
  return { source: "web", route: normalizePerformanceRoute(m.pathname), metric: m.name,
    value: m.value, device: m.viewportWidth < 768 ? "mobile" : "desktop", ok: true };
}
