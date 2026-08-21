"use client";

import { useState } from "react";

import {
  startInfrastructureProjectAction,
  startStaffAcademyTrainingAction,
} from "@/app/jeu/infrastructures/actions";
import { InfrastructureBuildingHero } from "@/components/game/infrastructure-building-hero";
import { InfrastructureSubmitButton } from "@/components/game/infrastructure-submit-button";
import { StaffAcademySubmitButton } from "@/components/game/staff-academy-submit-button";
import {
  STAFF_ACADEMY_LEVELS,
  STAFF_ACADEMY_MAX_TALENT_LINES,
} from "@/lib/game/staff-academy";
import {
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  canDirectorBuildInfrastructureLevel,
  getRequiredDirectorLevelForInfrastructureLevel,
  getTeamInfrastructureLevelDefinition,
} from "@/lib/game/infrastructure";
import { calculateConstructionWithArchitect } from "@/lib/game/staff";
import { getInfrastructureConstructionOptions } from "@/lib/game/infrastructure-construction";
import type { StaffAcademyOverview } from "@/services/staff-academy";
import type {
  InfrastructureArchitect,
  InfrastructureProject,
} from "@/services/team-infrastructures";

export function StaffAcademyCard({
  academy,
  architects,
  activeProjects,
  directorLevel,
  balance,
  currency,
}: {
  academy: StaffAcademyOverview;
  architects: InfrastructureArchitect[];
  activeProjects: InfrastructureProject[];
  directorLevel: number;
  balance: number;
  currency: string;
}) {
  const [architectContractId, setArchitectContractId] = useState("");
  const constructionOptions = getInfrastructureConstructionOptions({
    architects,
    activeProjects,
  });
  const [selectedContractId, setSelectedContractId] = useState(
    academy.members[0]?.contractId ?? "",
  );
  const architect =
    architects.find(
      (candidate) => candidate.contractId === architectContractId,
    ) ?? null;
  const member =
    academy.members.find(
      (candidate) => candidate.contractId === selectedContractId,
    ) ?? academy.members[0] ?? null;
  const nextLevel = getTeamInfrastructureLevelDefinition(
    "staff_academy",
    academy.academyLevel + 1,
  );
  const constructionQuote = nextLevel
    ? calculateConstructionWithArchitect({
        baseCost: nextLevel.cost,
        baseDurationDays: nextLevel.durationDays,
        architectLevel: architect?.level,
        architectSpecialty: architect?.specialty,
      })
    : null;
  const requiredDirectorLevel = nextLevel
    ? getRequiredDirectorLevelForInfrastructureLevel(nextLevel.level)
    : null;
  const constructionBlockReason =
    nextLevel &&
    !canDirectorBuildInfrastructureLevel(directorLevel, nextLevel.level)
      ? `Le niveau ${requiredDirectorLevel} de Directeur Sportif est requis pour construire le niveau ${nextLevel.level}.`
    : activeProjects.some((project) => project.code === "staff_academy")
      ? "Un chantier est déjà en cours pour l’Académie."
      : constructionOptions.capacityBlockReason
        ? constructionOptions.capacityBlockReason
        : constructionOptions.selectionBlockReason && !architectContractId
          ? constructionOptions.selectionBlockReason
      : !nextLevel
        ? "L’Académie a atteint son niveau maximal."
        : constructionQuote && balance < constructionQuote.cost
          ? "Trésorerie insuffisante."
          : null;
  const capacityReached =
    academy.activeTrainingCount >= academy.capacity;

  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_18px_50px_rgba(19,60,46,0.1)]">
      <InfrastructureBuildingHero
        definition={TEAM_INFRASTRUCTURE_DEFINITIONS.staff_academy}
        currency={currency}
        levelLabel={`Niveau ${academy.academyLevel}/5`}
        secondaryLabel={`${academy.activeTrainingCount}/${academy.capacity} stage(s)`}
        description="Développez durablement un membre du staff sans l’écarter de ses fonctions. Son étoile ou son nouveau bonus s’active uniquement à la fin du stage."
      />

      <div className="p-6 sm:p-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {STAFF_ACADEMY_LEVELS.map((definition) => (
            <div
              key={definition.level}
              className={`rounded-2xl border p-4 ${
                academy.academyLevel >= definition.level
                  ? "border-[#278B70]/35 bg-[#E5F4ED]"
                  : "border-[#315B3E]/10 bg-[#F6F8F6]"
              }`}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#60756E]">
                Niveau {definition.level} · DS N
                {getRequiredDirectorLevelForInfrastructureLevel(
                  definition.level,
                )}
              </p>
              <p className="mt-2 text-2xl font-black text-[#183F37]">
                {definition.capacity}
              </p>
              <p className="mt-1 text-xs font-bold text-[#60756E]">
                stage{definition.capacity > 1 ? "s" : ""} simultané
                {definition.capacity > 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>

        {nextLevel && constructionQuote ? (
          <form
            action={startInfrastructureProjectAction}
            className="mt-6 grid gap-5 rounded-2xl border border-[#315B3E]/12 bg-[#F6F8F6] p-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.62fr)]"
          >
            <input
              type="hidden"
              name="infrastructureCode"
              value="staff_academy"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
                {academy.academyLevel === 0 ? "Construction" : "Agrandissement"} · niveau {nextLevel.level} · DS N{requiredDirectorLevel}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
                {nextLevel.effect} Les travaux sont volontairement longs et
                coûteux : cette infrastructure s’adresse aux DS expérimentés.
              </p>
              <label className="mt-4 block">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">
                  Architecte (optionnel)
                </span>
                <select
                  name="architectContractId"
                  value={architectContractId}
                  onChange={(event) =>
                    setArchitectContractId(event.target.value)
                  }
                  className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70]"
                >
                  <option
                    value=""
                    disabled={!constructionOptions.canStartWithoutArchitect}
                  >
                    {constructionOptions.canStartWithoutArchitect
                      ? "Sans architecte"
                      : "Choisir l’architecte « Double chantier »"}
                  </option>
                  {constructionOptions.eligibleArchitects.map((candidate) => (
                    <option
                      key={candidate.contractId}
                      value={candidate.contractId}
                    >
                      {candidate.firstName} {candidate.lastName} · N
                      {candidate.level} · {candidate.specialtyLabel}
                      {candidate.hasParallelConstructionTalent
                        ? " · Double chantier"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rounded-2xl border border-[#F2C94C]/35 bg-[#FFF9E5] p-5">
              <dl className="grid grid-cols-2 gap-3">
                <QuoteMetric
                  label="Coût"
                  value={formatMoney(constructionQuote.cost, currency)}
                />
                <QuoteMetric
                  label="Délai"
                  value={`${constructionQuote.durationDays} jours`}
                />
              </dl>
              <div className="mt-4">
                <InfrastructureSubmitButton
                  disabled={Boolean(constructionBlockReason)}
                >
                  {academy.academyLevel === 0
                    ? "Construire l’Académie"
                    : `Lancer le niveau ${nextLevel.level}`}
                </InfrastructureSubmitButton>
              </div>
              {constructionBlockReason ? (
                <p className="mt-3 text-xs font-bold text-[#B54242]">
                  {constructionBlockReason}
                </p>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="mt-6 rounded-2xl bg-[#E5F4ED] p-5 text-sm font-black text-[#176951]">
            L’Académie a atteint son niveau maximal : cinq stages peuvent être
            menés en parallèle.
          </p>
        )}

        {academy.academyLevel > 0 ? (
          <div className="mt-8 border-t border-[#315B3E]/12 pt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
                  Sessions de perfectionnement
                </p>
                <h3 className="mt-2 text-2xl font-black text-[#183F37]">
                  Envoyer un membre du staff en stage
                </h3>
              </div>
              <span
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  capacityReached
                    ? "bg-[#FFF0EE] text-[#B54242]"
                    : "bg-[#E5F4ED] text-[#176951]"
                }`}
              >
                {capacityReached
                  ? "Tous les emplacements sont occupés"
                  : `${academy.capacity - academy.activeTrainingCount} emplacement(s) disponible(s)`}
              </span>
            </div>

            {academy.activeTrainings.length ? (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {academy.activeTrainings.map((training) => (
                  <div
                    key={training.id}
                    className="rounded-2xl border border-[#F2C94C]/40 bg-[#FFF9E5] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-[#071A17]">
                          {training.memberName}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#7B6B37]">
                          {training.improvementLabel}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#F2C94C]/25 px-3 py-1 text-[10px] font-black text-[#71580A]">
                        {training.remainingDays} j
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E8DCA8]">
                      <div
                        className="h-full rounded-full bg-[#E4B72E]"
                        style={{ width: `${training.progressPercentage}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] font-bold text-[#7B6B37]">
                      Fin prévue en saison {training.completionGameYear}, J
                      {training.completionDayNumber} · le staff reste actif
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {member ? (
              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(280px,0.42fr)_minmax(0,1fr)]">
                <div>
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">
                      Membre du staff
                    </span>
                    <select
                      value={member.contractId}
                      onChange={(event) =>
                        setSelectedContractId(event.target.value)
                      }
                      className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70]"
                    >
                      {academy.members.map((candidate) => (
                        <option
                          key={candidate.contractId}
                          value={candidate.contractId}
                        >
                          {candidate.fullName} · {candidate.roleLabel} · {candidate.level}★
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mt-4 rounded-2xl bg-[#0B302B] p-5 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black">{member.fullName}</p>
                        <p className="mt-1 text-xs font-bold text-[#9BE0BC]">
                          {member.roleLabel}
                          {member.trainerSpecialtyLabel
                            ? ` · domaine ${member.trainerSpecialtyLabel}`
                            : ""}
                        </p>
                      </div>
                      <span className="text-sm font-black text-[#F2C94C]">
                        {"★".repeat(member.level)}
                        <span className="text-white/25">
                          {"★".repeat(5 - member.level)}
                        </span>
                      </span>
                    </div>
                    <p className="mt-5 text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">
                      Bonus actuels · {member.talents.length}/{STAFF_ACADEMY_MAX_TALENT_LINES}
                    </p>
                    <div className="mt-3 space-y-2">
                      {member.talents.length ? (
                        member.talents.map((talent) => (
                          <div
                            key={talent.code}
                            className="rounded-xl bg-white/10 px-3 py-3"
                          >
                            <p className="text-xs font-black text-white">
                              {talent.label}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold leading-4 text-[#BFD1C6]">
                              {talent.description}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs font-semibold leading-5 text-[#BFD1C6]">
                          Aucun bonus d’Académie enregistré pour ce staff
                          historique. Il peut recevoir sa première ligne ici.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <TrainingOption
                    contractId={member.contractId}
                    improvementType="level"
                    eyebrow="Progression"
                    title={
                      member.canImproveLevel
                        ? `Passer de ${member.level} à ${member.level + 1} étoiles`
                        : "Niveau maximal atteint"
                    }
                    description="La nouvelle étoile augmente l’efficacité de toutes les compétences actuelles du staff."
                    cost={member.levelTraining.cost}
                    durationDays={member.levelTraining.durationDays}
                    currency={currency}
                    disabled={
                      capacityReached ||
                      Boolean(member.activeTrainingId) ||
                      !member.canImproveLevel ||
                      balance < member.levelTraining.cost
                    }
                    disabledReason={getTrainingBlockReason({
                      capacityReached,
                      alreadyTraining: Boolean(member.activeTrainingId),
                      eligible: member.canImproveLevel,
                      insufficientFunds: balance < member.levelTraining.cost,
                      ineligibleReason: "Ce membre possède déjà cinq étoiles.",
                    })}
                    buttonLabel="Ajouter une étoile"
                  />
                  <TrainingOption
                    contractId={member.contractId}
                    improvementType="talent"
                    eyebrow="Spécialisation"
                    title="Ajouter un bonus aléatoire"
                    description={
                      member.availableTalentLabels.length
                        ? `Tirage parmi les domaines manquants : ${member.availableTalentLabels.join(", ")}.`
                        : "Aucun domaine compatible supplémentaire n’est disponible."
                    }
                    cost={member.talentTraining.cost}
                    durationDays={member.talentTraining.durationDays}
                    currency={currency}
                    disabled={
                      capacityReached ||
                      Boolean(member.activeTrainingId) ||
                      !member.canAddTalent ||
                      balance < member.talentTraining.cost
                    }
                    disabledReason={getTrainingBlockReason({
                      capacityReached,
                      alreadyTraining: Boolean(member.activeTrainingId),
                      eligible: member.canAddTalent,
                      insufficientFunds: balance < member.talentTraining.cost,
                      ineligibleReason:
                        "Le maximum de trois bonus ou tous les domaines compatibles sont atteints.",
                    })}
                    buttonLabel="Ajouter une ligne"
                  />
                </div>
              </div>
            ) : (
              <p className="mt-6 rounded-2xl bg-[#F6F8F6] p-5 text-sm font-bold text-[#60756E]">
                Recrutez au moins un membre du staff pour ouvrir une session de
                perfectionnement.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#F6F8F6] p-6 text-center">
            <p className="text-sm font-black text-[#183F37]">
              Les stages seront disponibles dès la livraison du niveau 1.
            </p>
            <p className="mt-2 text-xs font-semibold text-[#60756E]">
              Le premier niveau ouvre une session simultanée ; chaque niveau
              suivant ajoute un emplacement, jusqu’à cinq.
            </p>
          </div>
        )}

        {academy.recentTrainings.length ? (
          <div className="mt-8 border-t border-[#315B3E]/12 pt-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
              Stages terminés
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {academy.recentTrainings.slice(0, 6).map((training) => (
                <div
                  key={training.id}
                  className="rounded-2xl border border-[#315B3E]/12 bg-[#F6F8F6] p-4"
                >
                  <p className="font-black text-[#071A17]">
                    {training.memberName}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#176951]">
                    {training.improvementType === "level"
                      ? `Niveau ${training.previousLevel + 1} obtenu`
                      : training.awardedTalentLabel ?? "Nouveau bonus obtenu"}
                  </p>
                  <p className="mt-2 text-[10px] font-semibold text-[#60756E]">
                    {training.durationDays} jours · {formatMoney(training.cost, currency)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function TrainingOption({
  contractId,
  improvementType,
  eyebrow,
  title,
  description,
  cost,
  durationDays,
  currency,
  disabled,
  disabledReason,
  buttonLabel,
}: {
  contractId: string;
  improvementType: "level" | "talent";
  eyebrow: string;
  title: string;
  description: string;
  cost: number;
  durationDays: number;
  currency: string;
  disabled: boolean;
  disabledReason: string | null;
  buttonLabel: string;
}) {
  return (
    <form
      action={startStaffAcademyTrainingAction}
      className="flex flex-col rounded-2xl border border-[#315B3E]/12 bg-[#F6F8F6] p-5"
    >
      <input type="hidden" name="staffContractId" value={contractId} />
      <input type="hidden" name="improvementType" value={improvementType} />
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
        {eyebrow}
      </p>
      <h4 className="mt-2 text-lg font-black text-[#071A17]">{title}</h4>
      <p className="mt-2 flex-1 text-xs font-semibold leading-5 text-[#60756E]">
        {description}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-white p-3">
        <QuoteMetric label="Prix" value={formatMoney(cost, currency)} />
        <QuoteMetric label="Durée" value={`${durationDays} jours`} />
      </dl>
      <div className="mt-4">
        <StaffAcademySubmitButton
          disabled={disabled}
          pendingLabel="Inscription au stage…"
        >
          {buttonLabel}
        </StaffAcademySubmitButton>
      </div>
      {disabledReason ? (
        <p className="mt-3 text-xs font-bold text-[#B54242]">
          {disabledReason}
        </p>
      ) : null}
    </form>
  );
}

function getTrainingBlockReason({
  capacityReached,
  alreadyTraining,
  eligible,
  insufficientFunds,
  ineligibleReason,
}: {
  capacityReached: boolean;
  alreadyTraining: boolean;
  eligible: boolean;
  insufficientFunds: boolean;
  ineligibleReason: string;
}) {
  if (alreadyTraining) return "Ce membre suit déjà un stage.";
  if (capacityReached) return "Tous les emplacements sont occupés.";
  if (!eligible) return ineligibleReason;
  if (insufficientFunds) return "Trésorerie insuffisante.";
  return null;
}

function QuoteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#60756E]">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-black text-[#071A17]">{value}</dd>
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
