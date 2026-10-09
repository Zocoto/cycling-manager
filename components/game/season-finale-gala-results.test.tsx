import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SEASON_FINALE_GALA_RESULTS, SEASON_FINALE_GALA_RESULTS_VIDEO_IDS } from "@/lib/game/season-finale-gala-results-data";
import type { SeasonFinaleGalaPublishedReward } from "@/services/season-finale-gala-results";
import { SeasonFinaleGalaResults, formatGalaGap } from "./season-finale-gala-results";
import { SeasonFinaleGalaMenuLink } from "./season-finale-gala-menu-link";

function grantedRewards(): SeasonFinaleGalaPublishedReward[] {
  return SEASON_FINALE_GALA_RESULTS.flatMap((group) => group.rows.filter((row) => row.rank <= 5).map((row) => ({ group_number: group.groupNumber, rank: row.rank, rider_id: row.riderId, rider_name: row.riderName, team_id: row.teamId, team_name: row.teamName, manager_name: `Manager ${row.teamId}`, item_name: `Lot ${group.groupNumber}-${row.rank}`, summary: "+3 VAL", allocated_at: "2026-10-08T17:00:00Z" })));
}

describe("publication des résultats du gala", () => {
  it("propose les deux films, les 39 équipes et les top 20 officiels", () => {
    const html = renderToStaticMarkup(<SeasonFinaleGalaResults videoIds={SEASON_FINALE_GALA_RESULTS_VIDEO_IDS} rewards={[]} />);
    expect(html).toContain("Regarder la poule 1");
    expect(html).toContain("Regarder la poule 2");
    expect(html).toContain("20 équipes engagées");
    expect(html).toContain("19 équipes engagées");
    expect(html.match(/Classement · Top 20/g)).toHaveLength(2);
    expect(html).toContain("Zain Miah");
    expect(html).toContain("Mathieu Laurent");
    expect(html).toContain("4h23′16″");
    expect(html).toContain("4h24′10″");
    expect(html).not.toContain("Classement intégral");
    expect(html).not.toContain("<iframe");
  });

  it("groupe les 10 lots par bénéficiaire et ne les annonce attribués qu'après allocation", () => {
    const html = renderToStaticMarkup(<SeasonFinaleGalaResults videoIds={SEASON_FINALE_GALA_RESULTS_VIDEO_IDS} rewards={grantedRewards()} />);
    expect(html).toContain("10 lots · 8 équipes récompensées");
    expect(html.match(/Dans l’inventaire ✓/g)).toHaveLength(8);
    expect(html).toContain("Lot 1-1");
    expect(html).toContain("Lot 1-3");
    expect(html).toContain("Lot 2-1");
    expect(html).toContain("Lot 2-2");
    expect(html).not.toContain("Attribution en attente");
    const before = renderToStaticMarkup(<SeasonFinaleGalaResults videoIds={SEASON_FINALE_GALA_RESULTS_VIDEO_IDS} rewards={[]} />);
    expect(before).toContain("Attribution en attente");
    expect(before).not.toContain("Dans l’inventaire");
  });

  it("maintient les résultats visibles sans inventer les attributions lorsque la lecture est indisponible", () => {
    const html = renderToStaticMarkup(<SeasonFinaleGalaResults videoIds={{ 1: null, 2: null }} rewards={null} />);
    expect(html).toContain("Le suivi des attributions est temporairement indisponible");
    expect(html).toContain("Roue avant · Éclat de Gala");
    expect(html).toContain("Attribution à vérifier");
    expect(html).not.toContain("Dans l’inventaire");
  });

  it("ne mélange pas une attribution avec une autre équipe ou un autre coureur", () => {
    const rewards = grantedRewards();
    rewards[0] = { ...rewards[0], team_id: "autre-equipe", manager_name: "Mauvais bénéficiaire" };
    const html = renderToStaticMarkup(<SeasonFinaleGalaResults videoIds={SEASON_FINALE_GALA_RESULTS_VIDEO_IDS} rewards={rewards} />);
    expect(html).not.toContain("Mauvais bénéficiaire");
    expect(html).toContain("Attribution en attente");
    expect(html).toContain("Roue avant · Éclat de Gala");
  });

  it("conserve les liens de fiches et met les équipes avant chaque film", () => {
    const html = renderToStaticMarkup(<SeasonFinaleGalaResults videoIds={SEASON_FINALE_GALA_RESULTS_VIDEO_IDS} rewards={[]} />);
    const first = SEASON_FINALE_GALA_RESULTS[0].rows[0];
    expect(html).toContain(`href="/jeu/coureurs/${first.riderId}"`);
    expect(html).toContain(`href="/jeu/equipes/${first.teamId}"`);
    expect(html.indexOf("Équipes de la poule 1")).toBeLessThan(html.indexOf("Le film de la poule 1"));
    expect(html.indexOf("Équipes de la poule 2")).toBeLessThan(html.indexOf("Le film de la poule 2"));
  });

  it("rend l'annonce dorée/noire aussi dans le menu mobile et traduit le statut anglais", () => {
    const html = renderToStaticMarkup(<SeasonFinaleGalaMenuLink />);
    expect(html).toContain('bg-[#D2B46B]');
    expect(html).toContain('text-[#101114]');
    expect(html).toContain("<strong");
    expect(html).toContain("Les résultats sont tombés");
    expect(renderToStaticMarkup(<SeasonFinaleGalaMenuLink isEnglish />)).toContain("The results are in");
  });

  it("donne accès au gala depuis les résultats et conserve des colonnes responsive sans largeur fixe", () => {
    const page = readFileSync(join(process.cwd(), "app/jeu/resultats/page.tsx"), "utf8");
    expect(page).toContain("<DashboardGalaShortcut now={Date.now()} />");
    const css = readFileSync(join(process.cwd(), "components/game/season-finale-gala.module.css"), "utf8");
    expect(css).toContain("@media (min-width: 1024px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr)");
    expect(css).toContain("overflow-y: auto");
    const galaPage = readFileSync(join(process.cwd(), "app/jeu/gala-fin-de-saison/page.tsx"), "utf8");
    expect(galaPage).not.toContain("getPcmGalaRegistrationContext");
    expect(galaPage).not.toContain("PcmGalaRegistrationPanel");
    expect(galaPage).toContain("SeasonFinaleGalaRewardsAdmin");
  });

  it("affiche clairement les écarts sans fabriquer des valeurs", () => {
    expect(formatGalaGap(0)).toBe("m.t.");
    expect(formatGalaGap(9)).toBe("+9″");
    expect(formatGalaGap(125)).toBe("+2′05″");
  });
});
