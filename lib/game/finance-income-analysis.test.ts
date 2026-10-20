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
    ["other", "fan-club:sales:season:day", "shop"],
    ["transfer", "transfer-sale:listing", "transfers"],
    ["equipment", "equipment-resale:item", "asset_sales"],
    ["other", "fan-club:car:sale:vehicle", "asset_sales"],
    ["other", "financial-director:bonus:receipt", "financial_director"],
    ["other", "financial-director:daily:day", "financial_director"],
    ["race_prize", "reward:hidden-switchback:director", "rewards"],
    ["race_prize", "reward:longevity-trophy:director", "rewards"],
    ["other", "trophy:award", "rewards"],
    ["other", "referral:count", "rewards"],
    ["training", "form-camp-refund:camp", "refunds"],
    ["transfer", "transfer-correction-refund:listing", "refunds"],
    ["staff_salary", "welcome-scout-salary-refund:salary", "refunds"],
    ["other", " FAn-Club:Sales:season:day ", "shop"],
    ["other", "future-source:receipt", "other"],
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
});
