import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { claimGameObjectiveAction } from "@/app/jeu/objectifs/actions";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { DailyRewardsPanel } from "@/components/game/daily-rewards-panel";
import { GameHeader } from "@/components/game/game-header";
import { ObjectiveClaimButton } from "@/components/game/objective-claim-button";
import { ObjectiveFilters } from "@/components/game/objective-filters";
import { TrophyGallery } from "@/components/game/trophy-gallery";
import Link from "@/components/ui/app-link";
import { buildObjectivesReturnPath } from "@/lib/game/filtered-page-paths";
import { getAchievementTrophyForObjective } from "@/lib/game/achievement-trophies";
import {
  filterGameObjectives,
  parseGameObjectiveStatusFilter,
  parseGameObjectiveTypeFilter,
  type GameObjective,
} from "@/lib/game/objectives";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentGameObjectives } from "@/services/game-objectives";
import { getCurrentDailyRewardOverview } from "@/services/daily-rewards";
import { getSportingDirectorTrophyGallery } from "@/services/trophy-gallery";

export const metadata: Metadata = {
  title: "Récompenses & trophées",
  description:
    "Suivez vos objectifs, récupérez vos récompenses et exposez les trophées de votre carrière de Directeur Sportif.",
};

type ObjectivesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const groupLabels: Record<string, string> = {
  onboarding: "Début de carrière",
  victories: "Victoires",
  roster: "Effectif",
  equipment: "Matériel",
  staff: "Staff",
  progression: "Progression du DS",
  jerseys: "Maillots distinctifs",
  participations: "Participations",
  wildcards: "Wildcards",
  racing: "Animation de course",
  sponsoring: "Sponsoring",
  monuments: "Monuments",
  grand_tours: "Grands Tours",
  rankings: "Classements UCI",
  youth: "Centre de formation",
  training: "Entraînement",
  reconnaissance: "Reconnaissance",
  health: "Santé et récupération",
  tutorials: "Didacticiels",
  infrastructures: "Infrastructures",
  rider_preparation: "Préparation coureurs",
  research: "Laboratoire R&D",
  social: "Vie du peloton",
  diversity: "Diversité",
  referrals: "Parrainage",
  fan_club: "Fan Club",
  championships: "Championnats",
};

const groupLinks: Record<string, { href: string; label: string }> = {
  onboarding: {
    href: "/jeu/directeur-sportif",
    label: "Continuer ma création",
  },
  victories: { href: "/jeu/resultats", label: "Voir les résultats" },
  roster: { href: "/jeu/effectif", label: "Gérer l’effectif" },
  equipment: { href: "/jeu/materiel", label: "Voir le matériel" },
  staff: { href: "/jeu/staff", label: "Gérer le staff" },
  progression: { href: "/jeu/directeur-sportif", label: "Voir ma progression" },
  jerseys: { href: "/jeu/resultats", label: "Voir les résultats" },
  participations: { href: "/jeu/calendrier", label: "Voir le calendrier" },
  wildcards: { href: "/jeu/calendrier", label: "Voir le calendrier" },
  racing: { href: "/jeu/resultats", label: "Voir les courses" },
  sponsoring: { href: "/jeu/sponsoring", label: "Voir le sponsoring" },
  monuments: { href: "/jeu/calendrier", label: "Voir le calendrier" },
  grand_tours: { href: "/jeu/calendrier", label: "Voir le calendrier" },
  rankings: { href: "/jeu/classements", label: "Voir les classements" },
  youth: { href: "/jeu/centre-de-formation", label: "Voir les juniors" },
  training: { href: "/jeu/entrainement", label: "Gérer l’entraînement" },
  reconnaissance: { href: "/jeu/entrainement", label: "Planifier un stage" },
  health: { href: "/jeu/centre-de-soin", label: "Voir le centre médical" },
  tutorials: { href: "/jeu", label: "Ouvrir les didacticiels" },
  infrastructures: {
    href: "/jeu/infrastructures",
    label: "Voir les infrastructures",
  },
  rider_preparation: {
    href: "/jeu/entrainement",
    label: "Préparer les coureurs",
  },
  research: {
    href: "/jeu/materiel/laboratoire",
    label: "Ouvrir le laboratoire",
  },
  social: { href: "/jeu/gazette", label: "Lire la Cyclogazette" },
  diversity: { href: "/jeu/effectif", label: "Voir le collectif" },
  referrals: { href: "/jeu/parrainage", label: "Voir le parrainage" },
  fan_club: { href: "/jeu/fan-club", label: "Ouvrir le Fan Club" },
  championships: { href: "/jeu/resultats", label: "Voir les championnats" },
};

