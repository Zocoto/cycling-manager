"use client";

import { useActionState, useState } from "react";

import {
  changeAmateurTeamNationalAffiliationAction,
} from "@/app/jeu/federations/affiliation-actions";
import { initialAmateurTeamAffiliationActionState } from "@/lib/game/federation-action-states";
import type { AmateurTeamAffiliationState } from "@/services/amateur-team-affiliation";

export function AmateurTeamAffiliationPanel({
  state,
}: {
  state: AmateurTeamAffiliationState;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [actionState, action, pending] = useActionState(
    changeAmateurTeamNationalAffiliationAction,
    initialAmateurTeamAffiliationActionState,
  );

  return (
    <section className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5 shadow-[0_10px_28px_rgba(19,60,46,0.05)] sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--federation-secondary)]">
            Nationalité de l’équipe
          </p>
          <h2 className="mt-1.5 text-xl font-black text-[#183F37]">
            Ancrer votre équipe amateur dans la fédération
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
            Alignez durablement la nationalité sportive de votre équipe amateur
            sur celle de la fédération. Elle contribue à déterminer les sponsors
            qui vous contacteront en fin de saison.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-black text-[#183F37]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#315B3E]/12 bg-white px-3 py-1.5">
              <span className="text-[9px] uppercase tracking-[0.1em] text-[#789087]">
                Actuelle
              </span>
              <span
                className={`fi fi-${state.currentCountryCode.toLowerCase()}`}
              />
              {state.currentCountryName}
            </span>
            <span aria-hidden="true" className="text-[#789087]">
              →
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--federation-soft)] px-3 py-1.5 text-[var(--federation-primary)]">
              <span className="text-[9px] uppercase tracking-[0.1em] opacity-65">
                Fédération
              </span>
              <span
                className={`fi fi-${state.federationCountryCode.toLowerCase()}`}
              />
              {state.federationCountryName}
            </span>
          </div>

          <p className="mt-3 text-xs font-semibold leading-5 text-[#789087]">
            Une saison complète dans cette fédération est requise. Les coureurs
            et les contrats en cours restent inchangés.
          </p>
          {state.unavailableReason ? (
            <p className="mt-3 inline-flex rounded-lg bg-[#FFF3E8] px-3 py-2 text-xs font-black text-[#8A4B16]">
              {state.unavailableReason}
            </p>
          ) : null}
          {actionState.message ? (
            <p
              role="status"
              className={`mt-3 rounded-lg px-3 py-2 text-xs font-black ${
                actionState.status === "success"
                  ? "bg-[#E8F7F1] text-[#176951]"
                  : "bg-[#FBE3DE] text-[#9D3E37]"
              }`}
            >
              {actionState.message}
            </p>
          ) : null}
        </div>

        <form action={action} className="min-w-0 lg:w-72">
          <input
            type="hidden"
            name="countryId"
            value={state.federationCountryId}
          />
          <label className="flex items-start gap-2.5 text-xs font-bold leading-5 text-[#526B62]">
            <input
              type="checkbox"
              name="confirmed"
              value="yes"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={!state.canChange || pending}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--federation-secondary)]"
            />
            Je confirme l’adoption de la nationalité sportive&nbsp;: {state.federationCountryName}.
          </label>
          <button
            type="submit"
            disabled={!state.canChange || !confirmed || pending}
            className="mt-3 min-h-11 w-full rounded-xl bg-[var(--federation-secondary)] px-5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? "Changement…" : "Confirmer le changement"}
          </button>
        </form>
      </div>
    </section>
  );
}
