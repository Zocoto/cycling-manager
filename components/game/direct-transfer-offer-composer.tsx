"use client";

import { useState, useTransition } from "react";

import { loadDirectTransferTradeCandidatesAction, submitDirectTransferOfferAction } from "@/app/jeu/transferts/actions";
import { TransferSubmitButton } from "@/components/game/transfer-submit-button";
import type { DirectTransferTradeCandidate } from "@/services/transfer-market";

export function DirectTransferOfferComposer({
  riderId,
  salaryPerSeason,
  availableBudget,
  currency,
  canMakeCashOffer,
  canMakeTradeOffer,
}: {
  riderId: string;
  salaryPerSeason: number;
  availableBudget: number;
  currency: string;
  canMakeCashOffer: boolean;
  canMakeTradeOffer: boolean;
}) {
  const [tradeCandidates, setTradeCandidates] = useState<DirectTransferTradeCandidate[]>([]);
  const [tradeOptionsLoaded, setTradeOptionsLoaded] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [isLoadingTrade, startTradeLoading] = useTransition();
  const [offeredRiderId, setOfferedRiderId] = useState("");
  const [amount, setAmount] = useState(canMakeCashOffer
    ? String(Math.min(10_000, Math.floor(availableBudget / 100) * 100))
    : "0");
  const offeredRider = tradeCandidates.find((rider) => rider.id === offeredRiderId);
  const isTrade = Boolean(offeredRider);
  const minimumOffer = isTrade ? 0 : 500;
  const maximumOffer = Math.min(100_000_000, Math.floor(availableBudget / 100) * 100);
  const money = (value: number) => new Intl.NumberFormat("fr-FR", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(value);

  function loadTradeOptions() {
    startTradeLoading(async () => {
      try {
        const result = await loadDirectTransferTradeCandidatesAction();
        setTradeCandidates(result.candidates);
        setTradeError(result.error);
        setTradeOptionsLoaded(result.error === null);
      } catch {
        setTradeError("Impossible de charger vos coureurs échangeables. Veuillez réessayer.");
      }
    });
  }

  return (
    <form
      action={submitDirectTransferOfferAction}
      className="mt-5"
      data-financial-expense-field="amount"
      data-financial-extra-expense={Math.max(0, salaryPerSeason - (offeredRider?.currentSalary ?? 0))}
      data-financial-label="cette offre de transfert"
    >
      <input type="hidden" name="riderId" value={riderId} />
      <input type="hidden" name="returnPath" value={`/jeu/coureurs/${riderId}`} />
      {canMakeTradeOffer && !tradeOptionsLoaded ? (
        <button type="button" onClick={loadTradeOptions} disabled={isLoadingTrade} className="mb-4 min-h-11 rounded-xl border border-[#9BE0BC]/40 px-4 py-2 text-xs font-black text-[#9BE0BC] transition hover:bg-white/10 disabled:opacity-60">
          {isLoadingTrade ? "Chargement des coureurs…" : tradeError ? "Réessayer de charger les coureurs" : "Ajouter un coureur en échange"}
        </button>
      ) : null}
      {tradeError ? <p role="alert" className="mb-4 text-xs font-semibold leading-5 text-[#FFE596]">{tradeError}</p> : null}
      {tradeOptionsLoaded ? <label className="block text-[10px] font-black uppercase tracking-wider text-[#9BE0BC]">
        Coureur proposé en échange · facultatif
        <select
          name="offeredRiderId"
          value={offeredRiderId}
          onChange={(event) => {
            const nextId = event.target.value;
            setOfferedRiderId(nextId);
            if (nextId === "" && Number(amount) < 500) setAmount("500");
          }}
          className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white px-3 text-sm font-bold text-[#183F37]"
        >
          <option value="" disabled={!canMakeCashOffer}>Argent uniquement</option>
          {tradeCandidates.map((rider) => (
            <option key={rider.id} value={rider.id}>{rider.firstName} {rider.lastName}</option>
          ))}
        </select>
      </label> : null}
      {tradeOptionsLoaded && tradeCandidates.length === 0 ? (
        <p className="mt-2 text-xs font-semibold text-[#BFD1C6]">Aucun coureur éligible à un échange dans votre effectif.</p>
      ) : null}
      {!canMakeCashOffer && !isTrade ? <p className="mt-2 text-xs font-semibold leading-5 text-[#BFD1C6]">Une offre en argent seul n’est pas possible avec votre trésorerie ou votre capacité d’effectif actuelle. Ajoutez un coureur pour préparer un échange.</p> : null}
      <label className="mt-4 block text-[10px] font-black uppercase tracking-wider text-[#9BE0BC]">
        {isTrade ? "Somme ajoutée à l’échange" : "Montant proposé"}
        <input
          name="amount" type="number" min={minimumOffer} max={maximumOffer}
          step="100" required value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white px-4 text-base font-black text-[#183F37]"
        />
      </label>
      {isTrade ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-[#BFD1C6]">0 € permet un échange sans indemnité. Les deux coureurs sont transférés ensemble, ou rien ne change.</p>
      ) : null}
      <label className="mt-4 block text-[10px] font-black uppercase tracking-wider text-[#9BE0BC]">
        Message au Directeur Sportif <span className="text-white/55">· facultatif</span>
        <textarea
          name="message" rows={3} maxLength={500}
          placeholder="Présentez votre projet sportif ou les raisons de votre offre…"
          className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-white px-4 py-3 text-sm font-semibold normal-case leading-5 tracking-normal text-[#183F37] placeholder:text-[#789087]"
        />
      </label>
      <p className="mt-2 text-[10px] font-semibold leading-4 text-[#9BE0BC]">L’offre et votre message seront ajoutés au fil privé avec un lien vers la fiche du coureur.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold text-[#BFD1C6]">
        <p>Budget disponible<br /><strong className="text-white">{money(availableBudget)}</strong></p>
        <p>Salaire estimé à votre charge<br /><strong className="text-white">{money(salaryPerSeason)} / saison</strong></p>
        {offeredRider ? (
          <p className="col-span-2 rounded-xl bg-white/10 p-3 leading-5">
            Vous cédez {offeredRider.firstName} {offeredRider.lastName} · salaire actuel libéré : {money(offeredRider.currentSalary)} / saison.
            <br />Salaire estimé de son nouveau contrat à la charge de l’autre équipe : <strong className="text-white">{money(offeredRider.salaryPerSeason)} / saison</strong>.
          </p>
        ) : null}
        <p className="col-span-2 text-[10px] leading-4 text-[#9BE0BC]">Les salaires sont payés par échéances, pas au moment de l’offre. Les deux contrats couvrent la fin de la saison en cours.</p>
        {isTrade ? <p className="col-span-2 text-[10px] leading-4 text-[#9BE0BC]">Estimations avant les réductions éventuelles propres à chaque équipe. Les salaires contractuels seront indiqués dans l’offre reçue.</p> : null}
      </div>
      {canMakeTradeOffer ? (
        <div className="mt-3 space-y-2 rounded-xl border border-[#F2C94C]/25 bg-[#F2C94C]/10 p-3 text-xs font-semibold leading-5 text-[#FFE596]">
          <p>Si vous proposez un coureur en échange, il sera immédiatement désinscrit de toutes ses courses à venir. Un refus ou un retrait de l’offre ne le réinscrit pas.</p>
          <p>À l’acceptation, les inscriptions futures des deux coureurs sont retirées. Une course commencée ou un départ déjà figé bloque l’envoi et l’acceptation. Les stages et reconnaissances doivent toujours être terminés ou annulés.</p>
        </div>
      ) : null}
      <div className="mt-5">
        <TransferSubmitButton pendingLabel="Envoi de l’offre…" disabled={!isTrade && !canMakeCashOffer}>
          Transmettre l’offre
        </TransferSubmitButton>
      </div>
    </form>
  );
}
