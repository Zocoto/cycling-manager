import Link from "@/components/ui/app-link";

import type { DirectTransferOffer } from "@/services/transfer-market";

export function DirectTransferOfferTerms({ offer }: { offer: DirectTransferOffer }) {
  const money = (value: number) => new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: offer.currency, maximumFractionDigits: 0,
  }).format(value);

  return (
    <div className="space-y-3">
      {offer.effectiveSeasonYear ? <div className="rounded-xl border border-[#D9A247]/35 bg-[#FFF8E5] p-3 text-xs font-bold leading-5 text-[#71580A]">
        <p>Début de la saison {offer.effectiveSeasonYear}</p>
        <p className="mt-1">L’indemnité est bloquée à l’acceptation, puis versée au vendeur au début de la saison suivante. Les coureurs restent dans leurs équipes jusque-là, avec leurs inscriptions et entraînements.</p>
        <p className="mt-1">Le nouveau contrat couvre uniquement la saison suivante. Les prolongations déjà prévues avec l’équipe actuelle seront remplacées par cet accord.</p>
      </div> : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#F3F8F6] p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#60756E]">{offer.effectiveSeasonYear ? "Indemnité à recevoir" : "Indemnité reçue"}</p>
          <p className="mt-1 text-lg font-black text-[#183F37]">{money(offer.amount)}</p>
        </div>
        <div className="rounded-xl bg-[#F3F8F6] p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#60756E]">Salaire à la charge de l’acheteur</p>
          <p className="mt-1 text-lg font-black text-[#183F37]">{money(offer.salaryPerSeason)} / saison</p>
        </div>
      </div>
      {!offer.effectiveSeasonYear && !offer.offeredRider ? <p className="text-xs font-semibold leading-5 text-[#48665F]">Le nouveau contrat couvre la saison en cours et la saison suivante.</p> : null}
      {offer.offeredRider ? (
        <div className="rounded-xl border border-[#42B99A]/30 bg-[#EAF5F3] p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#278B70]">Vous recevez également</p>
          <Link href={`/jeu/coureurs/${offer.offeredRider.id}`} className="mt-1 block text-lg font-black text-[#183F37] underline decoration-[#42B99A]/40 underline-offset-4">
            {offer.offeredRider.firstName} {offer.offeredRider.lastName} ↗
          </Link>
          <p className="mt-2 text-xs font-bold leading-5 text-[#48665F]">Salaire à votre charge : {money(offer.offeredRider.salaryPerSeason)} / saison.</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#48665F]">{offer.effectiveSeasonYear
            ? "Les deux arrivées et le versement de l’indemnité sont programmés ensemble au début de la saison suivante."
            : "L’échange des deux coureurs et le paiement sont indivisibles. Les deux contrats couvrent la saison en cours et la saison suivante. En acceptant, vous désinscrivez votre coureur de toutes ses courses à venir."}</p>
          {!offer.effectiveSeasonYear ? <p className="mt-2 text-xs font-semibold leading-5 text-[#48665F]">Une course commencée ou un départ déjà figé bloque l’échange. Les stages et reconnaissances doivent toujours être terminés ou annulés. Ces conditions sont revérifiées pour les deux coureurs à l’acceptation.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
