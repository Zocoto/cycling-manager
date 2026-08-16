import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { ProfileBackButton } from "@/components/game/profile-back-button";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import { ArchivedRiderProfileView } from "@/components/game/archived-rider-profile-view";
import { NaturalizationCard } from "@/components/game/naturalization-card";
import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { ContinentalChampionJersey } from "@/components/game/continental-champion-jersey";
import {
  ContinentalMark,
  ContinentalTitleBadge,
} from "@/components/game/continental-title-badge";
import { NationalChampionJersey } from "@/components/game/national-champion-jersey";
import { WorldChampionJersey } from "@/components/game/world-champion-jersey";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { RiderConditionGauges } from "@/components/game/rider-condition-gauges";
import { RiderClimateProfileCard } from "@/components/game/rider-climate-profile-card";
import { RiderEquipmentLoadout } from "@/components/game/rider-equipment-loadout";
import { RiderSeasonPlanning } from "@/components/game/rider-season-planning";
import { PotentialStars } from "@/components/game/potential-stars";
import { RankingBadge } from "@/components/game/ranking-badge";
import { RiderStatsRadar } from "@/components/game/rider-stats-radar";
import { DeferredRiderProgression } from "@/components/game/deferred-rider-progression";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { TeamJerseyPreview } from "@/components/game/team-jersey-preview";
import { TeamDivisionBadge } from "@/components/game/team-division-badge";
import { SpecialAbilityMedallion } from "@/components/game/special-ability-medallion";
import { TransferScoutingReportPanel } from "@/components/game/transfer-scouting-report";
import { SeasonPerformancesPopover } from "@/components/game/season-performances-popover";
import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import {
  combineEquipmentEffects,
  getEquipmentRatingBonusTotals,
} from "@/lib/game/equipment";
import { getRiderExperience } from "@/lib/game/rider-experience";
import { getRiderClimateProfile } from "@/lib/game/race-weather";
import { shouldDisplayNaturalizationCard } from "@/lib/game/naturalization";
import {
  SPECIAL_ABILITY_CATALOG,
  type RiderSpecialAbility,
} from "@/lib/game/special-abilities";
import {
  createAmateurRiderJersey,
  CONTINENTAL_CHAMPION_PALETTES,
  createContinentalChampionRiderJersey,
  createNationalChampionRiderJersey,
  createSponsoredRiderJersey,
  createWorldChampionRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  getNationalChampionPalette,
} from "@/lib/rider-jersey";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getPublicRiderProfile,
  type PublicRiderProfile,
} from "@/services/public-rider-profile";
import { getCurrentTeamRiderSeasonPlanning } from "@/services/rider-season-planning";
import { getProfessionalRiderNaturalizationEligibility } from "@/services/rider-naturalization";
import { getTeamAmateurIdentity } from "@/services/team-amateur-identity";
import { getRiderEquipmentManagement } from "@/services/team-equipment";
import { getRiderTransferManagement } from "@/services/transfer-market";
import { getActiveTeamSponsorIdentity } from "@/services/team-sponsor-identity";
import {
  dismissRiderAction,
  renewRiderContractAction,
  signFreeAgentAction,
  submitDirectTransferOfferAction,
} from "@/app/jeu/transferts/actions";
import { TransferSubmitButton } from "@/components/game/transfer-submit-button";
import { naturalizeProfessionalRiderAction } from "@/app/jeu/coureurs/actions";
import { getRiderRankingEntry } from "@/services/uci-rankings";
import { formatScoutedPotentialValue } from "@/lib/game/transfer-scouting";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import { ROSTER_TUTORIAL_KEY } from "@/lib/tutorial/roster";

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

const riderExperienceScoreFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

