"use client";

import { createContext, memo, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { claimCycloStickersObjectiveAction, claimGameObjectiveAction } from "@/app/jeu/objectifs/actions";
import { GameSectionTabLink } from "@/components/game/game-section-tabs";
import { ObjectiveClaimButton } from "@/components/game/objective-claim-button";
import { ObjectiveFilters } from "@/components/game/objective-filters";
import Link from "@/components/ui/app-link";
import { getAchievementTrophyForObjective, getAlbumCompletionTrophy } from "@/lib/game/achievement-trophies";
import { PATRIOT_OBJECTIVE_KEY } from "@/lib/game/patriot-achievement";
import { getProspectiveAchievement } from "@/lib/game/prospective-achievements";
import { claimRewardObjective, type ObjectiveClaimReceipt } from "@/lib/game/objective-claim-client";
import { filterGameObjectives, getGameObjectiveLongTermTier, normalizeGameObjective, summarizeGameObjectiveRewards,
  type GameObjective, type GameObjectiveFilters, type GameObjectiveRow } from "@/lib/game/objectives";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TUTORIAL_CENTER_ROUTE } from "@/lib/tutorial/tutorial-center-route";
import type { RewardsPageObjective } from "@/services/game-objectives";

type ClaimNotice = { tone: "success" | "error"; message: string };
type ObjectivesClaimsState = {
  objectives: RewardsPageObjective[];
  pendingKey: string | null;
  notice: ClaimNotice | null;
  claim: (objective: RewardsPageObjective) => Promise<void>;
};
const ObjectivesClaimsContext = createContext<ObjectivesClaimsState | null>(null);
const isReady = (objective: GameObjective) => objective.completed && !objective.claimedAt;
function withReceipt(objective: RewardsPageObjective, receipt?: ObjectiveClaimReceipt): RewardsPageObjective {
  if (!receipt) return objective;
  return { ...objective, completed: true, claimedAt: receipt.claimedAt,
    reward: { ...objective.reward, itemName: receipt.itemName ?? objective.reward.itemName } };
}

/** Only acknowledged server claims change a card. No redirect or page refresh is
 * needed to collect the next reward, while fresh progression is reconciled once
 * the manager stops clicking through the current group of rewards. */
