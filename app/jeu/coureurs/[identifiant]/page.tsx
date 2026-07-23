import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { RiderConditionGauges } from "@/components/game/rider-condition-gauges";
import { RiderEquipmentLoadout } from "@/components/game/rider-equipment-loadout";
import { RiderSeasonPlanning } from "@/components/game/rider-season-planning";
import { PotentialStars } from "@/components/game/potential-stars";
import { RankingBadge } from "@/components/game/ranking-badge";
import { RiderStatsRadar } from "@/components/game/rider-stats-radar";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { TeamJerseyPreview } from "@/components/game/team-jersey-preview";
import { TeamDivisionBadge } from "@/components/game/team-division-badge";
import { SpecialAbilityMedallion } from "@/components/game/special-ability-medallion";
import { TransferScoutingReportPanel } from "@/components/game/transfer-scouting-report";
import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import {
  SPECIAL_ABILITY_CATALOG,
  type RiderSpecialAbility,
} from "@/lib/game/special-abilities";
import {
  formatTrainingProgressMilli,
  TRAINING_DOMAIN_LABELS,
  isTrainingDomain,
} from "@/lib/game/training";
import {
  createAmateurRiderJersey,
  createNationalChampionRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  getNationalChampionPalette,
} from "@/lib/rider-jersey";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPublicRiderProfile } from "@/services/public-rider-profile";
import { getCurrentTeamRiderSeasonPlanning } from "@/services/rider-season-planning";
import { getTeamAmateurIdentity } from "@/services/team-amateur-identity";
import { getRiderEquipmentManagement } from "@/services/team-equipment";
import { getRiderTransferManagement } from "@/services/transfer-market";
import { getActiveTeamSponsorIdentity } from "@/services/team-sponsor-identity";
import { renewRiderContractAction, signFreeAgentAction } from "@/app/jeu/transferts/actions";
import { TransferSubmitButton } from "@/components/game/transfer-submit-button";
import { getRiderRankingEntry } from "@/services/uci-rankings";
import { formatScoutedPotentialValue } from "@/lib/game/transfer-scouting";

export const metadata: Metadata = {
  title: "Fiche coureur",
  description:
    "Consultez l’identité, les caractéristiques et la carrière d’un coureur dans Cyclostratège.",
};

type RiderProfilePageProps = {
  params: Promise<{
    identifiant: string;
  }>;
  searchParams: Promise<{
    equipement?: string;
    succes?: string;
    erreur?: string;
  }>;
};

const FREE_AGENT_JERSEY: AmateurJerseyConfig = {
  pattern: "classic",
  primaryColor: FREE_AGENT_RIDER_JERSEY.primaryColor,
  secondaryColor: FREE_AGENT_RIDER_JERSEY.secondaryColor,
  accentColor: FREE_AGENT_RIDER_JERSEY.accentColor,
};

