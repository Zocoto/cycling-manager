import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { hireStaffMemberAction } from "@/app/jeu/staff/actions";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { StaffSubmitButton } from "@/components/game/staff-submit-button";
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
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    detail: "25 profils communs à tous les DS · renouvelés chaque jour",
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
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getTeamStaffOverview(supabase, user.id, filters),
  ]);

  if (!overview) {
    redirect("/jeu");
  }

  const success = readQuery(query.succes);
  const errorMessage = readQuery(query.erreur);
  const marketReturnPath = buildMarketReturnPath(filters);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-24 h-80 w-80 rounded-full border-[52px] border-white/5"
          />
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Entraînements · Staff · Infrastructures
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Direction du staff
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Entourez {overview.teamName} de spécialistes. Chaque signature
                occupe une place liée à votre niveau de DS et engage la
                trésorerie immédiatement, puis quatre échéances salariales par
                saison.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur sm:grid-cols-4">
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

        <nav
          className="mt-7 grid gap-3 lg:grid-cols-2"
          aria-label="Rubriques du staff"
        >
          {tabs.map((entry) => (
            <Link
              key={entry.id}
              href={`/jeu/staff?onglet=${entry.id}`}
              aria-current={tab === entry.id ? "page" : undefined}
              className={
                tab === entry.id
                  ? "rounded-2xl border border-[#42B99A] bg-[#0B302B] p-5 text-white shadow-[0_16px_40px_rgba(7,26,23,0.18)]"
                  : "rounded-2xl border border-[#315B3E]/15 bg-white p-5 text-[#183F37] transition hover:-translate-y-0.5 hover:border-[#42B99A]/50"
              }
            >
              <span className="block text-lg font-black">{entry.label}</span>
              <span
                className={
                  tab === entry.id
                    ? "mt-1 block text-xs font-bold text-[#9BE0BC]"
                    : "mt-1 block text-xs font-bold text-[#60756E]"
                }
              >
                {entry.detail}
              </span>
            </Link>
          ))}
        </nav>

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          eyebrow={`Sélection du ${formatDate(overview.marketDate)}`}
          title="25 spécialistes sur le marché mondial"
          detail="Le pool est identique pour tous les joueurs. Une signature est définitive : dès qu’un DS recrute un profil, celui-ci n’est plus disponible pour les autres équipes."
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

      <form className="mt-5 grid gap-3 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_35px_rgba(19,60,46,0.07)] md:grid-cols-2 xl:grid-cols-5">
        <input type="hidden" name="onglet" value="marche" />
        <FilterField label="Nom">
          <input
            name="recherche"
            defaultValue={readQuery(query.recherche)}
            placeholder="Rechercher…"
            className={filterClassName}
          />
        </FilterField>
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
        <div className="flex flex-wrap gap-3 xl:col-span-5">
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
          title="Aucun profil ne correspond à ces filtres"
          detail="Élargissez les critères pour retrouver les 25 membres du marché du jour."
        />
      )}
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
    <article className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)]">
      <div
        className="h-1.5"
        style={{ backgroundColor: definition.accent }}
      />
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

        <div className="mt-4 rounded-2xl bg-[#F2F8F5] p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#60756E]">
            Effet niveau {member.level}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm font-bold leading-5 text-[#176951]">
            {member.effects.map((effect) => (
              <li key={effect} className="flex gap-2">
                <span aria-hidden="true">◆</span>
                <span>{effect}</span>
              </li>
            ))}
          </ul>
        </div>

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

        {listing.status === "available" ? (
          <form action={hireStaffMemberAction} className="mt-4">
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <StaffSubmitButton disabled={!listing.canHire}>
              Recruter
            </StaffSubmitButton>
          </form>
        ) : (
          <p
            className={
              listing.hiredByCurrentTeam
                ? "mt-4 rounded-xl bg-[#DDF3E7] px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-[#176951]"
                : "mt-4 rounded-xl bg-[#EEF1F0] px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-[#60756E]"
            }
          >
            {listing.hiredByCurrentTeam
              ? "Dans votre staff"
              : "Déjà recruté"}
          </p>
        )}

        {listing.hireBlockedReason && !listing.hiredByCurrentTeam ? (
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
    <section className="mt-7 space-y-7">
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
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
          </div>
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
            périmètre, leurs effets s’additionnent. La nationalité du scout
            définit sa zone géographique de prédilection.
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
          detail="Le salaire saisonnier est réparti sur les jours 7, 14, 21 et 28. La prime de signature est débitée immédiatement."
        />
        {overview.teamStaff.length > 0 ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {overview.teamStaff.map((member) => (
              <TeamStaffCard key={member.contractId} member={member} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Votre staff est encore vide"
            detail="Votre première place est disponible dès maintenant sur le marché de l’emploi."
          />
        )}
      </div>

      <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
          Connexions fonctionnelles
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#183F37]">
          Un modèle prêt pour le triptyque
        </h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ConnectionCard
            title="Effet actif immédiatement"
            detail="Le community manager augmente automatiquement chaque gain de réputation de 2 à 10 %."
          />
          <ConnectionCard
            title="Soins actifs"
            detail="Médecins, kinés et nutritionnistes sont reliés au centre de soin, avec effets et capacités dépendant de leur niveau."
          />
          <ConnectionCard
            title="Reconnaissances"
            detail="Le préparateur de parcours augmente de 5 à 25 % le bonus gagné sur l’étape étudiée."
          />
          <ConnectionCard
            title="Relève et futurs chantiers"
            detail="Le niveau du scout renforce déjà le potentiel et les notes initiales des jeunes. L’architecte réduira coût et durée de 5 à 25 % dès l’ouverture des chantiers."
          />
        </div>
      </article>
    </section>
  );
}

function TeamStaffCard({ member }: { member: TeamStaffMember }) {
  const definition = STAFF_ROLE_DEFINITIONS[member.role];

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
      <ul className="mt-4 space-y-2 text-sm font-bold leading-5 text-[#176951]">
        {member.effects.map((effect) => (
          <li key={effect}>◆ {effect}</li>
        ))}
      </ul>
      <div className="mt-4 border-t border-[#315B3E]/10 pt-4">
        <p className="text-xs font-black text-[#183F37]">
          {formatMoney(member.salaryPerWeek, member.currency)} / semaine
        </p>
        <p className="mt-1 text-[10px] font-semibold text-[#60756E]">
          Contrat actif depuis le {formatLongDate(member.signedAt)}
        </p>
      </div>
    </article>
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
      aria-label={`Drapeau : ${name}`}
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

function ConnectionCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#315B3E]/10 bg-[#F3F8F6] p-5">
      <h3 className="font-black text-[#183F37]">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
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
    search: readQuery(query.recherche) || undefined,
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

function buildMarketReturnPath(filters: StaffMarketFilters) {
  const params = new URLSearchParams({ onglet: "marche" });
  if (filters.search) params.set("recherche", filters.search);
  if (filters.role) params.set("metier", filters.role);
  if (filters.level) params.set("niveau", String(filters.level));
  if (filters.countryCode) params.set("pays", filters.countryCode);
  if (filters.trainerSpecialty) {
    params.set("specialite", filters.trainerSpecialty);
  }
  return `/jeu/staff?${params.toString()}`;
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
