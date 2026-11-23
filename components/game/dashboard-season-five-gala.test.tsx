import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SEASON_FIVE_GALA } from "@/lib/game/season-five-gala";
import { DashboardSeasonFiveGala } from "./dashboard-season-five-gala";

describe("official season-five gala on the DS office", () => {
  it("links prominently to the official registration page with the Paris deadline", () => {
    const html = renderToStaticMarkup(<DashboardSeasonFiveGala now={Date.parse("2026-11-23T12:00:00Z")} />);
    expect(html).toContain('data-gala-s5-registration-feature="true"');
    expect(html).toContain('href="/jeu/gala-saison-5"');
    expect(html).toContain("Le Gala des Lumières");
    expect(html).toContain("Les inscriptions sont ouvertes");
    expect(html).toContain("Jeudi 3 décembre à 18 h (heure de Paris)");
    expect(html).toContain("Inscrire mon équipe");
  });

  it("keeps the programme accessible after registration closes without advertising open registration", () => {
    const closes = Date.parse(SEASON_FIVE_GALA.registrationClosesAt);
    const html = renderToStaticMarkup(<DashboardSeasonFiveGala now={closes} />);
    expect(html).toContain('href="/jeu/gala-saison-5"');
    expect(html).toContain("Les inscriptions sont closes");
    expect(html).toContain("Voir le programme");
    expect(html).not.toContain("Inscrire mon équipe");
    expect(renderToStaticMarkup(<DashboardSeasonFiveGala now={closes - 1} />)).toContain("Les inscriptions sont ouvertes");
  });

  it("appears in the bureau above referrals without fetching each manager’s registration context", () => {
    const bureau = readFileSync("app/jeu/page.tsx", "utf8");
    const card = readFileSync("components/game/dashboard-season-five-gala.tsx", "utf8");
    expect(bureau).toContain("<DashboardSeasonFiveGala now={Date.now()} />");
    expect(bureau.indexOf("<DashboardSeasonFiveGala ")).toBeLessThan(bureau.indexOf("<DashboardReferralInvite "));
    expect(card).not.toContain("supabase");
    expect(card).not.toContain("getCurrentSeasonFiveGalaContext");
  });
});
