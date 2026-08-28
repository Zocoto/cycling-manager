import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import {
  createDirectorListingAction,
  placeTransferBidAction,
  respondToDirectTransferOfferAction,
  signFreeAgentAction,
} from "@/app/jeu/transferts/actions";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import {
  GameSectionTabLink,
  GameSectionTabs,
} from "@/components/game/game-section-tabs";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { TransferCountdown } from "@/components/game/transfer-countdown";
import { TransferScoutingReportPanel } from "@/components/game/transfer-scouting-report";
import { TransferSubmitButton } from "@/components/game/transfer-submit-button";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  getNationalChampionPalette,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import { buildTransferMarketReturnPath } from "@/lib/game/filtered-page-paths";
import { RIDER_RATING_AXES, type RiderRatingKey } from "@/lib/game/rider-profile";
import {
  isTransferRiderProfileFilter,
  TRANSFER_RIDER_PROFILE_FILTERS,
  type TransferContractFilter,
} from "@/lib/game/transfer-market";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import {
  TRANSFER_DAILY_TUTORIAL_ROUTE,
  TRANSFER_DIRECTORS_TUTORIAL_ROUTE,
  TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE,
  TRANSFER_TUTORIAL_KEY,
} from "@/lib/tutorial/transfers";
import { getGameHeaderData } from "@/services/game-header-data";
import { getTeamAmateurIdentity } from "@/services/team-amateur-identity";
import { getActiveTeamSponsorIdentity } from "@/services/team-sponsor-identity";
import {
  getTransferMarketOverview,
  type DirectTransferOffer,
  type TransferMarketFilters,
  type TransferMarketListing,
  type TransferRiderSearchResult,
  type TransferRosterCandidate,
} from "@/services/transfer-market";
import type { Sponsor } from "@/types/sponsor";

export const metadata: Metadata = {
  title: "Bureau des transferts",
  description: "Enchérissez, vendez et signez les coureurs de votre équipe.",
};

type TransferTab = "quotidiennes" | "directeurs" | "libres" | "offres";

type TransferPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const tabs: Array<{ id: TransferTab; label: string; detail: string }> = [
  { id: "quotidiennes", label: "Enchères quotidiennes", detail: "Nouveaux talents · clôture initiale à 18 h" },
  { id: "directeurs", label: "Enchères des DS", detail: "Ventes entre équipes · 24 h minimum" },
  { id: "libres", label: "Recherche de coureurs", detail: "Libres ou sous contrat" },
  { id: "offres", label: "Offres reçues", detail: "Négociations directes · historique" },
];

