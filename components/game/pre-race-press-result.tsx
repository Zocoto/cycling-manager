import type { PreRacePressConference } from "@/lib/game/pre-race-press";

export function PreRacePressResult({ conference }: { conference: PreRacePressConference }) {
  if (conference.status !== "settled") return null;
  const partial = !conference.targetMet && conference.achievementLevel === "partial";
  return (
    <div className="mt-2">
      <p className={`text-xs font-black ${conference.targetMet ? "text-[#176951]" : partial ? "text-[#936A21]" : "text-[#9C234A]"}`}>
        {conference.targetMet ? "Objectif tenu" : partial ? `Réussite partielle · ${conference.achievementPercent} %` : "Objectif manqué"}
        {conference.leaderFinalRank ? ` · ${conference.leaderFinalRank === 1 ? "1er" : `${conference.leaderFinalRank}e`}` : " · non classé"}
        {conference.reputationDelta !== null ? ` · ${conference.reputationDelta >= 0 ? "+" : ""}${conference.reputationDelta} réputation` : ""}
      </p>
      {partial ? (
        <p className="mt-1 text-[10px] font-bold leading-4 text-[#6F6650]">
          La promesse n’est pas entièrement tenue, mais le classement du leader reste satisfaisant.
          {conference.commitmentAmount > 0 ? ` ${conference.achievementPercent} % de la mise préservés · satisfaction sponsor : +${conference.sponsorBonusAwarded ?? 0}/${conference.sponsorBonus} (arrondi en points).` : ""}
        </p>
      ) : null}
    </div>
  );
}
