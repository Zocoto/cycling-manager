import { describe, expect, it } from "vitest";
import { buildFinanceIncomeAnalysis, classifyFinanceIncome, type FinanceIncomeSourceTransaction } from "./finance-income-analysis";

function receipt(id: string, amount: number, category = "other", status: FinanceIncomeSourceTransaction["status"] = "posted", sourceReference = id): FinanceIncomeSourceTransaction {
  return { id, amount, category, status, sourceReference };
}
describe("finance income analysis", () => {
  it.each([
    ["sponsor", "sponsor:contract:7", "sponsors"],
    ["sponsor", "secondary-sponsor-objective:goal", "sponsors"],
    ["race_prize", "reward:sponsor-objective:goal:team", "sponsors"],
    ["sponsor", "sponsor-main-objective:goal", "sponsors"],
    ["race_prize", "reward:official-race:edition", "races"],
    ["race_prize", "reward:official-stage-prize:edition:stage", "races"],
    ["other", "objective:claim", "objectives"],
    ["other", "newcomer-journey:journey:follow_race_live", "objectives"],
    ["race_prize", "reward:objective:claim", "objectives"],
    ["race_prize", "reward:team-rivalry:duel:a", "rivalries"],
    ["other", "team-rivalry:duel:b", "rivalries"],
    ["other", "federation-solidarity:plan:team", "federation_aid"],
    ["other", "understaffed-roster-aid:season", "team_aid"],
    ["other", "rookie-season-reward:season:team", "season_prizes"],
    ["race_prize", "reward:division-bonus:season", "season_prizes"],
    ["race_prize", "development-event-reward:result", "junior_races"],
    ["other", "fan-club:sales:season:day", "shop"],
    ["transfer", "transfer-sale:listing", "transfers"],
    ["equipment", "equipment-resale:item", "asset_sales"],
    ["other", "fan-club:car:sale:vehicle", "asset_sales"],
    ["other", "financial-director:bonus:receipt", "financial_director"],
    ["other", "financial-director:daily:day", "financial_director"],
    ["other", "financial-director:salary-savings:receipt", "financial_director"],
    ["race_prize", "reward:hidden-switchback:director", "rewards"],
    ["race_prize", "reward:longevity-trophy:director", "rewards"],
    ["race_prize", "reward:medical-trophy:director:milestone", "rewards"],
    ["race_prize", "reward:night-auction-trophy:award", "rewards"],
    ["other", "trophy:award", "rewards"],
    ["other", "referral:count", "rewards"],
    ["training", "form-camp-refund:camp", "refunds"],
    ["transfer", "transfer-correction-refund:listing", "refunds"],
    ["staff_salary", "welcome-scout-salary-refund:salary", "refunds"],
    ["other", "objective:refund:claim", "refunds"],
    ["other", " FAn-Club:Sales:season:day ", "shop"],
    ["other", "future-source:receipt", "other"],
    ["other", "objective-preview:receipt", "other"],
  ])("classifies %s / %s as %s", (category, sourceReference, expected) => {
    expect(classifyFinanceIncome({ category, sourceReference })).toBe(expected);
  });
  it("balances every positive receipt by source, distinguishing cash from known future income", () => {
    const rows = [receipt("sponsor:posted",100_000,"sponsor"), receipt("sponsor:pending",200_000,"sponsor","pending"),
      receipt("race",50_000,"race_prize"),receipt("fan-club:sales:day",25_000),
      receipt("transfer",10_000,"transfer"),receipt("cancelled",900_000,"sponsor","cancelled"),receipt("salary",-10_000,"staff_salary")];
    const before=structuredClone(rows), result=buildFinanceIncomeAnalysis(rows);
    expect(result).toMatchObject({ totalAmount:385_000,postedAmount:185_000,pendingAmount:200_000,sponsorAmount:300_000 });
    expect(result.sponsorPercentage).toBeCloseTo(300_000/385_000*100);
    expect(result.breakdown.map(row=>row.key)).toEqual(["sponsors","races","shop","transfers"]);
    expect(result.breakdown.reduce((sum,row)=>sum+row.amount,0)).toBe(result.totalAmount);
    expect(result.breakdown.reduce((sum,row)=>sum+row.percentage,0)).toBeCloseTo(100);
    expect(rows).toEqual(before);
  });
  it("shows reimbursements separately and never adds an opening cash allocation to income", () => {
    const result=buildFinanceIncomeAnalysis([receipt("form-camp-refund:camp",250,"training"),receipt("fan-club:sales:day",150)]);
    expect(result.totalAmount).toBe(400);
    expect(result.breakdown.map(row=>row.key)).toEqual(["refunds","shop"]);
  });
  it("keeps decimal amounts exact and ignores invalid, zero, cancelled and negative entries", () => {
    expect(buildFinanceIncomeAnalysis([receipt("a",0.1),receipt("b",0.2),receipt("c",0.7,"other","pending"),
      receipt("bad",NaN),receipt("overflow",Infinity),receipt("zero",0),receipt("expense",-100)]))
      .toMatchObject({totalAmount:1,postedAmount:0.3,pendingAmount:0.7,sponsorPercentage:0});
  });
  it("renders no fictional categories or percentages for an empty season", () => {
    expect(buildFinanceIncomeAnalysis([])).toEqual({totalAmount:0,postedAmount:0,pendingAmount:0,sponsorAmount:0,sponsorPercentage:0,breakdown:[]});
  });
  it("separates formerly generic receipts without changing seasonal, posted or pending totals", () => {
    const rows = [receipt("objective:claim",100_000), receipt("newcomer-journey:journey:step",5_000),
      receipt("reward:team-rivalry:duel:a",50_000,"race_prize","pending"),
      receipt("federation-solidarity:plan:team",20_000),receipt("understaffed-roster-aid:season",10_000),
      receipt("rookie-season-reward:season:team",15_000,"other","pending"),
      receipt("development-event-reward:result",8_000,"race_prize"),
      receipt("cancelled",500_000,"other","cancelled"),receipt("expense",-1_000)];
    const before = structuredClone(rows), result = buildFinanceIncomeAnalysis(rows);
    expect(result).toMatchObject({totalAmount:208_000,postedAmount:143_000,pendingAmount:65_000});
    expect(Object.fromEntries(result.breakdown.map(item=>[item.key,item.amount])))
      .toEqual({objectives:105_000,rivalries:50_000,federation_aid:20_000,season_prizes:15_000,team_aid:10_000,junior_races:8_000});
    expect(result.breakdown.reduce((sum,item)=>sum+item.amount,0)).toBe(result.totalAmount);
    expect(result.breakdown.reduce((sum,item)=>sum+item.percentage,0)).toBeCloseTo(100);
    expect(rows).toEqual(before);
  });
  it("makes residual receipts explainable, grouping identical descriptions and keeping cent totals exact", () => {
    const result = buildFinanceIncomeAnalysis([
      {...receipt("future:a",0.1),description:" Crédit exceptionnel "},
      {...receipt("future:b",0.2,"other","pending"),description:"Crédit   exceptionnel"},
      {...receipt("future:c",0.7),description:"Autre versement"},
      {...receipt("future:cancelled",100,"other","cancelled"),description:"Invisible"},
    ]);
    const item = result.breakdown[0];
    expect(item).toMatchObject({key:"other",amount:1,postedAmount:0.8,pendingAmount:0.2,transactionCount:3});
    expect(item.details).toEqual([
      {label:"Autre versement",amount:0.7,postedAmount:0.7,pendingAmount:0,transactionCount:1},
      {label:"Crédit exceptionnel",amount:0.3,postedAmount:0.1,pendingAmount:0.2,transactionCount:2},
    ]);
    expect(buildFinanceIncomeAnalysis([receipt("future:empty",1)]).breakdown[0].details?.[0].label)
      .toBe("Recette non précisée");
  });
});
