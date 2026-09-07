"use client";

import { useActionState } from "react";

import {
  chooseTeamInfrastructureSpecializationAction,
  type InfrastructureSpecializationActionState,
} from "@/app/jeu/infrastructures/actions";
import {
  chooseFederationInfrastructureSpecializationAction,
  type FederationInfrastructureActionState,
} from "@/app/jeu/federations/infrastructure-actions";
import {
  INFRASTRUCTURE_SPECIALIZATION_TRANSITION_DAYS,
  INFRASTRUCTURE_SPECIALIZATION_UNLOCK_LEVEL,
  getInfrastructureSpecializationPowerPercentage,
  type InfrastructureSpecializationProposal,
  type InfrastructureSpecializationSelection,
} from "@/lib/game/infrastructure-specializations";

const initialTeamState: InfrastructureSpecializationActionState = {
  status: "idle",
  message: "",
};
const initialFederationState: FederationInfrastructureActionState = {
  status: "idle",
  message: "",
};

export function InfrastructureSpecializationPanel({
  proposal,
  level,
  selection,
  gameYear,
  currency,
  countryCode,
  canManage = true,
}: {
  proposal: InfrastructureSpecializationProposal;
  level: number;
  selection: InfrastructureSpecializationSelection;
  gameYear: number;
  currency: string;
  countryCode?: string;
  canManage?: boolean;
}) {
  const [teamState, teamAction, teamPending] = useActionState(
    chooseTeamInfrastructureSpecializationAction,
    initialTeamState,
  );
  const [federationState, federationAction, federationPending] = useActionState(
    chooseFederationInfrastructureSpecializationAction,
    initialFederationState,
  );
  const isFederation = proposal.scope === "federation";
  const action = isFederation ? federationAction : teamAction;
  const actionState = isFederation ? federationState : teamState;
  const pending = isFederation ? federationPending : teamPending;
  const unlocked = level >= INFRASTRUCTURE_SPECIALIZATION_UNLOCK_LEVEL;
  const power = getInfrastructureSpecializationPowerPercentage(level);
  const hasChoice = Boolean(selection.activeCode);
  const activeOptionName = selection.pendingCode
    ? getOptionName(proposal, selection.pendingCode)
    : selection.activeCode
      ? getOptionName(proposal, selection.activeCode)
      : null;
  const canSubmit =
    unlocked &&
    canManage &&
    selection.canSelectThisSeason &&
    !selection.pendingCode &&
    !pending;

  return (
    <details className="group border-t border-[#315B3E]/12 bg-[#F8FBF9]">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 transition hover:bg-[#EEF7F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70] [&::-webkit-details-marker]:hidden sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E5F4ED] text-lg font-black text-[#176951]"
          >
            ◇
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#278B70]">
              Spécialisation · niveau 3
            </p>
            <p className="mt-0.5 truncate text-sm font-black text-[#183F37] sm:text-base">
              Orientation du bâtiment
              {activeOptionName ? ` · ${activeOptionName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full border border-[#315B3E]/12 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#60756E] sm:inline-flex">
            {unlocked ? `Puissance ${power} %` : `Verrouillé · N${level}/3`}
          </span>
          {gameYear < 3 ? (
            <span className="hidden rounded-full bg-[#102C27] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#F2C94C] md:inline-flex">
              Saison 3
            </span>
          ) : null}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-5 w-5 text-[#60756E] transition-transform group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m5 7 5 5 5-5" />
          </svg>
        </div>
      </summary>

      <div className="border-t border-[#315B3E]/10 bg-[#FFFDF4] p-4 sm:p-6">
        <p className="mb-4 text-xs font-semibold leading-5 text-[#60756E]">
          Une seule voie peut être active. Sa puissance progresse avec le
          bâtiment : 60 % au N3, 80 % au N4 et 100 % dès le N5. Les valeurs
          indiquées correspondent à la pleine puissance.
        </p>
        {!unlocked ? (
          <p className="mb-4 rounded-xl border border-[#315B3E]/10 bg-white px-4 py-3 text-xs font-bold text-[#60756E]">
            Les voies sont visibles dès maintenant. Construisez le niveau 3
            pour pouvoir en sélectionner une.
          </p>
        ) : selection.pendingCode ? (
          <p className="mb-4 rounded-xl border border-[#D5AC18]/35 bg-[#FFF6CE] px-4 py-3 text-xs font-bold text-[#71580A]">
            Réorientation en cours vers « {getOptionName(proposal, selection.pendingCode)} ».
            Activation {formatEffectiveDay(selection.effectiveGameDayIndex)}.
          </p>
        ) : hasChoice && !selection.canSelectThisSeason ? (
          <p className="mb-4 rounded-xl border border-[#315B3E]/10 bg-white px-4 py-3 text-xs font-bold text-[#60756E]">
            Le choix de cette saison est enregistré. Une réorientation sera
            possible la saison prochaine.
          </p>
        ) : hasChoice ? (
          <p className="mb-4 rounded-xl border border-[#315B3E]/10 bg-white px-4 py-3 text-xs font-bold text-[#60756E]">
            Une réorientation coûte {formatMoney(selection.reorientationCost, currency)}
            et demande {INFRASTRUCTURE_SPECIALIZATION_TRANSITION_DAYS} jours de jeu.
          </p>
        ) : gameYear < 3 ? (
          <p className="mb-4 rounded-xl border border-[#278B70]/20 bg-[#EAF7F1] px-4 py-3 text-xs font-bold text-[#176951]">
            Vous pouvez préselectionner votre voie en Saison 2 ; ses effets
            gameplay ne démarreront qu’en Saison 3.
          </p>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-3">
          {proposal.options.map((option) => {
            const isActive = selection.activeCode === option.code;
            const isPending = selection.pendingCode === option.code;
            return (
              <article
                key={option.code}
                className={`flex min-w-0 flex-col rounded-2xl border p-4 ${
                  isActive
                    ? "border-[#278B70]/45 bg-[#EAF7F1]"
                    : isPending
                      ? "border-[#D5AC18]/45 bg-[#FFF6CE]"
                      : "border-[#315B3E]/10 bg-white"
                } ${!unlocked ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#278B70]">
                      {isActive ? "Voie active" : isPending ? "À venir" : proposal.domain}
                    </p>
                    <h5 className="mt-1 text-base font-black text-[#183F37]">
                      {option.name}
                    </h5>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#102C27] px-2.5 py-1 text-[9px] font-black text-[#F2C94C]">
                    {power || 60} %
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
                  {option.identity}
                </p>
                <dl className="mt-4 space-y-2 text-xs leading-5">
                  <Effect label="Effet principal" value={option.primaryEffect} />
                  <Effect label="Effet secondaire" value={option.secondaryEffect} />
                  <Effect label="Limite" value={option.guardrail} muted />
                </dl>
                <form action={action} className="mt-auto pt-4">
                  <input type="hidden" name="infrastructureCode" value={proposal.buildingCode} />
                  <input type="hidden" name="specializationCode" value={option.code} />
                  {countryCode ? (
                    <input type="hidden" name="countryCode" value={countryCode} />
                  ) : null}
                  <button
                    type="submit"
                    disabled={!canSubmit || isActive || isPending}
                    className="min-h-10 w-full rounded-xl bg-[#183F37] px-3 text-xs font-black text-white transition enabled:hover:bg-[#278B70] disabled:cursor-not-allowed disabled:bg-[#CBD4D0]"
                  >
                    {isActive
                      ? "Spécialisation active"
                      : isPending
                        ? "Transition en cours"
                        : !unlocked
                          ? "Disponible au niveau 3"
                          : !canManage
                            ? isFederation
                              ? "Décision du président"
                              : "Choix indisponible"
                            : !selection.canSelectThisSeason
                              ? "Choix déjà effectué"
                              : pending
                                ? "Enregistrement…"
                                : hasChoice
                                  ? "Réorienter"
                                  : "Choisir cette voie"}
                  </button>
                </form>
              </article>
            );
          })}
        </div>

        {actionState.status !== "idle" ? (
          <p
            role="status"
            className={`mt-4 rounded-xl px-4 py-3 text-xs font-bold ${
              actionState.status === "success"
                ? "bg-[#E5F4ED] text-[#176951]"
                : "bg-[#FFF0EE] text-[#9D3E37]"
            }`}
          >
            {actionState.message}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function Effect({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={muted ? "text-[#7B6B37]" : "text-[#183F37]"}>
      <dt className="font-black">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function getOptionName(
  proposal: InfrastructureSpecializationProposal,
  code: string,
) {
  return proposal.options.find((option) => option.code === code)?.name ?? code;
}

function formatEffectiveDay(gameDayIndex: number | null) {
  if (gameDayIndex == null) return "à la fin de la transition";
  return `en S${Math.floor(gameDayIndex / 28)}, J${(gameDayIndex % 28) + 1}`;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
