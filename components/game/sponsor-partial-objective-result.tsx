import type { SponsorObjectiveAchievementLevel } from "@/lib/game/sponsor-objective-status";
import { formatSponsorPartialAchievement, type SponsorPartialAchievement } from "@/lib/game/sponsor-partial-achievements";

export function SponsorPartialObjectiveResult({ level, points, weight, achievements = [] }: {
  level: SponsorObjectiveAchievementLevel | null;
  points: number;
  weight: number;
  achievements?: SponsorPartialAchievement[];
}) {
  if (level !== "partial" || points <= 0) return null;
  return (
    <div className="mt-2 rounded-lg border border-[#B66A14]/20 bg-[#FFF8ED] px-3 py-2">
      <p className="text-[11px] font-extrabold text-[#B66A14]">
        Petite satisfaction : +{points} point{points > 1 ? "s" : ""} sur les {weight} prévus.
      </p>
      {achievements.length > 0 ? (
        <p className="mt-1 text-[11px] font-semibold leading-4 text-[#856232]">
          {achievements.map(formatSponsorPartialAchievement).join(" · ")}
        </p>
      ) : null}
      <p className="mt-1 text-[10px] font-semibold text-[#856232]">
        L’objectif principal n’est pas rempli ; seul le meilleur résultat secondaire est crédité.
      </p>
    </div>
  );
}
