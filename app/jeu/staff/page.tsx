import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  dismissStaffMemberAction,
  hireStaffMemberAction,
  naturalizeStaffMemberAction,
} from "@/app/jeu/staff/actions";
import {
  isMutualAgreementDismissal,
  resolveDismissalCost,
} from "@/lib/game/mutual-dismissal";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import {
  GameSectionTabLink,
  GameSectionTabs,
} from "@/components/game/game-section-tabs";
import { StaffDismissalSubmitButton } from "@/components/game/staff-dismissal-submit-button";
import { NaturalizationSubmitButton } from "@/components/game/naturalization-submit-button";
import { StaffSubmitButton } from "@/components/game/staff-submit-button";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import Link from "@/components/ui/app-link";
import { ARCHITECT_SPECIALTY_LABELS } from "@/lib/game/infrastructure";
import {
  STAFF_ROLES,
  STAFF_ROLE_DEFINITIONS,
  TRAINER_SPECIALTIES,
  TRAINER_SPECIALTY_LABELS,
  isStaffRole,
  isTrainerSpecialty,
  type StaffRole,
} from "@/lib/game/staff";
import { buildStaffMarketReturnPath } from "@/lib/game/filtered-page-paths";
import { getStaffNationalityAffinityDescription } from "@/lib/game/staff-talents";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import { isStaffTutorialRoute, STAFF_TUTORIAL_KEY } from "@/lib/tutorial/staff";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getTeamStaffOverview,
  type StaffMarketFilters,
  type StaffMarketListing,
  type TeamStaffMember,
  type TeamStaffOverview,
} from "@/services/team-staff";

export const metadata: Metadata = {
  title: "Staff de l’équipe",
  description:
    "Recrutez les spécialistes qui développent les performances de votre équipe.",
};

type StaffTab = "marche" | "equipe";

type StaffPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const tabs: Array<{ id: StaffTab; label: string; detail: string }> = [
  {
    id: "marche",
    label: "Marché de l’emploi",
    detail: "25 profils à minuit + 25 à midi · marché commun à tous les DS",
  },
  {
    id: "equipe",
    label: "Staff de l’équipe",
    detail: "Contrats, masse salariale et effets actifs",
  },
];

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const query = await searchParams;
  const tab = readTab(readQuery(query.onglet));
  const filters = readFilters(query);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, overview, staffTutorialProgress] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getTeamStaffOverview(supabase, user.id, filters),
    getAuthenticatedTutorialProgress(supabase, STAFF_TUTORIAL_KEY).catch(
      (error: unknown) => {
        console.error(
          "Impossible de reprendre le didacticiel du staff :",
          error,
        );
        return null;
      },
    ),
  ]);

  if (!overview) {
    redirect("/jeu");
  }

  const success = readQuery(query.succes);
  const errorMessage = readQuery(query.erreur);
  const marketReturnPath = buildStaffMarketReturnPath(filters);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {staffTutorialProgress?.status === "in_progress" &&
      isStaffTutorialRoute(staffTutorialProgress.current_route) &&
      staffTutorialProgress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={STAFF_TUTORIAL_KEY}
          currentStepKey={staffTutorialProgress.current_step_key}
        />
      ) : null}
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <header
          data-tutorial-id="staff-overview"
          className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10"
        >
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-24 h-80 w-80 rounded-full border-[52px] border-white/5"
          />
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Entraînements · Staff · Infrastructures
              </p>
              <div className="mt-3 flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                  Direction du staff
                </h1>
                <TutorialLaunchButton
                  tutorialKey={STAFF_TUTORIAL_KEY}
                  iconOnly
                />
              </div>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Entourez {overview.teamName} de spécialistes. Chaque signature
                occupe une place liée à votre niveau de DS et engage la
                trésorerie immédiatement, puis quatre échéances salariales par
                saison.
              </p>
            </div>

            <div
              data-tutorial-id="staff-capacity"
              className="grid grid-cols-2 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur sm:grid-cols-4"
            >
              <HeroMetric
                label="Niveau DS"
                value={String(overview.directorLevel)}
              />
              <HeroMetric
                label="Staff"
                value={`${overview.activeStaffCount}/${overview.staffCapacity}`}
              />
              <HeroMetric
                label="Paie saison"
                value={formatMoney(overview.activePayroll, overview.currency)}
              />
              <HeroMetric
                label="Budget projeté"
                value={formatMoney(overview.projectedBudget, overview.currency)}
              />
            </div>
          </div>
        </header>

        {success ? <Notice tone="success">{success}</Notice> : null}
        {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

        <GameSectionTabs
          ariaLabel="Rubriques du staff"
          columns={2}
          className="mt-7"
          data-tutorial-id="staff-tabs"
        >
          {tabs.map((entry) => (
            <GameSectionTabLink
              key={entry.id}
              href={`/jeu/staff?onglet=${entry.id}`}
              active={tab === entry.id}
              label={entry.label}
              description={entry.detail}
            />
          ))}
        </GameSectionTabs>

        {tab === "marche" ? (
          <EmploymentMarket
            overview={overview}
            query={query}
            returnPath={marketReturnPath}
          />
        ) : (
          <TeamStaff overview={overview} />
        )}
      </section>
    </main>
  );
}