export default async function RiderProfilePage({
  params,
  searchParams,
}: RiderProfilePageProps) {
  const { identifiant } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [profile, headerData, riderRanking, rosterTutorialProgress] =
    await Promise.all([
      getPublicRiderProfile({
        riderIdentifier: identifiant,
        viewerAuthUserId: user.id,
      }),
      getGameHeaderData(supabase, user.id),
      getRiderRankingEntry(identifiant),
      getAuthenticatedTutorialProgress(supabase, ROSTER_TUTORIAL_KEY).catch(
        (error: unknown) => {
          console.error(
            "Impossible de reprendre le didacticiel de l’effectif :",
            error,
          );
          return null;
        },
      ),
    ]);

  if (!profile) {
    notFound();
  }

  if (profile.archive) {
    return (
      <ArchivedRiderProfileView
        profile={profile}
        headerData={headerData}
        simulatorEmail={user.email}
      />
    );
  }

  const [
    equipmentManagement,
    transferManagement,
    riderPlanning,
    naturalizationEligibility,
  ] = await Promise.all([
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
    profile.canManage
      ? getProfessionalRiderNaturalizationEligibility({
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
  const activeWorldTitles = profile.worldTitles.filter(
    (title) => title.isActive,
  );
  const activeContinentalTitles = profile.continentalTitles.filter(
    (title) => title.isActive,
  );
  const activeNationalTitles = profile.nationalTitles.filter(
    (title) => title.isActive,
  );

  const activeWorldTitle =
    activeWorldTitles.find(
      (title) => title.isActive && title.type === "road",
    ) ??
    activeWorldTitles.find(
      (title) => title.isActive && title.type === "time_trial",
    ) ??
    null;
  const activeContinentalTitle =
    activeContinentalTitles.find((title) => title.type === "road") ??
    activeContinentalTitles.find((title) => title.type === "time_trial") ??
    null;
  const activeNationalTitle =
    activeNationalTitles.find(
      (title) => title.isActive && title.type === "road",
    ) ??
    activeNationalTitles.find(
      (title) => title.isActive && title.type === "time_trial",
    ) ??
    null;
  const riderJersey = activeWorldTitle
    ? createWorldChampionRiderJersey({
        championshipType: activeWorldTitle.type,
      })
    : activeContinentalTitle
      ? createContinentalChampionRiderJersey({
          continentCode: activeContinentalTitle.continentCode,
          championshipType: activeContinentalTitle.type,
        })
      : activeNationalTitle
        ? createNationalChampionRiderJersey({
            countryCode: activeNationalTitle.countryCode,
            championshipType: activeNationalTitle.type,
          })
        : sponsorIdentity
          ? createSponsoredRiderJersey({
              colors: sponsorIdentity.sponsor.colors,
              style: sponsorIdentity.selectedJersey.style,
              imagePath: sponsorIdentity.selectedJersey.imagePath,
            })
          : amateurIdentity
            ? createAmateurRiderJersey(amateurIdentity.jersey)
            : FREE_AGENT_RIDER_JERSEY;
  const nationalPalette =
    !activeWorldTitle && activeContinentalTitle
      ? {
          ...CONTINENTAL_CHAMPION_PALETTES[
            activeContinentalTitle.continentCode
          ],
          dominantColors: [
            CONTINENTAL_CHAMPION_PALETTES[activeContinentalTitle.continentCode]
              .primary,
            CONTINENTAL_CHAMPION_PALETTES[activeContinentalTitle.continentCode]
              .secondary,
            CONTINENTAL_CHAMPION_PALETTES[activeContinentalTitle.continentCode]
              .accent,
          ],
        }
      : !activeWorldTitle && activeNationalTitle
        ? getNationalChampionPalette(activeNationalTitle.countryCode)
        : null;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const equipmentRatingBonuses = getEquipmentRatingBonusTotals(
    combineEquipmentEffects(
      Object.values(profile.equipment).flatMap((item) =>
        item ? [item.effects] : [],
      ),
    ),
  );
  const riderExperience = getRiderExperience(profile.careerRaceDays);
  const riderClimateProfile = getRiderClimateProfile({
    riderId: profile.id,
    countryCode: profile.country.code,
  });
  const countryHref = `/jeu/nations/${profile.country.code.toLowerCase()}`;
  const riderProfileRoute = `/jeu/coureurs/${identifiant}`;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {rosterTutorialProgress?.status === "in_progress" &&
      rosterTutorialProgress.current_route === riderProfileRoute &&
      rosterTutorialProgress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={ROSTER_TUTORIAL_KEY}
          currentStepKey={rosterTutorialProgress.current_step_key}
        />
      ) : null}

      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <ProfileBackButton
          fallbackHref={profile.canManage ? "/jeu/effectif" : "/jeu/recherche"}
          className="mb-5"
        />

        {query.equipement ? (
          <p className="mb-5 rounded-2xl border border-[#42B99A]/25 bg-[#DFF5EA] px-5 py-4 text-sm font-bold text-[#176951]">
            {query.equipement === "retire"
              ? "Le matériel a été retiré et replacé dans l’inventaire."
              : "Le changement d’équipement a été enregistré."}
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
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#60756E]">
            <span aria-hidden="true">↗</span>
            Fiche ouverte indépendamment de votre espace de jeu
          </p>
          <TutorialLaunchButton tutorialKey={ROSTER_TUTORIAL_KEY} iconOnly />
        </div>

        <header
          data-tutorial-id="rider-profile-overview"
          className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-[linear-gradient(135deg,#071A17,#176951)] text-[#FFFDF4] shadow-[0_25px_70px_rgba(19,60,46,0.2)]"
          style={
            nationalPalette
              ? {
                  background: `linear-gradient(110deg, rgba(7,26,23,.94), rgba(7,26,23,.72)), linear-gradient(135deg, ${nationalPalette.primary}, ${nationalPalette.secondary} 52%, ${nationalPalette.accent})`,
                }
              : undefined
          }
        >
          {activeWorldTitle ? (
            <div
              aria-label="Bandes du champion du monde"
              className="grid h-2 grid-cols-5"
            >
              {["#2166B1", "#E32636", "#111111", "#F2C94C", "#16834A"].map(
                (color) => (
                  <span key={color} style={{ backgroundColor: color }} />
                ),
              )}
            </div>
          ) : nationalPalette ? (
            <div
              aria-label={
                activeContinentalTitle
                  ? `Couleurs continentales de ${activeContinentalTitle.continentName}`
                  : `Couleurs nationales de ${activeNationalTitle?.countryName ?? profile.country.name}`
              }
              className="grid h-2"
              style={{
                gridTemplateColumns: `repeat(${new Set(nationalPalette.dominantColors).size}, minmax(0, 1fr))`,
              }}
            >
              {[...new Set(nationalPalette.dominantColors)].map((color) => (
                <span key={color} style={{ backgroundColor: color }} />
              ))}
            </div>
          ) : null}
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center xl:grid-cols-[auto_minmax(0,1fr)_minmax(360px,400px)]">
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
              {activeWorldTitle ? (
                <span className="absolute -bottom-3 -right-3 flex items-center gap-2 rounded-xl border-2 border-white/70 bg-[#071A17] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-xl">
                  <RainbowMark />
                  CM {activeWorldTitle.type === "road" ? "Route" : "CLM"}
                </span>
              ) : activeContinentalTitle ? (
                <span className="absolute -bottom-3 -right-3 flex items-center gap-2 rounded-xl border-2 border-white/70 bg-[#071A17] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-xl">
                  <ContinentalMark
                    continentCode={activeContinentalTitle.continentCode}
                  />
                  CC {activeContinentalTitle.continentName}{" "}
                  {activeContinentalTitle.type === "road" ? "Route" : "CLM"}
                </span>
              ) : activeNationalTitle ? (
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
                <IdentityBadge>
                  Expérience · {riderExperience.level} ·{" "}
                  {riderExperienceScoreFormatter.format(riderExperience.score)}
                  /100
                </IdentityBadge>
                <IdentityBadge>
                  Jours de course · {riderExperience.raceDays}
                </IdentityBadge>
                <Link
                  href={countryHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
                >
                  <CountryFlag
                    code={profile.country.code}
                    name={profile.country.name}
                  />
                  {profile.country.name}
                  <span aria-hidden="true">↗</span>
                </Link>
                <IdentityBadge>
                  {profile.activeSeason?.name ?? "Hors saison"}
                </IdentityBadge>
                {profile.worldTitles
                  .filter((title) => title.isActive)
                  .map((title) => (
                    <IdentityBadge key={`world-${title.type}`}>
                      <RainbowMark />
                      Champion du monde{" "}
                      {title.type === "road" ? "route" : "CLM"}
                    </IdentityBadge>
                  ))}
                {profile.continentalTitles
                  .filter((title) => title.isActive)
                  .map((title) => (
                    <IdentityBadge
                      key={`continental-${title.continentCode}-${title.type}`}
                    >
                      <ContinentalMark continentCode={title.continentCode} />
                      Champion {title.continentName}{" "}
                      {title.type === "road" ? "route" : "CLM"}
                    </IdentityBadge>
                  ))}
                {profile.nationalTitles
                  .filter((title) => title.isActive)
                  .map((title) => (
                    <IdentityBadge key={`${title.type}-${title.countryCode}`}>
                      <span
                        className={`fi fi-${title.countryCode.toLowerCase()} mr-2 rounded-sm`}
                        role="img"
                        aria-label={`Drapeau ${title.countryName}`}
                      />
                      Champion national{" "}
                      {title.type === "road" ? "route" : "CLM"}
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
                    Potentiel{" "}
                    {formatScoutedPotentialValue(
                      profile.scoutingReport.potential,
                    )}
                  </IdentityBadge>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 lg:col-span-2 xl:col-span-1">
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
                activeNationalTitles={activeNationalTitles}
                activeContinentalTitles={activeContinentalTitles}
                activeWorldTitles={activeWorldTitles}
              />
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
          <section
            data-tutorial-id="rider-profile-stats"
            className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8"
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
              Profil sportif
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">
              Caractéristiques de la saison
            </h2>
            {profile.ratings ? (
              <div className="mt-5">
                <RiderStatsRadar
                  ratings={profile.ratings}
                  equipmentBonuses={equipmentRatingBonuses}
                />
              </div>
            ) : profile.scoutingReport ? (
              <div className="mt-5">
                <TransferScoutingReportPanel report={profile.scoutingReport} />
              </div>
            ) : (
              <EmptyBlock message="Aucune caractéristique n’est disponible pour ce coureur." />
            )}
            {profile.canManage && profile.activeSeason ? (
              <DeferredRiderProgression
                riderId={profile.id}
                detailHref={`/jeu/entrainement?progression=1&coureur=${profile.id}`}
              />
            ) : null}
          </section>

          <aside className="space-y-5">
            {shouldDisplayNaturalizationCard(naturalizationEligibility) ? (
              <div data-tutorial-id="rider-profile-naturalization">
                <NaturalizationCard
                  eligibility={naturalizationEligibility}
                  subjectName={fullName}
                  subjectId={profile.id}
                  subjectIdField="riderId"
                  action={naturalizeProfessionalRiderAction}
                />
              </div>
            ) : null}
            {profile.privateContract ? (
              <div
                data-tutorial-id="rider-profile-contract"
                className="min-w-0 space-y-5"
              >
                {transferManagement ? (
                  <>
                    <ContractRenewalCard
                      riderId={profile.id}
                      contract={profile.privateContract}
                      management={transferManagement}
                    />
                    <RiderDismissalCard
                      riderId={profile.id}
                      management={transferManagement}
                    />
                  </>
                ) : (
                  <PrivateContractCard contract={profile.privateContract} />
                )}
              </div>
            ) : transferManagement?.isFreeAgent ? (
              <div
                data-tutorial-id="rider-profile-contract"
                className="min-w-0 space-y-5"
              >
                <FreeAgentSigningCard
                  riderId={profile.id}
                  management={transferManagement}
                />
              </div>
            ) : (
              <div
                data-tutorial-id="rider-profile-contract"
                className="min-w-0 space-y-5"
              >
                <CareerSummaryCard
                  teamName={profile.currentTeam?.displayName ?? "Agent libre"}
                  seasonsCount={
                    new Set(profile.history.map((entry) => entry.seasonId)).size
                  }
                />
                {transferManagement ? (
                  <DirectTransferOfferCard
                    riderId={profile.id}
                    teamName={
                      profile.currentTeam?.displayName ??
                      "l'\u00e9quipe actuelle"
                    }
                    management={transferManagement}
                  />
                ) : null}
              </div>
            )}
            {profile.medical ? (
              <RiderMedicalCard medical={profile.medical} />
            ) : null}
            <div data-tutorial-id="rider-profile-form">
              <RiderConditionGauges
                form={profile.condition.form}
                dayNumber={profile.condition.dayNumber}
                events={profile.condition.events}
              />
            </div>
            <RiderClimateProfileCard profile={riderClimateProfile} />
            <div data-tutorial-id="rider-profile-abilities">
              <SpecialAbilitiesCard abilities={profile.specialAbilities} />
            </div>
          </aside>
        </div>

        {profile.canManage && riderPlanning ? (
          <div data-tutorial-id="rider-profile-planning" className="mt-6">
            <RiderSeasonPlanning
              planning={riderPlanning}
              jersey={riderJersey}
              variant="rider"
              showEventDetails={false}
            />
          </div>
        ) : null}

        <div data-tutorial-id="rider-profile-history" className="mt-6 min-w-0">
          <CareerHistory history={profile.history} />
        </div>

        <div data-tutorial-id="rider-profile-equipment" className="mt-6">
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
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-5 w-5"
            fill="currentColor"
          >
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
  management: NonNullable<
    Awaited<ReturnType<typeof getRiderTransferManagement>>
  >;
}) {
  return (
    <article className="rounded-[2rem] border border-[#42B99A]/25 bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(7,26,23,0.16)] sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9BE0BC]">
        Agent libre
      </p>
      <h2 className="mt-2 text-2xl font-black text-white">Signer un contrat</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#BFD1C6]">
        Aucune indemnité de transfert. Le contrat couvre la saison actuelle et
        la suivante.
      </p>
      {management.freeAgentSalary !== null ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#9BE0BC]">
            Demande salariale
          </p>
          <p className="mt-1 text-xl font-black text-[#F2C94C]">
            {formatMoney(management.freeAgentWeeklySalary ?? 0, "EUR")} /
            semaine
          </p>
          <p className="mt-1 text-xs font-bold text-[#BFD1C6]">
            {formatMoney(management.freeAgentSalary, "EUR")} par saison
          </p>
        </div>
      ) : null}
      {management.canSignFreeAgent ? (
        <form action={signFreeAgentAction} className="mt-5">
          <input type="hidden" name="riderId" value={riderId} />
          <input
            type="hidden"
            name="returnPath"
            value={`/jeu/coureurs/${riderId}`}
          />
          <TransferSubmitButton pendingLabel="Signature…">
            Signer pour 2 saisons
          </TransferSubmitButton>
        </form>
      ) : (
        <p className="mt-5 rounded-xl bg-[#F2C94C]/10 px-4 py-3 text-xs font-bold text-[#FFE596]">
          {management.freeAgentBlockedReason ??
            "Ce coureur n’est pas disponible à la signature."}
        </p>
      )}
    </article>
  );
}

function ContractRenewalCard({
  riderId,
  contract,
  management,
}: {
  riderId: string;
  contract: NonNullable<
    Awaited<ReturnType<typeof getPublicRiderProfile>>
  >["privateContract"] & {};
  management: NonNullable<
    Awaited<ReturnType<typeof getRiderTransferManagement>>
  >;
}) {
  const endSeasonYear = management.contractEndSeasonYear;
  const endLabel = endSeasonYear
    ? `Fin de S${endSeasonYear}`
    : contract.endSeasonName;
  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-[#D6A93D]/30 bg-[#FFF8DD] p-6 shadow-[0_16px_45px_rgba(111,82,13,0.08)] sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8A6B16]">
        Votre coureur
      </p>
      <h2 className="mt-2 text-xl font-black text-[#3F3518]">Contrat</h2>
      <dl className="mt-5 space-y-3 text-sm">
        <ContractLine
          label="Salaire annuel"
          value={formatMoney(contract.salaryPerSeason, contract.currencyCode)}
        />
        <ContractLine label={"D\u00e9but"} value={contract.startSeasonName} />
        <ContractLine label="Statut" value="Actif" />
      </dl>
      <div className="mt-5 rounded-xl border border-[#D6A93D]/25 bg-white/65 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8A6B16]">
          Échéance
        </p>
        <p className="mt-1 text-lg font-black text-[#3F3518]">{endLabel}</p>
      </div>
      {management.canRenew ? (
        <form action={renewRiderContractAction} className="mt-4">
          <p className="mb-4 text-sm font-semibold leading-6 text-[#7E7043]">
            Prolongez d’une saison, jusqu’à fin de S{endSeasonYear! + 1}. La
            limite est de trois saisons glissantes.
          </p>
          <input type="hidden" name="riderId" value={riderId} />
          <input
            type="hidden"
            name="returnPath"
            value={`/jeu/coureurs/${riderId}`}
          />
          <TransferSubmitButton pendingLabel="Prolongation…" tone="green">
            Prolonger d’une saison
          </TransferSubmitButton>
        </form>
      ) : (
        <p className="mt-4 rounded-xl bg-[#DDF3E7] px-4 py-3 text-sm font-bold text-[#176951]">
          Le contrat est déjà sécurisé pour le maximum de trois saisons
          glissantes.
        </p>
      )}
    </article>
  );
}

function RiderDismissalCard({
  riderId,
  management,
}: {
  riderId: string;
  management: NonNullable<
    Awaited<ReturnType<typeof getRiderTransferManagement>>
  >;
}) {
  if (!management.canDismiss || management.dismissalCost === null) return null;
  const canAfford = management.dismissalCost <= management.cashBalance;

  return (
    <article className="rounded-[2rem] border border-[#C94F4F]/25 bg-[#FFF6F3] p-6 shadow-[0_16px_45px_rgba(111,38,38,0.08)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#B54242]">
        Rupture du contrat
      </p>
      <h2 className="mt-2 text-xl font-black text-[#702E2E]">
        Licencier le coureur
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#7F5D58]">
        Tous les salaires restant jusqu’à l’échéance, y compris les saisons déjà
        signées, sont réglés immédiatement. Le coureur devient agent libre.
      </p>
      <div className="mt-4 rounded-xl border border-[#C94F4F]/15 bg-white px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#9D6767]">
          Solde contractuel
        </p>
        <p className="mt-1 text-xl font-black text-[#B54242]">
          {formatMoney(management.dismissalCost, management.dismissalCurrency)}
        </p>
      </div>
      <form action={dismissRiderAction} className="mt-4 space-y-4">
        <input type="hidden" name="riderId" value={riderId} />
        <input
          type="hidden"
          name="returnPath"
          value={`/jeu/coureurs/${riderId}`}
        />
        <label className="flex items-start gap-3 rounded-xl bg-[#FBE4DF] px-4 py-3 text-xs font-bold leading-5 text-[#702E2E]">
          <input
            type="checkbox"
            required
            disabled={!canAfford}
            className="mt-0.5 h-4 w-4 accent-[#B54242]"
          />
          Je confirme la rupture définitive du contrat et le paiement immédiat.
        </label>
        {!canAfford ? (
          <p className="text-xs font-bold text-[#B54242]">
            La trésorerie disponible ne couvre pas ce solde.
          </p>
        ) : null}
        <TransferSubmitButton
          pendingLabel="Licenciement…"
          tone="dark"
          disabled={!canAfford}
        >
          Régler et licencier
        </TransferSubmitButton>
      </form>
    </article>
  );
}

function DirectTransferOfferCard({
  riderId,
  teamName,
  management,
}: {
  riderId: string;
  teamName: string;
  management: NonNullable<
    Awaited<ReturnType<typeof getRiderTransferManagement>>
  >;
}) {
  if (
    management.directOfferSalary === null &&
    management.pendingDirectOfferAmount === null
  ) {
    return null;
  }

  const maximumOffer = Math.max(
    500,
    Math.floor(management.availableBudget / 100) * 100,
  );
  const defaultOffer = Math.min(10_000, maximumOffer);

  return (
    <article className="rounded-[2rem] border border-[#F2C94C]/30 bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(7,26,23,0.16)] sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2C94C]">
        Négociation directe
      </p>
      <h2 className="mt-2 text-2xl font-black">Faire une offre</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#BFD1C6]">
        Proposez une indemnité à {teamName}. Son Directeur Sportif recevra un
        courrier et pourra accepter ou refuser. En cas d’accord, le contrat
        couvre la fin de la saison en cours.
      </p>

      {management.pendingDirectOfferAmount !== null ? (
        <div className="mt-5 rounded-xl border border-[#F2C94C]/25 bg-[#F2C94C]/10 px-4 py-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#FFE596]">
            Offre en attente
          </p>
          <p className="mt-1 text-xl font-black text-[#F2C94C]">
            {formatMoney(
              management.pendingDirectOfferAmount,
              management.currency,
            )}
          </p>
          <p className="mt-2 text-xs font-bold text-[#D6DFD2]">
            Vous serez prévenu par courrier dès que le DS adverse aura répondu.
          </p>
        </div>
      ) : management.canMakeDirectOffer ? (
        <form action={submitDirectTransferOfferAction} className="mt-5">
          <input type="hidden" name="riderId" value={riderId} />
          <input
            type="hidden"
            name="returnPath"
            value={`/jeu/coureurs/${riderId}`}
          />
          <label className="block text-[10px] font-black uppercase tracking-wider text-[#9BE0BC]">
            Montant proposé
            <input
              name="amount"
              type="number"
              min="500"
              max={Math.min(100_000_000, maximumOffer)}
              step="100"
              required
              defaultValue={defaultOffer}
              className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white px-4 text-base font-black text-[#183F37]"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-bold text-[#BFD1C6]">
            <p>
              Budget disponible
              <br />
              <strong className="text-white">
                {formatMoney(management.availableBudget, management.currency)}
              </strong>
            </p>
            <p>
              Salaire futur
              <br />
              <strong className="text-white">
                {formatMoney(
                  management.directOfferSalary ?? 0,
                  management.currency,
                )}
              </strong>
            </p>
            <p className="col-span-2 text-[10px] leading-4 text-[#9BE0BC]">
              Le salaire sera payé par échéances et n’est pas retiré de votre
              trésorerie au moment de l’offre.
            </p>
          </div>
          <div className="mt-5">
            <TransferSubmitButton pendingLabel="Envoi de l’offre…">
              Transmettre l’offre
            </TransferSubmitButton>
          </div>
        </form>
      ) : (
        <p className="mt-5 rounded-xl bg-[#F2C94C]/10 px-4 py-3 text-xs font-bold text-[#FFE596]">
          {management.directOfferBlockedReason ??
            "Ce coureur n’est pas disponible pour une négociation directe."}
        </p>
      )}
    </article>
  );
}
function CurrentTeamCard({
  team,
  amateurJersey,
  amateurTeamName,
  sponsorIdentity,
  activeNationalTitles,
  activeContinentalTitles,
  activeWorldTitles,
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
  activeNationalTitles: PublicRiderProfile["nationalTitles"];
  activeContinentalTitles: PublicRiderProfile["continentalTitles"];
  activeWorldTitles: PublicRiderProfile["worldTitles"];
}) {
  const hasChampionTitles =
    activeWorldTitles.length +
      activeContinentalTitles.length +
      activeNationalTitles.length >
    0;

  const content = (
    <span className="block min-w-0">
      {hasChampionTitles ? (
        <span className="block">
          <span className="block text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#9BE0BC]">
            Maillots de champion
          </span>
          <span
            data-champion-jerseys
            className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-x-1.5 gap-y-3"
          >
            {activeWorldTitles.map((title) => (
              <span key={`world-${title.type}`} className="min-w-0 text-center">
                <WorldChampionJersey
                  championshipType={title.type}
                  className="mx-auto h-24 w-20 drop-shadow-xl"
                />
                <span className="mt-1 block text-[8px] font-black uppercase tracking-wider text-[#F2C94C]">
                  CM {title.type === "road" ? "Route" : "CLM"}
                </span>
              </span>
            ))}
            {activeContinentalTitles.map((title) => (
              <span
                key={`continental-${title.continentCode}-${title.type}`}
                className="min-w-0 text-center"
              >
                <ContinentalChampionJersey
                  continentCode={title.continentCode}
                  championshipType={title.type}
                  className="mx-auto h-24 w-20 drop-shadow-xl"
                />
                <span className="mt-1 block text-[8px] font-black uppercase tracking-wider text-[#F2C94C]">
                  CC {title.type === "road" ? "Route" : "CLM"}
                </span>
              </span>
            ))}
            {activeNationalTitles.map((title) => (
              <span
                key={`national-${title.countryCode}-${title.type}`}
                className="min-w-0 text-center"
              >
                <NationalChampionJersey
                  countryCode={title.countryCode}
                  countryName={title.countryName}
                  championshipType={title.type}
                  className="mx-auto h-24 w-20 drop-shadow-xl"
                />
                <span className="mt-1 block text-[8px] font-black uppercase tracking-wider text-[#F2C94C]">
                  CN {title.type === "road" ? "Route" : "CLM"}
                </span>
              </span>
            ))}
          </span>
        </span>
      ) : null}

      <span
        data-current-team-identity
        className="mt-4 grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 border-t border-white/10 pt-4 first:mt-0 first:border-t-0 first:pt-0"
      >
        <span className="min-w-0 text-center">
          <TeamJerseyPreview
            amateurJersey={amateurJersey}
            amateurTeamName={amateurTeamName}
            sponsor={sponsorIdentity?.sponsor ?? null}
            sponsorJersey={sponsorIdentity?.selectedJersey ?? null}
            className="mx-auto h-24 w-20 drop-shadow-xl"
          />
          <span className="mt-1 block text-[8px] font-black uppercase tracking-wider text-[#BFD1C6]">
            Maillot équipe
          </span>
        </span>
        <span className="min-w-0 pr-5">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#9BE0BC]">
            Équipe actuelle
          </span>
          <span className="mt-2 block break-words text-lg font-black leading-tight text-white">
            {team?.displayName ?? "Agent libre"}
          </span>
          {team ? (
            <span className="mt-2 block">
              <TeamDivisionBadge
                division={team.divisionCode}
                isProfessional={Boolean(sponsorIdentity)}
                dark
                compact
              />
            </span>
          ) : null}
          {sponsorIdentity ? (
            <span className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <SponsorLogoMark
                src={sponsorIdentity.sponsor.logoPath}
                alt={`Logo de ${sponsorIdentity.sponsor.name}`}
                sponsorName={sponsorIdentity.sponsor.name}
                primaryColor={sponsorIdentity.sponsor.colors.primary}
                backgroundColor={sponsorIdentity.sponsor.colors.background}
                textColor={sponsorIdentity.sponsor.colors.text}
                className="h-8 w-12 shrink-0 rounded-lg p-1"
              />
              <span className="min-w-0 break-words text-xs font-semibold text-[#BFD1C6]">
                {sponsorIdentity.sponsor.name}
              </span>
            </span>
          ) : (
            <span className="mt-1 block text-xs font-semibold text-[#BFD1C6]">
              {team ? "Structure amateur" : "Maillot neutre"}
            </span>
          )}
        </span>
      </span>
    </span>
  );

  return team ? (
    <Link
      href={`/jeu/equipes/${team.id}`}
      target="_blank"
      rel="noreferrer"
      className="relative block min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-4 pr-10 transition hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
    >
      {content}
      <span
        className="absolute right-4 top-4 text-sm font-black text-[#9BE0BC]"
        aria-hidden="true"
      >
        ↗
      </span>
    </Link>
  ) : (
    <div className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-4">
      <AmateurTeamJersey
        jersey={FREE_AGENT_JERSEY}
        teamName="Agent libre"
        className="h-24 w-20 shrink-0 opacity-80 drop-shadow-xl"
      />
      <span className="min-w-0">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#9BE0BC]">
          Équipe actuelle
        </span>
        <span className="mt-2 block text-lg font-black">Agent libre</span>
        <span className="mt-1 block text-xs font-semibold text-[#BFD1C6]">
          Maillot neutre
        </span>
      </span>
    </div>
  );
}

function CareerHistory({
  history,
}: {
  history: PublicRiderProfile["history"];
}) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
      <div className="px-6 py-6 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
          Carrière
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#183F37]">
          Historique des saisons
        </h2>
      </div>

      {history.length > 0 ? (
        <>
          <div className="grid gap-3 border-t border-[#315B3E]/10 bg-[#F3F8F5] p-4 md:hidden">
            {history.map((entry) => (
              <article
                key={`${entry.careerLevel}-${entry.seasonId}-${entry.teamId}`}
                className="min-w-0 rounded-2xl border border-[#315B3E]/12 bg-white p-4 shadow-sm"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-[#183F37]">
                        {entry.seasonName}
                      </p>
                      {entry.careerLevel === "junior" ? (
                        <span className="rounded-full bg-[#FFF3C4] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#7A5A00]">
                          Année junior
                        </span>
                      ) : null}
                    </div>
                    <Link
                      href={`/jeu/equipes/${entry.teamId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-words text-sm font-black text-[#176951] underline decoration-[#176951]/25 underline-offset-4 transition hover:text-[#278B70]"
                    >
                      {entry.teamName} <span aria-hidden="true">↗</span>
                    </Link>
                    {formatCareerMovement(entry) ? (
                      <p className="mt-1 text-xs font-bold text-[#60756E]">
                        {formatCareerMovement(entry)}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-[#EAF5F0] px-3 py-1 text-xs font-black text-[#176951]">
                    {entry.careerLevel === "junior"
                      ? `${entry.juniorRaceCount ?? 0} courses`
                      : entry.uciRank === null
                        ? "UCI —"
                        : `UCI #${entry.uciRank}`}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2">
                  <MobileHistoryValue
                    label="Victoires"
                    value={entry.victories}
                  />
                  <MobileHistoryValue label="Points" value={entry.points} />
                  {entry.careerLevel === "junior" ? (
                    <MobileHistoryValue
                      label="Podiums juniors"
                      value={entry.juniorPodiums}
                    />
                  ) : null}
                </dl>

                <div className="mt-3 grid gap-3 border-t border-[#315B3E]/10 pt-3">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#60756E]">
                      Palmarès
                    </span>
                    <div className="flex min-w-0 flex-wrap justify-end gap-2">
                      {entry.nationalTitles.map((title) => (
                        <NationalTitleFlag
                          key={`${title.type}-${title.countryCode}`}
                          countryCode={title.countryCode}
                          countryName={title.countryName}
                          discipline={title.type}
                        />
                      ))}
                      {entry.worldTitles.map((title) => (
                        <WorldTitleBadge
                          key={`world-${title.type}`}
                          discipline={title.type}
                        />
                      ))}
                      {entry.continentalTitles.map((title) => (
                        <ContinentalTitleBadge
                          key={`continental-${title.continentCode}-${title.type}`}
                          continentCode={title.continentCode}
                          continentName={title.continentName}
                          discipline={title.type}
                        />
                      ))}
                      {entry.nationalTitles.length === 0 &&
                      entry.worldTitles.length === 0 &&
                      entry.continentalTitles.length === 0 ? (
                        <span className="text-sm font-black text-[#48665F]">
                          —
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#60756E]">
                      Résultats notables
                    </span>
                    <SeasonPerformancesPopover
                      seasonName={entry.seasonName}
                      gameYear={entry.gameYear}
                      performances={entry.notablePerformances}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden max-w-full overflow-x-auto overscroll-x-contain border-t border-[#315B3E]/10 md:block">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-[#F3F8F5] text-xs font-extrabold uppercase tracking-[0.12em] text-[#60756E]">
                <tr>
                  <th className="px-6 py-4">Saison</th>
                  <th className="px-5 py-4">Équipe</th>
                  <th className="px-4 py-4 text-center">Victoires</th>
                  <th className="px-4 py-4 text-center">Points</th>
                  <th className="px-4 py-4 text-center">Palmarès</th>
                  <th className="px-5 py-4 text-center">Résultats notables</th>
                  <th className="px-6 py-4 text-center">Classement UCI</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr
                    key={`${entry.careerLevel}-${entry.seasonId}-${entry.teamId}`}
                    className="border-t border-[#315B3E]/10 text-sm"
                  >
                    <td className="px-6 py-4 font-black text-[#183F37]">
                      <span className="block">{entry.seasonName}</span>
                      {entry.careerLevel === "junior" ? (
                        <span className="mt-1 inline-flex rounded-full bg-[#FFF3C4] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#7A5A00]">
                          Année junior
                        </span>
                      ) : null}
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
                      {formatCareerMovement(entry) ? (
                        <p className="mt-1 text-xs font-bold text-[#60756E]">
                          {formatCareerMovement(entry)}
                        </p>
                      ) : null}
                    </td>
                    <HistoryValue value={entry.victories} />
                    <HistoryValue value={entry.points} />
                    <td className="px-4 py-4">
                      <div className="flex justify-center gap-2">
                        {entry.nationalTitles.map((title) => (
                          <NationalTitleFlag
                            key={`${title.type}-${title.countryCode}`}
                            countryCode={title.countryCode}
                            countryName={title.countryName}
                            discipline={title.type}
                          />
                        ))}
                        {entry.worldTitles.map((title) => (
                          <WorldTitleBadge
                            key={`world-${title.type}`}
                            discipline={title.type}
                          />
                        ))}
                        {entry.continentalTitles.map((title) => (
                          <ContinentalTitleBadge
                            key={`continental-${title.continentCode}-${title.type}`}
                            continentCode={title.continentCode}
                            continentName={title.continentName}
                            discipline={title.type}
                          />
                        ))}
                        {entry.nationalTitles.length === 0 &&
                        entry.worldTitles.length === 0 &&
                        entry.continentalTitles.length === 0 ? (
                          <>{entry.nationalTitles.length === 0 ? "—" : null}</>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <SeasonPerformancesPopover
                        seasonName={entry.seasonName}
                        gameYear={entry.gameYear}
                        performances={entry.notablePerformances}
                      />
                    </td>
                    {entry.careerLevel === "junior" ? (
                      <td className="px-6 py-4 text-center font-black text-[#176951]">
                        Junior · {entry.juniorRaceCount ?? 0} courses
                      </td>
                    ) : (
                      <HistoryValue value={entry.uciRank} prefix="#" />
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="border-t border-[#315B3E]/10 px-6 pb-6 sm:px-8">
          <EmptyBlock message="Aucune saison en club n’est encore enregistrée." />
        </div>
      )}
    </section>
  );
}

function HistoryValue({
  value,
  prefix = "",
}: {
  value: number | null;
  prefix?: string;
}) {
  return (
    <td className="px-4 py-4 text-center font-black text-[#48665F]">
      {value === null ? "—" : `${prefix}${value}`}
    </td>
  );
}

function formatCareerMovement(entry: {
  transferFee: number | null;
  currencyCode: string;
  joinedDayNumber: number | null;
  leftDayNumber: number | null;
}) {
  const details: string[] = [];
  if (entry.transferFee !== null) {
    details.push(
      `Transfert ${formatMoney(entry.transferFee, entry.currencyCode)}`,
    );
  }
  if ((entry.joinedDayNumber ?? 1) > 1) {
    details.push(`arrivée J${entry.joinedDayNumber}`);
  }
  if (entry.leftDayNumber !== null) {
    details.push(`départ J${entry.leftDayNumber}`);
  }
  return details.join(" · ");
}

function MobileHistoryValue({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-xl bg-[#F3F8F5] px-3 py-2.5">
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#60756E]">
        {label}
      </dt>
      <dd className="mt-1 text-base font-black text-[#183F37]">
        {value === null ? "—" : value}
      </dd>
    </div>
  );
}
function RainbowMark() {
  const colors = ["#2166B1", "#E32636", "#111111", "#F2C94C", "#16834A"];
  return (
    <span
      aria-hidden="true"
      className="mr-1 inline-flex h-3 w-5 overflow-hidden rounded-sm border border-white/30"
    >
      {colors.map((color) => (
        <span
          key={color}
          className="min-w-0 flex-1"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

function WorldTitleBadge({
  discipline,
}: {
  discipline: "road" | "time_trial";
}) {
  const title =
    discipline === "time_trial"
      ? "Champion du monde du contre-la-montre"
      : "Champion du monde sur route";
  const colors = ["#2166B1", "#E32636", "#111111", "#F2C94C", "#16834A"];

  return (
    <span
      className="relative inline-flex h-7 w-10 flex-col overflow-hidden rounded-md border border-[#315B3E]/20 bg-white shadow-sm"
      title={title}
      aria-label={title}
    >
      {colors.map((color) => (
        <span
          key={color}
          aria-hidden="true"
          className="min-h-0 flex-1"
          style={{ backgroundColor: color }}
        />
      ))}
      {discipline === "time_trial" ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-white/15 text-lg font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
        >
          <span className="relative h-4 w-4 rounded-full border-2 border-white">
            <span className="absolute left-1/2 top-[2px] h-[5px] w-[2px] -translate-x-1/2 bg-white" />
            <span className="absolute left-1/2 top-1/2 h-[2px] w-[5px] -translate-y-1/2 bg-white" />
          </span>
        </span>
      ) : null}
    </span>
  );
}

function NationalTitleFlag({
  countryCode,
  countryName,
  discipline,
}: {
  countryCode: string;
  countryName: string;
  discipline: "road" | "time_trial";
}) {
  const title =
    discipline === "time_trial"
      ? `Champion national du contre-la-montre · ${countryName}`
      : `Champion national sur route · ${countryName}`;

  return (
    <span
      className="relative inline-flex h-7 w-10 overflow-hidden rounded-md border border-[#315B3E]/15 shadow-sm"
      title={title}
      aria-label={title}
    >
      <span
        aria-hidden="true"
        className={`fi fi-${countryCode.toLowerCase()} absolute inset-0 h-full w-full bg-cover bg-center`}
      />
      {discipline === "time_trial" ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-black/10 text-sm font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
        >
          ◷
        </span>
      ) : null}
    </span>
  );
}

function PrivateContractCard({
  contract,
}: {
  contract: NonNullable<
    Awaited<ReturnType<typeof getPublicRiderProfile>>
  >["privateContract"] & {};
}) {
  if (!contract) {
    return null;
  }

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-[#D6A93D]/30 bg-[#FFF8DD] p-6 shadow-[0_16px_45px_rgba(111,82,13,0.08)] sm:p-7">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8A6B16]">
            Données privées
          </p>
          <h2 className="mt-2 text-xl font-black text-[#3F3518]">Contrat</h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#F2C94C]/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#6E5715]">
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
        Ces interactions seront activées avec les mécaniques de contrats et
        d’entraînement.
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
      <h2 className="mt-2 text-xl font-black text-[#183F37]">
        Situation sportive
      </h2>
      <dl className="mt-5 space-y-3 text-sm">
        <ContractLine label="Équipe actuelle" value={teamName} />
        <ContractLine
          label="Saisons en club"
          value={`${seasonsCount} saison${seasonsCount > 1 ? "s" : ""}`}
        />
      </dl>
      <p className="mt-5 rounded-xl border border-[#315B3E]/10 bg-[#F3F8F5] px-4 py-3 text-xs font-semibold leading-5 text-[#60756E]">
        Les informations contractuelles sont réservées au Directeur Sportif de
        l’équipe actuelle.
      </p>
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
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-current/10 pb-3 last:border-none last:pb-0">
      <dt className="min-w-0 font-semibold opacity-65">{label}</dt>
      <dd className="min-w-0 break-words text-right font-black">{value}</dd>
    </div>
  );
}

function FutureActionButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="min-h-11 w-full min-w-0 whitespace-normal rounded-xl border border-[#8A6B16]/20 bg-white/60 px-4 text-sm font-black text-[#7E7043] opacity-65 disabled:cursor-not-allowed"
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
      aria-label={`Drapeau : ${name}`}
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
