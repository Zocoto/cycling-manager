"use client";

import Link from "@/components/ui/app-link";
import { useFormStatus } from "react-dom";

import { createDirectorListingAction } from "@/app/jeu/transferts/actions";
import { TransferCountdown } from "@/components/game/transfer-countdown";
import type { RiderTransferManagement } from "@/services/transfer-market";

export function RiderTransferListingCard({
  riderId,
  riderName,
  management,
}: {
  riderId: string;
  riderName: string;
  management: RiderTransferManagement;
}) {
  if (!management.ownsRider) return null;

  return (
    <article
      data-rider-transfer-listing="true"
      className="min-w-0 overflow-hidden rounded-[2rem] border border-[#256390]/25 bg-[#F2F7FC] p-6 shadow-[0_16px_45px_rgba(37,99,144,0.08)] sm:p-7"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#256390]">
        Marché des transferts
      </p>
      <h2 className="mt-2 text-xl font-black text-[#173B55]">
        Mettre le coureur en vente
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#557184]">
        Publiez directement une enchère de 24 heures sans quitter la fiche du
        coureur. Il restera dans votre effectif jusqu’à la clôture.
      </p>

      {management.activeListing ? (
        <div className="mt-5 rounded-2xl border border-[#256390]/15 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#54758B]">
                Enchère déjà publiée
              </p>
              <p className="mt-1 text-lg font-black text-[#173B55]">
                Prix d’appel ·{" "}
                {formatMoney(
                  management.activeListing.minimumBid,
                  management.currency,
                )}
              </p>
            </div>
            <span className="rounded-full bg-[#EAF2FA] px-3 py-1.5 text-xs font-black text-[#256390]">
              <TransferCountdown closesAt={management.activeListing.closesAt} />
            </span>
          </div>
          <Link
            href={`/jeu/transferts?onglet=quotidiennes#enchere-${management.activeListing.id}`}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#173B55] px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#256390]"
          >
            Voir l’enchère
          </Link>
        </div>
      ) : management.canListRider ? (
        <form action={createDirectorListingAction} className="mt-5">
          <input type="hidden" name="riderId" value={riderId} />
          <input
            type="hidden"
            name="returnPath"
            value={`/jeu/coureurs/${riderId}`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <ListingMetric
              label="Salaire actuel"
              value={`${formatMoney(
                management.currentSalary ?? 0,
                management.currency,
              )} / saison`}
            />
            <ListingMetric
              label="Prix conseillé"
              value={formatMoney(
                management.recommendedListingPrice,
                management.currency,
              )}
            />
          </div>
          <label className="mt-4 block text-[10px] font-black uppercase tracking-wider text-[#54758B]">
            Prix d’appel
            <span className="relative mt-2 block">
              <input
                name="minimumBid"
                type="number"
                min="500"
                max="1000000"
                step="100"
                required
                defaultValue={management.recommendedListingPrice}
                className="min-h-12 w-full rounded-xl border border-[#256390]/20 bg-white px-4 pr-14 text-base font-black text-[#173B55] outline-none focus:border-[#256390] focus:ring-2 focus:ring-[#256390]/15"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-black text-[#54758B]">
                {management.currency}
              </span>
            </span>
          </label>
          <div className="mt-4">
            <ListingConfirmationButton
              riderName={riderName}
              currency={management.currency}
            />
          </div>
        </form>
      ) : (
        <p className="mt-5 rounded-xl border border-[#C75B4B]/20 bg-[#FFF2EF] px-4 py-3 text-sm font-bold text-[#9B4035]">
          {management.listingBlockedReason ??
            "Ce coureur ne peut pas être mis en vente actuellement."}
        </p>
      )}
    </article>
  );
}

function ListingConfirmationButton({
  riderName,
  currency,
}: {
  riderName: string;
  currency: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        const form = event.currentTarget.form;
        const amount = form
          ? Number(new FormData(form).get("minimumBid"))
          : Number.NaN;
        if (
          !Number.isFinite(amount) ||
          amount < 500 ||
          amount > 1_000_000
        ) {
          return;
        }
        const confirmed = window.confirm(
          `Confirmer la mise en vente de ${riderName} pour un prix d’appel de ${formatMoney(amount, currency)} pendant 24 heures ?`,
        );
        if (!confirmed) event.preventDefault();
      }}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#256390] px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#173B55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#256390] disabled:cursor-wait disabled:bg-[#8FA5B4]"
    >
      {pending ? "Publication…" : "Mettre en vente pendant 24 h"}
    </button>
  );
}

function ListingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#256390]/10 bg-white px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-[#54758B]">
        {label}
      </p>
      <p className="mt-1 text-base font-black text-[#173B55]">{value}</p>
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
