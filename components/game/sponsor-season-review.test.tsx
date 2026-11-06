import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
vi.mock("./sponsor-objective-title",()=>({SponsorObjectiveTitle:({children}:{children:React.ReactNode})=><p>{children}</p>}));
import {SponsorSeasonReviewPanel} from "./sponsor-season-review";
import {createSponsorSeasonReview,createSponsorSeasonReviewObjective} from "@/test/sponsor-season-review-fixture";
describe("sponsor season review panel",()=>{
  it("shows final satisfaction and both actual annual budgets before expanding objectives",()=>{
    const html=renderToStaticMarkup(<SponsorSeasonReviewPanel report={createSponsorSeasonReview()} />);
    expect(html).toContain("Votre bilan sponsor");expect(html).toContain("98 %");expect(html).toContain("Dotation S4");expect(html).toContain("Dotation S5");
    expect(html).toContain("320");expect(html).toContain("350");expect(html).toContain("+9,6 %");expect(html).toContain("<details");expect(html).not.toContain("<details open");
  });
  it("shows partial success and final rank without calling it a full success",()=>{
    const html=renderToStaticMarkup(<SponsorSeasonReviewPanel report={createSponsorSeasonReview({objectives:[createSponsorSeasonReviewObjective({status:"failed",achievementLevel:"partial",partialSatisfactionPoints:2,currentValue:20})]})} />);
    expect(html).toContain("Réussite partielle");expect(html).toContain("Petite satisfaction");expect(html).toContain("20e");expect(html).not.toContain("Objectif atteint");
  });
  it("does not present a changed contract's budget variation as a satisfaction bonus",()=>{
    const html=renderToStaticMarkup(<SponsorSeasonReviewPanel report={createSponsorSeasonReview({sameContract:false,currentSponsorName:"Autre sponsor"})} />);
    expect(html).toContain("Nouveau contrat");expect(html).not.toContain("Effet de la satisfaction");
  });
  it("distinguishes a missing archive from a zero and missing details from failed objectives",()=>{
    const html=renderToStaticMarkup(<SponsorSeasonReviewPanel report={createSponsorSeasonReview({satisfactionScore:null,objectives:[],objectivesAvailable:false})} />);
    expect(html).toContain("Non archivée");expect(html).toContain("n’est pas disponible");expect(html).not.toContain("0 %");expect(html).not.toContain("Nouveau contrat");
    expect(renderToStaticMarkup(<SponsorSeasonReviewPanel report={null} />)).toBe("");
  });
});
