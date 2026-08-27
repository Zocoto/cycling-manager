import { redeemDailyRewardAction } from "@/app/jeu/objectifs/actions";
import { DailyRewardTargetFields } from "@/components/game/daily-reward-target-fields";
import {
  isStackableDailyReward,
  requiresRiderTarget,
  type DailyRewardAbility,
  type DailyRewardAcademyRider,
  type DailyRewardCountry,
  type DailyRewardConstructionProject,
  type DailyRewardInventoryItem,
  type DailyRewardRace,
  type DailyRewardRider,
  type DailyRewardStaffMember,
} from "@/lib/game/daily-rewards";
import type { ScoutingSupervisionStatus } from "@/lib/game/scouting-supervision";
import { canReceiveInjuryCareItem } from "@/lib/game/item-target-values";
import {
  STAFF_ROLE_DEFINITIONS,
  STAFF_ROLES,
} from "@/lib/game/staff";

export function DailyRewardRedemptionForm({
  item,
  riders,
  abilities,
  eligibleRaces,
  academyRiders,
  countries,
  staffAcademyBuilt,
  constructionProjects,
  staffMembers,
  scoutingSupervision,
  returnPath,
}: {
  item: DailyRewardInventoryItem;
  riders: DailyRewardRider[];
  abilities: DailyRewardAbility[];
  eligibleRaces: DailyRewardRace[];
  academyRiders: DailyRewardAcademyRider[];
  countries: DailyRewardCountry[];
  staffAcademyBuilt: boolean;
  constructionProjects: DailyRewardConstructionProject[];
  staffMembers: DailyRewardStaffMember[];
  scoutingSupervision: ScoutingSupervisionStatus;
  returnPath?: string;
}) {
  const targetRiders =
    item.effectKind === "injury_care"
      ? riders.filter(canReceiveInjuryCareItem)
      : riders;
  const needsRider = requiresRiderTarget(item.effectKind);
  const stackable = isStackableDailyReward(item.effectKind);
  const canUse =
    item.quantity > 0 &&
    (!needsRider || targetRiders.length > 0) &&
    (item.effectKind !== "wildcard" || eligibleRaces.length > 0) &&
    (item.effectKind !== "special_ability" || abilities.length > 0) &&
    (item.effectKind !== "instant_youth_promotion" ||
      academyRiders.length > 0) &&
    (item.effectKind !== "custom_staff_recruitment" ||
      countries.length > 0) &&
    (item.effectKind !== "construction_time_reduction" ||
      constructionProjects.some((project) => project.remainingDays > 1)) &&
    (item.effectKind !== "staff_level_boost" || staffMembers.length > 0);

  return (
    <form action={redeemDailyRewardAction} className="mt-auto space-y-3 pt-5">
      <input type="hidden" name="inventoryId" value={item.id} />
      <input type="hidden" name="effectKind" value={item.effectKind} />
      {returnPath ? (
        <input type="hidden" name="returnPath" value={returnPath} />
      ) : null}
      <DailyRewardTargetFields
        item={item}
        riders={targetRiders}
        abilities={abilities}
      />

      {item.effectKind === "scouting_boost" &&
      scoutingSupervision.currentPercentage > 0 ? (
        <div className="rounded-xl border border-[#D6A600]/25 bg-[#FFF9DB] px-3 py-3 text-[#715700]">
          <p className="text-[10px] font-black uppercase tracking-[0.14em]">
            Supervision déjà active
          </p>
          <p className="mt-1 text-sm font-black">
            +{scoutingSupervision.currentPercentage} % pendant encore{" "}
            {scoutingSupervision.remainingDays} jour
            {scoutingSupervision.remainingDays > 1 ? "s" : ""}
            {scoutingSupervision.stableThroughDayNumber
              ? ` · jusqu’au J${scoutingSupervision.stableThroughDayNumber}`
              : ""}
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-5">
            Le bonus de cet objet s’ajoutera au cumul en cours, dans la limite
            de +100 %.
          </p>
        </div>
      ) : null}

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

      {item.effectKind === "instant_youth_promotion" ? (
        <SelectField name="academyRiderId" label="Junior à promouvoir" required>
          <option value="">Choisir un junior de 17 ans ou plus</option>
          {academyRiders.map((rider) => (
            <option key={rider.id} value={rider.id}>
              {rider.name} · {rider.age} ans
              {rider.promotionGameYear
                ? ` · promotion prévue en ${rider.promotionGameYear}`
                : ""}
            </option>
          ))}
        </SelectField>
      ) : null}

      {item.effectKind === "custom_staff_recruitment" ? (
        <>
          <SelectField name="staffRole" label="Métier" required>
            <option value="">Choisir un métier</option>
            {STAFF_ROLES.map((role) => (
              <option
                key={role}
                value={role}
                disabled={role === "educator" && !staffAcademyBuilt}
              >
                {STAFF_ROLE_DEFINITIONS[role].label}
                {role === "educator" && !staffAcademyBuilt
                  ? " · Académie des métiers requise"
                  : ""}
              </option>
            ))}
          </SelectField>
          <SelectField name="countryId" label="Nationalité" required>
            <option value="">Choisir une nationalité</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name} ({country.code})
              </option>
            ))}
          </SelectField>
          <p className="rounded-xl border border-[#D6A600]/20 bg-[#FFF9DB] px-3 py-2 text-[11px] font-bold leading-5 text-[#715700]">
            Tirage équitable : chaque niveau de 1 à 5 étoiles a exactement 20 %
            de chance. Le talent et les éventuelles spécialités sont ensuite
            tirés parmi les options compatibles.
          </p>
          <p className="text-[11px] font-semibold leading-5 text-[#60756E]">
            La prime de signature est offerte. Le salaire normal et les limites
            habituelles de votre structure restent applicables.
          </p>
        </>
      ) : null}

      {item.effectKind === "construction_time_reduction" ? (
        <SelectField
          name="constructionProjectId"
          label="Chantier en cours"
          required
        >
          <option value="">Choisir un chantier</option>
          {constructionProjects.map((project) => (
            <option
              key={project.id}
              value={project.id}
              disabled={project.remainingDays <= 1}
            >
              {project.name} · niveau {project.targetLevel} ·{" "}
              {project.remainingDays} jour
              {project.remainingDays > 1 ? "s" : ""} restant
              {project.remainingDays > 1 ? "s" : ""}
            </option>
          ))}
        </SelectField>
      ) : null}

      {item.effectKind === "staff_level_boost" ? (
        <SelectField name="staffContractId" label="Membre du staff" required>
          <option value="">Choisir un membre à faire progresser</option>
          {staffMembers.map((member) => (
            <option key={member.contractId} value={member.contractId}>
              {member.name} · {member.roleLabel} · {member.level}★ →{" "}
              {member.level + 1}★
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
  if (kind === "wildcard") return "Réserver l’invitation";
  if (kind === "instant_youth_promotion") return "Signer le junior maintenant";
  if (kind === "custom_staff_recruitment") return "Générer et signer ce staff";
  if (kind === "construction_time_reduction") return "Accélérer ce chantier";
  if (kind === "staff_level_boost") return "Attribuer l’étoile";
  if (kind === "injury_care") return "Appliquer le soin";
  return "Utiliser sur ce coureur";
}
