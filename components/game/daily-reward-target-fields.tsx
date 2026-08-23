"use client";

import { useState } from "react";

import {
  getRatingOptionsForOffer,
  requiresRiderTarget,
  type DailyRewardAbility,
  type DailyRewardInventoryItem,
  type DailyRewardRider,
} from "@/lib/game/daily-rewards";
import {
  formatItemTargetValue,
  readItemTargetRatingKey,
  type ItemTargetValueContext,
} from "@/lib/game/item-target-values";
import { getSpecialAbilityDefinition } from "@/lib/game/special-abilities";

export function DailyRewardTargetFields({
  item,
  riders,
  abilities,
}: {
  item: DailyRewardInventoryItem;
  riders: DailyRewardRider[];
  abilities: DailyRewardAbility[];
}) {
  const ratingOptions = getRatingOptionsForOffer(item);
  const [ratingKey, setRatingKey] = useState("");
  const [abilityCode, setAbilityCode] = useState("");
  const [riderId, setRiderId] = useState("");
  const needsRider = requiresRiderTarget(item.effectKind);
  const riderSelectionDisabled =
    (item.effectKind === "rating_boost" && !ratingKey) ||
    (item.effectKind === "special_ability" && !abilityCode);
  const context = getTargetContext(item, ratingKey, abilityCode);
  const selectedAbility = abilities.find(
    (ability) => ability.code === abilityCode,
  );
  const selectedAbilityDefinition = getSpecialAbilityDefinition(abilityCode);

  return (
    <>
      {item.effectKind === "rating_boost" ? (
        <SelectField
          name="ratingKey"
          label="Statistique"
          required
          value={ratingKey}
          onChange={(value) => {
            setRatingKey(value);
            setRiderId("");
          }}
        >
          <option value="">Choisir une statistique</option>
          {ratingOptions.map((option) => (
            <option key={option.databaseKey} value={option.databaseKey}>
              {option.shortLabel} · {option.label}
            </option>
          ))}
        </SelectField>
      ) : null}

      {item.effectKind === "special_ability" ? (
        <SelectField
          name="abilityCode"
          label="Capacité"
          required
          value={abilityCode}
          onChange={(value) => {
            setAbilityCode(value);
            setRiderId("");
          }}
        >
          <option value="">Choisir une capacité</option>
          {abilities.map((ability) => {
            const definition = getSpecialAbilityDefinition(ability.code);
            return (
              <option key={ability.code} value={ability.code}>
                {definition?.name ?? ability.name} ·{" "}
                {definition?.effect ?? ability.effectSummary}
              </option>
            );
          })}
        </SelectField>
      ) : null}

      {item.effectKind === "special_ability" && selectedAbility ? (
        <div
          aria-live="polite"
          className="rounded-xl border border-[#D6A600]/25 bg-[#FFF9DB] px-3 py-3 text-[#5F4B0D]"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.16em]">
            Effet de {selectedAbilityDefinition?.name ?? selectedAbility.name}
          </p>
          <p className="mt-1 text-xs font-bold leading-5">
            {selectedAbilityDefinition?.effect ||
              selectedAbility.effectSummary ||
              "Effet détaillé indisponible."}
          </p>
        </div>
      ) : null}

      {needsRider ? (
        <SelectField
          name="riderId"
          label="Coureur"
          required
          disabled={riderSelectionDisabled || riders.length === 0}
          value={riderId}
          onChange={setRiderId}
        >
          <option value="">
            {riders.length === 0
              ? "Aucun coureur disponible"
              : riderSelectionDisabled
                ? item.effectKind === "rating_boost"
                  ? "Choisir d’abord une statistique"
                  : "Choisir d’abord une capacité"
                : "Choisir un coureur"}
          </option>
          {riders.map((rider) => (
            <option key={rider.id} value={rider.id}>
              {rider.name}
              {context ? ` · ${formatItemTargetValue(rider, context)}` : ""}
            </option>
          ))}
        </SelectField>
      ) : null}
    </>
  );
}

function getTargetContext(
  item: DailyRewardInventoryItem,
  ratingKey: string,
  abilityCode: string
): ItemTargetValueContext | null {
  if (item.effectKind === "form_boost") return { kind: "form" };
  if (item.effectKind === "rider_experience") {
    return { kind: "experience" };
  }
  if (item.effectKind === "naturalization") return { kind: "nationality" };
  if (item.effectKind === "rating_boost") {
    return {
      kind: "rating",
      ratingKey: readItemTargetRatingKey(ratingKey),
    };
  }
  if (item.effectKind === "special_ability") {
    return { kind: "ability", abilityCode: abilityCode || null };
  }
  return null;
}

function SelectField({
  name,
  label,
  required,
  disabled = false,
  value,
  onChange,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-black text-[#315B3E]">
      {label}
      <select
        name={name}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-11 w-full rounded-xl border border-[#315B3E]/18 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#42B99A]/20 disabled:cursor-not-allowed disabled:bg-[#EEF1ED] disabled:text-[#789087]"
      >
        {children}
      </select>
    </label>
  );
}
