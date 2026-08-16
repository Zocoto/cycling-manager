import { redeemDailyRewardAction } from "@/app/jeu/objectifs/actions";
import { DailyRewardTargetFields } from "@/components/game/daily-reward-target-fields";
import {
  isStackableDailyReward,
  requiresRiderTarget,
  type DailyRewardAbility,
  type DailyRewardInventoryItem,
  type DailyRewardRace,
  type DailyRewardRider,
} from "@/lib/game/daily-rewards";

export function DailyRewardRedemptionForm({
  item,
  riders,
  abilities,
  eligibleRaces,
  returnPath,
}: {
  item: DailyRewardInventoryItem;
  riders: DailyRewardRider[];
  abilities: DailyRewardAbility[];
  eligibleRaces: DailyRewardRace[];
  returnPath?: string;
}) {
  const needsRider = requiresRiderTarget(item.effectKind);
  const stackable = isStackableDailyReward(item.effectKind);
  const canUse =
    item.quantity > 0 &&
    (!needsRider || riders.length > 0) &&
    (item.effectKind !== "wildcard" || eligibleRaces.length > 0) &&
    (item.effectKind !== "special_ability" || abilities.length > 0);

  return (
    <form action={redeemDailyRewardAction} className="mt-auto space-y-3 pt-5">
      <input type="hidden" name="inventoryId" value={item.id} />
      {returnPath ? (
        <input type="hidden" name="returnPath" value={returnPath} />
      ) : null}
      <DailyRewardTargetFields
        item={item}
        riders={riders}
        abilities={abilities}
      />

      {item.effectKind === "wildcard" ? (
        <SelectField name="raceEditionId" label="Course Elite hors GT" required>
          <option value="">Choisir une course</option>
          {eligibleRaces.map((race) => (
            <option key={race.id} value={race.id}>
              J{race.firstDayNumber} · {race.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      {stackable ? (
        <label className="block text-xs font-black text-[#315B3E]">
          Quantité à utiliser
          <input
            type="number"
            name="quantity"
            min={1}
            max={item.quantity}
            defaultValue={1}
            required
            className="mt-1.5 min-h-11 w-full rounded-xl border border-[#315B3E]/18 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#42B99A]/20"
          />
          <span className="mt-1.5 block text-[11px] font-semibold text-[#789087]">
            {item.quantity} disponible{item.quantity > 1 ? "s" : ""} · les
            effets seront cumulés
          </span>
        </label>
      ) : (
        <input type="hidden" name="quantity" value="1" />
      )}

      <button
        type="submit"
        disabled={!canUse}
        className="min-h-11 w-full rounded-xl bg-[#176951] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#0B302B] disabled:cursor-not-allowed disabled:bg-[#A9B9B2]"
      >
        {getUseLabel(item.effectKind)}
      </button>
      {!canUse ? (
        <p className="text-xs font-bold text-[#9A453D]">
          Aucun choix compatible n’est disponible actuellement.
        </p>
      ) : null}
    </form>
  );
}

function SelectField({
  name,
  label,
  required,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-black text-[#315B3E]">
      {label}
      <select
        name={name}
        required={required}
        className="mt-1.5 min-h-11 w-full rounded-xl border border-[#315B3E]/18 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#42B99A]/20"
      >
        {children}
      </select>
    </label>
  );
}

function getUseLabel(kind: DailyRewardInventoryItem["effectKind"]) {
  if (kind === "training_multiplier") return "Activer pour la prochaine séance";
  if (kind === "scouting_boost") return "Activer pendant 7 jours";
  if (kind === "wildcard") return "Réserver la Wild Card";
  return "Utiliser sur ce coureur";
}
