import { notFound } from "next/navigation";
import { FinanceIncomeAnalysisPanel } from "@/components/game/finance-income-analysis";
import { buildFinanceIncomeAnalysis } from "@/lib/game/finance-income-analysis";

export default function FinanceIncomePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const sources = [
    ["sponsor:contract:season", 770_000, "sponsor"],
    ["reward:official-race:edition", 940_000, "race_prize"],
    ["objective:claim", 1_380_000, "other"],
    ["development-event-reward:result", 130_000, "race_prize"],
    ["fan-club:sales:season:day", 112_000, "other"],
    ["financial-director:daily:day", 55_000, "other"],
    ["reward:team-rivalry:duel:a", 75_000, "race_prize"],
    ["federation-solidarity:plan:team", 30_000, "other"],
    ["understaffed-roster-aid:season", 100_000, "other"],
    ["rookie-season-reward:season:team", 25_000, "other"],
    ["future:receipt", 1_500, "other"],
  ] as const;
  const analysis = buildFinanceIncomeAnalysis(sources.map(([sourceReference, amount, category], index) => ({
    id: String(index), sourceReference, amount, category,
    status: index % 3 === 0 ? "pending" : "posted",
    description: "Versement exceptionnel",
  })));
  return <main className="min-h-screen bg-[#EAF5F3] p-4 text-[#082A2A] sm:p-8">
    <div className="mx-auto max-w-7xl">
      <FinanceIncomeAnalysisPanel analysis={analysis} currency="EUR" seasonName="Saison 4" />
    </div>
  </main>;
}