export function ObjectivesClaimProvider({ initialObjectives, ownerUserId, children }: {
  initialObjectives: RewardsPageObjective[]; ownerUserId: string; children: ReactNode;
}) {
  const [objectives, setObjectives] = useState(initialObjectives);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<ClaimNotice | null>(null);
  const lock = useRef(false);
  const active = useRef(true);
  const revision = useRef(0);
  const receipts = useRef(new Map<string, ObjectiveClaimReceipt>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      revision.current += 1;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshAbort.current?.abort();
    };
  }, []);

  useEffect(() => {
    // A refresh of this URL keeps the provider mounted. Accept its fresh server
    // snapshot while retaining receipts confirmed after that request began.
    revision.current += 1;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = null;
    refreshAbort.current?.abort();
    setObjectives(initialObjectives.map(objective => withReceipt(objective, receipts.current.get(objective.key))));
  }, [initialObjectives]);

  async function refreshProgress(version: number) {
    if (!active.current || version !== revision.current) return;
    const controller = new AbortController();
    refreshAbort.current = controller;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== ownerUserId) return;
      const result = await supabase.rpc("get_current_game_objectives").abortSignal(controller.signal);
      if (!active.current || version !== revision.current || controller.signal.aborted) return;
      if (result.error || !Array.isArray(result.data)) throw new Error("Objectives progression refresh failed");
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!active.current || version !== revision.current || currentSession?.user.id !== ownerUserId) return;
      const fresh = (result.data as GameObjectiveRow[]).map(normalizeGameObjective);
      setObjectives(current => [
        ...fresh.map(objective => withReceipt(objective, receipts.current.get(objective.key))),
        ...current.filter(objective => objective.album),
      ]);
    } catch (error) {
      if (!active.current || version !== revision.current || controller.signal.aborted) return;
      console.error("Impossible d’actualiser les autres objectifs après la récompense.", error);
      setNotice({ tone: "error", message: "Les gains sont bien attribués. Actualisez la page pour mettre à jour les autres objectifs." });
    } finally {
      if (refreshAbort.current === controller) refreshAbort.current = null;
    }
  }

  async function claim(objective: RewardsPageObjective) {
    if (lock.current || receipts.current.has(objective.key) || !isReady(objective)) return;
    lock.current = true;
    setPendingKey(objective.key);
    setNotice(null);
    try {
      const receipt = await claimRewardObjective(objective, ownerUserId);
      if (!active.current) return;
      receipts.current.set(objective.key, receipt);
      const version = ++revision.current;
      setObjectives(current => current.map(row => row.key === objective.key ? withReceipt(row, receipt) : row));
      setNotice({ tone: "success", message: receipt.alreadyClaimed
        ? "Cette récompense a déjà été récupérée."
        : "Récompense récupérée : les gains ont été ajoutés à votre carrière." });
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => { refreshTimer.current = null; void refreshProgress(version); }, 350);
    } catch (error) {
      if (active.current) setNotice({ tone: "error", message: error instanceof Error
        ? error.message : "L’action n’a pas pu être confirmée. Réessayez pour vérifier votre récompense." });
    } finally {
      lock.current = false;
      if (active.current) setPendingKey(null);
    }
  }
  const sortedObjectives = [...objectives].sort((left,right) => Number(isReady(right)) - Number(isReady(left)));
  return <ObjectivesClaimsContext.Provider value={{objectives: sortedObjectives, pendingKey, notice, claim}}>{children}</ObjectivesClaimsContext.Provider>;
}
function useObjectiveClaims() {
  const state = useContext(ObjectivesClaimsContext);
  if (!state) throw new Error("Objective claims provider is missing");
  return state;
}

