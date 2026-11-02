import { notFound } from "next/navigation";
import { TrainingReportPopover } from "@/components/game/training-report-popover";
import { trainingLimitLatestFixture, trainingLimitSeasonFixture } from "@/test/fixtures/training-progress-limits";

export default function TrainingLimitsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="min-h-screen bg-[#EAF5F3] p-5 text-[#183C32] sm:p-10">
    <div className="mx-auto max-w-3xl rounded-2xl bg-white p-4 sm:p-8">
      <h1 className="text-lg font-black">Rapport d’entraînement · exemple local</h1>
      <p className="mt-2 text-sm">Vallon 61 → 73 · progression saisonnière +12</p>
      <div className="mt-5 flex justify-end">
        <TrainingReportPopover report={trainingLimitLatestFixture} seasonReport={trainingLimitSeasonFixture} />
      </div>
    </div>
  </main>;
}
