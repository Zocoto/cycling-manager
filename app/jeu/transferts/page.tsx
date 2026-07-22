import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import {
  createDirectorListingAction,
  placeTransferBidAction,
  signFreeAgentAction,
} from "@/app/jeu/transferts/actions";
import { GameHeader } from "@/components/game/game-header";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { TransferCountdown } from "@/components/game/transfer-countdown";
import { TransferScoutingReportPanel } from "@/components/game/transfer-scouting-report";
import { TransferSubmitButton } from "@/components/game/transfer-submit-button";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import { RIDER_RATING_AXES, type RiderRatingKey } from "@/lib/game/rider-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getTeamAmateurIdentity } from "@/services/team-amateur-identity";
import { getActiveTeamSponsorIdentity } from "@/services/team-sponsor-identity";
import {
  getTransferMarketOverview,
  type TransferMarketFilters,
  type TransferMarketListing,
  type TransferMarketRider,
  type TransferRosterCandidate,
} from "@/services/transfer-market";

export const metadata: Metadata = {
  title: "Bureau des transferts",
  description: "Enchérissez, vendez et signez les coureurs de votre équipe.",
};

type TransferTab = "quotidiennes" | "directeurs" | "libres";

type TransferPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const tabs: Array<{ id: TransferTab; label: string; detail: string }> = [
  { id: "quotidiennes", label: "Enchères quotidiennes", detail: "5 nouveaux talents · 9 h à 18 h" },
  { id: "directeurs", label: "Enchères des DS", detail: "Ventes entre équipes · 24 h" },
  { id: "libres", label: "Agents libres", detail: "Signature sans indemnité" },
];

export default async function TransferMarketPage({ searchParams }: TransferPageProps) {
  const query = await searchParams;
  const tab = readTab(readQuery(query.onglet));
  const filters = readFilters(query);
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authenticationError } = await supabase.auth.getUser();
  if (authenticationError || !user) redirect("/connexion");

  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getTransferMarketOverview(supabase, user.id, filters),
  ]);
  if (!overview) redirect("/jeu");

  const sellerTeamIds = [...new Set(
    overview.directorListings
      .map((listing) => listing.sellerTeamId)
      .filter((teamId): teamId is string => Boolean(teamId))
      .concat(overview.teamId)
  )];
  const jerseys = new Map<string, RiderJerseyAppearance>();
  await Promise.all(sellerTeamIds.map(async (teamId) => {
    const [amateur, sponsor] = await Promise.all([
      getTeamAmateurIdentity(teamId).catch(() => null),
      getActiveTeamSponsorIdentity(teamId).catch(() => null),
    ]);
    jerseys.set(
      teamId,
      sponsor
        ? createSponsoredRiderJersey({ colors: sponsor.sponsor.colors, style: sponsor.selectedJersey.style })
        : amateur
          ? createAmateurRiderJersey(amateur.jersey)
          : FREE_AGENT_RIDER_JERSEY
    );
  }));

  const success = readQuery(query.succes);
  const errorMessage = readQuery(query.erreur);
  const currentPath = `/jeu/transferts?onglet=${tab}`;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader simulatorEmail={user.email} displayName={headerData.displayName} sponsor={headerData.teamSponsorIdentity?.sponsor ?? null} maxWidth="wide" />
      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/jeu" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] hover:text-[#0B302B]">← Retour au bureau du DS</Link>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10">
          <div aria-hidden="true" className="absolute -right-12 -top-20 h-72 w-72 rounded-full border-[42px] border-white/5" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">Recruter · vendre · construire</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Bureau des transferts</h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Recrutez à partir d’un rapport de scouting incomplet : certaines notes sont exactes, d’autres estimées ou encore inconnues. Les outils d’analyse permettront plus tard d’affiner ces informations.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <Metric label="Budget projeté" value={formatMoney(overview.projectedBudget, overview.currency)} />
              <Metric label="Réservé" value={formatMoney(overview.reservedBudget, overview.currency)} />
              <Metric label="Disponible" value={formatMoney(overview.availableBudget, overview.currency)} />
            </div>
          </div>
        </header>

        {success ? <Notice tone="success">{success}</Notice> : null}
        {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

        <nav className="mt-7 grid gap-3 lg:grid-cols-3" aria-label="Rubriques du marché des transferts">
          {tabs.map((entry) => (
            <Link
              key={entry.id}
              href={`/jeu/transferts?onglet=${entry.id}`}
              aria-current={tab === entry.id ? "page" : undefined}
              className={tab === entry.id
                ? "rounded-2xl border border-[#42B99A] bg-[#0B302B] p-5 text-white shadow-[0_16px_40px_rgba(7,26,23,0.18)]"
                : "rounded-2xl border border-[#315B3E]/15 bg-white p-5 text-[#183F37] transition hover:-translate-y-0.5 hover:border-[#42B99A]/50"}
            >
              <span className="block text-lg font-black">{entry.label}</span>
              <span className={tab === entry.id ? "mt-1 block text-xs font-bold text-[#9BE0BC]" : "mt-1 block text-xs font-bold text-[#60756E]"}>{entry.detail}</span>
            </Link>
          ))}
        </nav>

        {tab === "quotidiennes" ? (
          <DailyAuctions listings={overview.dailyListings} overview={overview} returnPath={currentPath} />
        ) : tab === "directeurs" ? (
          <DirectorAuctions listings={overview.directorListings} roster={overview.roster} overview={overview} jerseys={jerseys} returnPath={currentPath} />
        ) : (
          <FreeAgents riders={overview.freeAgents} countries={overview.countries} query={query} currency={overview.currency} returnPath={currentPath} />
        )}
      </section>
    </main>
  );
}