export function ObjectivesHeroMetrics() {
  const {objectives} = useObjectiveClaims();
  const {completedCount, readyCount, claimedCount} = summarizeGameObjectiveRewards(objectives);
  return <>
    <HeroMetric label="Terminés" value={completedCount + "/" + objectives.length} />
    <HeroMetric label="À récupérer" value={String(readyCount)} highlight />
    <HeroMetric label="Réclamés" value={String(claimedCount)} />
  </>;
}
export function ObjectivesTabLink({active}: {active: boolean}) {
  const {objectives} = useObjectiveClaims();
  const ready = summarizeGameObjectiveRewards(objectives).readyCount;
  const albumReady = summarizeGameObjectiveRewards(objectives.filter(objective => objective.album)).readyCount;
  return <GameSectionTabLink href="/jeu/objectifs?onglet=objectifs" label="Objectifs & récompenses"
    description={albumReady > 0 ? "Récompenses Cyclo-Stickers à récupérer" : "Suivre les paliers et récupérer les gains"}
    badge={active ? ready : albumReady} active={active} />;
}
export function ObjectivesPanel({filters, returnPath, success, errorMessage}: {
  filters: GameObjectiveFilters; returnPath: string; success: string | null; errorMessage: string | null;
}) {
  const {objectives, notice} = useObjectiveClaims();
  const visibleObjectives = filterGameObjectives(objectives, filters);
  const {readyCount} = summarizeGameObjectiveRewards(objectives);
  const albumReadyCount = summarizeGameObjectiveRewards(objectives.filter(objective => objective.album)).readyCount;
  const groups = Array.from(new Set(objectives.map(objective => objective.group)))
    .map(group => ({value: group, label: groupLabels[group] ?? group})).sort((left,right) => left.label.localeCompare(right.label, "fr"));
  return <>
    {notice ? <Notice tone={notice.tone}>{notice.message}</Notice> : <>
      {success ? <Notice tone="success">{success}</Notice> : null}
      {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}
    </>}
    {readyCount > 0 ? <aside className="mt-7 flex flex-col gap-4 rounded-2xl border border-[#D6A600]/25 bg-[#FFF7D2] p-5 shadow-[0_12px_30px_rgba(100,75,0,0.08)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2C94C] text-lg font-black text-[#071A17]">{readyCount}</span>
        <div><p className="font-black text-[#4A3A00]">{readyCount === 1 ? "Une récompense vous attend" : readyCount + " récompenses vous attendent"}</p>
          <p className="mt-1 text-sm font-semibold text-[#75631C]">Les objectifs prêts à être réclamés sont signalés en premier.</p></div></div>
      <div className="flex flex-wrap items-center gap-3">
        {albumReadyCount > 0 ? <Link href="/jeu/objectifs?onglet=objectifs&groupe=cyclo_stickers&statut=completed#objectives-list" className="inline-flex min-h-11 items-center rounded-xl border border-[#D6A600]/35 px-4 text-xs font-black text-[#4A3A00] hover:bg-[#FFF0AF]">Cyclo-Stickers ({albumReadyCount})</Link> : null}
        <Link href="/jeu/objectifs?onglet=objectifs&statut=completed#objectives-list" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-5 text-xs font-black uppercase tracking-[0.12em] text-[#4A3A00] transition hover:bg-[#E8BC32]">Afficher et récupérer →</Link>
      </div>
    </aside> : null}
    <div id="objectives-list" className="scroll-mt-6"><ObjectiveFilters key={filters.type + "-" + filters.status + "-" + filters.group}
      groups={groups} initialType={filters.type} initialStatus={filters.status} initialGroup={filters.group} totalCount={objectives.length} visibleCount={visibleObjectives.length} /></div>
    <ObjectiveSection eyebrow="Catalogue" title="Objectifs de carrière" description="Chaque objectif a sa condition et sa récompense. Ils se récupèrent indépendamment, sans parcours supplémentaire à suivre." objectives={visibleObjectives} returnPath={returnPath} />
    {visibleObjectives.length === 0 ? <div className="mt-8 rounded-[1.65rem] border border-dashed border-[#315B3E]/25 bg-white px-6 py-12 text-center">
      <p className="text-xl font-black text-[#183F37]">Aucun objectif ne correspond à ces filtres.</p>
      <Link href="/jeu/objectifs?onglet=objectifs#objectives-list" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#176951] px-5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#0B302B]">Réinitialiser les filtres</Link>
    </div> : null}
  </>;
}
function ObjectiveClaimControl({objective, returnPath}: {objective: RewardsPageObjective; returnPath: string}) {
  const {pendingKey, claim} = useObjectiveClaims();
  return <form action={objective.album ? claimCycloStickersObjectiveAction : claimGameObjectiveAction} onSubmit={event => {event.preventDefault(); void claim(objective);}}>
    {objective.album ? <><input type="hidden" name="editionId" value={objective.album.editionId} /><input type="hidden" name="achievementId" value={objective.album.achievementId} /></> : <input type="hidden" name="objectiveKey" value={objective.key} />}
    <input type="hidden" name="returnPath" value={returnPath} />
    <ObjectiveClaimButton pending={pendingKey === objective.key} disabled={pendingKey !== null} />
  </form>;
}

const groupLabels: Record<string, string> = {
  transfers: "Transferts",
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
  gazette_games: "Jeux de La Cyclogazette",
  cyclo_stickers: "Album de Cyclo-Stickers",
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
  tutorials: {
    href: TUTORIAL_CENTER_ROUTE,
    label: "Ouvrir le centre des didacticiels",
  },
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
  gazette_games: { href: "/jeu/gazette", label: "Jouer dans la Gazette" },
  cyclo_stickers: { href: "/jeu/album?onglet=succes", label: "Ouvrir l’album" },
};

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
  objectives: RewardsPageObjective[];
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

const ObjectiveCard = memo(function ObjectiveCard({
  objective,
  featured,
  returnPath,
}: {
  objective: RewardsPageObjective;
  featured: boolean;
  returnPath: string;
}) {
  const ready = objective.completed && !objective.claimedAt;
  const claimed = Boolean(objective.claimedAt);
  // Cet objectif historique est encore rattaché au groupe `onboarding` en
  // base. Son action doit néanmoins ouvrir le centre des didacticiels, pas le
  // profil du Directeur Sportif associé au reste de l'onboarding.
  const groupLink =
    objective.key === "complete_tutorial"
      ? groupLinks.tutorials
      : objective.group === "transfers" ? { href: "/jeu/transferts", label: "Voir les transferts" }
      : /^journey_(community_days|private_contacts)_/.test(objective.key) ? { href: "/jeu/chat", label: "Ouvrir le chat et les MP" }
      : groupLinks[objective.group];
  const trophyReward = objective.album?.trophy
    ? getAlbumCompletionTrophy(objective.album.sourceSeason)
    : getAchievementTrophyForObjective(objective.key);
  const nationalFlagReward = objective.key === PATRIOT_OBJECTIVE_KEY;
  const achievement = getProspectiveAchievement(objective.key);
  // Les dates de mise en service sont internes au suivi des succès.
  const description = achievement
    ? objective.description
        .replace(/ Seuls les accomplissements postérieurs à l’activation du 15 octobre 2026 comptent\.$/u, "")
        .replace(/ Actions réalisées depuis le 16 octobre 2026 uniquement\.$/u, "")
        .replace(/ (?:après|depuis) (?:l’)?activation(?: de ces succès)?/gu, "")
    : objective.description;
  const outfitReward = achievement?.tier === "gold" && "cosmetic" in achievement.definition;
  const longTermTier = getGameObjectiveLongTermTier(objective.key);

  return (
    <article
      className={`relative flex min-h-full flex-col overflow-hidden rounded-[1.65rem] border p-5 shadow-[0_16px_42px_rgba(19,60,46,0.08)] [contain-intrinsic-size:auto_28rem] [content-visibility:auto] sm:p-6 ${
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
            {objective.album ? ` · S${objective.album.sourceSeason}` : null}
          </span>
          {longTermTier ? (
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                longTermTier === "THL"
                  ? "bg-[#2B1D3D] text-[#E9D7FF]"
                  : "bg-[#FFF1BF] text-[#806300]"
              }`}
            >
              {longTermTier === "THL" ? "Très longue durée" : "Longue durée"}
            </span>
          ) : null}
        </div>

        <ObjectiveStatus objective={objective} />
      </div>

      <h3
        className={`mt-5 font-black text-[#183F37] ${featured ? "text-2xl" : "text-xl"}`}
      >
        {objective.title}
      </h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
        {description}
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
          {outfitReward ? (
            <RewardChip icon="★" label="Tenue d’avatar exclusive" rare />
          ) : null}
          {nationalFlagReward ? (
            <RewardChip icon="⚑" label="Fond d’avatar · Drapeau national" rare />
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
          <ObjectiveClaimControl objective={objective} returnPath={returnPath} />
        ) : claimed ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="inline-flex min-h-11 items-center rounded-xl bg-[#DDF3E7] px-4 py-2 text-xs font-black text-[#176951]">
              ✓ Récompense récupérée le {formatDate(objective.claimedAt!)}
            </p>
            {nationalFlagReward ? (
              <Link href="/jeu/directeur-sportif#distinction-avatar" className="inline-flex min-h-11 items-center text-xs font-black text-[#176951] underline underline-offset-4">
                Personnaliser mon avatar
              </Link>
            ) : null}
          </div>
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
});

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
      <span className="shrink-0 motion-safe:animate-pulse rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#071A17]">
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

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
});
const progressFormatter = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
    year: "numeric",
});

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function formatProgressValue(value: number) {
  return progressFormatter.format(value);
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