export default async function ObjectivesPage({
  searchParams,
}: ObjectivesPageProps) {
  const query = await searchParams;
  const requestedTab = readQuery(query.onglet);
  const selectedTab =
    requestedTab === "trophees" || requestedTab === "quotidiennes"
      ? requestedTab
      : "objectifs";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, objectives, trophyGallery, dailyRewards] =
    await Promise.all([
      getGameHeaderData(supabase, user.id),
      getCurrentGameObjectives(supabase),
      getSportingDirectorTrophyGallery(user.id),
      getCurrentDailyRewardOverview(supabase),
    ]);

  const availableGroups = Array.from(
    new Set(objectives.map((objective) => objective.group)),
  );
  const requestedGroup = readQuery(query.groupe);
  const selectedGroup =
    requestedGroup && availableGroups.includes(requestedGroup)
      ? requestedGroup
      : "all";
  const selectedType = parseGameObjectiveTypeFilter(readQuery(query.type));
  const selectedStatus = parseGameObjectiveStatusFilter(
    readQuery(query.statut),
  );
  const visibleObjectives = filterGameObjectives(objectives, {
    type: selectedType,
    status: selectedStatus,
    group: selectedGroup,
  });
  const primaryObjectives = visibleObjectives.filter(
    (objective) => objective.type === "primary",
  );
  const secondaryObjectives = visibleObjectives.filter(
    (objective) => objective.type === "secondary",
  );
  const groupOptions = availableGroups
    .map((group) => ({ value: group, label: groupLabels[group] ?? group }))
    .sort((left, right) => left.label.localeCompare(right.label, "fr"));
  const readyObjectiveCount = objectives.filter(
    (objective) => objective.completed && !objective.claimedAt,
  ).length;
  const readyCount =
    readyObjectiveCount + trophyGallery.claimableTrophies.length;
  const completedCount = objectives.filter(
    (objective) => objective.completed,
  ).length;
  const claimedCount =
    objectives.filter((objective) => objective.claimedAt).length +
    trophyGallery.counts.special;
  const success = readQuery(query.succes);
  const errorMessage = readQuery(query.erreur);
  const returnPath = buildObjectivesReturnPath({
    type: selectedType,
    status: selectedStatus,
    group: selectedGroup,
  });

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

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17_0%,#0B302B_52%,#176951_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.22)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-28 h-96 w-96 rounded-full border-[64px] border-white/5"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-1 w-full bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]"
          />

          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Carrière du Directeur Sportif
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Récompenses & trophées
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Progressez grâce aux objectifs, puis retrouvez dans votre
                galerie chaque victoire majeure et chaque titre UCI inscrit à
                votre palmarès officiel.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur sm:grid-cols-4 xl:grid-cols-2">
              <HeroMetric
                label="Terminés"
                value={`${completedCount}/${objectives.length}`}
              />
              <HeroMetric
                label="À récupérer"
                value={String(readyCount)}
                highlight
              />
              <HeroMetric label="Réclamés" value={String(claimedCount)} />
              <HeroMetric
                label="Trophées"
                value={String(trophyGallery.counts.total)}
                highlight={trophyGallery.counts.total > 0}
              />
            </div>
          </div>
        </header>

        <nav
          aria-label="Rubriques des récompenses"
          className="mt-7 grid rounded-2xl border border-[#315B3E]/14 bg-white p-2 shadow-[0_14px_40px_rgba(19,60,46,0.09)] sm:grid-cols-3"
        >
          <CareerTab
            href="/jeu/objectifs?onglet=objectifs"
            label="Objectifs & récompenses"
            description="Suivre les paliers et récupérer les gains"
            active={selectedTab === "objectifs"}
          />
          <CareerTab
            href="/jeu/objectifs?onglet=quotidiennes"
            label="Récompenses quotidiennes"
            description={
              dailyRewards?.availableToday
                ? "Cadeau du jour à ouvrir"
                : `${dailyRewards?.consecutiveDays ?? 0} jour${(dailyRewards?.consecutiveDays ?? 0) > 1 ? "s" : ""} consécutif${(dailyRewards?.consecutiveDays ?? 0) > 1 ? "s" : ""}`
            }
            active={selectedTab === "quotidiennes"}
          />
          <CareerTab
            href="/jeu/objectifs?onglet=trophees"
            label="Galerie des trophées"
            description={
              trophyGallery.claimableTrophies.length > 0
                ? `${trophyGallery.claimableTrophies.length} cadeau à ouvrir`
                : `${trophyGallery.counts.total} pièce${trophyGallery.counts.total > 1 ? "s" : ""} au palmarès`
            }
            active={selectedTab === "trophees"}
          />
        </nav>

        {selectedTab === "objectifs" ? (
          <>
            {success ? <Notice tone="success">{success}</Notice> : null}
            {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

            {readyObjectiveCount > 0 ? (
              <aside className="mt-7 flex flex-col gap-4 rounded-2xl border border-[#D6A600]/25 bg-[#FFF7D2] p-5 shadow-[0_12px_30px_rgba(100,75,0,0.08)] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2C94C] text-lg font-black text-[#071A17]">
                    {readyObjectiveCount}
                  </span>
                  <div>
                    <p className="font-black text-[#4A3A00]">
                      {readyObjectiveCount === 1
                        ? "Une récompense vous attend"
                        : `${readyObjectiveCount} récompenses vous attendent`}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#75631C]">
                      Les objectifs prêts à être réclamés sont signalés en
                      premier.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black uppercase tracking-[0.15em] text-[#8A7000]">
                  Versement immédiat et définitif
                </span>
                <Link
                  href="/jeu/objectifs?onglet=objectifs&statut=completed#objectives-list"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-5 text-xs font-black uppercase tracking-[0.12em] text-[#4A3A00] transition hover:bg-[#E8BC32]"
                >
                  Afficher et récupérer →
                </Link>
              </aside>
            ) : null}

            <div id="objectives-list" className="scroll-mt-6">
              <ObjectiveFilters
                key={`${selectedType}-${selectedStatus}-${selectedGroup}`}
                groups={groupOptions}
                initialType={selectedType}
                initialStatus={selectedStatus}
                initialGroup={selectedGroup}
                totalCount={objectives.length}
                visibleCount={visibleObjectives.length}
              />
            </div>

            <ObjectiveSection
              eyebrow="Parcours fondateur"
              title="Objectifs primaires"
              description="Les quatre jalons qui installent les bases de votre carrière et débloquent rapidement vos premiers moyens."
              objectives={primaryObjectives}
              returnPath={returnPath}
              featured
            />

            <ObjectiveSection
              eyebrow="Développement de carrière"
              title="Objectifs secondaires"
              description="Des paliers durables dans toutes les dimensions du club. Les niveaux supérieurs offrent les objets les plus rares."
              objectives={secondaryObjectives}
              returnPath={returnPath}
            />

            {visibleObjectives.length === 0 ? (
              <div className="mt-8 rounded-[1.65rem] border border-dashed border-[#315B3E]/25 bg-white px-6 py-12 text-center">
                <p className="text-xl font-black text-[#183F37]">
                  Aucun objectif ne correspond à ces filtres.
                </p>
                <Link
                  href="/jeu/objectifs?onglet=objectifs#objectives-list"
                  className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#176951] px-5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#0B302B]"
                >
                  Réinitialiser les filtres
                </Link>
              </div>
            ) : null}
          </>
        ) : selectedTab === "quotidiennes" ? (
          <>
            {success ? <Notice tone="success">{success}</Notice> : null}
            {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}
            <DailyRewardsPanel overview={dailyRewards} />
          </>
        ) : (
          <TrophyGallery gallery={trophyGallery} />
        )}
      </section>
    </main>
  );
}

function CareerTab({
  href,
  label,
  description,
  active,
}: {
  href: string;
  label: string;
  description: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-xl px-5 py-4 transition ${
        active
          ? "bg-[#123F36] text-white shadow-[0_10px_25px_rgba(18,63,54,0.18)]"
          : "text-[#183F37] hover:bg-[#F0F7F3]"
      }`}
    >
      <span className="block text-sm font-black">{label}</span>
      <span
        className={`mt-1 block text-xs font-semibold ${
          active ? "text-[#ABD5C2]" : "text-[#789087]"
        }`}
      >
        {description}
      </span>
    </Link>
  );
}
function ObjectiveSection({
  eyebrow,
  title,
  description,
  objectives,
  returnPath,
  featured = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  objectives: GameObjective[];
  returnPath: string;
  featured?: boolean;
}) {
  const sectionId = featured
    ? "primary-career-objectives"
    : "secondary-career-objectives";

  if (objectives.length === 0) {
    return null;
  }

  return (
    <section className="mt-10" aria-labelledby={sectionId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
            {eyebrow}
          </p>
          <h2
            id={sectionId}
            className="mt-2 text-3xl font-black tracking-tight"
          >
            {title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm font-semibold leading-6 text-[#60756E] sm:text-right">
          {description}
        </p>
      </div>

      <div
        className={`mt-6 grid gap-5 ${
          featured ? "xl:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"
        }`}
      >
        {objectives.map((objective) => (
          <ObjectiveCard
            key={objective.key}
            objective={objective}
            featured={featured}
            returnPath={returnPath}
          />
        ))}
      </div>
    </section>
  );
}

function ObjectiveCard({
  objective,
  featured,
  returnPath,
}: {
  objective: GameObjective;
  featured: boolean;
  returnPath: string;
}) {
  const ready = objective.completed && !objective.claimedAt;
  const claimed = Boolean(objective.claimedAt);
  const groupLink = groupLinks[objective.group];
  const trophyReward = getAchievementTrophyForObjective(objective.key);

  return (
    <article
      className={`relative flex min-h-full flex-col overflow-hidden rounded-[1.65rem] border p-5 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-6 ${
        ready
          ? "border-[#D5AC18]/45 bg-[#FFFDF4] ring-2 ring-[#F2C94C]/25"
          : claimed
            ? "border-[#315B3E]/10 bg-[#F4F7F5]"
            : "border-[#315B3E]/14 bg-white"
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 ${
          ready
            ? "bg-[#F2C94C]"
            : objective.type === "primary"
              ? "bg-[#42B99A]"
              : "bg-[#9AB4AA]"
        }`}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
              objective.type === "primary"
                ? "bg-[#DDF3E7] text-[#176951]"
                : "bg-[#EAF0ED] text-[#526B62]"
            }`}
          >
            {objective.type === "primary" ? "Primaire" : "Secondaire"}
          </span>
          <span className="rounded-full bg-[#EFF4F1] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#60756E]">
            {groupLabels[objective.group] ?? objective.group}
          </span>
        </div>

        <ObjectiveStatus objective={objective} />
      </div>

      <h3
        className={`mt-5 font-black text-[#183F37] ${featured ? "text-2xl" : "text-xl"}`}
      >
        {objective.title}
      </h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
        {objective.description}
      </p>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 text-xs font-black">
          <span className="uppercase tracking-[0.12em] text-[#60756E]">
            Progression
          </span>
          <span className={ready ? "text-[#8A7000]" : "text-[#176951]"}>
            {formatProgressValue(objective.currentValue)} /{" "}
            {formatProgressValue(objective.targetValue)}
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#DCE7E2]">
          <div
            className={`h-full rounded-full transition-all ${
              ready || claimed ? "bg-[#F2C94C]" : "bg-[#42B99A]"
            }`}
            style={{ width: `${objective.progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-right text-[11px] font-bold text-[#789087]">
          {objective.progressPercent} %
        </p>
      </div>

      <div className="mt-5 border-t border-[#315B3E]/10 pt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">
          Récompense annoncée
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {objective.reward.cash > 0 ? (
            <RewardChip icon="€" label={formatMoney(objective.reward.cash)} />
          ) : null}
          {objective.reward.experience > 0 ? (
            <RewardChip icon="XP" label={`${objective.reward.experience} XP`} />
          ) : null}
          {objective.reward.reputation > 0 ? (
            <RewardChip
              icon="★"
              label={`${formatProgressValue(objective.reward.reputation)} réputation`}
            />
          ) : null}
          {trophyReward ? (
            <RewardChip
              icon="♛"
              label={`Trophée · ${trophyReward.title}`}
              rare
            />
          ) : null}
          {objective.reward.itemName ? (
            <RewardChip
              icon={getRewardItemIcon(objective.reward.itemKind)}
              label={objective.reward.itemName}
              rare={objective.reward.itemKind === "special_ability"}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-auto pt-5">
        {ready ? (
          <form action={claimGameObjectiveAction}>
            <input type="hidden" name="objectiveKey" value={objective.key} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <ObjectiveClaimButton />
          </form>
        ) : claimed ? (
          <p className="inline-flex min-h-11 items-center rounded-xl bg-[#DDF3E7] px-4 py-2 text-xs font-black text-[#176951]">
            ✓ Récompense récupérée le {formatDate(objective.claimedAt!)}
          </p>
        ) : groupLink ? (
          <Link
            href={groupLink.href}
            className="inline-flex min-h-10 items-center text-xs font-black uppercase tracking-[0.12em] text-[#176951] transition hover:text-[#0B302B]"
          >
            {groupLink.label} →
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function ObjectiveStatus({ objective }: { objective: GameObjective }) {
  if (objective.claimedAt) {
    return (
      <span className="shrink-0 rounded-full bg-[#DDF3E7] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#176951]">
        Récupéré
      </span>
    );
  }

  if (objective.completed) {
    return (
      <span className="shrink-0 animate-pulse rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#071A17]">
        À récupérer
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-[#EAF0ED] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#60756E]">
      En cours
    </span>
  );
}

function RewardChip({
  icon,
  label,
  rare = false,
}: {
  icon: string;
  label: string;
  rare?: boolean;
}) {
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-black ${
        rare
          ? "border-[#CBA021]/35 bg-[#FFF4B8] text-[#665000]"
          : "border-[#315B3E]/10 bg-[#F3F8F6] text-[#315B3E]"
      }`}
    >
      <span aria-hidden="true" className="text-[10px]">
        {icon}
      </span>
      {label}
    </span>
  );
}

function HeroMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-24 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#BFD1C6]">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-black ${highlight ? "text-[#F2C94C]" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${
        tone === "success"
          ? "border-[#42B99A]/35 bg-[#DDF3E7] text-[#176951]"
          : "border-[#C75348]/25 bg-[#FFF0EE] text-[#9C352D]"
      }`}
    >
      {children}
    </div>
  );
}

function getRewardItemIcon(kind: GameObjective["reward"]["itemKind"]) {
  if (kind === "equipment") return "◆";
  if (kind === "special_ability") return "✦";
  if (kind === "potential_boost") return "↗";
  if (kind === "rating_boost") return "+";
  return "●";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatProgressValue(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function readQuery(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}