export default async function TransferMarketPage({ searchParams }: TransferPageProps) {
  const query = await searchParams;
  const tab = readTab(readQuery(query.onglet));
  const filters = readFilters(query);
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authenticationError } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) redirect("/connexion");

  const [headerData, overview, transferTutorialProgress] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getTransferMarketOverview(supabase, user.id, filters, {
      includeDirectOffers: tab === "offres",
      includeRiderSearch: tab === "libres",
      includeRoster: tab === "directeurs",
    }),
    getAuthenticatedTutorialProgress(supabase, TRANSFER_TUTORIAL_KEY).catch(
      (error: unknown) => {
        console.error(
          "Impossible de reprendre le didacticiel des transferts :",
          error,
        );
        return null;
      },
    ),
  ]);
  if (!overview) redirect("/jeu");

  const visualTeamIds = [
    ...new Set(
      [...overview.dailyListings, ...overview.directorListings]
        .flatMap((listing) => [listing.sellerTeamId, listing.leaderTeamId])
        .filter((teamId): teamId is string => Boolean(teamId))
        .concat(overview.teamId),
    ),
  ];
  const jerseys = new Map<string, RiderJerseyAppearance>();
  const sponsors = new Map<string, Sponsor>();
  await Promise.all(visualTeamIds.map(async (teamId) => {
    const [amateur, sponsor] = await Promise.all([
      getTeamAmateurIdentity(teamId).catch(() => null),
      getActiveTeamSponsorIdentity(teamId).catch(() => null),
    ]);
    if (sponsor) sponsors.set(teamId, sponsor.sponsor);
    jerseys.set(
      teamId,
      sponsor
        ? createSponsoredRiderJersey({
            colors: sponsor.sponsor.colors,
            style: sponsor.selectedJersey.style,
            imagePath: sponsor.selectedJersey.imagePath,
          })
        : amateur
          ? createAmateurRiderJersey(amateur.jersey)
          : FREE_AGENT_RIDER_JERSEY
    );
  }));

  const success = readQuery(query.succes);
  const errorMessage = readQuery(query.erreur);
  const currentPath = buildTransferMarketReturnPath(tab, filters);
  const currentTransferTutorialRoute =
    tab === "directeurs"
      ? TRANSFER_DIRECTORS_TUTORIAL_ROUTE
      : tab === "libres"
        ? TRANSFER_FREE_AGENTS_TUTORIAL_ROUTE
        : TRANSFER_DAILY_TUTORIAL_ROUTE;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {transferTutorialProgress?.status === "in_progress" &&
      transferTutorialProgress.current_route === currentTransferTutorialRoute &&
      transferTutorialProgress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={TRANSFER_TUTORIAL_KEY}
          currentStepKey={transferTutorialProgress.current_step_key}
        />
      ) : null}
      <GameHeader simulatorEmail={user.email} displayName={headerData.displayName} sponsor={headerData.teamSponsorIdentity?.sponsor ?? null} maxWidth="wide" />
      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <header
          data-tutorial-id="transfer-overview"
          className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10"
        >
          <div aria-hidden="true" className="absolute -right-12 -top-20 h-72 w-72 rounded-full border-[42px] border-white/5" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">Recruter · vendre · construire</p>
              <div className="mt-3 flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                  Bureau des transferts
                </h1>
                <TutorialLaunchButton
                  tutorialKey={TRANSFER_TUTORIAL_KEY}
                  iconOnly
                />
              </div>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Recrutez à partir d’un rapport de scouting incomplet. Votre
                Data Room affine automatiquement les notes estimées et réduit
                les zones d’ombre.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <Metric label="Trésorerie" value={formatMoney(overview.cashBalance, overview.currency)} />
              <Metric label="Budget projeté" value={formatMoney(overview.projectedBudget, overview.currency)} />
              <Metric label="Réservé" value={formatMoney(overview.reservedBudget, overview.currency)} />
              <Metric label="Disponible" value={formatMoney(overview.availableBudget, overview.currency)} />
              <Metric label="Data Room" value={`Niveau ${overview.dataRoomLevel}/3`} />
              <Metric label="Effectif" value={`${overview.rosterSize} / ${overview.rosterLimit}`} />
            </div>
          </div>
        </header>

        {success ? <Notice tone="success">{success}</Notice> : null}
        {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

        <GameSectionTabs
          ariaLabel="Rubriques du marché des transferts"
          columns={4}
          className="mt-7"
          data-tutorial-id="transfer-tabs"
        >
          {tabs.map((entry) => (
            <GameSectionTabLink
              key={entry.id}
              href={`/jeu/transferts?onglet=${entry.id}`}
              active={tab === entry.id}
              label={entry.label}
              description={entry.detail}
            />
          ))}
        </GameSectionTabs>

        {tab === "quotidiennes" ? (
          <DailyAuctions listings={overview.dailyListings} overview={overview} sponsors={sponsors} returnPath={currentPath} />
        ) : tab === "directeurs" ? (
          <DirectorAuctions listings={overview.directorListings} roster={overview.roster} overview={overview} jerseys={jerseys} sponsors={sponsors} returnPath={currentPath} />
        ) : tab === "libres" ? (
          <RiderSearch
            riders={overview.riderSearchResults}
            countries={overview.countries}
            query={query}
            filters={filters}
            currency={overview.currency}
            currentTeamId={overview.teamId}
            rosterSize={overview.rosterSize}
            rosterLimit={overview.rosterLimit}
            rosterIsFull={overview.rosterIsFull}
            total={overview.riderSearchTotal}
            page={overview.riderSearchPage}
            pageSize={overview.riderSearchPageSize}
            returnPath={currentPath}
          />
        ) : (
          <ReceivedDirectOffers offers={overview.directOffers} returnPath={currentPath} />
        )}
      </section>
    </main>
  );
}

