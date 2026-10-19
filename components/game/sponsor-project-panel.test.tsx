import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SponsorProjectPanel, SponsorRaceBriefPanel } from "./sponsor-project-panel";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { createSponsorProjectFixture } from "@/test/sponsor-project-fixture";
import { buildSponsorRaceBrief } from "@/lib/game/sponsor-project";

describe("contextual sponsor guidance", () => {
  it("shows signed priorities and recorded progress without a new score or recruitment advice", () => {
    const { project } = createSponsorProjectFixture();
    const html = renderToStaticMarkup(<SponsorProjectPanel project={project} />);
    expect(html).toContain("Le projet du partenaire"); expect(html).toContain("Classiques pavées");
    expect(html).toContain("70 % / 75 %"); expect(html).toContain("Poids contractuel");
    expect(html).toContain('data-i18n-skip="true"'); expect(html).not.toContain("Retard");
    expect(renderToStaticMarkup(<SponsorProjectPanel project={project} scope="youth" />)).toBe("");
    expect(renderToStaticMarkup(<SponsorProjectPanel project={null} />)).toBe("");
  });
  it("distinguishes sporting affinity from a contractual reward", () => {
    const { project, edition } = createSponsorProjectFixture(); project.objectives = [];
    const html = renderToStaticMarkup(<SponsorRaceBriefPanel brief={buildSponsorRaceBrief(project, edition)} />);
    expect(html).toContain("Affinité sportive"); expect(html).toContain("aucune récompense contractuelle");
    expect(html).not.toContain("points de satisfaction");
  });
  it("uses recorded outcomes, including a correction from achieved to failed, without inventing credits", () => {
    const { project, edition, objective } = createSponsorProjectFixture();
    objective.status = "completed";
    const success = renderToStaticMarkup(<SponsorRaceBriefPanel brief={buildSponsorRaceBrief(project, edition)} final />);
    expect(success).toContain("Objectif atteint"); expect(success).not.toContain("+12");
    objective.status = "failed"; objective.achievementLevel = "partial"; objective.partialSatisfactionPoints = 3;
    const corrected = renderToStaticMarkup(<SponsorRaceBriefPanel brief={buildSponsorRaceBrief(project, edition)} final />);
    expect(corrected).toContain("Réussite partielle enregistrée"); expect(corrected).toContain("enregistrés : 3");
    expect(corrected).not.toContain("Objectif atteint");
    objective.status = "active";
    expect(renderToStaticMarkup(<SponsorRaceBriefPanel brief={buildSponsorRaceBrief(project, edition)} final />)).toContain("évaluation sponsor en attente");
  });
  it("explains the scope of a general classification objective and the existing main-objective risk", () => {
    const { project, edition, objective } = createSponsorProjectFixture();
    objective.mainObjectiveTerms = { cashReward: 100000, currencyCode: "EUR", reputationPenalty: 20, raceCategoryCode: "national", settlementStatus: "pending" };
    const html = renderToStaticMarkup(<SponsorRaceBriefPanel brief={buildSponsorRaceBrief(project, { ...edition, raceFormat: "stage_race" })} />);
    expect(html).toContain("Évalué à la fin du tour"); expect(html).toContain("Échec : −20");
    const english = renderToStaticMarkup(<LocaleProvider initialLocale="en"><SponsorRaceBriefPanel brief={buildSponsorRaceBrief(project, { ...edition, raceFormat: "stage_race" })} /></LocaleProvider>);
    expect(english).toContain("Contractual sponsor objective"); expect(english).toContain("Assessed at the end of the tour");
  });
});
