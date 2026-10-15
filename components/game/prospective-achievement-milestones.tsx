import type { GameObjective } from "@/lib/game/objectives";
import { getProspectiveAchievement, PROSPECTIVE_ACHIEVEMENTS_START_LABEL } from "@/lib/game/prospective-achievements";

const tierLabels = { bronze: "Bronze", silver: "Argent", gold: "Or" } as const;
const number = new Intl.NumberFormat("fr-FR");

export function ProspectiveAchievementMilestones({ objective, members }: {
  objective: GameObjective;
  members: GameObjective[];
}) {
  const family = getProspectiveAchievement(objective.key);
  if (!family) return null;
  const ordered = [...members].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <div className="mt-3">
      <p className="text-[11px] font-bold text-[#60756E]">
        Nouveau parcours · depuis le {PROSPECTIVE_ACHIEVEMENTS_START_LABEL} · sans rétroactivité
      </p>
      <div className="mt-2 flex flex-wrap gap-2" aria-label="Paliers du succès">
        {ordered.map(member => {
          const tier = getProspectiveAchievement(member.key)?.tier;
          return tier ? <span key={member.key} className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${member.key === objective.key ? "border-[#D5AC43] bg-[#FFF4CF] text-[#71510A]" : "border-[#315B3E]/15 text-[#60756E]"}`}>
            {member.claimedAt ? "✓ " : member.completed ? "● " : ""}{tierLabels[tier]}
          </span> : null;
        })}
      </div>
      {"cosmetic" in family.definition ? <p className="mt-2 text-xs font-bold text-[#176951]">Tenue d’avatar exclusive incluse au palier Or.</p> : null}
      {ordered.length > 1 ? (
        <details className="mt-3 text-xs font-semibold text-[#60756E]">
          <summary className="cursor-pointer py-1 font-bold text-[#176951]">Voir les conditions et récompenses des paliers</summary>
          <ol className="mt-2 space-y-3 border-l-2 border-[#D5AC43]/40 pl-3">
            {ordered.map(member => {
              const tier = getProspectiveAchievement(member.key)?.tier;
              const index = tier === "gold" ? 2 : tier === "silver" ? 1 : 0;
              return tier ? <li key={member.key}>
                <p className="font-black text-[#183F37]">{tierLabels[tier]}{member.claimedAt ? " · Récupéré" : member.completed ? " · À récupérer" : ""}</p>
                <p className="mt-1 leading-5">{family.definition.descriptions[index]}</p>
                <p className="mt-1 text-[#176951]">{number.format(member.reward.cash)} € · {member.reward.experience} XP · {member.reward.reputation} réputation{tier === "gold" ? " · trophée" : ""}{tier === "gold" && "cosmetic" in family.definition ? " · tenue exclusive" : ""}</p>
              </li> : null;
            })}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
