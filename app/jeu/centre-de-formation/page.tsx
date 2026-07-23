import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import {
  markYouthNotificationsReadAction,
  markYouthScoutingReportViewedAction,
  recruitYouthRiderAction,
  saveYouthTrainingPriorityAction,
  signYouthCandidateAction,
} from "@/app/jeu/centre-de-formation/actions";
import { GameHeader } from "@/components/game/game-header";
import { PotentialStars } from "@/components/game/potential-stars";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { YouthScoutingMap } from "@/components/game/youth-scouting-map";
import { RIDER_RATING_AXES, type RiderRatingKey } from "@/lib/game/rider-profile";
import { TRAINING_DOMAINS, TRAINING_DOMAIN_LABELS } from "@/lib/game/training";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getYouthDevelopmentOverview,
  type AcademyYouth,
  type YouthCandidate,
  type YouthDevelopmentOverview,
  type YouthMission,
} from "@/services/youth-development";

export const metadata: Metadata = {
  title: "Centre de formation",
  description: "Détectez, formez et préparez les futurs coureurs de votre équipe.",
};

type Tab = "scouting" | "ecole" | "development";
type PageProps = { searchParams: Promise<{ onglet?: string; succes?: string; erreur?: string }> };

export default async function YouthDevelopmentPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const activeTab: Tab = query.onglet === "ecole" || query.onglet === "development" ? query.onglet : "scouting";
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/connexion");

  let overview: YouthDevelopmentOverview | null = null;
  let loadingError: string | null = null;
  const headerPromise = getGameHeaderData(supabase, user.id);
  try {
    overview = await getYouthDevelopmentOverview(supabase, user.id);
  } catch (overviewError) {
    console.error("Impossible de charger le centre de formation :", overviewError);
    loadingError = overviewError instanceof Error ? overviewError.message : "Le centre de formation ne peut pas être chargé.";
  }
  const headerData = await headerPromise;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader simulatorEmail={user.email} displayName={headerData.displayName} sponsor={headerData.teamSponsorIdentity?.sponsor ?? null} maxWidth="wide" />
      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-11">
        <Link href="/jeu" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]">
          <span aria-hidden="true">←</span> Retour au bureau du DS
        </Link>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(130deg,#071A17_0%,#0B302B_52%,#176951_100%)] p-7 text-white shadow-[0_24px_70px_rgba(19,60,46,0.22)] sm:p-10">
          <div aria-hidden="true" className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[48px] border-[#F2C94C]/8" />
          <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-black uppercase tracking-[0.21em] text-[#9BE0CA]">Détection · apprentissage · relève</p>
                {overview?.unreadCount ? <span className="rounded-full bg-[#C63F3F] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">{overview.unreadCount} nouveauté{overview.unreadCount > 1 ? "s" : ""}</span> : null}
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-6xl">Centre de formation</h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2] sm:text-base">Construisez un réseau mondial, repérez des profils bruts puis façonnez-les chaque jour avant leur passage chez les professionnels.</p>
            </div>
            {overview ? <div className="grid grid-cols-3 gap-2 sm:gap-3"><HeroMetric label="Scouts" value={String(overview.scouts.length)} /><HeroMetric label="Jeunes" value={String(overview.academy.length)} /><HeroMetric label="Jour" value={`${overview.currentDayNumber}/28`} /></div> : null}
          </div>
        </header>

        <nav aria-label="Rubriques du centre de formation" className="mt-6 grid gap-2 rounded-2xl border border-[#315B3E]/12 bg-white p-2 shadow-sm sm:grid-cols-3">
          <TabLink tab="scouting" activeTab={activeTab} label="Scouting" detail="Carte & rapports" count={overview?.missions.filter((mission) => mission.unread).length} />
          <TabLink tab="ecole" activeTab={activeTab} label="École de cyclisme" detail="Effectif & entraînement" count={overview?.notifications.filter((notification) => notification.unread).length} />
          <TabLink tab="development" activeTab={activeTab} label="Development Team" detail="Projet à venir" />
        </nav>

        <div className="mt-5 space-y-4">
          {query.succes ? <Alert tone="success">{query.succes}</Alert> : null}
          {query.erreur ? <Alert tone="error">{query.erreur}</Alert> : null}
          {loadingError ? <Alert tone="error">{loadingError}</Alert> : null}
        </div>

        {overview && activeTab === "scouting" ? <ScoutingTab overview={overview} /> : null}
        {overview && activeTab === "ecole" ? <AcademyTab overview={overview} /> : null}
        {activeTab === "development" ? <DevelopmentTab /> : null}
      </section>
    </main>
  );
}

function ScoutingTab({ overview }: { overview: YouthDevelopmentOverview }) {
  const activeMissions = overview.missions.filter((mission) => mission.status === "active");
  const completedMissions = overview.missions.filter((mission) => mission.status === "completed");
  return (
    <div className="mt-7 space-y-8">
      <section aria-labelledby="scouts-title">
        <SectionHeading eyebrow="Cellule de recrutement" title="Vos scouts disponibles" id="scouts-title" description="Un scout ne peut couvrir qu’une zone à la fois. Son niveau améliore le potentiel et les statistiques initiales des jeunes détectés ; une nationalité commune avec le pays ciblé ajoute 15 % d’efficacité." />
        {overview.scouts.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {overview.scouts.map((scout) => (
              <article key={scout.contractId} className={`rounded-2xl border bg-white p-4 ${scout.activeMissionId ? "border-[#F2C94C]/60" : "border-[#315B3E]/12"}`}>
                <div className="flex items-center justify-between gap-3"><span className={`fi fi-${scout.countryCode.toLowerCase()} h-5 w-7 rounded shadow-sm`} /><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${scout.activeMissionId ? "bg-[#F2C94C]/20 text-[#8A6B16]" : "bg-[#72D4B7]/15 text-[#176951]"}`}>{scout.activeMissionId ? "En mission" : "Disponible"}</span></div>
                <h3 className="mt-3 font-black text-[#071A17]">{scout.firstName} {scout.lastName}</h3>
                <p className="mt-1 text-xs font-bold text-[#60756E]">{scout.countryName} · Niveau {scout.level}</p>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Aucun scout dans votre staff" text="Recrutez au moins un scout depuis la rubrique Staff pour lancer une mission." />}
      </section>

      <section aria-label="Carte de scouting"><YouthScoutingMap countries={overview.countries} scouts={overview.scouts} /></section>

      {activeMissions.length ? (
        <section><SectionHeading eyebrow="Sur le terrain" title="Missions en cours" /><div className="mt-4 grid gap-3 lg:grid-cols-2">{activeMissions.map((mission) => <ActiveMissionCard key={mission.id} mission={mission} currentDay={overview.currentDayNumber} />)}</div></section>
      ) : null}

      <section>
        <SectionHeading eyebrow="Rapports de détection" title="Talents repérés" description="Les notes sont volontairement brutes et plafonnées à 6. Le potentiel et la durée de formation feront la différence." />
        {completedMissions.length ? <div className="mt-4 space-y-5">{completedMissions.map((mission) => <MissionReport key={mission.id} mission={mission} currency={overview.currency} balance={overview.balance} />)}</div> : <EmptyState title="Aucun rapport reçu" text="Lancez une mission de 1 à 7 jours : un rapport contiendra entre 1 et 4 jeunes." />}
      </section>
    </div>
  );
}

function AcademyTab({ overview }: { overview: YouthDevelopmentOverview }) {
  return (
    <div className="mt-7 space-y-8">
      {overview.notifications.length ? (
        <section className="rounded-[1.5rem] border border-[#C63F3F]/25 bg-[#FFF7F5] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#B54242]">Suivi administratif</p><h2 className="mt-1 text-xl font-black text-[#071A17]">Notifications de l’école</h2></div>{overview.notifications.some((notification) => notification.unread) ? <form action={markYouthNotificationsReadAction}><button className="rounded-xl border border-[#B54242]/30 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#B54242]">Tout marquer comme lu</button></form> : null}</div>
          <div className="mt-4 grid gap-2">{overview.notifications.slice(0, 6).map((notification) => <div key={notification.id} className={`rounded-xl border p-3 ${notification.unread ? "border-[#C63F3F]/25 bg-white" : "border-[#315B3E]/10 bg-white/60"}`}><p className="text-sm font-black text-[#071A17]">{notification.title}</p><p className="mt-1 text-xs font-semibold text-[#60756E]">{notification.message}</p></div>)}</div>
        </section>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <SectionHeading eyebrow="Formation quotidienne" title="École de cyclisme" description="Choisissez une priorité par jeune. Une séance est traitée chaque jour de jeu et son évolution apparaît dans le dernier rapport." />
        <div className="rounded-2xl border border-[#315B3E]/12 bg-white px-5 py-4 text-right"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">Frais annuels récurrents</p><p className="mt-1 text-2xl font-black text-[#071A17]">{formatCurrency(overview.totalTuitionPerSeason, overview.currency)}</p></div>
      </div>
      {overview.academy.length ? <div className="space-y-4">{overview.academy.map((rider) => <AcademyRiderCard key={rider.id} rider={rider} gameYear={overview.gameYear} currency={overview.currency} />)}</div> : <EmptyState title="Votre école est encore vide" text="Signez un jeune depuis un rapport de scouting pour commencer sa formation." />}
    </div>
  );
}

function AcademyRiderCard({ rider, gameYear, currency }: { rider: AcademyYouth; gameYear: number; currency: string }) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-[#315B3E]/12 bg-white shadow-sm">
      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(250px,0.72fr)_minmax(0,1.35fr)_minmax(260px,0.75fr)] xl:items-center">
        <div className="flex items-center gap-4"><RiderAvatar profileKey={rider.profileKey} seed={rider.avatarSeed} riderId={rider.id} age={rider.age} className="h-20 w-20" /><div className="min-w-0"><div className="flex items-center gap-2"><span className={`fi fi-${rider.countryCode.toLowerCase()} h-4 w-6 rounded`} /><span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]">{rider.age} ans</span></div><h3 className="mt-2 text-xl font-black text-[#071A17]">{rider.firstName} {rider.lastName}</h3><p className="mt-1 text-xs font-extrabold text-[#278B70]">{rider.sportingProfile}</p><div className="mt-2"><PotentialStars potentialSteps={rider.potentialSteps} /></div></div></div>
        <RatingsGrid ratings={rider.ratings} compact />
        <div className="space-y-3">
          <form action={saveYouthTrainingPriorityAction} className="rounded-2xl bg-[#EAF5F3] p-3"><input type="hidden" name="academyRiderId" value={rider.id} /><label className="text-[9px] font-black uppercase tracking-[0.15em] text-[#60756E]">Priorité d’entraînement<select name="trainingPriority" defaultValue={rider.trainingPriority} className="mt-2 min-h-10 w-full rounded-lg border border-[#315B3E]/15 bg-white px-3 text-xs font-bold text-[#183F37]">{TRAINING_DOMAINS.map((domain) => <option key={domain} value={domain}>{TRAINING_DOMAIN_LABELS[domain]}</option>)}</select></label><button className="mt-2 w-full rounded-lg bg-[#176951] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-white">Enregistrer</button></form>
          {rider.latestTrainingReport ? <div className="rounded-xl border border-[#315B3E]/10 p-3"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">Rapport · jour {rider.latestTrainingReport.dayNumber}</p><p className="mt-1 text-xs font-bold text-[#176951]">{formatRatingChanges(rider.latestTrainingReport.ratingChanges)}</p></div> : null}
          <p className="text-[10px] font-bold text-[#60756E]">Scolarité : {formatCurrency(rider.tuitionPerSeason, currency)} / saison</p>
          {rider.status === "recruited" ? <div className="rounded-xl bg-[#F2C94C]/20 p-3 text-xs font-black text-[#8A6B16]">Recruté · arrivée pro en {rider.promotionGameYear}</div> : rider.canRecruit ? <form action={recruitYouthRiderAction}><input type="hidden" name="academyRiderId" value={rider.id} /><button className="w-full rounded-xl bg-[#F2C94C] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#071A17]">Recruter pour {gameYear + 1}</button></form> : <p className="rounded-xl bg-[#F6F7F2] p-3 text-[10px] font-bold text-[#60756E]">Recrutable à partir de 17 ans.</p>}
        </div>
      </div>
    </article>
  );
}

function MissionReport({ mission, currency, balance }: { mission: YouthMission; currency: string; balance: number }) {
  return (
    <article className={`rounded-[1.75rem] border bg-white p-5 shadow-sm sm:p-6 ${mission.unread ? "border-[#C63F3F]/45 ring-2 ring-[#C63F3F]/8" : "border-[#315B3E]/12"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className={`fi fi-${mission.countryCode.toLowerCase()} h-7 w-10 rounded shadow-sm`} /><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#278B70]">{mission.countryName} · {mission.durationDays} jour{mission.durationDays > 1 ? "s" : ""}</p><h3 className="mt-1 text-xl font-black text-[#071A17]">Rapport de {mission.scoutName}</h3></div></div>{mission.unread ? <form action={markYouthScoutingReportViewedAction}><input type="hidden" name="missionId" value={mission.id} /><button className="rounded-xl border border-[#C63F3F]/30 bg-[#FFF7F5] px-3 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#B54242]">Marquer comme consulté</button></form> : <span className="rounded-full bg-[#EAF5F3] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#176951]">Consulté</span>}</div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">{mission.candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} currency={currency} balance={balance} />)}</div>
    </article>
  );
}

function CandidateCard({ candidate, currency, balance }: { candidate: YouthCandidate; currency: string; balance: number }) {
  return (
    <div className="rounded-2xl border border-[#315B3E]/12 bg-[#FFFDF4] p-4">
      <div className="flex items-start gap-4"><RiderAvatar profileKey={candidate.profileKey} seed={candidate.avatarSeed} riderId={candidate.id} age={candidate.age} className="h-16 w-16" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`fi fi-${candidate.countryCode.toLowerCase()} h-4 w-6 rounded`} /><span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">{candidate.age} ans · {candidate.archetypeLabel}</span></div><h4 className="mt-1 text-lg font-black text-[#071A17]">{candidate.firstName} {candidate.lastName}</h4><p className="mt-1 text-xs font-extrabold text-[#278B70]">{candidate.sportingProfile}</p><div className="mt-2"><PotentialStars potentialSteps={candidate.potentialSteps} /></div>{candidate.internationalCenterBonusApplied ? <p className="mt-2 inline-flex rounded-full bg-[#F2C94C]/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#8A6714]">École internationale · +1★</p> : candidate.internationalCenterBonusPercentage > 0 ? <p className="mt-2 text-[9px] font-bold text-[#60756E]">Bonus mondial tenté : {candidate.internationalCenterBonusPercentage} %</p> : null}</div></div>
      <div className="mt-4"><RatingsGrid ratings={candidate.ratings} compact /></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#315B3E]/10 pt-4"><div><p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">Prime d’accueil</p><p className="font-black text-[#071A17]">{formatCurrency(candidate.signingFee, currency)}</p><p className="text-[9px] font-bold text-[#60756E]">+ {formatCurrency(candidate.tuitionPerSeason, currency)} / saison</p></div>{candidate.status === "spotted" ? <form action={signYouthCandidateAction}><input type="hidden" name="candidateId" value={candidate.id} /><button disabled={balance < candidate.signingFee} className="rounded-xl bg-[#F2C94C] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#071A17] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#D5D6CE]">Signer le jeune</button></form> : <span className="rounded-full bg-[#72D4B7]/15 px-3 py-2 text-[9px] font-black uppercase text-[#176951]">À l’école</span>}</div>
    </div>
  );
}

function RatingsGrid({ ratings, compact = false }: { ratings: Record<RiderRatingKey, number>; compact?: boolean }) {
  return <div className={`grid gap-1.5 ${compact ? "grid-cols-7" : "grid-cols-5"}`}>{RIDER_RATING_AXES.map((axis) => <div key={axis.key} title={axis.label} className="rounded-lg border border-[#315B3E]/10 bg-white px-1 py-1.5 text-center"><span className="block text-[8px] font-black uppercase text-[#60756E]">{axis.shortLabel}</span><strong className="mt-0.5 block text-xs text-[#071A17]">{ratings[axis.key].toFixed(1)}</strong></div>)}</div>;
}

function ActiveMissionCard({ mission, currentDay }: { mission: YouthMission; currentDay: number }) {
  const progress = Math.min(100, Math.max(4, ((currentDay - mission.startDayNumber) / mission.durationDays) * 100));
  return <article className="rounded-2xl border border-[#F2C94C]/45 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8A6B16]">{mission.countryName}</p><h3 className="mt-1 font-black text-[#071A17]">{mission.scoutName}</h3></div><span className="rounded-full bg-[#F2C94C]/20 px-3 py-1 text-[9px] font-black text-[#8A6B16]">Retour J{mission.completesDayNumber}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#315B3E]/10"><div className="h-full rounded-full bg-[#F2C94C]" style={{ width: `${progress}%` }} /></div></article>;
}

function DevelopmentTab() {
  return <section className="relative mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white px-6 py-20 text-center shadow-sm"><div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(135deg,transparent_45%,rgba(39,139,112,0.06)_45%,rgba(39,139,112,0.06)_55%,transparent_55%)] bg-[length:32px_32px]" /><div className="relative mx-auto max-w-xl"><span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2C94C] text-3xl">⚒</span><p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-[#278B70]">Development Team</p><h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#071A17]">En construction</h2><p className="mt-4 text-sm font-semibold leading-7 text-[#60756E]">Cette future structure fera le lien entre l’école de cyclisme et l’équipe professionnelle. Son fonctionnement sera défini avec les infrastructures.</p></div></section>;
}

function TabLink({ tab, activeTab, label, detail, count }: { tab: Tab; activeTab: Tab; label: string; detail: string; count?: number }) {
  const active = tab === activeTab;
  return <Link href={`/jeu/centre-de-formation?onglet=${tab}`} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition ${active ? "bg-[#0B302B] text-white shadow-md" : "text-[#315B3E] hover:bg-[#EAF5F3]"}`}><span><strong className="block text-sm">{label}</strong><span className={`mt-0.5 block text-[10px] font-bold ${active ? "text-[#9BE0CA]" : "text-[#60756E]"}`}>{detail}</span></span>{count ? <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#C63F3F] px-1.5 text-[10px] font-black text-white">{count}</span> : null}</Link>;
}

function HeroMetric({ label, value }: { label: string; value: string }) { return <div className="min-w-20 rounded-2xl border border-white/15 bg-white/10 p-3 text-center backdrop-blur-sm"><span className="block text-[9px] font-black uppercase tracking-[0.15em] text-[#9BE0CA]">{label}</span><strong className="mt-1 block text-xl text-white">{value}</strong></div>; }
function SectionHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description?: string; id?: string }) { return <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#278B70]">{eyebrow}</p><h2 id={id} className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#071A17]">{title}</h2>{description ? <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">{description}</p> : null}</div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="mt-4 rounded-2xl border border-dashed border-[#315B3E]/25 bg-white/60 p-7 text-center"><p className="font-black text-[#071A17]">{title}</p><p className="mt-2 text-sm font-semibold text-[#60756E]">{text}</p></div>; }
function Alert({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) { return <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${tone === "success" ? "border-[#278B70]/30 bg-[#DDF2E9] text-[#176951]" : "border-[#C63F3F]/30 bg-[#FFF0ED] text-[#A32F2F]"}`}>{children}</div>; }
function formatCurrency(value: number, currency: string) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
function formatRatingChanges(changes: Record<string, number>) { const entries = Object.entries(changes).filter(([, value]) => value > 0).sort((left, right) => right[1] - left[1]).slice(0, 3); return entries.length ? entries.map(([key, value]) => `${RIDER_RATING_AXES.find((axis) => axis.key === key)?.shortLabel ?? key} +${value.toFixed(3)}`).join(" · ") : "Consolidation, sans hausse visible"; }
