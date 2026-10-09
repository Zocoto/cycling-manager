import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardGalaShortcut } from "./dashboard-gala-shortcut";

describe("raccourci gala du bureau du DS", () => {
  it("propose un seul accès direct, sans menu ni sous-menu", () => {
    const html = renderToStaticMarkup(<DashboardGalaShortcut now={Date.parse("2026-10-09T23:59:59+02:00")} />);
    expect(html).toContain('href="/jeu/gala-fin-de-saison"');
    expect(html).toContain("Grand Gala de fin de saison");
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).not.toContain("<nav");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Inscriptions ouvertes");
    expect(html).toContain('bg-[#D2B46B]');
    expect(html).toContain('text-[#101114]');
    expect(html).toContain('<strong class="mt-0.5 block text-sm font-black">Les résultats sont tombés</strong>');
  });
  it("retire l’encart exactement à J2 minuit, heure de Paris", () => {
    const midnight = Date.parse("2026-10-10T00:00:00+02:00");
    expect(renderToStaticMarkup(<DashboardGalaShortcut now={midnight - 1} />)).toContain("Grand Gala de fin de saison");
    expect(renderToStaticMarkup(<DashboardGalaShortcut now={midnight} />)).toBe("");
    expect(renderToStaticMarkup(<DashboardGalaShortcut now={Date.parse("2026-10-10T12:00:00+02:00")} />)).toBe("");
  });
  it("place le raccourci dans le bureau avant les cartes de gestion", () => {
    const source = readFileSync(join(process.cwd(), "app/jeu/page.tsx"), "utf8");
    expect(source).toContain("<DashboardGalaShortcut now={Date.now()} />");
    expect(source.indexOf("<DashboardGalaShortcut now={Date.now()} />")).toBeLessThan(source.indexOf("<DashboardReferralInvite />"));
  });
});