function DailyAuctions({ listings, overview, sponsors, returnPath }: {
  listings: TransferMarketListing[];
  overview: NonNullable<Awaited<ReturnType<typeof getTransferMarketOverview>>>;
  sponsors: Map<string, Sponsor>;
  returnPath: string;
}) {
  return (
    <section data-tutorial-id="transfer-daily-overview" className="mt-7">
      <SectionHeading eyebrow={`Marché du ${formatDate(overview.marketDate)}`} title="La sélection du jour" detail="Les enchères ouvrent à 9 h avec une clôture initiale à 18 h. Toute offre placée dans les 10 dernières minutes repousse la fin de 30 minutes. Les rapports sont partiels et un talent rare peut parfois apparaître." />
      {overview.nationalDayFeatures.length > 0 ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {overview.nationalDayFeatures.map((feature) => (
            <NationalDayAuctionBanner
              key={feature.countryCode}
              feature={feature}
            />
          ))}
        </div>
      ) : null}
      <div data-tutorial-id="transfer-daily-listings">
        {listings.length > 0 ? (
          <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => <AuctionCard key={listing.id} listing={listing} jersey={FREE_AGENT_RIDER_JERSEY} leaderSponsor={listing.leaderTeamId ? sponsors.get(listing.leaderTeamId) ?? null : null} teamId={overview.teamId} availableBudget={overview.availableBudget} rosterIsFull={overview.rosterIsFull} returnPath={returnPath} />)}
          </div>
        ) : (
          <EmptyState title="Le marché quotidien n’est pas encore ouvert" detail="Revenez à partir de 9 h : de nouveaux coureurs apparaîtront automatiquement." />
        )}
      </div>
    </section>
  );
}

function DirectorAuctions({ listings, roster, overview, jerseys, sponsors, returnPath }: {
  listings: TransferMarketListing[];
  roster: TransferRosterCandidate[];
  overview: NonNullable<Awaited<ReturnType<typeof getTransferMarketOverview>>>;
  jerseys: Map<string, RiderJerseyAppearance>;
  sponsors: Map<string, Sponsor>;
  returnPath: string;
}) {
  const sellable = roster.filter((candidate) => candidate.canList);
  return (
    <section className="mt-7 space-y-7">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <article
          data-tutorial-id="transfer-director-selling"
          className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8"
        >
          <SectionHeading eyebrow="Votre effectif" title="Mettre un coureur aux enchères" detail="Fixez le prix d’appel. La vente reste ouverte au moins 24 heures ; une offre dans les 10 dernières minutes repousse la fin de 30 minutes." compact />
          {sellable.length > 0 ? (
            <form action={createDirectorListingAction} className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
              <input type="hidden" name="returnPath" value={returnPath} />
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

      <div data-tutorial-id="transfer-director-market">
        <SectionHeading eyebrow="Marché interéquipes" title="Enchères ouvertes par les DS" detail="Le vendeur conserve le coureur jusqu’à la clôture. Une offre dans les 10 dernières minutes prolonge automatiquement l’enchère de 30 minutes, autant de fois que nécessaire." />
        {listings.length > 0 ? <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => <AuctionCard key={listing.id} listing={listing} jersey={listing.sellerTeamId ? jerseys.get(listing.sellerTeamId) ?? FREE_AGENT_RIDER_JERSEY : FREE_AGENT_RIDER_JERSEY} leaderSponsor={listing.leaderTeamId ? sponsors.get(listing.leaderTeamId) ?? null : null} teamId={overview.teamId} availableBudget={overview.availableBudget} rosterIsFull={overview.rosterIsFull} returnPath={returnPath} />)}</div> : <EmptyState title="Aucune vente entre DS" detail="Dès qu’un Directeur Sportif publiera un coureur, son enchère apparaîtra ici pendant au moins 24 heures." />}
      </div>
    </section>
  );
}

