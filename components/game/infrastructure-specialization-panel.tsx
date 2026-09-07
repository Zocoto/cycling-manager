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
  const canSubmit =
    unlocked &&
    canManage &&
    selection.canSelectThisSeason &&
    !selection.pendingCode &&
    !pending;

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-[#C9A227]/30 bg-[#FFFDF4] shadow-[0_12px_32px_rgba(19,60,46,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#C9A227]/20 bg-[linear-gradient(105deg,#102C27,#183F37)] px-5 py-5 text-white sm:px-7">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F2C94C]">
            Spécialisation · palier niveau 3
          </p>
          <h4 className="mt-1 text-xl font-black">Orientation du bâtiment</h4>
          <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-[#D6DFD2] sm:text-sm">
            Une seule voie peut être active. Sa puissance progresse avec le
            bâtiment : 60 % au N3, 80 % au N4 et 100 % dès le N5. Les valeurs
            ci-dessous correspondent à la pleine puissance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill>
            {unlocked ? `Puissance ${power} %` : `Verrouillé · N${level}/3`}
          </StatusPill>
          {gameYear < 3 ? <StatusPill>Saison 3</StatusPill> : null}
        </div>
      </div>

      <div className="p-4 sm:p-6">
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
    </section>
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

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em]">
      {children}
    </span>
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
