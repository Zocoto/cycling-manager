import {describe, expect, it} from "vitest";
import {getSponsorReviewObjectivePresentation, readSponsorSeasonReviewObjective, summarizeSponsorSeasonReview} from "./sponsor-season-review";
import {createSponsorSeasonReview, createSponsorSeasonReviewObjective} from "@/test/sponsor-season-review-fixture";

describe("previous sponsor season review", ()=>{
  it("explains the real renewal using final archived satisfaction, not an old forecast",()=>{
    expect(summarizeSponsorSeasonReview(createSponsorSeasonReview())).toMatchObject({
      achieved: 1, total: 1, difference: 30720, changePercent: 9.6, satisfactionAdjustment: 9.6,
      budgetAfterSatisfaction: 350720, otherAdjustments: 0,
    });
  });
  it("separates ambition and rounding from the satisfaction adjustment",()=>{
    const report=createSponsorSeasonReview({satisfactionScore: 75, previousBudget: 910000, currentBudget: 1050000});
    expect(summarizeSponsorSeasonReview(report)).toMatchObject({satisfactionAdjustment: 5, budgetAfterSatisfaction: 955500, otherAdjustments: 94500});
  });
  it("retains a negative renewal and a true zero satisfaction",()=>{
    expect(summarizeSponsorSeasonReview(createSponsorSeasonReview({satisfactionScore: 0,currentBudget: 240000}))).toMatchObject({satisfactionAdjustment: -25, changePercent: -25});
    expect(summarizeSponsorSeasonReview(createSponsorSeasonReview({satisfactionScore: 46,currentBudget: 313600}))).toMatchObject({satisfactionAdjustment: -2, changePercent: -2});
  });
  it("never attributes a different contract's increase to satisfaction",()=>{
    expect(summarizeSponsorSeasonReview(createSponsorSeasonReview({sameContract: false,currentSponsorName: "New sponsor"}))).toMatchObject({satisfactionAdjustment: null,budgetAfterSatisfaction: null,otherAdjustments: null});
  });
  it("does not turn missing archives into a zero or compare different currencies",()=>{
    expect(summarizeSponsorSeasonReview(createSponsorSeasonReview({satisfactionScore: null,currentBudget: null}))).toMatchObject({changePercent: null,satisfactionAdjustment: null});
    expect(summarizeSponsorSeasonReview(createSponsorSeasonReview({currentCurrencyCode: "USD"}))).toMatchObject({changePercent: null,otherAdjustments: null});
  });
  it("counts partial, failed, neutralized and unarchived results separately",()=>{
    const objectives=[createSponsorSeasonReviewObjective(), createSponsorSeasonReviewObjective({status: "failed",achievementLevel: "partial"}),
      createSponsorSeasonReviewObjective({status: "failed",achievementLevel: "missed"}),createSponsorSeasonReviewObjective({status: "cancelled",achievementLevel: null}),
      createSponsorSeasonReviewObjective({status: "active",achievementLevel: null})];
    expect(summarizeSponsorSeasonReview(createSponsorSeasonReview({objectives}))).toMatchObject({achieved: 1,partial: 1,failed: 1,neutralized: 1,unrecorded: 1,total: 5});
    expect(getSponsorReviewObjectivePresentation(objectives[4]).label).toBe("Résultat non archivé");
  });
  it("reads final progress without inventing values or recomputing historical targets",()=>{
    const base={id:"o",name:"Quota",display_order:1,status:"active" as const,satisfaction_points:12,
      target_details:{kind:"nationality_quota" as const,countryCode:"BE",minimumPercentage:30}};
    expect(readSponsorSeasonReviewObjective({...base,objective_progress:[]})).toMatchObject({currentValue:null,targetValue:null,achievementLevel:null});
    expect(readSponsorSeasonReviewObjective({...base,objective_progress:[{status:"achieved",current_value:"36.00",details:{targetValue:30}}]})).toMatchObject({status:"completed",currentValue:36,targetValue:30});
    expect(readSponsorSeasonReviewObjective({...base,status:"cancelled",objective_progress:[{status:"achieved",current_value:0,details:null}]}).status).toBe("cancelled");
  });
  it("keeps a neutralized objective neutral even if older partial credit remains recorded",()=>{
    expect(getSponsorReviewObjectivePresentation(createSponsorSeasonReviewObjective({status:"cancelled",achievementLevel:"partial",partialSatisfactionPoints:2}))).toMatchObject({status:"neutralized"});
  });
});
