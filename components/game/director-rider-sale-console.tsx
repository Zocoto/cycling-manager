"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { createDirectorListingAction } from "@/app/jeu/transferts/actions";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { TransferScoutingReportPanel } from "@/components/game/transfer-scouting-report";
import {
  formatScoutedNumericValue,
  formatScoutedPotentialValue,
} from "@/lib/game/transfer-scouting";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type { TransferRosterCandidate } from "@/services/transfer-market";

export function DirectorRiderSaleConsole({
  roster,
  jersey,
  returnPath,
}: {
  roster: TransferRosterCandidate[];
  jersey: RiderJerseyAppearance;
  returnPath: string;
}) {
  const initialCandidate =
    roster.find((candidate) => candidate.canList) ?? roster[0] ?? null;
  const [selectedRiderId, setSelectedRiderId] = useState(
    initialCandidate?.rider.id ?? "",
  );
  const selectedCandidate =
    roster.find((candidate) => candidate.rider.id === selectedRiderId) ??
    initialCandidate;
  const [minimumBid, setMinimumBid] = useState(
    initialCandidate?.recommendedPrice ?? 5000,
  );

  function selectCandidate(candidate: TransferRosterCandidate) {
    setSelectedRiderId(candidate.rider.id);
    setMinimumBid(candidate.recommendedPrice);
  }

  if (!selectedCandidate) {
    return (
      <p className="mt-5 rounded-2xl bg-[#F3F8F6] px-5 py-6 text-sm font-bold text-[#60756E]">
        Votre effectif ne contient actuellement aucun coureur à présenter.
      </p>
    );
  }

  const selectedRider = selectedCandidate.rider;

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
      <section
        aria-labelledby="sale-roster-title"
        className="min-w-0 rounded-[1.75rem] border border-[#315B3E]/12 bg-[#F7FAF8] p-4"
      >
        <div className="px-1 pb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
            Liste de valeur
          </p>
          <h3 id="sale-roster-title" className="mt-1 text-xl font-black text-[#183F37]">
            Choisir un coureur
          </h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">
            Les notes sont exactes : vous consultez les données de votre propre équipe.
          </p>
        </div>
        <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1 [scrollbar-color:#72D4B7_#EAF5F3] [scrollbar-width:thin]">
          {roster.map((candidate) => {
            const rider = candidate.rider;
            const selected = rider.id === selectedRider.id;
            return (
              <button
                key={rider.id}
                type="button"
                aria-pressed={selected}
                onClick={() => selectCandidate(candidate)}
                className={`w-full rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] ${
                  selected
                    ? "border-[#F2C94C] bg-[#FFF9DF] shadow-[0_8px_20px_rgba(112,91,0,0.1)]"
                    : "border-[#315B3E]/10 bg-white hover:border-[#42B99A]/45 hover:bg-[#F0F8F4]"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#183F37]">
                      {rider.firstName} {rider.lastName}
                    </span>
                    <span className="mt-1 block truncate text-[10px] font-bold text-[#60756E]">
                      <span
                        aria-hidden="true"
                        className={`fi fi-${rider.countryCode.toLowerCase()} mr-1.5 rounded-sm`}
                      />
                      {rider.age} ans · {rider.profileLabel}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#DDF3E7] px-2.5 py-1 text-[10px] font-black text-[#176951]">
                    MOY {formatScoutedNumericValue(rider.scoutingReport.overall)}
                  </span>
                </span>
                <span className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                  <RosterMetric
                    label="Mont."
                    value={formatScoutedNumericValue(
                      rider.scoutingReport.ratings.mountain,
                    )}
                  />
                  <RosterMetric
                    label="Sprint"
                    value={formatScoutedNumericValue(
                      rider.scoutingReport.ratings.sprint,
                    )}
                  />
                  <RosterMetric
                    label="Pot."
                    value={formatScoutedPotentialValue(
                      rider.scoutingReport.potential,
                    )}
                  />
                </span>
                <span className="mt-3 flex items-center justify-between gap-3 text-[10px] font-black">
                  <span className="text-[#60756E]">
                    Valeur conseillée {formatMoney(candidate.recommendedPrice, candidate.currency)}
                  </span>
                  <span
                    className={
                      candidate.canList
                        ? "text-[#176951]"
                        : "text-[#9B4035]"
                    }
                  >
                    {candidate.canList ? "Disponible" : "Indisponible"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="sale-preparation-title"
        className="min-w-0 overflow-hidden rounded-[1.75rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.08)]"
      >
        <div className="flex flex-col gap-5 bg-[linear-gradient(135deg,#071A17,#176951)] p-5 text-white sm:flex-row sm:items-center">
          <RiderAvatar
            profileKey={selectedRider.avatarProfileKey}
            seed={selectedRider.avatarSeed}
            riderId={selectedRider.id}
            age={selectedRider.age}
            jersey={jersey}
            label={`Portrait de ${selectedRider.firstName} ${selectedRider.lastName}`}
            className="h-24 w-24 shrink-0 border-2 border-white/20"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9BE0BC]">
              Tuile de traitement
            </p>
            <h3 id="sale-preparation-title" className="mt-1 truncate text-2xl font-black">
              {selectedRider.firstName} {selectedRider.lastName}
            </h3>
            <p className="mt-2 text-xs font-bold text-[#D6DFD2]">
              <span
                aria-hidden="true"
                className={`fi fi-${selectedRider.countryCode.toLowerCase()} mr-2 rounded-sm`}
              />
              {selectedRider.countryName} · {selectedRider.age} ans · {selectedRider.profileLabel}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <TransferScoutingReportPanel
            report={selectedRider.scoutingReport}
            compact
            exactDataLabel="Données de votre équipe"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SaleMetric
              label="Salaire actuel"
              value={`${formatMoney(selectedCandidate.currentSalary, selectedCandidate.currency)} / saison`}
            />
            <SaleMetric
              label="Prix conseillé"
              value={formatMoney(
                selectedCandidate.recommendedPrice,
                selectedCandidate.currency,
              )}
            />
          </div>

          {selectedCandidate.canList ? (
            <form action={createDirectorListingAction} className="mt-5">
              <input type="hidden" name="riderId" value={selectedRider.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <label className="block text-xs font-black uppercase tracking-wider text-[#48665F]">
                Prix d’appel
                <span className="relative mt-2 block">
                  <input
                    name="minimumBid"
                    type="number"
                    min="500"
                    max="1000000"
                    step="100"
                    required
                    value={minimumBid}
                    onChange={(event) => setMinimumBid(Number(event.target.value))}
                    className="min-h-12 w-full rounded-xl border border-[#315B3E]/20 bg-white px-4 pr-14 text-base font-black text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/15"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-black text-[#60756E]">
                    {selectedCandidate.currency}
                  </span>
                </span>
              </label>
              <p className="mt-3 rounded-xl bg-[#F3F8F6] px-4 py-3 text-xs font-semibold leading-5 text-[#60756E]">
                L’annonce sera immédiatement visible dans « Enchères » pendant 24 heures. Le coureur reste dans votre équipe jusqu’à la clôture.
              </p>
              <div className="mt-4 flex justify-end">
                <SaleConfirmationButton
                  riderName={`${selectedRider.firstName} ${selectedRider.lastName}`}
                  amount={minimumBid}
                  currency={selectedCandidate.currency}
                />
              </div>
            </form>
          ) : (
            <p className="mt-5 rounded-xl border border-[#C75B4B]/20 bg-[#FFF2EF] px-4 py-3 text-sm font-bold text-[#9B4035]">
              {selectedCandidate.listBlockedReason ??
                "Ce coureur ne peut pas être mis en vente actuellement."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function SaleConfirmationButton({
  riderName,
  amount,
  currency,
}: {
  riderName: string;
  amount: number;
  currency: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || !Number.isFinite(amount) || amount < 500 || amount > 1_000_000}
      onClick={(event) => {
        const confirmed = window.confirm(
          `Confirmer la mise en vente de ${riderName} pour un prix d’appel de ${formatMoney(amount, currency)} pendant 24 heures ?`,
        );
        if (!confirmed) event.preventDefault();
      }}
      className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#F2C94C] px-6 py-3 text-xs font-black uppercase tracking-wider text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:cursor-not-allowed disabled:bg-[#D4D8CE] disabled:text-[#60756E]"
    >
      {pending ? "Publication…" : "Valider la mise en vente"}
    </button>
  );
}

function RosterMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg bg-[#F3F8F6] px-1.5 py-1.5">
      <span className="block text-[8px] font-black uppercase tracking-wider text-[#789087]">
        {label}
      </span>
      <span className="mt-0.5 block text-[10px] font-black text-[#183F37]">
        {value}
      </span>
    </span>
  );
}

function SaleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#315B3E]/10 bg-[#F7FAF8] px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-[#60756E]">
        {label}
      </p>
      <p className="mt-1 text-base font-black text-[#183F37]">{value}</p>
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}