export default async function RiderProfilePage({ params, searchParams }: RiderProfilePageProps) {
  const { identifiant } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [profile, headerData, riderRanking] = await Promise.all([
    getPublicRiderProfile({
      riderIdentifier: identifiant,
      viewerAuthUserId: user.id,
    }),
    getGameHeaderData(supabase, user.id),
    getRiderRankingEntry(identifiant),
  ]);

  if (!profile) {
    notFound();
  }

  const [equipmentManagement, transferManagement, riderPlanning] =
    await Promise.all([
      profile.canManage
        ? getRiderEquipmentManagement(user.id, profile.id)
        : Promise.resolve(null),
      getRiderTransferManagement(user.id, profile.id),
      profile.canManage
        ? getCurrentTeamRiderSeasonPlanning({
            authUserId: user.id,
            riderId: profile.id,
          })
        : Promise.resolve(null),
    ]);

  const [amateurIdentity, sponsorIdentity] = profile.currentTeam
    ? await Promise.all([
        getTeamAmateurIdentity(profile.currentTeam.id),
        getActiveTeamSponsorIdentity(profile.currentTeam.id),
      ])
    : [null, null];
  const activeNationalTitle =
    profile.nationalTitles.find(
      (title) => title.isActive && title.type === "road"
    ) ??
    profile.nationalTitles.find(
      (title) => title.isActive && title.type === "time_trial"
    ) ??
    null;
  const riderJersey = activeNationalTitle
    ? createNationalChampionRiderJersey({
        countryCode: activeNationalTitle.countryCode,
        championshipType: activeNationalTitle.type,
      })
    : sponsorIdentity
      ? createSponsoredRiderJersey({
          colors: sponsorIdentity.sponsor.colors,
          style: sponsorIdentity.selectedJersey.style,
        })
      : amateurIdentity
        ? createAmateurRiderJersey(amateurIdentity.jersey)
        : FREE_AGENT_RIDER_JERSEY;
  const nationalPalette = activeNationalTitle
    ? getNationalChampionPalette(activeNationalTitle.countryCode)
    : null;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const countryHref = `/jeu/nations/${profile.country.code.toLowerCase()}`;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {query.equipement ? (
          <p className="mb-5 rounded-2xl border border-[#42B99A]/25 bg-[#DFF5EA] px-5 py-4 text-sm font-bold text-[#176951]">
            Le changement d’équipement a été enregistré.
          </p>
        ) : null}
        {query.succes ? (
          <p className="mb-5 rounded-2xl border border-[#42B99A]/25 bg-[#DFF5EA] px-5 py-4 text-sm font-bold text-[#176951]">
            {query.succes}
          </p>
        ) : null}
        {query.erreur ? (
          <p className="mb-5 rounded-2xl border border-[#C94F4F]/25 bg-[#FFF0EE] px-5 py-4 text-sm font-bold text-[#8A2F2F]">
            {query.erreur}
          </p>
        ) : null}
        <p className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#60756E]">
          <span aria-hidden="true">↗</span>
          Fiche ouverte indépendamment de votre espace de jeu
        </p>

        <header
          className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-[linear-gradient(135deg,#071A17,#176951)] text-[#FFFDF4] shadow-[0_25px_70px_rgba(19,60,46,0.2)]"
          style={
            nationalPalette
              ? {
                  background: `linear-gradient(110deg, rgba(7,26,23,.94), rgba(7,26,23,.72)), linear-gradient(135deg, ${nationalPalette.primary}, ${nationalPalette.secondary} 52%, ${nationalPalette.accent})`,
                }
              : undefined
          }
        >
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[auto_minmax(0,1fr)_280px] lg:items-center">
            <div className="relative w-fit">
              <RiderAvatar
                profileKey={profile.avatarProfileKey}
                seed={profile.avatarSeed}
                riderId={profile.id}
                age={profile.age ?? 25}
                jersey={riderJersey}
                label={`Portrait généré de ${fullName}`}
                className="h-48 w-48 rounded-[2rem] border-white/25 shadow-2xl sm:h-56 sm:w-56"
              />
              {activeNationalTitle ? (
                <span className="absolute -bottom-3 -right-3 flex items-center gap-2 rounded-xl border-2 border-white/70 bg-[#071A17] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-xl">
                  <span
                    className={`fi fi-${activeNationalTitle.countryCode.toLowerCase()} rounded-sm`}
                    role="img"
                    aria-label={`Drapeau ${activeNationalTitle.countryName}`}
                  />
                  CN {activeNationalTitle.type === "road" ? "Route" : "CLM"}
                </span>
              ) : null}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9BE0BC]">
                Coureur cycliste
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                {fullName}
              </h1>
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.age ? (
                  <IdentityBadge>{profile.age} ans</IdentityBadge>
                ) : null}
                <Link
                  href={countryHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
                >
                  <CountryFlag code={profile.country.code} name={profile.country.name} />
                  {profile.country.name}
                  <span aria-hidden="true">↗</span>
                </Link>
                <IdentityBadge>
                  {profile.activeSeason?.name ?? "Hors saison"}
                </IdentityBadge>
                {profile.nationalTitles
                  .filter((title) => title.isActive)
                  .map((title) => (
                    <IdentityBadge key={`${title.type}-${title.countryCode}`}>
                      <span
                        className={`fi fi-${title.countryCode.toLowerCase()} mr-2 rounded-sm`}
                        role="img"
                        aria-label={`Drapeau ${title.countryName}`}
                      />
                      Champion national {title.type === "road" ? "route" : "CLM"}
                    </IdentityBadge>
                  ))}
                {profile.potentialSteps !== null ? (
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5">
                    <PotentialStars
                      potentialSteps={profile.potentialSteps}
                      dark
                      compact
                    />
                  </span>
                ) : profile.scoutingReport ? (
                  <IdentityBadge>
                    Potentiel {formatScoutedPotentialValue(profile.scoutingReport.potential)}
                  </IdentityBadge>
                ) : null}
              </div>
              <p className="mt-5 max-w-xl text-sm font-semibold leading-6 text-[#D6DFD2]">
                {activeNationalTitle
                  ? `Champion de ${activeNationalTitle.countryName} en titre : son identité nationale remplace le thème habituel pendant toute la durée de son règne.`
                  : profile.scoutingReport
                  ? "Portrait permanent et rapport de scouting partiel : le recrutement conserve une part d’incertitude."
                  : "Portrait permanent, caractéristiques sportives de la saison et parcours professionnel du coureur."}
              </p>
            </div>

            <div className="space-y-3">
              <RankingBadge
                rank={riderRanking?.rank ?? null}
                points={riderRanking?.points ?? 0}
                label="Classement individuel"
                href="/jeu/classements?vue=individuel"
                dark
              />
              <CurrentTeamCard
                team={profile.currentTeam}
                amateurJersey={amateurIdentity?.jersey ?? FREE_AGENT_JERSEY}
                amateurTeamName={amateurIdentity?.amateurName ?? null}
                sponsorIdentity={sponsorIdentity}
              />
            </div>
          </div>
        </header>

        <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
          <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
              Profil sportif
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">
              Caractéristiques de la saison
            </h2>
            {profile.ratings ? (
              <div className="mt-5">
                <RiderStatsRadar ratings={profile.ratings} />
              </div>
            ) : profile.scoutingReport ? (
              <div className="mt-5">
                <TransferScoutingReportPanel report={profile.scoutingReport} />
              </div>
            ) : (
              <EmptyBlock message="Aucune caractéristique n’est disponible pour ce coureur." />
            )}
          </section>

          <aside className="space-y-5">
            {profile.medical ? (
              <RiderMedicalCard medical={profile.medical} />
            ) : null}
            <RiderConditionGauges
              form={profile.condition.form}
              dayNumber={profile.condition.dayNumber}
            />
            {profile.trainingReport ? (
              <PrivateTrainingReportCard report={profile.trainingReport} />
            ) : (
              <LockedTrainingCard canManage={profile.canManage} />
            )}
            <SpecialAbilitiesCard abilities={profile.specialAbilities} />
          </aside>
        </div>

        {profile.canManage && riderPlanning ? (
          <div className="mt-7">
            <RiderSeasonPlanning
              planning={riderPlanning}
              jersey={riderJersey}
              variant="rider"
            />
          </div>
        ) : null}

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
          <CareerHistory history={profile.history} />
          {profile.privateContract ? (
            <div className="space-y-5">
              <PrivateContractCard contract={profile.privateContract} />
              {transferManagement ? (
                <ContractRenewalCard
                  riderId={profile.id}
                  management={transferManagement}
                />
              ) : null}
            </div>
          ) : transferManagement?.isFreeAgent ? (
            <FreeAgentSigningCard
              riderId={profile.id}
              management={transferManagement}
            />
          ) : (
            <CareerSummaryCard
              teamName={profile.currentTeam?.displayName ?? "Agent libre"}
              seasonsCount={new Set(profile.history.map((entry) => entry.seasonId)).size}
            />
          )}
        </div>

        <div className="mt-7">
          <RiderEquipmentLoadout
            riderId={profile.id}
            equipment={profile.equipment}
            canManage={profile.canManage}
            management={equipmentManagement}
          />
        </div>
      </section>
    </main>
  );
}

