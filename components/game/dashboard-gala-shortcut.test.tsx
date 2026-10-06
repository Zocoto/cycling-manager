import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardGalaShortcut } from "./dashboard-gala-shortcut";

describe("raccourci gala du bureau du DS", () => {
  it("propose un seul accès direct, sans menu ni sous-menu", () => {
    const html = renderToStaticMarkup(<DashboardGalaShortcut />);
    expect(html).toContain('href="/jeu/gala-fin-de-saison"');
    expect(html).toContain("Grand Gala de fin de saison");
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).not.toContain("<nav");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Inscriptions ouvertes");
  });
  it("place le raccourci dans le bureau avant les cartes de gestion", () => {
    const source = readFileSync(join(process.cwd(), "app/jeu/page.tsx"), "utf8");
    expect(source).toContain("<DashboardGalaShortcut />");
    expect(source.indexOf("<DashboardGalaShortcut />")).toBeLessThan(source.indexOf("<DashboardReferralInvite />"));
  });
});
