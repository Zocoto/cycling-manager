"use client";

import { useActionState, useState } from "react";

import {
  changeAmateurTeamNationalAffiliationAction,
} from "@/app/jeu/federations/affiliation-actions";
import { initialAmateurTeamAffiliationActionState } from "@/lib/game/federation-action-states";
import type { AmateurTeamAffiliationState } from "@/services/amateur-team-affiliation";

type CountryOption = {
  id: string;
  name: string;
  code: string;
};

export function AmateurTeamAffiliationPanel({
  countries,
  state,
}: {
  countries: CountryOption[];
  state: AmateurTeamAffiliationState;
}) {
  const [selectedCountryId, setSelectedCountryId] = useState(
    state.currentCountryId ?? "",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [actionState, action, pending] = useActionState(
    changeAmateurTeamNationalAffiliationAction,
    initialAmateurTeamAffiliationActionState,
  );
  const selectedCountry = countries.find(
    (country) => country.id === selectedCountryId,
  );
  const unchanged = selectedCountryId === state.currentCountryId;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[var(--federation-secondary)]/20 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
      <div className="grid gap-5 bg-[var(--federation-primary)] p-6 text-white sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-accent)]">
            Identité fondatrice
          </p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">
            Transférer l’affiliation nationale de l’équipe
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/75">
            Enregistrez durablement votre structure amateur auprès d’une
            nouvelle fédération. Ce pays deviendra la référence géographique
            privilégiée lors des prochaines propositions de sponsoring.
          </p>
        </div>
        {state.currentCountryCode ? (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black">
            <span className={`fi fi-${state.currentCountryCode.toLowerCase()}`} />
            {state.currentCountryName}
          </span>
        ) : null}
      </div>

      <form action={action} className="grid gap-5 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <label className="block text-sm font-black text-[#183F37]" htmlFor="new-affiliation-country">
            Nouvelle fédération d’affiliation
          </label>
          <select
            id="new-affiliation-country"
            name="countryId"
            value={selectedCountryId}
            onChange={(event) => {
              setSelectedCountryId(event.target.value);
              setConfirmed(false);
            }}
            disabled={!state.canChange || pending}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/18 bg-[#F8FBF9] px-4 text-sm font-black text-[#183F37] outline-none focus:border-[var(--federation-secondary)] focus:ring-2 focus:ring-[var(--federation-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name} ({country.code})
              </option>
            ))}
          </select>
          <label className="mt-4 flex items-start gap-3 text-xs font-bold leading-5 text-[#526B62]">
            <input
              type="checkbox"
              name="confirmed"
              value="yes"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={!state.canChange || unchanged || pending}
              className="mt-0.5 h-4 w-4 accent-[var(--federation-secondary)]"
            />
            Je confirme le transfert durable vers {selectedCountry?.name ?? "la fédération sélectionnée"}.
          </label>
          <p className="mt-3 text-xs font-semibold leading-5 text-[#789087]">
            Aucune ancienneté minimale n’est requise. Le transfert est possible
            une fois par saison ; le sponsor et les contrats déjà signés restent
            inchangés. La nationalité des coureurs n’est pas modifiée.
          </p>
          {state.unavailableReason ? (
            <p className="mt-3 rounded-xl bg-[#FFF3E8] px-4 py-3 text-xs font-black text-[#8A4B16]">
              {state.unavailableReason}
            </p>
          ) : null}
          {actionState.message ? (
            <p
              role="status"
              className={`mt-3 rounded-xl px-4 py-3 text-xs font-black ${
                actionState.status === "success"
                  ? "bg-[#E8F7F1] text-[#176951]"
                  : "bg-[#FBE3DE] text-[#9D3E37]"
              }`}
            >
              {actionState.message}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={!state.canChange || unchanged || !confirmed || pending}
          className="min-h-12 rounded-xl bg-[var(--federation-secondary)] px-6 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "Transfert…" : "Confirmer l’affiliation"}
        </button>
      </form>
    </section>
  );
}