function DailyAuctions({ listings, overview, returnPath }: {
  listings: TransferMarketListing[];
  overview: NonNullable<Awaited<ReturnType<typeof getTransferMarketOverview>>>;
  returnPath: string;
}) {
  return (
    <section className="mt-7">
      <SectionHeading eyebrow={`Marché du ${formatDate(overview.marketDate)}`} title="La sélection du jour" detail="Les cinq enchères ouvrent à 9 h et sont attribuées à 18 h. Les rapports sont volontairement partiels ; sans offre, le coureur rejoint les agents libres." />
      {listings.length > 0 ? (
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => <AuctionCard key={listing.id} listing={listing} jersey={FREE_AGENT_RIDER_JERSEY} teamId={overview.teamId} availableBudget={overview.availableBudget} returnPath={returnPath} />)}
        </div>
      ) : (
        <EmptyState title="Le marché quotidien n’est pas encore ouvert" detail="Revenez à partir de 9 h : cinq nouveaux coureurs apparaîtront automatiquement." />
      )}
    </section>
  );
}

function DirectorAuctions({ listings, roster, overview, jerseys, returnPath }: {
  listings: TransferMarketListing[];
  roster: TransferRosterCandidate[];
  overview: NonNullable<Awaited<ReturnType<typeof getTransferMarketOverview>>>;
  jerseys: Map<string, RiderJerseyAppearance>;
  returnPath: string;
}) {
  const sellable = roster.filter((candidate) => candidate.canList);
  return (
    <section className="mt-7 space-y-7">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionHeading eyebrow="Votre effectif" title="Mettre un coureur aux enchères" detail="Fixez le prix d’appel. La vente reste ouverte 24 heures et le plus offrant remporte le coureur." compact />
          {sellable.length > 0 ? (
            <form action={createDirectorListingAction} className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
              <label className="text-xs font-black uppercase tracking-wider text-[#48665F]">Coureur
                <select name="riderId" required className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/20 bg-white px-4 text-sm font-bold">
                  {sellable.map((candidate) => <option key={candidate.rider.id} value={candidate.rider.id}>{candidate.rider.firstName} {candidate.rider.lastName} · MOY {candidate.rider.overall}</option>)}
                </select>
              </label>
              <label className="text-xs font-black uppercase tracking-wider text-[#48665F]">Prix d’appel
                <input name="minimumBid" type="number" min="500" max="1000000" step="100" required defaultValue={sellable[0]?.recommendedPrice ?? 5000} className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/20 px-4 text-sm font-black" />
              </label>
              <TransferSubmitButton pendingLabel="Publication…" tone="dark">Publier 24 h</TransferSubmitButton>
            </form>
          ) : <p className="mt-5 rounded-xl bg-[#F3F8F6] px-4 py-4 text-sm font-bold text-[#60756E]">Aucun coureur n’est actuellement éligible à une nouvelle mise en vente.</p>}
        </article>

        <article className="rounded-[2rem] border border-[#F2C94C]/25 bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(7,26,23,0.14)] sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2C94C]">Règle contractuelle</p>
          <h2 className="mt-2 text-2xl font-black">Une saison de stabilité</h2>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#BFD1C6]">Un coureur recruté pendant la saison ne peut pas être revendu avant la saison suivante. Les coureurs fondateurs restent immédiatement cessibles.</p>
        </article>
      </div>

      <div>
        <SectionHeading eyebrow="Marché interéquipes" title="Enchères ouvertes par les DS" detail="Le vendeur conserve le coureur jusqu’à la clôture ; le transfert et les écritures financières sont ensuite automatiques." />
        {listings.length > 0 ? <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => <AuctionCard key={listing.id} listing={listing} jersey={listing.sellerTeamId ? jerseys.get(listing.sellerTeamId) ?? FREE_AGENT_RIDER_JERSEY : FREE_AGENT_RIDER_JERSEY} teamId={overview.teamId} availableBudget={overview.availableBudget} returnPath={returnPath} />)}</div> : <EmptyState title="Aucune vente entre DS" detail="Dès qu’un Directeur Sportif publiera un coureur, son enchère apparaîtra ici pendant 24 heures." />}
      </div>
    </section>
  );
}