function EmploymentMarket({
  overview,
  query,
  returnPath,
}: {
  overview: TeamStaffOverview;
  query: Record<string, string | string[] | undefined>;
  returnPath: string;
}) {
  return (
    <section className="mt-7">
      <div
        data-tutorial-id="staff-market-overview"
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <SectionHeading
          eyebrow={`Sélection du ${formatDate(overview.marketDate)}`}
          title="Spécialistes disponibles sur le marché mondial"
          detail="Le pool est identique pour tous les joueurs. Une signature est définitive : dès qu’un DS recrute un profil, celui-ci n’est plus disponible pour les autres équipes."
        />
        <div className="grid shrink-0 grid-cols-2 gap-3">
          <CompactMetric
            label="Encore disponibles"
            value={`${overview.marketAvailableCount}/${overview.marketTotalCount}`}
          />
          <CompactMetric
            label="Vos places libres"
            value={String(overview.availableStaffSlots)}
          />
        </div>
      </div>

      <form
        data-tutorial-id="staff-market-filters"
        className="mt-5 grid gap-3 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_35px_rgba(19,60,46,0.07)] md:grid-cols-2 xl:grid-cols-4"
      >
        <input type="hidden" name="onglet" value="marche" />
        <FilterField label="Métier">
          <select
            name="metier"
            defaultValue={readQuery(query.metier)}
            className={filterClassName}
          >
            <option value="">Tous les métiers</option>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {STAFF_ROLE_DEFINITIONS[role].label}
                {role === "educator" && overview.staffAcademyLevel < 1
                  ? " · Académie des métiers requise"
                  : ""}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Niveau">
          <select
            name="niveau"
            defaultValue={readQuery(query.niveau)}
            className={filterClassName}
          >
            <option value="">Tous les niveaux</option>
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={level}>
                Niveau {level}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Nationalité">
          <select
            name="pays"
            defaultValue={readQuery(query.pays)}
            className={filterClassName}
          >
            <option value="">Toutes</option>
            {overview.countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Spécialité entraîneur">
          <select
            name="specialite"
            defaultValue={readQuery(query.specialite)}
            className={filterClassName}
          >
            <option value="">Toutes</option>
            {TRAINER_SPECIALTIES.map((specialty) => (
              <option key={specialty} value={specialty}>
                {TRAINER_SPECIALTY_LABELS[specialty]}
              </option>
            ))}
          </select>
        </FilterField>
        <div className="flex flex-wrap gap-3 xl:col-span-4">
          <button className="rounded-xl bg-[#0B302B] px-5 py-3 text-xs font-black uppercase tracking-wider text-white">
            Filtrer
          </button>
          <Link
            href="/jeu/staff?onglet=marche"
            className="rounded-xl border border-[#315B3E]/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-[#315B3E]"
          >
            Réinitialiser
          </Link>
        </div>
      </form>

      <div data-tutorial-id="staff-market-listings">
        {overview.marketListings.length > 0 ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {overview.marketListings.map((listing) => (
              <StaffMarketCard
                key={listing.id}
                listing={listing}
                returnPath={returnPath}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Aucun profil disponible avec ces filtres"
            detail="Modifiez les critères ou revenez après le renouvellement quotidien du marché."
          />
        )}
      </div>
    </section>
  );
}

function StaffMarketCard({
  listing,
  returnPath,
}: {
  listing: StaffMarketListing;
  returnPath: string;
}) {
  const { member } = listing;
  const definition = STAFF_ROLE_DEFINITIONS[member.role];

  return (
    <article id={`staff-${listing.id}`} className="scroll-mt-6 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)] target:ring-4 target:ring-[#F2C94C]/60">
      <div className="h-1.5" style={{ backgroundColor: definition.accent }} />
      <div className="p-5">
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ backgroundColor: definition.accent }}
          >
            <StaffRoleIcon role={member.role} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
                  {definition.label}
                </p>
                <h3 className="mt-1 truncate text-xl font-black text-[#183F37]">
                  {member.firstName} {member.lastName}
                </h3>
              </div>
              <LevelStars level={member.level} />
            </div>
            <p className="mt-2 text-xs font-bold text-[#60756E]">
              <CountryFlag
                code={member.countryCode}
                name={member.countryName}
              />
              {member.countryName}
            </p>
          </div>
        </div>

        {member.trainerSpecialty ? (
          <p className="mt-4 inline-flex rounded-full bg-[#FFF4D0] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#71580A]">
            Spécialité · {TRAINER_SPECIALTY_LABELS[member.trainerSpecialty]}
          </p>
        ) : null}
        {member.architectSpecialty ? (
          <p className="mt-4 inline-flex rounded-full bg-[#F4E9DD] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#7A4E28]">
            Profil · {ARCHITECT_SPECIALTY_LABELS[member.architectSpecialty]}
          </p>
        ) : null}

        <StaffEffectBlock member={member} />

        <StaffTalentBlock member={member} />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <PriceBlock
            label="Signature"
            value={formatMoney(member.signingFee, member.currency)}
          />
          <PriceBlock
            label="Salaire / semaine"
            value={formatMoney(member.salaryPerWeek, member.currency)}
            detail={`${formatMoney(member.salaryPerSeason, member.currency)} / saison`}
          />
        </div>

        <form action={hireStaffMemberAction} className="mt-4">
          <input type="hidden" name="listingId" value={listing.id} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <StaffSubmitButton disabled={!listing.canHire}>
            Recruter
          </StaffSubmitButton>
        </form>

        {listing.hireBlockedReason ? (
          <p className="mt-3 text-xs font-semibold leading-5 text-[#8A5A23]">
            {listing.hireBlockedReason}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function TeamStaff({ overview }: { overview: TeamStaffOverview }) {
  const fillPercentage = Math.min(
    100,
    (overview.activeStaffCount / Math.max(1, overview.staffCapacity)) * 100,
  );

  return (
    <section data-tutorial-id="staff-team-overview" className="mt-7 space-y-7">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionHeading
            eyebrow={`Directeur Sportif · niveau ${overview.directorLevel}`}
            title={`${overview.activeStaffCount} membre${overview.activeStaffCount > 1 ? "s" : ""} sur ${overview.staffCapacity}`}
            detail="Le niveau du DS fixe le nombre maximal de contrats actifs. La progression débloque des paliers plus importants aux niveaux supérieurs."
          />
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#DDE9E4]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#42B99A,#176951)]"
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CompactMetric
              label="Places disponibles"
              value={String(overview.availableStaffSlots)}
            />
            <CompactMetric
              label="Masse salariale"
              value={formatMoney(overview.activePayroll, overview.currency)}
            />
            <CompactMetric
              label="Échéance hebdo."
              value={formatMoney(
                Math.round(overview.activePayroll / 4),
                overview.currency,
              )}
            />
            <CompactMetric
              label="Naturalisations staff"
              value={
                overview.staffNaturalization.limit > 0
                  ? `${overview.staffNaturalization.used}/${overview.staffNaturalization.limit} cette saison`
                  : "Centre requis"
              }
            />
          </div>
          <p className="mt-4 text-xs font-bold leading-5 text-[#60756E]">
            Centre d’accueil international · niveau {overview.staffNaturalization.welcomeCenterLevel}/5 · {overview.staffNaturalization.remaining} naturalisation{overview.staffNaturalization.remaining > 1 ? "s" : ""} encore disponible{overview.staffNaturalization.remaining > 1 ? "s" : ""} vers {overview.staffNaturalization.targetCountryName}.
          </p>
        </article>

        <article className="rounded-[2rem] border border-[#F2C94C]/25 bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(7,26,23,0.14)] sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2C94C]">
            Règle d’efficacité
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Les compétences se cumulent
          </h2>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#BFD1C6]">
            Lorsque plusieurs membres du staff interviennent sur un même
            périmètre, leurs effets s’additionnent. Un staff de la nationalité
            de l’équipe reçoit 10 % d’efficacité en plus ; pour l’entraîneur,
            l’affinité se mesure avec le coureur suivi.
          </p>
          <Link
            href="/jeu/staff?onglet=marche"
            className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#9BE0BC] hover:text-white"
          >
            Compléter mon staff →
          </Link>
        </article>
      </div>

      <div>
        <SectionHeading
          eyebrow={overview.seasonName}
          title="Les spécialistes de l’équipe"
          detail="Le salaire saisonnier est réparti sur les jours 7, 14, 21 et 28. Un licenciement règle uniquement les échéances restant dans la saison en cours."
        />
        {overview.teamStaff.length > 0 ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {overview.teamStaff.map((member) => (
              <TeamStaffCard
                key={member.contractId}
                member={member}
                currentBalance={overview.balance}
                naturalization={overview.staffNaturalization}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Votre staff est encore vide"
            detail="Votre première place est disponible dès maintenant sur le marché de l’emploi."
          />
        )}
      </div>

    </section>
  );
}

function TeamStaffCard({
  member,
  currentBalance,
  naturalization,
}: {
  member: TeamStaffMember;
  currentBalance: number;
  naturalization: TeamStaffOverview["staffNaturalization"];
}) {
  const definition = STAFF_ROLE_DEFINITIONS[member.role];
  const mutualAgreement = isMutualAgreementDismissal(currentBalance);
  const dismissalCompensation = resolveDismissalCost(
    currentBalance,
    member.dismissalCompensation,
  );
  const balanceAfterDismissal = currentBalance - dismissalCompensation;

  return (
    <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_14px_38px_rgba(19,60,46,0.08)]">
      <div className="flex items-start gap-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: definition.accent }}
        >
          <StaffRoleIcon role={member.role} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
            {definition.label}
          </p>
          <h3 className="mt-1 truncate text-lg font-black text-[#183F37]">
            {member.firstName} {member.lastName}
          </h3>
          <p className="mt-1 text-xs font-bold text-[#60756E]">
            <CountryFlag code={member.countryCode} name={member.countryName} />
            {member.countryName}
          </p>
        </div>
        <LevelStars level={member.level} compact />
      </div>

      {member.trainerSpecialty ? (
        <p className="mt-4 text-xs font-black text-[#8A6714]">
          Spécialité · {TRAINER_SPECIALTY_LABELS[member.trainerSpecialty]}
        </p>
      ) : null}
      {member.architectSpecialty ? (
        <p className="mt-4 text-xs font-black text-[#7A4E28]">
          Profil · {ARCHITECT_SPECIALTY_LABELS[member.architectSpecialty]}
        </p>
      ) : null}
      <StaffEffectBlock member={member} />
      <StaffTalentBlock member={member} />
      <div className="mt-4 border-t border-[#315B3E]/10 pt-4">
        <p className="text-xs font-black text-[#183F37]">
          {formatMoney(member.salaryPerWeek, member.currency)} / semaine
        </p>
        <p className="mt-1 text-[10px] font-semibold text-[#60756E]">
          Contrat actif depuis le {formatLongDate(member.signedAt)}
        </p>
      </div>
      <StaffNaturalizationPanel
        member={member}
        naturalization={naturalization}
      />
      <div className="mt-4 rounded-2xl border border-[#C94848]/20 bg-[#FFF7F7] p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A12E2E]">
              {mutualAgreement
                ? "Licenciement à l’amiable"
                : "Indemnité de rupture"}
            </p>
            <p className="mt-1 text-lg font-black text-[#7E2424]">
              {mutualAgreement
                ? "Gratuit"
                : formatMoney(dismissalCompensation, member.currency)}
            </p>
          </div>
          <p
            className={`text-right text-[10px] font-black ${
              balanceAfterDismissal < 0 ? "text-[#C94848]" : "text-[#60756E]"
            }`}
          >
            Solde après rupture
            <br />
            {formatMoney(balanceAfterDismissal, member.currency)}
          </p>
        </div>
        <div className="mt-3 grid gap-1 text-[11px] font-semibold leading-5 text-[#775959]">
          {mutualAgreement ? (
            <p>
              Trésorerie négative · aucune indemnité ne sera débitée.
            </p>
          ) : (
            <p>
              Saison en cours ·{" "}
              {formatMoney(member.remainingCurrentSeasonSalary, member.currency)}
            </p>
          )}
        </div>
      </div>
      {member.contractId ? (
        <form action={dismissStaffMemberAction} className="mt-3">
          <input type="hidden" name="contractId" value={member.contractId} />
          <StaffDismissalSubmitButton
            staffName={`${member.firstName} ${member.lastName}`}
            compensationLabel={formatMoney(
              dismissalCompensation,
              member.currency,
            )}
            currentSeasonLabel={formatMoney(
              member.remainingCurrentSeasonSalary,
              member.currency,
            )}
            resultingBalanceLabel={formatMoney(
              balanceAfterDismissal,
              member.currency,
            )}
            resultingBalanceIsNegative={balanceAfterDismissal < 0}
            mutualAgreement={mutualAgreement}
          />
        </form>
      ) : null}
    </article>
  );
}

function StaffNaturalizationPanel({
  member,
  naturalization,
}: {
  member: TeamStaffMember;
  naturalization: TeamStaffOverview["staffNaturalization"];
}) {
  if (member.countryId === naturalization.targetCountryId) {
    return (
      <p className="mt-4 rounded-2xl border border-[#42B99A]/20 bg-[#EFF9F5] px-4 py-3 text-xs font-black text-[#176951]">
        Nationalité de l’équipe déjà acquise · {naturalization.targetCountryName}
      </p>
    );
  }

  if (naturalization.limit === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-[#315B3E]/12 bg-[#F6F8F6] px-4 py-3 text-xs font-bold leading-5 text-[#60756E]">
        Construisez le Centre d’accueil international niveau 1 pour naturaliser un membre du staff par saison.
      </p>
    );
  }

  if (naturalization.remaining === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-[#F2C94C]/30 bg-[#FFF9E5] px-4 py-3 text-xs font-bold leading-5 text-[#71580A]">
        Quota de naturalisation du staff atteint pour cette saison ({naturalization.used}/{naturalization.limit}).
      </p>
    );
  }

  return member.contractId ? (
    <div className="mt-4 rounded-2xl border border-[#F2C94C]/35 bg-[#FFF9E5] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#71580A]">
        Centre d’accueil · {naturalization.remaining}/{naturalization.limit} disponible{naturalization.remaining > 1 ? "s" : ""}
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#7B6B37]">
        La naturalisation est immédiate et consomme une place du quota de la saison.
      </p>
      <form action={naturalizeStaffMemberAction} className="mt-3">
        <input type="hidden" name="contractId" value={member.contractId} />
        <NaturalizationSubmitButton
          subjectName={`${member.firstName} ${member.lastName}`}
          targetCountryName={naturalization.targetCountryName}
          compact
        />
      </form>
    </div>
  ) : null;
}

function StaffEffectBlock({ member }: { member: TeamStaffMember }) {
  const isResearchEngineer = member.role === "research_engineer";
  const effects = isResearchEngineer
    ? member.talents.map(
        (talent) => `${talent.label} · ${talent.description}`,
      )
    : member.effects;

  return (
    <div className="mt-4 rounded-2xl border border-[#315B3E]/10 bg-[#F2F8F5] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#60756E]">
        {isResearchEngineer
          ? `Talents R&D actifs · ${member.talents.length}/3`
          : `Compétence de base · niveau ${member.level}`}
      </p>
      {effects.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-sm font-bold leading-5 text-[#176951]">
          {effects.map((effect) => (
            <li key={effect} className="flex gap-2">
              <span aria-hidden="true">◆</span>
              <span>{effect}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm font-bold leading-5 text-[#A12E2E]">
          Aucun talent R&D actif. Ce membre doit être régularisé.
        </p>
      )}
    </div>
  );
}

function StaffTalentBlock({ member }: { member: TeamStaffMember }) {
  const displayedTalents =
    member.role === "research_engineer" ? [] : member.talents;
  if (displayedTalents.length === 0 && !member.nationalityAffinity) return null;

  return (
    <div className="mt-3 space-y-3">
      {displayedTalents.length > 0 ? (
        <div className="rounded-2xl border border-[#E2A63B]/25 bg-[#FFF9E8] p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8A6714]">
            Compétences supplémentaires · {displayedTalents.length}/3
          </p>
          <div className="mt-2 space-y-3">
            {displayedTalents.map((talent) => (
              <div key={talent.code}>
                <p className="text-xs font-black text-[#5E4A18]">
                  {talent.label}
                </p>
                <p className="mt-0.5 text-xs font-bold leading-5 text-[#6D5A27]">
                  {talent.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {member.nationalityAffinity ? (
        <div className="rounded-2xl border border-[#42B99A]/20 bg-[#EFF9F5] px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#278B70]">
            Bonus d’affinité nationale
          </p>
          <p className="mt-1 text-[10px] font-black leading-5 text-[#176951]">
            {getStaffNationalityAffinityDescription()}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StaffRoleIcon({ role }: { role: StaffRole }) {
  const paths: Record<StaffRole, React.ReactNode> = {
    trainer: (
      <>
        <path d="M5 8v8M19 8v8M2 10v4M22 10v4M5 12h14" />
      </>
    ),
    scout: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 5 5M11 8v6M8 11h6" />
      </>
    ),
    doctor: (
      <>
        <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z" />
      </>
    ),
    mechanic: (
      <>
        <path d="m14 6 4-4 4 4-4 4M3 21l9-9M7 17l-3-3" />
        <circle cx="14" cy="10" r="4" />
      </>
    ),
    community_manager: (
      <>
        <path d="M4 5h16v11H9l-5 4V5Z" />
        <path d="M8 9h8M8 12h5" />
      </>
    ),
    nutritionist: (
      <>
        <path d="M12 21c-5-3-7-7-7-11 4 0 7 2 7 6" />
        <path d="M12 21c5-3 7-7 7-11-4 0-7 2-7 6V6" />
      </>
    ),
    physiotherapist: (
      <>
        <path d="M7 4v7a5 5 0 0 0 10 0V4M7 7h4M13 7h4" />
        <path d="M12 16v5" />
      </>
    ),
    race_preparer: (
      <>
        <path d="M4 18 9 7l4 8 3-6 4 9" />
        <path d="M3 21h18M6 5h6M9 2v6" />
      </>
    ),
    architect: (
      <>
        <path d="M4 21 12 3l8 18M7 15h10M9 10h6" />
      </>
    ),
    research_engineer: (
      <>
        <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />
        <path d="M8 15h8M10 18h4" />
      </>
    ),
    educator: (
      <>
        <path d="M4 5h16v12H4zM8 21h8M12 17v4" />
        <path d="m8 11 2.5 2.5L16 8" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[role]}
    </svg>
  );
}

function LevelStars({
  level,
  compact = false,
}: {
  level: number;
  compact?: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0 gap-0.5"
      aria-label={`Niveau ${level} sur 5`}
      title={`Niveau ${level} sur 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`${compact ? "text-[10px]" : "text-xs"} ${
            index < level ? "text-[#E2A63B]" : "text-[#D7E1DD]"
          }`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-black text-[#183F37]">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
        {detail}
      </p>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
        {label}
      </p>
      <p className="mt-1 text-base font-black text-[#F2C94C]">{value}</p>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#315B3E]/10 bg-[#F3F8F6] px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#60756E]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-[#183F37]">{value}</p>
    </div>
  );
}

function PriceBlock({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-[#315B3E]/10 bg-[#F7FAF8] px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-[#60756E]">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-[#183F37]">{value}</p>
      {detail ? (
        <p className="mt-1 text-[9px] font-semibold text-[#60756E]">{detail}</p>
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-[10px] font-black uppercase tracking-[0.14em] text-[#48665F]">
      {label}
      {children}
    </label>
  );
}

function CountryFlag({ code, name }: { code: string; name: string }) {
  return (
    <span
      role="img"
      aria-label={`Drapeau : ${name}`}
      className={`fi fi-${code.toLowerCase()} mr-2 overflow-hidden rounded-sm shadow-sm`}
    />
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "success"
          ? "mt-5 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900"
          : "mt-5 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900"
      }
    >
      {children}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mt-5 rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white/70 px-6 py-14 text-center">
      <h3 className="text-xl font-black text-[#183F37]">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">
        {detail}
      </p>
    </div>
  );
}

function readFilters(
  query: Record<string, string | string[] | undefined>,
): StaffMarketFilters {
  const roleValue = readQuery(query.metier);
  const levelValue = Number(readQuery(query.niveau));
  const specialtyValue = readQuery(query.specialite);

  return {
    role: isStaffRole(roleValue) ? roleValue : undefined,
    level:
      Number.isInteger(levelValue) && levelValue >= 1 && levelValue <= 5
        ? levelValue
        : undefined,
    countryCode: /^[A-Za-z]{2}$/.test(readQuery(query.pays))
      ? readQuery(query.pays).toUpperCase()
      : undefined,
    trainerSpecialty: isTrainerSpecialty(specialtyValue)
      ? specialtyValue
      : undefined,
  };
}

function readTab(value: string): StaffTab {
  return value === "equipe" ? "equipe" : "marche";
}

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00+02:00`));
}

function formatLongDate(value: string | null) {
  if (!value) return "date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

const filterClassName =
  "mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal";
