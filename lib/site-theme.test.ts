import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getActiveSiteTheme, HALLOWEEN_SITE_THEME, isInAnnualThemeWindow, nextSiteThemeCheckDelay } from "./site-theme";
const APPROVED_CONFIGURATION = { ...HALLOWEEN_SITE_THEME, enabled: true };
const approvedTheme = (now: Date) => getActiveSiteTheme(now, APPROVED_CONFIGURATION);

describe("skin Halloween annuel", () => {
  it("active uniquement le skin approuvé, sans requête réseau ni mécanisme de jeu", () => {
    expect(HALLOWEEN_SITE_THEME).toEqual({ enabled: true, window: { start: { month: 10, day: 9 }, end: { month: 11, day: 2 } } });
    expect(getActiveSiteTheme(new Date("2026-10-09T12:00:00Z"))).toBe("halloween");
    expect(getActiveSiteTheme(new Date("2026-10-31T12:00:00Z"))).toBe("halloween");
    expect(readFileSync(resolve("lib/site-theme.ts"), "utf8")).not.toMatch(/supabase|\.rpc\(|\bfetch\(|setInterval|setTimeout/);
  });
  it.each([2026, 2027, 2028, 2030, 2040])("revient chaque année (%s), bornes incluses", (year) => {
    expect(approvedTheme(new Date(`${year}-10-08T12:00:00Z`))).toBeUndefined();
    expect(approvedTheme(new Date(`${year}-10-09T12:00:00Z`))).toBe("halloween");
    expect(approvedTheme(new Date(`${year}-10-31T12:00:00Z`))).toBe("halloween");
    expect(approvedTheme(new Date(`${year}-11-02T12:00:00Z`))).toBe("halloween");
    expect(approvedTheme(new Date(`${year}-11-03T12:00:00Z`))).toBeUndefined();
  });
  it("suit le minuit parisien, y compris de part et d’autre du changement d’heure", () => {
    expect(approvedTheme(new Date("2026-10-08T21:59:59.999Z"))).toBeUndefined();
    expect(approvedTheme(new Date("2026-10-08T22:00:00Z"))).toBe("halloween");
    expect(approvedTheme(new Date("2026-11-02T22:59:59.999Z"))).toBe("halloween");
    expect(approvedTheme(new Date("2026-11-02T23:00:00Z"))).toBeUndefined();
  });
  it("permet de couper le skin ou de modifier sa période sans toucher aux pages", () => {
    const now = new Date("2026-10-31T12:00:00Z");
    expect(getActiveSiteTheme(now, { enabled: false, window: HALLOWEEN_SITE_THEME.window })).toBeUndefined();
    expect(getActiveSiteTheme(now, { enabled: true, window: null })).toBeUndefined();
    expect(getActiveSiteTheme(now, { enabled: true, window: { start: { month: 10, day: 31 }, end: { month: 10, day: 31 } } })).toBe("halloween");
    expect(getActiveSiteTheme(now, { enabled: true, window: { start: { month: 11, day: 1 }, end: { month: 11, day: 2 } } })).toBeUndefined();
  });
  it("supporte une période annuelle passant par le nouvel an", () => {
    const window = { start: { month: 12, day: 25 }, end: { month: 1, day: 5 } };
    for (const day of ["2026-12-25", "2026-12-31", "2027-01-01", "2027-01-05"]) expect(isInAnnualThemeWindow(new Date(`${day}T12:00:00Z`), window)).toBe(true);
    for (const day of ["2026-12-24", "2027-01-06", "2027-06-01"]) expect(isInAnnualThemeWindow(new Date(`${day}T12:00:00Z`), window)).toBe(false);
  });
  it("échoue sans activation si les dates sont invalides", () => {
    expect(getActiveSiteTheme(new Date("invalid"))).toBeUndefined();
    for (const start of [{ month: 0, day: 4 }, { month: 13, day: 4 }, { month: 10, day: 0 }, { month: 4, day: 31 }, { month: 10.5, day: 4 }]) expect(isInAnnualThemeWindow(new Date(), { start, end: { month: 11, day: 2 } })).toBe(false);
  });
  it("rafraîchit aussi un onglet ouvert au passage du minuit parisien", () => {
    expect(nextSiteThemeCheckDelay(new Date("2026-10-08T21:45:00Z"))).toBe(15 * 60000);
    expect(nextSiteThemeCheckDelay(new Date("2026-10-08T21:59:59.999Z"))).toBe(1);
    expect(nextSiteThemeCheckDelay(new Date("2026-11-02T22:45:00Z"))).toBe(15 * 60000);
    expect(nextSiteThemeCheckDelay(new Date("2026-11-03T00:00:00Z"))).toBe(3600000);
    expect(nextSiteThemeCheckDelay(new Date("invalid"))).toBe(3600000);
    const client = readFileSync(resolve("components/layout/seasonal-theme-sync.tsx"), "utf8");
    expect(client).toContain('removeEventListener("visibilitychange", onVisible)');
    expect(client).not.toMatch(/supabase|fetch\(|setInterval|localStorage|sessionStorage/);
  });
  it("importe le même CSS à la racine, pas uniquement dans le bureau", () => {
    const layout = readFileSync(resolve("app/layout.tsx"), "utf8");
    expect(layout).toContain('import "./seasonal-theme.css"');
    expect(layout).toContain("data-site-theme={getActiveSiteTheme()}");
    const css = readFileSync(resolve("app/seasonal-theme.css"), "utf8");
    expect(css.trim().startsWith("/*")).toBe(true);
    expect(css).toContain('[data-site-theme="halloween"]');
    expect(css).not.toMatch(/animation\s*:|filter\s*:|opacity\s*:|padding\s*:|min-height\s*:|url\(|\.game-workspace/);
    expect(css).toContain(':not(:disabled)');
    expect(css).toContain('[data-site-theme-preserve]');
    expect(css).toContain('--cm-night: #201a18');
    expect(css).not.toMatch(/--cm-danger\s*:|--cm-mint\s*:/);
    expect(css).toContain('[data-halloween-logo-web] { display: none;');
  });
  it.each([["#eb934d", "#29231f"], ["#f6a764", "#29231f"], ["#29231f", "#f7c697"], ["#3b3028", "#f7c697"], ["#fff4e7", "#29231f"]])("conserve un contraste texte AA : %s / %s", (background, text) => {
    const values = [background, text].map((hex) => {
      const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    });
    expect((Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
  it("couvre les liens-cartes, raccourcis sans arrondi et boutons aux couleurs variables", () => {
    const css = readFileSync(resolve("app/seasonal-theme.css"), "utf8");
    expect(css).toContain('a[class*="rounded"], a[class*="px-"]');
    for (const token of ["bg-[var(--fan-primary)]", "bg-[var(--fan-accent)]", "text-[var(--fan-primary)]", "bg-[var(--federation-secondary)]"]) {
      expect(css).toContain(`[class~="${token}"]`);
    }
    const dashboard = readFileSync(resolve("app/jeu/page.tsx"), "utf8");
    expect(dashboard.match(/data-site-action="dark"/g)).toHaveLength(3);
    expect(dashboard).toContain("data-site-action-icon");
    expect(dashboard).toContain("data-site-action-overlay");
    expect(dashboard.match(/data-site-action-label/g)).toHaveLength(3);
    expect(dashboard.match(/data-site-action-icon/g)).toHaveLength(3);
    expect(css).toContain(':not([class*="bg-"])');
    expect(css).toContain(".game-shell .mobile-chat-bubble");
    expect(css).toContain('[class~="bg-[#7CCF9C]/10" i]');
    expect(css).toContain(':has(> svg[aria-hidden="true"])');
    expect(css).toContain('[class~="bg-[#1B463C]" i]');
    expect(css).toContain(':not([data-site-theme-preserve] *)');
  });
  it("habille les actions désactivées sans les réactiver ni modifier leur opacité", () => {
    const css = readFileSync(resolve("app/seasonal-theme.css"), "utf8");
    expect(css).not.toContain('a.halloween-subtle-button):not(:disabled)');
    expect(css.match(/&:hover:not\(:disabled\):not\(\[aria-disabled="true"\]\)/g)).toHaveLength(4);
    expect(css).not.toMatch(/cursor\s*:|opacity\s*:|pointer-events\s*:\s*(auto|all)/);
  });
});