function FreeAgents({ riders, countries, query, currency, returnPath }: {
  riders: TransferMarketRider[];
  countries: Array<{ name: string; code: string }>;
  query: Record<string, string | string[] | undefined>;
  currency: string;
  returnPath: string;
}) {
  return (
    <section className="mt-7">
      <SectionHeading eyebrow="Sans indemnité de transfert" title="Base des agents libres" detail="Le contrat couvre la saison actuelle et la suivante. Le salaire est connu, mais le niveau sportif reste soumis à la qualité du rapport de scouting." />
      <form className="mt-5 grid gap-3 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_35px_rgba(19,60,46,0.07)] md:grid-cols-2 xl:grid-cols-6">
        <input type="hidden" name="onglet" value="libres" />
        <FilterField label="Nom"><input name="recherche" defaultValue={readQuery(query.recherche)} placeholder="Rechercher…" className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal" /></FilterField>
        <FilterField label="Nationalité"><select name="pays" defaultValue={readQuery(query.pays)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal"><option value="">Toutes</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></FilterField>
        <FilterField label="Âge min."><input name="ageMin" type="number" min="15" max="60" defaultValue={readQuery(query.ageMin)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal" /></FilterField>
        <FilterField label="Âge max."><input name="ageMax" type="number" min="15" max="60" defaultValue={readQuery(query.ageMax)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal" /></FilterField>
        <FilterField label="Statistique"><select name="stat" defaultValue={readQuery(query.stat) || "overall"} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal"><option value="overall">Moyenne</option>{RIDER_RATING_AXES.map((axis) => <option key={axis.key} value={axis.key}>{axis.label}</option>)}</select></FilterField>
        <FilterField label="Seuil estimé"><input name="statMin" type="number" min="0" max="100" defaultValue={readQuery(query.statMin)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal" /></FilterField>
        <div className="flex gap-3 xl:col-span-6"><button className="rounded-xl bg-[#0B302B] px-5 py-3 text-xs font-black uppercase tracking-wider text-white">Filtrer</button><Link href="/jeu/transferts?onglet=libres" className="rounded-xl border border-[#315B3E]/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-[#315B3E]">Réinitialiser</Link></div>
      </form>
      {riders.length > 0 ? (
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {riders.map((rider) => <FreeAgentCard key={rider.id} rider={rider} currency={currency} returnPath={returnPath} />)}
        </div>
      ) : <EmptyState title="Aucun agent libre pour ces filtres" detail="Élargissez les critères ou attendez la prochaine clôture d’enchère sans offre." />}
    </section>
  );
}

function AuctionCard({ listing, jersey, teamId, availableBudget, returnPath }: { listing: TransferMarketListing; jersey: RiderJerseyAppearance; teamId: string; availableBudget: number; returnPath: string }) {
  const canBid = listing.status === "open" && listing.sellerTeamId !== teamId;
  const bidCapacity = availableBudget + (listing.isOwnTeamLeading ? listing.currentBid ?? 0 : 0);
  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)]">
      <div className="relative flex items-center gap-5 bg-[linear-gradient(135deg,#0B302B,#176951)] p-5 text-white">
        <RiderAvatar profileKey={listing.rider.avatarProfileKey} seed={listing.rider.avatarSeed} riderId={listing.rider.id} age={listing.rider.age} jersey={jersey} label={`Portrait de ${listing.rider.firstName} ${listing.rider.lastName}`} className="h-24 w-24 border-2 border-white/20" />
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9BE0BC]">{listing.sellerTeamName ?? "Sélection quotidienne"}</p><Link href={`/jeu/coureurs/${listing.rider.id}`} target="_blank" className="mt-1 block truncate text-xl font-black hover:text-[#F2C94C]">{listing.rider.firstName} {listing.rider.lastName} ↗</Link><p className="mt-2 text-xs font-bold text-[#D6DFD2]"><span className={`fi fi-${listing.rider.countryCode.toLowerCase()} mr-2 rounded-sm`} />{listing.rider.countryName} · {listing.rider.age} ans</p></div>
      </div>
      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-2"><span className="rounded-full bg-[#DDF3E7] px-3 py-1 text-xs font-black text-[#176951]">{listing.rider.profileLabel}</span></div>
        <TransferScoutingReportPanel report={listing.rider.scoutingReport} compact />
        <div className="mt-4 grid grid-cols-2 gap-3"><PriceBlock label={listing.currentBid ? "Offre en tête" : "Prix d’appel"} value={formatMoney(listing.currentBid ?? listing.minimumBid, listing.currency)} /><PriceBlock label="Salaire hebdo." value={formatMoney(listing.salaryPerWeek, listing.currency)} /></div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[#F2C94C]/25 bg-[#FFF9DF] px-4 py-3 text-xs font-black text-[#705B00]"><span>{listing.status === "open" ? "Temps restant" : listing.status === "settled" ? "Attribué" : "Clôturé sans offre"}</span>{listing.status === "open" ? <TransferCountdown closesAt={listing.closesAt} /> : <span>{listing.leaderTeamName ?? "Agent libre"}</span>}</div>
        {listing.isOwnTeamLeading ? <p className="mt-3 rounded-xl bg-[#DDF3E7] px-4 py-3 text-xs font-black text-[#176951]">Votre équipe mène l’enchère avec {formatMoney(listing.ownBid ?? 0, listing.currency)}.</p> : null}
        {canBid ? (
          <form action={placeTransferBidAction} className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <input type="hidden" name="listingId" value={listing.id} /><input type="hidden" name="returnPath" value={returnPath} />
            <label className="text-[10px] font-black uppercase tracking-wider text-[#48665F]">Votre offre<input name="amount" type="number" min={listing.minimumNextBid} step="100" required defaultValue={listing.minimumNextBid} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 px-3 text-sm font-black" /></label>
            <div className="self-end"><TransferSubmitButton pendingLabel="Offre…" disabled={bidCapacity < listing.minimumNextBid + listing.salaryPerSeason}>Enchérir</TransferSubmitButton></div>
          </form>
        ) : listing.sellerTeamId === teamId && listing.status === "open" ? <p className="mt-4 text-center text-xs font-black uppercase tracking-wider text-[#60756E]">Votre mise en vente</p> : null}
        <p className="mt-3 text-[10px] font-semibold leading-4 text-[#60756E]">Contrat proposé : saison actuelle + saison suivante · salaire saisonnier {formatMoney(listing.salaryPerSeason, listing.currency)}</p>
      </div>
    </article>
  );
}

function FreeAgentCard({ rider, currency, returnPath }: { rider: TransferMarketRider; currency: string; returnPath: string }) {
  const seasonSalary = rider.salaryPerSeason;
  return (
    <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_42px_rgba(19,60,46,0.09)]">
      <div className="flex items-center gap-4"><RiderAvatar profileKey={rider.avatarProfileKey} seed={rider.avatarSeed} riderId={rider.id} age={rider.age} jersey={FREE_AGENT_RIDER_JERSEY} label={`Portrait de ${rider.firstName} ${rider.lastName}`} className="h-20 w-20" /><div className="min-w-0 flex-1"><Link href={`/jeu/coureurs/${rider.id}`} target="_blank" className="block truncate text-lg font-black text-[#183F37] hover:text-[#176951]">{rider.firstName} {rider.lastName} ↗</Link><p className="mt-1 text-xs font-bold text-[#60756E]"><span className={`fi fi-${rider.countryCode.toLowerCase()} mr-2 rounded-sm`} />{rider.countryName} · {rider.age} ans</p><div className="mt-2 flex gap-2"><span className="rounded-full bg-[#EAF2FA] px-2.5 py-1 text-[10px] font-black text-[#256390]">{rider.profileLabel}</span></div></div></div>
      <div className="mt-4"><TransferScoutingReportPanel report={rider.scoutingReport} compact /></div>
      <div className="mt-4 rounded-xl bg-[#F3F8F6] px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-[#60756E]">Demande salariale</p><p className="mt-1 text-lg font-black text-[#183F37]">{formatMoney(Math.round(seasonSalary / 4), currency)} / semaine</p><p className="text-[10px] font-bold text-[#60756E]">{formatMoney(seasonSalary, currency)} par saison</p></div>
      <form action={signFreeAgentAction} className="mt-4 flex"><input type="hidden" name="riderId" value={rider.id} /><input type="hidden" name="returnPath" value={returnPath} /><TransferSubmitButton pendingLabel="Signature…" tone="green">Signer 2 saisons</TransferSubmitButton></form>
    </article>
  );
}

function SectionHeading({ eyebrow, title, detail, compact = false }: { eyebrow: string; title: string; detail: string; compact?: boolean }) { return <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">{eyebrow}</p><h2 className={`${compact ? "text-2xl" : "text-3xl"} mt-2 font-black text-[#183F37]`}>{title}</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">{detail}</p></div>; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="mt-5 rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white/70 px-6 py-14 text-center"><h3 className="text-xl font-black text-[#183F37]">{title}</h3><p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">{detail}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-24"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">{label}</p><p className="mt-1 text-base font-black text-[#F2C94C]">{value}</p></div>; }
function Notice({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) { return <div className={tone === "success" ? "mt-5 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900" : "mt-5 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900"}>{children}</div>; }
function PriceBlock({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#315B3E]/10 bg-[#F7FAF8] px-4 py-3"><p className="text-[9px] font-black uppercase tracking-wider text-[#60756E]">{label}</p><p className="mt-1 text-base font-black text-[#183F37]">{value}</p></div>; }
function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-[10px] font-black uppercase tracking-wider text-[#48665F]">{label}{children}</label>; }

function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${value}T12:00:00Z`)); }
function readQuery(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function readTab(value: string): TransferTab { return value === "directeurs" || value === "libres" ? value : "quotidiennes"; }
function readNumber(value: string | string[] | undefined) { const parsed = Number(readQuery(value)); return Number.isFinite(parsed) && readQuery(value) !== "" ? parsed : undefined; }
function readFilters(query: Record<string, string | string[] | undefined>): TransferMarketFilters { const rating = readQuery(query.stat); return { search: readQuery(query.recherche), country: readQuery(query.pays), minimumAge: readNumber(query.ageMin), maximumAge: readNumber(query.ageMax), rating: rating === "overall" || RIDER_RATING_AXES.some((axis) => axis.key === rating) ? rating as RiderRatingKey | "overall" : undefined, minimumRating: readNumber(query.statMin) }; }
