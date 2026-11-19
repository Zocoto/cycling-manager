import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TeamMediaCenterOverview } from "@/services/team-media-center";
import { MediaCenterComposer } from "./media-center-composer";

vi.mock("@/app/jeu/gazette/actions", () => ({
  publishMediaCenterArticleAction: vi.fn(),
}));

const overview: TeamMediaCenterOverview = {
  teamName: "Kirghiz Galloping Horses", buildingLevel: 1, currentDayNumber: 14,
  canSubmit: false, nextSubmissionInDays: 6, publicationIntervalDays: 7,
  canIncludeSponsor: false, hasFanClub: true, sponsorName: null,
  recentArticles: [{
    id: "article-1", dayNumber: 14, title: "Les chemins de Botiryeva",
    body: "Le premier vélo et la jeunesse du coureur au village.",
    blocks: null, sponsorName: null, reputationAwarded: 1,
    supportersAwarded: 25, status: "queued",
  }],
};

describe("MediaCenterComposer", () => {
  it("rouvre un aperçu du contenu envoyé avec une modification possible avant publication", () => {
    const markup = renderToStaticMarkup(<MediaCenterComposer overview={overview} success errorMessage={null} />);
    expect(markup).toContain("Aperçu de votre dernier article");
    expect(markup).toContain("Les chemins de Botiryeva");
    expect(markup).toContain(overview.recentArticles[0].body);
    expect(markup).toContain("Modifier avant publication");
    expect(markup).toMatch(/<details[^>]*open=""/);
  });

  it("conserve la mise en forme de l’aperçu publié et retire le bouton de modification", () => {
    const published: TeamMediaCenterOverview = {
      ...overview,
      recentArticles: [{
        ...overview.recentArticles[0], status: "published",
        blocks: [{ type: "text", font: "serif", content: [{ text: "La version enregistrée", bold: true }] }],
      }],
    };
    const markup = renderToStaticMarkup(<MediaCenterComposer overview={published} success={false} errorMessage={null} />);
    expect(markup).toContain("<strong>La version enregistrée</strong>");
    expect(markup).not.toContain("Modifier avant publication");
  });
});
