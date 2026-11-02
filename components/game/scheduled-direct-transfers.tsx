import Link from "@/components/ui/app-link";
import type { TransferMarketOverview } from "@/services/transfer-market";

export function ScheduledDirectTransfers({ offers }: {
  offers: NonNullable<TransferMarketOverview["scheduledTransfers"]>;
}) {
  if (offers.length === 0) return null;
  return <section className="mt-7 rounded-[2rem] border border-[#D9A247]/30 bg-[#FFF8E5] p-5 sm:p-6">
    <h2 className="text-xl font-black text-[#183F37]">Transferts programmés</h2>
    <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">Accords acceptés. Les indemnités sont bloquées puis versées au vendeur lors du transfert. Les places d’effectif sont réservées pour la saison suivante.</p>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">{offers.map(offer => {
      const money = (amount: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: offer.currency, maximumFractionDigits: 0 }).format(amount);
      return <article key={offer.id} className="rounded-2xl border border-[#315B3E]/12 bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8A6B16]">{offer.offeredRider ? "Échange programmé" : offer.direction === "arrival" ? "Arrivée" : "Départ"} · Début de la saison {offer.effectiveSeasonYear}</p>
        {offer.offeredRider ? <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[#60756E]">{offer.direction === "arrival" ? "Arrivée" : "Départ"}</p> : null}
        <Link href={`/jeu/coureurs/${offer.rider.id}`} className="mt-2 block text-lg font-black text-[#183F37] underline decoration-[#315B3E]/25 underline-offset-4">{offer.rider.firstName} {offer.rider.lastName} ↗</Link>
        <p className="mt-1 text-xs font-bold text-[#60756E]">{offer.counterpartTeamName}</p>
        {offer.offeredRider ? <p className="mt-3 text-xs font-semibold text-[#48665F]">{offer.direction === "arrival" ? "Départ" : "Arrivée"} : <Link href={`/jeu/coureurs/${offer.offeredRider.id}`} className="font-black underline underline-offset-4">{offer.offeredRider.firstName} {offer.offeredRider.lastName} ↗</Link></p> : null}
        <p className="mt-3 text-sm font-black text-[#183F37]">Indemnité bloquée : {money(offer.amount)}</p>
        <p className="mt-1 text-xs font-semibold text-[#60756E]">{offer.direction === "departure" && !offer.offeredRider ? "Salaire à la charge de l’acheteur" : "Salaire du nouveau contrat"} : {money(offer.direction === "departure" && offer.offeredRider ? offer.offeredRider.salaryPerSeason : offer.salaryPerSeason)} / saison</p>
      </article>;
    })}</div>
  </section>;
}