function RiderMedicalCard({
  medical,
}: {
  medical: NonNullable<
    NonNullable<Awaited<ReturnType<typeof getPublicRiderProfile>>>["medical"]
  >;
}) {
  const remainingHours = medical.remainingHours;
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;

  return (
    <section className="rounded-2xl border border-[#D75D5D]/25 bg-[#FFF0EE] p-5 shadow-[0_12px_34px_rgba(111,38,38,0.08)]">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#D94F4F] text-white">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
            <path d="M7.5 2.5h5v5h5v5h-5v5h-5v-5h-5v-5h5v-5Z" />
          </svg>
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#B54242]">
            Indisponibilité médicale
          </p>
          <h2 className="mt-1 text-lg font-black text-[#702E2E]">
            {medical.label}
          </h2>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#D75D5D]/15 pt-4 text-sm">
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wider text-[#9D6767]">
            Temps restant
          </dt>
          <dd className="mt-1 font-black text-[#702E2E]">
            {days > 0 ? `${days} j ${hours} h` : `${hours} h`}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wider text-[#9D6767]">
            Reprise prévue
          </dt>
          <dd className="mt-1 font-black text-[#702E2E]">
            {new Intl.DateTimeFormat("fr-FR", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Paris",
            }).format(new Date(medical.expectedRecoveryAt))}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function FreeAgentSigningCard({
  riderId,
  management,
}: {
  riderId: string;
  management: NonNullable<Awaited<ReturnType<typeof getRiderTransferManagement>>>;
}) {
  return (
    <article className="rounded-[2rem] border border-[#42B99A]/25 bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(7,26,23,0.16)] sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9BE0BC]">
        Agent libre
      </p>
      <h2 className="mt-2 text-2xl font-black text-white">Signer un contrat</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#BFD1C6]">
        Aucune indemnité de transfert. Le contrat couvre la saison actuelle et la suivante.
      </p>
      {management.freeAgentSalary !== null ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#9BE0BC]">Demande salariale</p>
          <p className="mt-1 text-xl font-black text-[#F2C94C]">{formatMoney(management.freeAgentWeeklySalary ?? 0, "EUR")} / semaine</p>
          <p className="mt-1 text-xs font-bold text-[#BFD1C6]">{formatMoney(management.freeAgentSalary, "EUR")} par saison</p>
        </div>
      ) : null}
      {management.canSignFreeAgent ? (
        <form action={signFreeAgentAction} className="mt-5">
          <input type="hidden" name="riderId" value={riderId} />
          <input type="hidden" name="returnPath" value={`/jeu/coureurs/${riderId}`} />
          <TransferSubmitButton pendingLabel="Signature…">Signer pour 2 saisons</TransferSubmitButton>
        </form>
      ) : (
        <p className="mt-5 rounded-xl bg-[#F2C94C]/10 px-4 py-3 text-xs font-bold text-[#FFE596]">
          {management.freeAgentBlockedReason ?? "Ce coureur n’est pas disponible à la signature."}
        </p>
      )}
    </article>
  );
}

function ContractRenewalCard({
  riderId,
  management,
}: {
  riderId: string;
  management: NonNullable<Awaited<ReturnType<typeof getRiderTransferManagement>>>;
}) {
  if (!management.canRenew && !management.hasPlannedRenewal) return null;
  return (
    <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">Avenir contractuel</p>
      <h2 className="mt-2 text-xl font-black text-[#183F37]">Renouvellement</h2>
      {management.hasPlannedRenewal ? (
        <p className="mt-4 rounded-xl bg-[#DDF3E7] px-4 py-3 text-sm font-bold text-[#176951]">Le contrat de la saison suivante est déjà signé.</p>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
            {management.renewalSalary === 0
              ? "Sa moyenne est inférieure à 60 : il accepte de rester amateur sans salaire."
              : `Sa demande sera de ${formatMoney(management.renewalSalary ?? 0, "EUR")} pour la prochaine saison.`}
          </p>
          <form action={renewRiderContractAction} className="mt-4">
            <input type="hidden" name="riderId" value={riderId} />
            <input type="hidden" name="returnPath" value={`/jeu/coureurs/${riderId}`} />
            <TransferSubmitButton pendingLabel="Renouvellement…" tone="green">Renouveler</TransferSubmitButton>
          </form>
        </>
      )}
    </article>
  );
}

function CurrentTeamCard({
  team,
  amateurJersey,
  amateurTeamName,
  sponsorIdentity,
}: {
  team: {
    id: string;
    displayName: string;
    shortName: string | null;
    divisionCode: string;
    divisionName: string;
  } | null;
  amateurJersey: AmateurJerseyConfig;
  amateurTeamName: string | null;
  sponsorIdentity: Awaited<ReturnType<typeof getActiveTeamSponsorIdentity>>;
}) {
  const content = (
    <>
      <TeamJerseyPreview
        amateurJersey={amateurJersey}
        amateurTeamName={amateurTeamName}
        sponsor={sponsorIdentity?.sponsor ?? null}
        sponsorJersey={sponsorIdentity?.selectedJersey ?? null}
        className="h-28 w-24 shrink-0 drop-shadow-xl"
      />
      <span className="min-w-0">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#9BE0BC]">
          Équipe actuelle
        </span>
        <span className="mt-2 block text-lg font-black text-white">
          {team?.displayName ?? "Agent libre"}
        </span>
        {team ? (
          <span className="mt-2 block">
            <TeamDivisionBadge division={team.divisionCode} dark compact />
          </span>
        ) : null}
        {sponsorIdentity ? (
          <span className="mt-2 flex items-center gap-2">
            <SponsorLogoMark
              src={sponsorIdentity.sponsor.logoPath}
              alt={`Logo de ${sponsorIdentity.sponsor.name}`}
              sponsorName={sponsorIdentity.sponsor.name}
              primaryColor={sponsorIdentity.sponsor.colors.primary}
              backgroundColor={sponsorIdentity.sponsor.colors.background}
              textColor={sponsorIdentity.sponsor.colors.text}
              className="h-8 w-12 rounded-lg p-1"
            />
            <span className="text-xs font-semibold text-[#BFD1C6]">
              {sponsorIdentity.sponsor.name}
            </span>
          </span>
        ) : (
          <span className="mt-1 block text-xs font-semibold text-[#BFD1C6]">
            {team ? "Structure amateur" : "Maillot neutre"}
          </span>
        )}
      </span>
    </>
  );

  return team ? (
    <Link
      href={`/jeu/equipes/${team.id}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 transition hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
    >
      {content}
      <span className="ml-auto self-start text-sm font-black text-[#9BE0BC]" aria-hidden="true">
        ↗
      </span>
    </Link>
  ) : (
    <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4">
      <AmateurTeamJersey
        jersey={FREE_AGENT_JERSEY}
        teamName="Agent libre"
        className="h-28 w-24 shrink-0 opacity-80 drop-shadow-xl"
      />
      <span>
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#9BE0BC]">
          Équipe actuelle
        </span>
        <span className="mt-2 block text-lg font-black">Agent libre</span>
        <span className="mt-1 block text-xs font-semibold text-[#BFD1C6]">Maillot neutre</span>
      </span>
    </div>
  );
}

function CareerHistory({
  history,
}: {
  history: Array<{
    seasonId: string;
    seasonName: string;
    gameYear: number;
    teamId: string;
    teamName: string;
    victories: number | null;
    points: number | null;
    uciRank: number | null;
    nationalTitles: Array<{
      type: "road" | "time_trial";
      countryName: string;
      countryCode: string;
    }>;
  }>;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
      <div className="px-6 py-6 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
          Carrière
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#183F37]">
          Historique des clubs
        </h2>
      </div>

      {history.length > 0 ? (
        <div className="overflow-x-auto border-t border-[#315B3E]/10">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="bg-[#F3F8F5] text-xs font-extrabold uppercase tracking-[0.12em] text-[#60756E]">
              <tr>
                <th className="px-6 py-4">Saison</th>
                <th className="px-5 py-4">Équipe</th>
                <th className="px-4 py-4 text-center">Victoires</th>
                <th className="px-4 py-4 text-center">Points</th>
                <th className="px-6 py-4 text-center">Classement UCI</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr
                  key={`${entry.seasonId}-${entry.teamId}`}
                  className="border-t border-[#315B3E]/10 text-sm"
                >
                  <td className="px-6 py-4 font-black text-[#183F37]">
                    <span className="flex items-center gap-2">
                      {entry.seasonName}
                      {entry.nationalTitles.map((title) => (
                        <span
                          key={`${title.type}-${title.countryCode}`}
                          className={`fi fi-${title.countryCode.toLowerCase()} rounded-sm shadow-sm`}
                          role="img"
                          aria-label={`Champion national ${title.type === "road" ? "sur route" : "contre-la-montre"} de ${title.countryName}`}
                          title={`Champion national ${title.type === "road" ? "sur route" : "contre-la-montre"} · ${title.countryName}`}
                        />
                      ))}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/jeu/equipes/${entry.teamId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-black text-[#176951] underline decoration-[#176951]/25 underline-offset-4 transition hover:text-[#278B70]"
                    >
                      {entry.teamName} <span aria-hidden="true">↗</span>
                    </Link>
                  </td>
                  <HistoryValue value={entry.victories} />
                  <HistoryValue value={entry.points} />
                  <HistoryValue value={entry.uciRank} prefix="#" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-t border-[#315B3E]/10 px-6 pb-6 sm:px-8">
          <EmptyBlock message="Aucune saison en club n’est encore enregistrée." />
        </div>
      )}
    </section>
  );
}

function HistoryValue({ value, prefix = "" }: { value: number | null; prefix?: string }) {
  return (
    <td className="px-4 py-4 text-center font-black text-[#48665F]">
      {value === null ? "—" : `${prefix}${value}`}
    </td>
  );
}

function PrivateContractCard({
  contract,
}: {
  contract: NonNullable<Awaited<ReturnType<typeof getPublicRiderProfile>>>["privateContract"] & {};
}) {
  if (!contract) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-[#D6A93D]/30 bg-[#FFF8DD] p-6 shadow-[0_16px_45px_rgba(111,82,13,0.08)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8A6B16]">
            Données privées
          </p>
          <h2 className="mt-2 text-xl font-black text-[#3F3518]">Contrat</h2>
        </div>
        <span className="rounded-full bg-[#F2C94C]/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#6E5715]">
          Votre coureur
        </span>
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <ContractLine
          label="Salaire annuel"
          value={formatMoney(contract.salaryPerSeason, contract.currencyCode)}
        />
        <ContractLine label="Début" value={contract.startSeasonName} />
        <ContractLine label="Échéance" value={contract.endSeasonName} />
        <ContractLine label="Statut" value="Actif" />
      </dl>

      <div className="mt-6 grid gap-2">
        <FutureActionButton label="Renouveler le contrat" />
        <FutureActionButton label="Organiser un stage" />
      </div>
      <p className="mt-3 text-[11px] font-semibold leading-5 text-[#7E7043]">
        Ces interactions seront activées avec les mécaniques de contrats et d’entraînement.
      </p>
    </section>
  );
}

function CareerSummaryCard({
  teamName,
  seasonsCount,
}: {
  teamName: string;
  seasonsCount: number;
}) {
  return (
    <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
        En bref
      </p>
      <h2 className="mt-2 text-xl font-black text-[#183F37]">Situation sportive</h2>
      <dl className="mt-5 space-y-3 text-sm">
        <ContractLine label="Équipe actuelle" value={teamName} />
        <ContractLine
          label="Saisons en club"
          value={`${seasonsCount} saison${seasonsCount > 1 ? "s" : ""}`}
        />
      </dl>
      <p className="mt-5 rounded-xl border border-[#315B3E]/10 bg-[#F3F8F5] px-4 py-3 text-xs font-semibold leading-5 text-[#60756E]">
        Les informations contractuelles sont réservées au Directeur Sportif de l’équipe actuelle.
      </p>
    </section>
  );
}

function PrivateTrainingReportCard({
  report,
}: {
  report: NonNullable<
    Awaited<ReturnType<typeof getPublicRiderProfile>>
  >["trainingReport"] & {};
}) {
  if (!report) return null;
  const domain = isTrainingDomain(report.domain)
    ? TRAINING_DOMAIN_LABELS[report.domain]
    : "Programme général";
  const changes = Object.entries(report.ratingChanges).filter(
    ([, value]) => value !== 0,
  );
  const gains = Object.entries(report.progressMilli).filter(
    ([, value]) => value > 0,
  );
  const isCompleted = report.status === "completed";

  return (
    <section className="rounded-2xl border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            Compte rendu privé
          </p>
          <h2 className="mt-1 font-black text-[#183F37]">
            Rapport d’entraînement J{report.dayNumber}
          </h2>
        </div>
        <span className="rounded-full bg-[#FFF2C7] px-3 py-1 text-xs font-black text-[#7A5B09]">
          {report.intensity}%
        </span>
      </div>
      <p className="mt-4 text-sm font-bold text-[#48665F]">
        {isCompleted ? (
          <>
            {domain} · Forme {report.formDelta > 0 ? "+" : ""}
            {report.formDelta}
          </>
        ) : (
          "Pas d’entraînement pendant la séance de 8 h"
        )}
      </p>
      <p className="mt-3 rounded-xl bg-[#F3F8F5] px-4 py-3 text-xs font-bold leading-5 text-[#60756E]">
        {isCompleted
          ? gains.length > 0
            ? gains
                .map(
                  ([stat, value]) =>
                    `${TRAINING_STAT_LABELS[stat] ?? stat} +${formatTrainingProgressMilli(value)}`,
                )
                .join(" · ")
            : "Aucun gain de statistique pendant cette séance."
          : "Aucun gain d’entraînement n’a été crédité."}
      </p>
      {changes.length > 0 ? (
        <p className="mt-2 text-xs font-bold leading-5 text-[#60756E]">
          Notes entières :{" "}
          {changes
            .map(
              ([stat, value]) =>
                `${TRAINING_STAT_LABELS[stat] ?? stat} ${value > 0 ? "+" : ""}${value}`,
            )
            .join(" · ")}
        </p>
      ) : null}
      <Link
        href="/jeu/entrainement"
        className="mt-4 inline-flex text-xs font-black uppercase tracking-wider text-[#176951]"
      >
        Ouvrir les entraînements →
      </Link>
    </section>
  );
}

const TRAINING_STAT_LABELS: Record<string, string> = {
  mountain: "MON",
  hills: "VAL",
  flat: "PLA",
  time_trial: "CLM",
  cobbles: "PAV",
  sprint: "SPR",
  acceleration: "ACC",
  downhill: "DES",
  endurance: "END",
  resistance: "RES",
  recovery: "REC",
  breakaway: "BAR",
  prologue: "PRO",
};

function LockedTrainingCard({ canManage }: { canManage: boolean }) {
  return (
    <section className="rounded-2xl border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.07)]">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF5F3] text-lg" aria-hidden="true">
          🔒
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            Compte rendu
          </p>
          <h2 className="mt-1 font-black text-[#183F37]">Entraînement</h2>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-[#60756E]">
        {canManage
          ? "Aucun rapport n’est encore disponible pour ce coureur. La première séance sera réglée à 8 h."
          : "Le compte rendu d’entraînement est réservé au Directeur Sportif de l’équipe du coureur."}
      </p>
      {canManage ? (
        <Link
          href="/jeu/entrainement"
          className="mt-4 inline-flex text-xs font-black uppercase tracking-wider text-[#176951]"
        >
          Configurer son programme →
        </Link>
      ) : null}
    </section>
  );
}

function SpecialAbilitiesCard({
  abilities,
}: {
  abilities: RiderSpecialAbility[];
}) {
  const unlockedAbilities = new Set(abilities);

  return (
    <section className="rounded-2xl border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.07)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
        Capacités spéciales
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {SPECIAL_ABILITY_CATALOG.map((ability) => (
          <SpecialAbilityMedallion
            key={ability.code}
            ability={ability}
            unlocked={unlockedAbilities.has(ability.code)}
          />
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-[#60756E]">
        {abilities.length > 0
          ? `${abilities.length} capacité${abilities.length > 1 ? "s" : ""} débloquée${abilities.length > 1 ? "s" : ""}. Survolez ou sélectionnez un médaillon pour voir son effet.`
          : "Les capacités connues restent grisées tant que le coureur ne les a pas débloquées. Survolez ou sélectionnez un médaillon pour voir son effet."}
      </p>
    </section>
  );
}

function ContractLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-current/10 pb-3 last:border-none last:pb-0">
      <dt className="font-semibold opacity-65">{label}</dt>
      <dd className="text-right font-black">{value}</dd>
    </div>
  );
}

function FutureActionButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="min-h-11 rounded-xl border border-[#8A6B16]/20 bg-white/60 px-4 text-sm font-black text-[#7E7043] opacity-65 disabled:cursor-not-allowed"
    >
      {label} · bientôt
    </button>
  );
}

function IdentityBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black">
      {children}
    </span>
  );
}

function CountryFlag({ code, name }: { code: string; name: string }) {
  return (
    <span
      className={`fi fi-${code.toLowerCase()} shrink-0 rounded-sm`}
      role="img"
      aria-label={`Drapeau : ${name}`}
    />
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <p className="mt-5 rounded-xl border border-dashed border-[#315B3E]/25 bg-[#F3F8F5] px-5 py-5 text-sm font-semibold leading-6 text-[#60756E]">
      {message}
    </p>
  );
}

function formatMoney(value: number, currencyCode: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}
