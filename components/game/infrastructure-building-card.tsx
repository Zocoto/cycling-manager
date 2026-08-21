"use client";

import { useState } from "react";

import { startInfrastructureProjectAction } from "@/app/jeu/infrastructures/actions";
import { InfrastructureBuildingHero } from "@/components/game/infrastructure-building-hero";
import { InfrastructureSubmitButton } from "@/components/game/infrastructure-submit-button";
import type {
  InfrastructureLevelDefinition,
  TeamInfrastructureDefinition,
} from "@/lib/game/infrastructure";
import {
  canDirectorBuildInfrastructureLevel,
  getRequiredDirectorLevelForInfrastructureLevel,
} from "@/lib/game/infrastructure";
import { calculateConstructionWithArchitect } from "@/lib/game/staff";
import { getInfrastructureConstructionOptions } from "@/lib/game/infrastructure-construction";
import type {
  InfrastructureArchitect,
  InfrastructureProject,
} from "@/services/team-infrastructures";

export function InfrastructureBuildingCard({
  definition,
  currentLevel,
  nextLevel,
  architects,
  activeProjects,
  directorLevel,
  balance,
  currency,
  prerequisiteMessage = null,
}: {
  definition: TeamInfrastructureDefinition;
  currentLevel: number;
  nextLevel: InfrastructureLevelDefinition | null;
  architects: InfrastructureArchitect[];
  activeProjects: InfrastructureProject[];
  directorLevel: number;
  balance: number;
  currency: string;
  prerequisiteMessage?: string | null;
}) {
  const [architectContractId, setArchitectContractId] = useState("");
  const constructionOptions = getInfrastructureConstructionOptions({
    architects,
    activeProjects,
  });
  const architect =
    architects.find(
      (candidate) => candidate.contractId === architectContractId,
    ) ?? null;
  const quote = nextLevel
    ? calculateConstructionWithArchitect({
        baseCost: nextLevel.cost,
        baseDurationDays: nextLevel.durationDays,
        architectLevel: architect?.level,
        architectSpecialty: architect?.specialty,
      })
    : null;
  const maximumLevel = definition.levels.at(-1)?.level ?? 0;
  const sameBuildingIsActive = activeProjects.some(
    (project) => project.code === definition.code,
  );
  const requiredDirectorLevel = nextLevel
    ? getRequiredDirectorLevelForInfrastructureLevel(nextLevel.level)
    : null;
  const blockReason =
    nextLevel &&
    !canDirectorBuildInfrastructureLevel(directorLevel, nextLevel.level)
      ? `Le niveau ${requiredDirectorLevel} de Directeur Sportif est requis pour construire le niveau ${nextLevel.level}.`
    : prerequisiteMessage
      ? prerequisiteMessage
      : sameBuildingIsActive
        ? "Un chantier est déjà en cours pour ce bâtiment."
        : constructionOptions.capacityBlockReason
          ? constructionOptions.capacityBlockReason
          : constructionOptions.selectionBlockReason && !architectContractId
            ? constructionOptions.selectionBlockReason
        : !nextLevel
          ? definition.name + " a atteint son niveau maximal."
          : quote && balance < quote.cost
            ? "Trésorerie insuffisante."
            : null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-white shadow-[0_16px_44px_rgba(19,60,46,0.09)]">
      <InfrastructureBuildingHero
        definition={definition}
        currency={currency}
        levelLabel={
          currentLevel > 0
            ? "Niveau " + currentLevel + "/" + maximumLevel
            : "À construire"
        }
      />

      <div className="grid flex-1 gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(330px,0.55fr)]">
        <div className="grid content-start gap-2 sm:grid-cols-2 2xl:grid-cols-3">
          {definition.levels.map((level) => (
            <div
              key={level.level}
              className={
                "rounded-xl border p-3 " +
                (currentLevel >= level.level
                  ? "border-[#278B70]/35 bg-[#E5F4ED]"
                  : "border-[#315B3E]/10 bg-[#F6F8F6]")
              }
            >
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                Niveau {level.level} · DS N
                {getRequiredDirectorLevelForInfrastructureLevel(level.level)}
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-[#183F37]">
                {level.effect}
              </p>
            </div>
          ))}
        </div>

        {nextLevel && quote ? (
          <form
            action={startInfrastructureProjectAction}
            className="flex flex-1 flex-col border-t border-[#315B3E]/10 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
          >
            <input
              type="hidden"
              name="infrastructureCode"
              value={definition.code}
            />
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
              Prochain chantier · niveau {nextLevel.level} · DS N
              {requiredDirectorLevel}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
              {nextLevel.effect}
            </p>

            <label className="mt-4 block">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
                Architecte (optionnel)
              </span>
              <select
                name="architectContractId"
                value={architectContractId}
                onChange={(event) =>
                  setArchitectContractId(event.target.value)
                }
                className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70]"
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

            <div className="mt-4 rounded-2xl border border-[#F2C94C]/35 bg-[#FFF9E5] p-4">
              <dl className="grid grid-cols-2 gap-3">
                <QuoteMetric
                  label="Coût"
                  value={formatMoney(quote.cost, currency)}
                />
                <QuoteMetric
                  label="Délai"
                  value={quote.durationDays + " jours"}
                />
              </dl>
              {architect ? (
                <p className="mt-3 text-xs font-bold text-[#176951]">
                  Économie : −{quote.costReductionPercentage} % · délai : −
                  {quote.durationReductionPercentage} %
                </p>
              ) : (
                <p className="mt-3 text-xs font-semibold text-[#60756E]">
                  Un architecte peut réduire le coût ou le délai du chantier.
                </p>
              )}
              <div className="mt-4">
                <InfrastructureSubmitButton disabled={Boolean(blockReason)}>
                  Lancer le niveau {nextLevel.level}
                </InfrastructureSubmitButton>
              </div>
              {blockReason ? (
                <p className="mt-3 text-xs font-bold text-[#B54242]">
                  {blockReason}
                </p>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="h-fit rounded-2xl bg-[#E5F4ED] p-4 text-sm font-black text-[#176951]">
            {definition.name} a atteint son niveau maximal.
          </p>
        )}
      </div>
    </article>
  );
}

function QuoteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">
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