function ReceivedDirectOffers({ offers, returnPath }: {
  offers: DirectTransferOffer[];
  returnPath: string;
}) {
  const pendingOffers = offers.filter((offer) => offer.status === "pending");
  const history = offers.filter((offer) => offer.status !== "pending");

  return (
    <section className="mt-7 space-y-8">
      <div>
        <SectionHeading
          eyebrow="Décisions en attente"
          title="Offres reçues"
          detail="Chaque réponse est définitive. Une acceptation crédite immédiatement votre équipe, libère le coureur de son contrat actuel et l’engage avec l’acheteur jusqu’à la fin de la saison."
        />
        {pendingOffers.length > 0 ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {pendingOffers.map((offer) => (
              <article
                key={offer.id}
                className="overflow-hidden rounded-[2rem] border border-[#F2C94C]/30 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)]"
              >
                <header className="bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-5 text-white">
                  <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9BE0BC]">
                    Proposition de {offer.buyerTeamName}
                  </p>
                  <Link
                    href={`/jeu/coureurs/${offer.rider.id}`}
                    className="mt-2 block text-2xl font-black transition hover:text-[#F2C94C]"
                  >
                    {offer.rider.firstName} {offer.rider.lastName} ↗
                  </Link>
                  <p className="mt-1 text-xs font-bold text-[#D6DFD2]">
                    Reçue le {formatDateTime(offer.createdAt)}
                  </p>
                </header>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-3">
                    <PriceBlock
                      label="Indemnité versée"
                      value={formatMoney(offer.amount, offer.currency)}
                    />
                    <PriceBlock
                      label="Salaire du futur contrat"
                      value={formatMoney(offer.salaryPerSeason, offer.currency)}
                    />
                  </div>
                  <p className="mt-4 text-xs font-semibold leading-5 text-[#60756E]">
                    En acceptant, votre équipe reçoit l’indemnité et l’acheteur
                    prend immédiatement en charge le coureur. Les équipements,
                    inscriptions et stages sont nettoyés automatiquement.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <form action={respondToDirectTransferOfferAction}>
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="riderId" value={offer.rider.id} />
                      <input type="hidden" name="decision" value="accept" />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <TransferSubmitButton pendingLabel="Acceptation…" tone="green">
                        Accepter l’offre
                      </TransferSubmitButton>
                    </form>
                    <form action={respondToDirectTransferOfferAction}>
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="riderId" value={offer.rider.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <TransferSubmitButton pendingLabel="Refus…" tone="dark">
                        Refuser
                      </TransferSubmitButton>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Aucune réponse à donner"
            detail="Les futures propositions reçues depuis une fiche coureur apparaîtront ici et dans votre boîte mail."
          />
        )}
      </div>

      <div>
        <SectionHeading
          eyebrow="Archive de la saison"
          title="Historique des offres"
          detail="Les propositions acceptées, refusées ou devenues caduques restent consultables pendant toute la saison."
        />
        {history.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_12px_35px_rgba(19,60,46,0.07)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-[#F3F8F6] text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                  <tr>
                    <th className="px-5 py-3">Coureur</th>
                    <th className="px-4 py-3">Équipe demandeuse</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Décision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#315B3E]/10">
                  {history.map((offer) => {
                    const status = getDirectOfferStatus(offer.status);
                    return (
                      <tr key={offer.id} className="hover:bg-[#F7FBF9]">
                        <td className="px-5 py-4">
                          <Link
                            href={`/jeu/coureurs/${offer.rider.id}`}
                            className="font-black text-[#183F37] hover:text-[#176951]"
                          >
                            {offer.rider.firstName} {offer.rider.lastName}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-[#48665F]">
                          {offer.buyerTeamName}
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-black text-[#183F37]">
                          {formatMoney(offer.amount, offer.currency)}
                        </td>
                        <td className="px-4 py-4 text-xs font-bold text-[#60756E]">
                          {formatDateTime(offer.respondedAt ?? offer.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Aucun historique pour le moment"
            detail="Les réponses de la saison seront archivées ici."
          />
        )}
      </div>
    </section>
  );
}

function RiderSearch({ riders, countries, query, filters, currency, currentTeamId, rosterSize, rosterLimit, rosterIsFull, total, page, pageSize, returnPath }: {
  riders: TransferRiderSearchResult[];
  countries: Array<{ name: string; code: string }>;
  query: Record<string, string | string[] | undefined>;
  filters: TransferMarketFilters;
  currency: string;
  currentTeamId: string;
  rosterSize: number;
  rosterLimit: number;
  rosterIsFull: boolean;
  total: number;
  page: number;
  pageSize: number;
  returnPath: string;
}) {
  const contractStatus = filters.contractStatus ?? "free";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstResult = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, total);

  return (
    <section data-tutorial-id="transfer-free-agents-overview" className="mt-7">
      <SectionHeading
        eyebrow="Base de recrutement"
        title="Recherche de coureurs"
        detail="Explorez les coureurs libres ou sous contrat sans charger toute la base. Les résultats sont filtrés et paginés côté serveur, tandis que leur niveau reste soumis à la qualité de votre rapport de scouting."
      />
      {rosterIsFull ? (
        <p className="mt-5 rounded-2xl border border-[#C94F4F]/25 bg-[#FFF0EE] px-5 py-4 text-sm font-bold text-[#8A2F2F]">
          Effectif complet : {rosterSize} / {rosterLimit} coureurs. La recherche reste disponible, mais libérez une place avant tout recrutement.
        </p>
      ) : null}
      <form
        data-tutorial-id="transfer-free-agent-filters"
        className="mt-5 grid gap-3 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_35px_rgba(19,60,46,0.07)] md:grid-cols-2 xl:grid-cols-7"
      >
        <input type="hidden" name="onglet" value="libres" />
        <FilterField label="Contrat"><select name="contrat" defaultValue={contractStatus} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal"><option value="free">Libre</option><option value="contracted">Sous contrat</option></select></FilterField>
        <FilterField label="Profil"><select name="profil" defaultValue={readQuery(query.profil)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal"><option value="">Tous les profils</option>{TRANSFER_RIDER_PROFILE_FILTERS.map((profile) => <option key={profile} value={profile}>{profile}</option>)}</select></FilterField>
        <FilterField label="Nationalité"><select name="pays" defaultValue={readQuery(query.pays)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal"><option value="">Toutes</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></FilterField>
        <FilterField label="Âge min."><input name="ageMin" type="number" min="15" max="60" defaultValue={readQuery(query.ageMin)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal" /></FilterField>
        <FilterField label="Âge max."><input name="ageMax" type="number" min="15" max="60" defaultValue={readQuery(query.ageMax)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal" /></FilterField>
        <FilterField label="Statistique"><select name="stat" defaultValue={readQuery(query.stat) || "overall"} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal"><option value="overall">Moyenne</option>{RIDER_RATING_AXES.map((axis) => <option key={axis.key} value={axis.key}>{axis.label}</option>)}</select></FilterField>
        <FilterField label="Seuil estimé"><input name="statMin" type="number" min="0" max="100" defaultValue={readQuery(query.statMin)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal" /></FilterField>
        <div className="flex gap-3 xl:col-span-7"><button className="rounded-xl bg-[#0B302B] px-5 py-3 text-xs font-black uppercase tracking-wider text-white">Rechercher</button><Link href="/jeu/transferts?onglet=libres" className="rounded-xl border border-[#315B3E]/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-[#315B3E]">Réinitialiser</Link></div>
      </form>
      <div data-tutorial-id="transfer-free-agent-listings">
        {riders.length > 0 ? (
          <>
            <p className="mt-5 text-xs font-black uppercase tracking-wider text-[#60756E]">
              {firstResult}–{lastResult} sur {total} coureur{total > 1 ? "s" : ""}
            </p>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {riders.map((rider) => <RiderSearchCard key={rider.id} rider={rider} currency={currency} currentTeamId={currentTeamId} rosterIsFull={rosterIsFull} returnPath={returnPath} />)}
            </div>
            {totalPages > 1 ? (
              <nav aria-label="Pagination des coureurs" className="mt-6 flex items-center justify-center gap-3">
                {page > 1 ? <Link href={buildTransferMarketReturnPath("libres", { ...filters, page: page - 1 })} className="rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-[#315B3E]">Précédent</Link> : <span className="rounded-xl border border-[#315B3E]/10 bg-white/50 px-4 py-3 text-xs font-black uppercase tracking-wider text-[#9AA9A4]">Précédent</span>}
                <span className="text-xs font-black text-[#48665F]">Page {page} / {totalPages}</span>
                {page < totalPages ? <Link href={buildTransferMarketReturnPath("libres", { ...filters, page: page + 1 })} className="rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-[#315B3E]">Suivant</Link> : <span className="rounded-xl border border-[#315B3E]/10 bg-white/50 px-4 py-3 text-xs font-black uppercase tracking-wider text-[#9AA9A4]">Suivant</span>}
              </nav>
            ) : null}
          </>
        ) : <EmptyState title={contractStatus === "free" ? "Aucun coureur libre pour ces filtres" : "Aucun coureur sous contrat pour ces filtres"} detail="Élargissez les critères de recherche pour afficher davantage de profils." />}
      </div>
    </section>
  );
}

function AuctionCard({ listing, jersey, leaderSponsor, teamId, availableBudget, rosterIsFull, returnPath }: { listing: TransferMarketListing; jersey: RiderJerseyAppearance; leaderSponsor: Sponsor | null; teamId: string; availableBudget: number; rosterIsFull: boolean; returnPath: string }) {
  const canBid = listing.status === "open" && listing.sellerTeamId !== teamId && !rosterIsFull;
  const bidCapacity = availableBudget + (listing.isOwnTeamLeading ? listing.currentBid ?? 0 : 0);
  return (
    <article id={`enchere-${listing.id}`} className="scroll-mt-6 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)] target:ring-4 target:ring-[#F2C94C]/60">
      <div className="relative flex items-center gap-5 bg-[linear-gradient(135deg,#0B302B,#176951)] p-5 text-white">
        <RiderAvatar profileKey={listing.rider.avatarProfileKey} seed={listing.rider.avatarSeed} riderId={listing.rider.id} age={listing.rider.age} jersey={jersey} label={`Portrait de ${listing.rider.firstName} ${listing.rider.lastName}`} className="h-24 w-24 border-2 border-white/20" />
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9BE0BC]">{listing.sellerTeamName ?? "Sélection quotidienne"}</p><Link href={`/jeu/coureurs/${listing.rider.id}`} target="_blank" className="mt-1 block truncate text-xl font-black hover:text-[#F2C94C]">{listing.rider.firstName} {listing.rider.lastName} ↗</Link><p className="mt-2 text-xs font-bold text-[#D6DFD2]"><span className={`fi fi-${listing.rider.countryCode.toLowerCase()} mr-2 rounded-sm`} />{listing.rider.countryName} · {listing.rider.age} ans</p></div>
      </div>
      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-2"><span className="rounded-full bg-[#DDF3E7] px-3 py-1 text-xs font-black text-[#176951]">{listing.rider.profileLabel}</span>{listing.isNationalDayBonus ? <span className="rounded-full bg-[#FFF3C4] px-3 py-1 text-xs font-black text-[#755A00]">Sélection fête nationale</span> : null}</div>
        <TransferScoutingReportPanel report={listing.rider.scoutingReport} compact />
        <div className="mt-4 grid grid-cols-2 gap-3"><PriceBlock label={listing.currentBid ? "Offre en tête" : "Prix d’appel"} value={formatMoney(listing.currentBid ?? listing.minimumBid, listing.currency)} /><PriceBlock label="Salaire hebdo." value={formatMoney(listing.salaryPerWeek, listing.currency)} /></div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[#F2C94C]/25 bg-[#FFF9DF] px-4 py-3 text-xs font-black text-[#705B00]"><span>{listing.status === "open" ? "Temps restant" : listing.status === "settled" ? "Attribué" : "Clôturé sans offre"}</span>{listing.status === "open" ? <TransferCountdown closesAt={listing.closesAt} /> : <span>{listing.leaderTeamName ?? "Agent libre"}</span>}</div>
        {listing.currentBid !== null && listing.leaderTeamName ? <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#315B3E]/12 bg-[#F3F8F6] px-4 py-3">{leaderSponsor ? <SponsorLogoMark src={leaderSponsor.logoPath} alt={`Logo de ${leaderSponsor.name}`} sponsorName={leaderSponsor.name} primaryColor={leaderSponsor.colors.primary} backgroundColor={leaderSponsor.colors.background} textColor={leaderSponsor.colors.text} className="h-10 w-14 rounded-lg p-1.5" /> : <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0B302B] text-xs font-black text-white">{getTeamInitials(listing.leaderTeamName)}</span>}<div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-wider text-[#60756E]">Meilleure enchère</p><p className="truncate text-sm font-black text-[#183F37]">{listing.leaderTeamName}</p></div><p className="shrink-0 text-sm font-black text-[#176951]">{formatMoney(listing.currentBid, listing.currency)}</p></div> : null}
        {listing.isOwnTeamLeading ? <p className="mt-3 rounded-xl bg-[#DDF3E7] px-4 py-3 text-xs font-black text-[#176951]">Votre équipe mène l’enchère avec {formatMoney(listing.ownBid ?? 0, listing.currency)}.</p> : null}
        {canBid ? (
          <form action={placeTransferBidAction} className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <input type="hidden" name="listingId" value={listing.id} /><input type="hidden" name="returnPath" value={returnPath} />
            <label className="text-[10px] font-black uppercase tracking-wider text-[#48665F]">Votre offre<input name="amount" type="number" min={listing.minimumNextBid} step="100" required defaultValue={listing.minimumNextBid} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 px-3 text-sm font-black" /></label>
            <div className="self-end"><TransferSubmitButton pendingLabel="Offre…" disabled={bidCapacity < listing.minimumNextBid}>Enchérir</TransferSubmitButton></div>
          </form>
        ) : listing.sellerTeamId === teamId && listing.status === "open" ? <p className="mt-4 text-center text-xs font-black uppercase tracking-wider text-[#60756E]">Votre mise en vente</p> : rosterIsFull && listing.status === "open" ? <p className="mt-4 rounded-xl bg-[#FFF0EE] px-4 py-3 text-center text-xs font-black text-[#8A2F2F]">Effectif complet · 35 coureurs maximum</p> : null}
        <p className="mt-3 text-[10px] font-semibold leading-4 text-[#60756E]">Contrat proposé : saison actuelle + saison suivante · salaire saisonnier {formatMoney(listing.salaryPerSeason, listing.currency)}</p>
      </div>
    </article>
  );
}

function NationalDayAuctionBanner({
  feature,
}: {
  feature: NonNullable<
    NonNullable<Awaited<ReturnType<typeof getTransferMarketOverview>>>["nationalDayFeatures"][number]
  >;
}) {
  const palette = getNationalChampionPalette(feature.countryCode);
  const flagClassName = `fi fi-${feature.countryCode.toLowerCase()} rounded-sm shadow-sm`;

  return (
    <aside
      className="overflow-hidden rounded-2xl border-2 px-5 py-4 text-white shadow-[0_14px_36px_rgba(7,26,23,0.16)] sm:px-7"
      style={{
        borderColor: palette.accent,
        background: `linear-gradient(110deg, #071A17 0%, ${palette.secondary} 50%, #071A17 100%)`,
      }}
    >
      <div className="flex items-center justify-center gap-3 text-center sm:gap-5">
        <span aria-hidden="true" className={`${flagClassName} text-2xl sm:text-3xl`} />
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
            Sélection spéciale du jour
          </p>
          <h3 className="mt-1 text-lg font-black sm:text-xl">
            Fête nationale · {feature.countryName}
          </h3>
          <p className="mt-1 text-xs font-bold leading-5 text-white/85 sm:text-sm">
            {feature.bonusRiderCount} coureurs de {feature.countryName}, aux profils légèrement plus prometteurs, rejoignent les enchères.
          </p>
        </div>
        <span aria-hidden="true" className={`${flagClassName} text-2xl sm:text-3xl`} />
      </div>
    </aside>
  );
}

function RiderSearchCard({ rider, currency, currentTeamId, rosterIsFull, returnPath }: { rider: TransferRiderSearchResult; currency: string; currentTeamId: string; rosterIsFull: boolean; returnPath: string }) {
  const seasonSalary = rider.salaryPerSeason;
  const isFreeAgent = rider.contractStatus === "free";
  const isOwnRider = rider.teamId === currentTeamId;
  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_42px_rgba(19,60,46,0.09)]">
      <div className="flex items-center gap-4"><RiderAvatar profileKey={rider.avatarProfileKey} seed={rider.avatarSeed} riderId={rider.id} age={rider.age} jersey={FREE_AGENT_RIDER_JERSEY} label={`Portrait de ${rider.firstName} ${rider.lastName}`} className="h-20 w-20" /><div className="min-w-0 flex-1"><Link href={`/jeu/coureurs/${rider.id}`} target="_blank" className="block truncate text-lg font-black text-[#183F37] hover:text-[#176951]">{rider.firstName} {rider.lastName} ↗</Link><p className="mt-1 text-xs font-bold text-[#60756E]"><span className={`fi fi-${rider.countryCode.toLowerCase()} mr-2 rounded-sm`} />{rider.countryName} · {rider.age} ans</p><div className="mt-2 flex gap-2"><span className="rounded-full bg-[#EAF2FA] px-2.5 py-1 text-[10px] font-black text-[#256390]">{rider.profileLabel}</span></div></div></div>
      <div className={`mt-4 rounded-xl px-4 py-3 ${isFreeAgent ? "bg-[#ECF8F1] text-[#176951]" : "bg-[#FFF8DD] text-[#705B00]"}`}><p className="text-[10px] font-black uppercase tracking-wider">{isFreeAgent ? "Libre" : isOwnRider ? "Votre effectif" : "Sous contrat"}</p><p className="mt-1 truncate text-sm font-black">{isFreeAgent ? "Disponible immédiatement" : (rider.teamName ?? "Équipe actuelle")}</p></div>
      <div className="mt-4"><TransferScoutingReportPanel report={rider.scoutingReport} compact /></div>
      <div className="mt-4 rounded-xl bg-[#F3F8F6] px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-[#60756E]">{isFreeAgent ? "Demande salariale" : "Salaire estimé après transfert"}</p><p className="mt-1 text-lg font-black text-[#183F37]">{formatMoney(Math.round(seasonSalary / 4), currency)} / semaine</p><p className="text-[10px] font-bold text-[#60756E]">{formatMoney(seasonSalary, currency)} par saison</p></div>
      {isFreeAgent ? (
        rosterIsFull ? <p className="mt-4 rounded-xl bg-[#FFF0EE] px-4 py-3 text-center text-xs font-black text-[#8A2F2F]">Effectif complet · signature impossible</p> : <form action={signFreeAgentAction} className="mt-4 flex"><input type="hidden" name="riderId" value={rider.id} /><input type="hidden" name="returnPath" value={returnPath} /><TransferSubmitButton pendingLabel="Signature…" tone="green">Signer 2 saisons</TransferSubmitButton></form>
      ) : (
        <Link href={`/jeu/coureurs/${rider.id}`} className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-[#0B302B] px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#176951]">
          {isOwnRider || rosterIsFull ? "Voir la fiche" : "Voir et faire une offre"}
        </Link>
      )}
    </article>
  );
}

function SectionHeading({ eyebrow, title, detail, compact = false }: { eyebrow: string; title: string; detail: string; compact?: boolean }) { return <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">{eyebrow}</p><h2 className={`${compact ? "text-2xl" : "text-3xl"} mt-2 font-black text-[#183F37]`}>{title}</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">{detail}</p></div>; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="mt-5 rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white/70 px-6 py-14 text-center"><h3 className="text-xl font-black text-[#183F37]">{title}</h3><p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">{detail}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-24"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">{label}</p><p className="mt-1 text-base font-black text-[#F2C94C]">{value}</p></div>; }
function Notice({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) { return <div className={tone === "success" ? "mt-5 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900" : "mt-5 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900"}>{children}</div>; }
function PriceBlock({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#315B3E]/10 bg-[#F7FAF8] px-4 py-3"><p className="text-[9px] font-black uppercase tracking-wider text-[#60756E]">{label}</p><p className="mt-1 text-base font-black text-[#183F37]">{value}</p></div>; }
function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-[10px] font-black uppercase tracking-wider text-[#48665F]">{label}{children}</label>; }

function getTeamInitials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "ÉQ"; }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${value}T12:00:00Z`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(value)); }
function getDirectOfferStatus(status: DirectTransferOffer["status"]) {
  if (status === "accepted") return { label: "Acceptée", className: "bg-[#DDF3E7] text-[#176951]" };
  if (status === "rejected") return { label: "Refusée", className: "bg-[#FFF0EE] text-[#8A2F2F]" };
  if (status === "cancelled") return { label: "Caduque", className: "bg-[#EEF1EF] text-[#60756E]" };
  return { label: "En attente", className: "bg-[#FFF4D6] text-[#8A6516]" };
}
function readQuery(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function readTab(value: string): TransferTab { return value === "directeurs" || value === "libres" || value === "offres" ? value : "quotidiennes"; }
function readNumber(value: string | string[] | undefined) { const parsed = Number(readQuery(value)); return Number.isFinite(parsed) && readQuery(value) !== "" ? parsed : undefined; }
function readContractStatus(value: string | string[] | undefined): TransferContractFilter { return readQuery(value) === "contracted" ? "contracted" : "free"; }
function readSearchPage(value: string | string[] | undefined) { const parsed = Number(readQuery(value)); return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 1; }
function readFilters(query: Record<string, string | string[] | undefined>): TransferMarketFilters {
  const profile = readQuery(query.profil);
  const rating = readQuery(query.stat);

  return {
    contractStatus: readContractStatus(query.contrat),
    profile: isTransferRiderProfileFilter(profile) ? profile : undefined,
    country: readQuery(query.pays),
    minimumAge: readNumber(query.ageMin),
    maximumAge: readNumber(query.ageMax),
    rating:
      rating === "overall" ||
      RIDER_RATING_AXES.some((axis) => axis.key === rating)
        ? (rating as RiderRatingKey | "overall")
        : undefined,
    minimumRating: readNumber(query.statMin),
    page: readSearchPage(query.page),
  };
}
