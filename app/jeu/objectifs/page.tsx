import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { claimGameObjectiveAction } from "@/app/jeu/objectifs/actions";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { ObjectiveClaimButton } from "@/components/game/objective-claim-button";
import type { GameObjective } from "@/lib/game/objectives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentGameObjectives } from "@/services/game-objectives";

export const metadata: Metadata = {
  title: "Objectifs de carrière",
  description:
    "Suivez les objectifs primaires et secondaires de votre carrière de Directeur Sportif.",
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
};

const groupLinks: Record<string, { href: string; label: string }> = {
  onboarding: { href: "/jeu/directeur-sportif", label: "Continuer ma création" },
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
};

export default async function ObjectivesPage({
  searchParams,
}: ObjectivesPageProps) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, objectives] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentGameObjectives(supabase),
  ]);

  const primaryObjectives = objectives.filter(
    (objective) => objective.type === "primary"
  );
  const secondaryObjectives = objectives.filter(
    (objective) => objective.type === "secondary"
  );
  const readyCount = objectives.filter(
    (objective) => objective.completed && !objective.claimedAt
  ).length;
  const completedCount = objectives.filter(
    (objective) => objective.completed
  ).length;
  const claimedCount = objectives.filter((objective) => objective.claimedAt).length;
  const success = readQuery(query.succes);
  const errorMessage = readQuery(query.erreur);

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
                Feuille de route · Récompenses uniques
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Objectifs de carrière
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Chaque accomplissement est mesuré à partir de vos actions et de
                vos résultats officiels. Une fois le palier atteint, récupérez
                vous-même les gains annoncés : ils ne pourront être versés
                qu’une seule fois.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <HeroMetric label="Terminés" value={`${completedCount}/${objectives.length}`} />
              <HeroMetric label="À récupérer" value={String(readyCount)} highlight />
              <HeroMetric label="Réclamés" value={String(claimedCount)} />
            </div>
          </div>
        </header>

        {success ? <Notice tone="success">{success}</Notice> : null}
        {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

        {readyCount > 0 ? (
          <aside className="mt-7 flex flex-col gap-4 rounded-2xl border border-[#D6A600]/25 bg-[#FFF7D2] p-5 shadow-[0_12px_30px_rgba(100,75,0,0.08)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2C94C] text-lg font-black text-[#071A17]">
                {readyCount}
              </span>
              <div>
                <p className="font-black text-[#4A3A00]">
                  {readyCount === 1
                    ? "Une récompense vous attend"
                    : `${readyCount} récompenses vous attendent`}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#75631C]">
                  Les objectifs prêts à être réclamés sont signalés en premier.
                </p>
              </div>
            </div>
            <span className="text-xs font-black uppercase tracking-[0.15em] text-[#8A7000]">
              Versement immédiat et définitif
            </span>
          </aside>
        ) : null}

        <ObjectiveSection
          eyebrow="Parcours fondateur"
          title="Objectifs primaires"
          description="Les quatre jalons qui installent les bases de votre carrière et débloquent rapidement vos premiers moyens."
          objectives={primaryObjectives}
          featured
        />

        <ObjectiveSection
          eyebrow="Développement de carrière"
          title="Objectifs secondaires"
          description="Des paliers durables dans toutes les dimensions du club. Les niveaux supérieurs offrent les objets les plus rares."
          objectives={secondaryObjectives}
        />
      </section>
    </main>
  );
}

function ObjectiveSection({
  eyebrow,
  title,
  description,
  objectives,
  featured = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  objectives: GameObjective[];
  featured?: boolean;
}) {
  const sectionId = featured
    ? "primary-career-objectives"
    : "secondary-career-objectives";

  return (
    <section className="mt-10" aria-labelledby={sectionId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
            {eyebrow}
          </p>
          <h2 id={sectionId} className="mt-2 text-3xl font-black tracking-tight">
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
          <ObjectiveCard key={objective.key} objective={objective} featured={featured} />
        ))}
      </div>
    </section>
  );
}

function ObjectiveCard({
  objective,
  featured,
}: {
  objective: GameObjective;
  featured: boolean;
}) {
  const ready = objective.completed && !objective.claimedAt;
  const claimed = Boolean(objective.claimedAt);
  const groupLink = groupLinks[objective.group];

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

      <h3 className={`mt-5 font-black text-[#183F37] ${featured ? "text-2xl" : "text-xl"}`}>
        {objective.title}
      </h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
        {objective.description}
      </p>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 text-xs font-black">
          <span className="uppercase tracking-[0.12em] text-[#60756E]">Progression</span>
          <span className={ready ? "text-[#8A7000]" : "text-[#176951]"}>
            {formatProgressValue(objective.currentValue)} / {formatProgressValue(objective.targetValue)}
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
      <p className={`mt-1 text-2xl font-black ${highlight ? "text-[#F2C94C]" : "text-white"}`}>
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
