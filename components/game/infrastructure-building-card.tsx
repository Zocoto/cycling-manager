"use client";

import { useState } from "react";

import { startInfrastructureProjectAction } from "@/app/jeu/infrastructures/actions";
import { InfrastructureSubmitButton } from "@/components/game/infrastructure-submit-button";
import type {
  InfrastructureLevelDefinition,
  TeamInfrastructureDefinition,
} from "@/lib/game/infrastructure";
import { calculateConstructionWithArchitect } from "@/lib/game/staff";
import type {
  InfrastructureArchitect,
  InfrastructureProject,
} from "@/services/team-infrastructures";

export function InfrastructureBuildingCard({
  definition,
  currentLevel,
  nextLevel,
  architects,
  activeProject,
  isUnlocked,
  balance,
  currency,
  prerequisiteMessage = null,
}: {
  definition: TeamInfrastructureDefinition;
  currentLevel: number;
  nextLevel: InfrastructureLevelDefinition | null;
  architects: InfrastructureArchitect[];
  activeProject: InfrastructureProject | null;
  isUnlocked: boolean;
  balance: number;
  currency: string;
  prerequisiteMessage?: string | null;
}) {
  const [architectContractId, setArchitectContractId] = useState("");
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
  const blockReason = !isUnlocked
    ? "Le niveau 10 de Directeur Sportif est requis."
    : prerequisiteMessage
      ? prerequisiteMessage
      : activeProject
        ? "Votre équipe possède déjà un chantier actif."
        : !nextLevel
          ? definition.name + " a atteint son niveau maximal."
          : quote && balance < quote.cost
            ? "Trésorerie insuffisante."
            : null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-white shadow-[0_16px_44px_rgba(19,60,46,0.09)]">
      <div className="bg-[linear-gradient(135deg,#0B302B,#176951)] px-5 py-5 text-white sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#F2C94C]">
              {definition.domain}
            </p>
            <h2 className="mt-2 text-2xl font-black">{definition.name}</h2>
          </div>
          <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black">
            {currentLevel > 0
              ? "Niveau " + currentLevel + "/" + maximumLevel
              : "À construire"}
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#CFE0D8]">
          {definition.summary}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-5 xl:grid-cols-1 2xl:grid-cols-5">
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
                Niveau {level.level}
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
            className="mt-5 flex flex-1 flex-col border-t border-[#315B3E]/10 pt-5"
          >
            <input
              type="hidden"
              name="infrastructureCode"
              value={definition.code}
            />
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
              Prochain chantier · niveau {nextLevel.level}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
              {nextLevel.effect}
            </p>

            <label className="mt-4 block">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
                Architecte
              </span>
              <select
                name="architectContractId"
                value={architectContractId}
                onChange={(event) =>
                  setArchitectContractId(event.target.value)
                }
                className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70]"
              >
                <option value="">Sans architecte</option>
                {architects.map((candidate) => (
                  <option
                    key={candidate.contractId}
                    value={candidate.contractId}
                  >
                    {candidate.firstName} {candidate.lastName} · N
                    {candidate.level} · {candidate.specialtyLabel}
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
          <p className="mt-5 rounded-2xl bg-[#E5F4ED] p-4 text-sm font-black text-[#176951]">
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
