"use client";

import { useState } from "react";

import { startInfrastructureProjectAction } from "@/app/jeu/infrastructures/actions";
import { InfrastructureBuildingHero } from "@/components/game/infrastructure-building-hero";
import { InfrastructureSubmitButton } from "@/components/game/infrastructure-submit-button";
import { calculateConstructionWithArchitect } from "@/lib/game/staff";
import { getInfrastructureConstructionOptions } from "@/lib/game/infrastructure-construction";
import type {
  InfrastructureArchitect,
  InfrastructureProject,
} from "@/services/team-infrastructures";
import {
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  canDirectorBuildInfrastructureLevel,
  getRequiredDirectorLevelForInfrastructureLevel,
  type InfrastructureLevelDefinition,
} from "@/lib/game/infrastructure";

export function DataRoomConstructionCard({
  currentLevel,
  currentEfficiencyBonusPercentage = 0,
  nextLevel,
  architects,
  activeProjects,
  directorLevel,
  balance,
  currency,
}: {
  currentLevel: number;
  currentEfficiencyBonusPercentage?: number;
  nextLevel: InfrastructureLevelDefinition | null;
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
  const requiredDirectorLevel = nextLevel
    ? getRequiredDirectorLevelForInfrastructureLevel(nextLevel.level)
    : null;
  const blockReason =
    nextLevel &&
    !canDirectorBuildInfrastructureLevel(directorLevel, nextLevel.level)
      ? `Le niveau ${requiredDirectorLevel} de Directeur Sportif est requis pour construire le niveau ${nextLevel.level}.`
    : activeProjects.some((project) => project.code === "recruitment_data_room")
      ? "Un chantier est déjà en cours pour la Data Room."
      : constructionOptions.capacityBlockReason
        ? constructionOptions.capacityBlockReason
        : constructionOptions.selectionBlockReason && !architectContractId
          ? constructionOptions.selectionBlockReason
      : !nextLevel
        ? "La Data Room a atteint son niveau maximal."
        : quote && balance < quote.cost
          ? "Trésorerie insuffisante."
          : null;

  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_18px_50px_rgba(19,60,46,0.1)]">
      <InfrastructureBuildingHero
        definition={TEAM_INFRASTRUCTURE_DEFINITIONS.recruitment_data_room}
        currency={currency}
        levelLabel={`Niveau actuel · ${currentLevel}/3`}
        description="Le bâtiment affine automatiquement tous les rapports incomplets du marché, sans révéler totalement les coureurs."
      />

      {currentEfficiencyBonusPercentage > 0 ? (
        <p className="border-b border-[#315B3E]/10 bg-[#E5F4ED] px-6 py-3 text-xs font-black text-[#176951] sm:px-8">
          Conception haute performance · +{currentEfficiencyBonusPercentage} %
          d’efficacité
        </p>
      ) : null}

      <div className="p-6 sm:p-8">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            "3 exactes · 8 fourchettes · 2 inconnues",
            "5 exactes · aucune inconnue",
            "7 exactes · fourchettes ±1",
          ].map((label, index) => {
            const level = index + 1;
            return (
              <div
                key={label}
                className={`rounded-2xl border p-4 ${
                  currentLevel >= level
                    ? "border-[#278B70]/35 bg-[#E5F4ED]"
                    : "border-[#315B3E]/10 bg-[#F6F8F6]"
                }`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#60756E]">
                  Niveau {level}
                </p>
                <p className="mt-2 text-sm font-black text-[#183F37]">
                  {label}
                </p>
              </div>
            );
          })}
        </div>

        {nextLevel && quote ? (
          <form
            action={startInfrastructureProjectAction}
            className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.6fr)]"
          >
            <input
              type="hidden"
              name="infrastructureCode"
              value="recruitment_data_room"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
                Prochain chantier · niveau {nextLevel.level} · DS N
                {requiredDirectorLevel}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
                {nextLevel.effect}
              </p>
              <label className="mt-5 block">
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
                      {candidate.buildingEfficiencyBonusPercentage > 0
                        ? ` · Bâtiment +${candidate.buildingEfficiencyBonusPercentage} %`
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
                  value={formatMoney(quote.cost, currency)}
                />
                <QuoteMetric
                  label="Délai"
                  value={`${quote.durationDays} jours`}
                />
              </dl>
              {architect ? (
                <p className="mt-3 text-xs font-bold text-[#176951]">
                  Économie : −{quote.costReductionPercentage} % · délai : −
                  {quote.durationReductionPercentage} %
                  {architect.buildingEfficiencyBonusPercentage > 0
                    ? ` · bâtiment : +${architect.buildingEfficiencyBonusPercentage} % d’efficacité`
                    : ""}
                </p>
              ) : (
                <p className="mt-3 text-xs font-semibold text-[#60756E]">
                  Recruter un architecte permet de réduire le coût ou le délai.
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
          <p className="mt-6 rounded-2xl bg-[#E5F4ED] p-5 text-sm font-black text-[#176951]">
            La Data Room a atteint son niveau maximal.
          </p>
        )}
      </div>
    </article>
  );
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
