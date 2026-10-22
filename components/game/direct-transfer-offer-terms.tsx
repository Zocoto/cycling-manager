import Link from "@/components/ui/app-link";

import type { DirectTransferOffer } from "@/services/transfer-market";

export function DirectTransferOfferTerms({ offer }: { offer: DirectTransferOffer }) {
  const money = (value: number) => new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: offer.currency, maximumFractionDigits: 0,
  }).format(value);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#F3F8F6] p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#60756E]">Indemnité reçue</p>
          <p className="mt-1 text-lg font-black text-[#183F37]">{money(offer.amount)}</p>
        </div>
        <div className="rounded-xl bg-[#F3F8F6] p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#60756E]">Salaire à la charge de l’acheteur</p>
          <p className="mt-1 text-lg font-black text-[#183F37]">{money(offer.salaryPerSeason)} / saison</p>
        </div>
      </div>
      {offer.offeredRider ? (
        <div className="rounded-xl border border-[#42B99A]/30 bg-[#EAF5F3] p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#278B70]">Vous recevez également</p>
          <Link href={`/jeu/coureurs/${offer.offeredRider.id}`} className="mt-1 block text-lg font-black text-[#183F37] underline decoration-[#42B99A]/40 underline-offset-4">
            {offer.offeredRider.firstName} {offer.offeredRider.lastName} ↗
          </Link>
          <p className="mt-2 text-xs font-bold leading-5 text-[#48665F]">Salaire à votre charge : {money(offer.offeredRider.salaryPerSeason)} / saison.</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#48665F]">L’échange des deux coureurs et le paiement sont indivisibles. Les deux contrats couvrent la fin de la saison en cours. Les engagements en course, stage ou reconnaissance doivent être terminés ou retirés avant acceptation.</p>
        </div>
      ) : null}
    </div>
  );
}
