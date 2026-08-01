import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound, redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import {
  canAccessPlayerActivityMonitoring,
  type PlayerActivityEventType,
} from "@/lib/game/player-activity";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getPlayerActivityMonitoring,
  type PlayerActivityMonitoringEvent,
} from "@/services/player-activity-monitoring";

export const metadata: Metadata = {
  title: "Monitoring privé de l’activité",
  description: "Vue privée des usages de l’alpha Cyclo Stratégie.",
  robots: { index: false, follow: false },
};

type PageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function PlayerActivityMonitoringPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");
  if (!canAccessPlayerActivityMonitoring(user.email)) notFound();

  const rawSearchParams = await searchParams;
  const eventType = parseEventType(readSearchParam(rawSearchParams.type));
  const sectionKey = parseSectionKey(readSearchParam(rawSearchParams.section));
  const page = parsePage(readSearchParam(rawSearchParams.page));
  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getPlayerActivityMonitoring(supabase, {
      eventType,
      sectionKey,
      page,
    }),
  ]);

  const mobileShare = overview.summary.totalEvents
    ? Math.round(
        (overview.summary.mobileEvents / overview.summary.totalEvents) * 100,
      )
    : 0;
  const topSection = overview.sections[0] ?? null;

  return (
    <main className="min-h-screen bg-[#EEF4F1] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <header className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#278B70]">
              Outil privé · compte administrateur
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              Activité des joueurs
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#526B64] sm:text-base">
              Consultations et interactions enregistrées durant les dernières
              24 heures. Aucun contenu saisi, message ou adresse IP n’est
              conservé.
            </p>
          </header>

          <div className="flex flex-wrap gap-3">
            <Link
              href={buildMonitoringHref({ eventType, sectionKey, page })}
              className="inline-flex min-h-11 items-center rounded-xl border border-[#278B70]/25 bg-white px-4 text-xs font-black uppercase tracking-wider text-[#176650] transition hover:border-[#278B70]"
            >
              Actualiser
            </Link>
            <BackToOfficeLink />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Joueurs actifs"
            value={overview.summary.uniquePlayers}
            detail="comptes distincts"
            accent="mint"
          />
          <MetricCard
            label="Pages consultées"
            value={overview.summary.pageViews}
            detail="chargements de rubriques"
            accent="yellow"
          />
          <MetricCard
            label="Actions"
            value={overview.summary.actions}
            detail="formulaires et interactions"
            accent="blue"
          />
          <MetricCard
            label="Part mobile"
            value={`${mobileShare} %`}
            detail={`${overview.summary.mobileEvents} événements`}
            accent="coral"
          />
          <MetricCard
            label="Rubrique dominante"
            value={topSection?.sectionLabel ?? "—"}
            detail={topSection ? `${topSection.pageViews} consultations` : "aucune donnée"}
            accent="green"
            compact
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]">
          <section className="overflow-hidden rounded-[28px] border border-[#C9D9D2] bg-white shadow-[0_18px_50px_rgba(7,42,36,0.08)]">
            <div className="border-b border-[#DCE7E2] bg-[#0B312B] px-5 py-5 text-white sm:px-7">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#91D9C2]">
                Adoption des fonctionnalités
              </p>
              <h2 className="mt-2 text-2xl font-black">Toutes les rubriques</h2>
            </div>

            <div className="divide-y divide-[#E4ECE8]">
              {overview.sections.length ? (
                overview.sections.map((section, index) => (
                  <Link
                    key={section.sectionKey}
                    href={buildMonitoringHref({
                      eventType,
                      sectionKey: section.sectionKey,
                      page: 1,
                    })}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4 transition hover:bg-[#F4F9F7] sm:px-7 ${
                      sectionKey === section.sectionKey ? "bg-[#E9F6F1]" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF2EE] text-[10px] font-black text-[#45675D]">
                          {index + 1}
                        </span>
                        <p className="truncate text-sm font-black text-[#102F29]">
                          {section.sectionLabel}
                        </p>
                      </div>
                      <p className="mt-2 pl-10 text-xs font-semibold text-[#698078]">
                        {section.uniquePlayers} joueur
                        {section.uniquePlayers > 1 ? "s" : ""} · {section.actions} action
                        {section.actions > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-[#1D7A60]">
                        {section.pageViews}
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-wider text-[#8A9B95]">
                        vues
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState label="Aucune rubrique consultée durant cette fenêtre." />
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-[#C9D9D2] bg-white shadow-[0_18px_50px_rgba(7,42,36,0.08)]">
            <div className="border-b border-[#DCE7E2] px-5 py-5 sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
                    Chronologie détaillée
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-[#102F29]">
                    Toutes les activités
                  </h2>
                  <p className="mt-2 text-xs font-semibold text-[#71857E]">
                    {overview.pagination.totalItems} événement
                    {overview.pagination.totalItems > 1 ? "s" : ""} avec les filtres actuels
                  </p>
                </div>
                {(eventType || sectionKey) ? (
                  <Link
                    href="/jeu/monitoring-activite"
                    className="text-xs font-black text-[#B04B55] underline decoration-[#B04B55]/30 underline-offset-4"
                  >
                    Effacer les filtres
                  </Link>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <FilterChip
                  label="Tout"
                  active={!eventType}
                  href={buildMonitoringHref({ eventType: null, sectionKey, page: 1 })}
                />
                <FilterChip
                  label="Consultations"
                  active={eventType === "page_view"}
                  href={buildMonitoringHref({ eventType: "page_view", sectionKey, page: 1 })}
                />
                <FilterChip
                  label="Actions envoyées"
                  active={eventType === "form_submit"}
                  href={buildMonitoringHref({ eventType: "form_submit", sectionKey, page: 1 })}
                />
                <FilterChip
                  label="Interactions"
                  active={eventType === "interaction"}
                  href={buildMonitoringHref({ eventType: "interaction", sectionKey, page: 1 })}
                />
              </div>
            </div>

            <div className="divide-y divide-[#E4ECE8]">
              {overview.events.length ? (
                overview.events.map((event) => (
                  <ActivityRow key={event.id} event={event} />
                ))
              ) : (
                <EmptyState label="Aucune activité ne correspond à ces filtres." />
              )}
            </div>

            {overview.pagination.totalPages > 1 ? (
              <nav
                aria-label="Pagination des activités"
                className="flex items-center justify-between gap-4 border-t border-[#DCE7E2] px-5 py-4 sm:px-7"
              >
                {overview.pagination.page > 1 ? (
                  <Link
                    href={buildMonitoringHref({ eventType, sectionKey, page: overview.pagination.page - 1 })}
                    className="text-xs font-black text-[#176650]"
                  >
                    ← Plus récentes
                  </Link>
                ) : <span />}
                <p className="text-xs font-bold text-[#71857E]">
                  Page {overview.pagination.page} / {overview.pagination.totalPages}
                </p>
                {overview.pagination.page < overview.pagination.totalPages ? (
                  <Link
                    href={buildMonitoringHref({ eventType, sectionKey, page: overview.pagination.page + 1 })}
                    className="text-xs font-black text-[#176650]"
                  >
                    Plus anciennes →
                  </Link>
                ) : <span />}
              </nav>
            ) : null}
          </section>
        </div>

        <aside className="mt-6 rounded-2xl border border-[#D4B254]/30 bg-[#FFF9E7] px-5 py-4 text-xs font-semibold leading-5 text-[#6F5B28]">
          Données limitées aux métadonnées d’usage, visibles pendant 24 heures
          dans cet outil et supprimées automatiquement de la base après sept
          jours. La prochaine étape RGPD consistera notamment à formaliser
          l’information des joueurs et la base légale de cette mesure d’audience.
        </aside>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent,
  compact = false,
}: {
  label: string;
  value: number | string;
  detail: string;
  accent: "mint" | "yellow" | "blue" | "coral" | "green";
  compact?: boolean;
}) {
  const accentClasses = {
    mint: "border-[#83CBB5]/45 bg-[#EAF8F3] text-[#1F745C]",
    yellow: "border-[#E0BC51]/45 bg-[#FFF7D9] text-[#7A5A13]",
    blue: "border-[#77A9D8]/45 bg-[#EDF6FF] text-[#2E608B]",
    coral: "border-[#E39B91]/45 bg-[#FFF0ED] text-[#9A4D43]",
    green: "border-[#548E70]/45 bg-[#E9F2EC] text-[#315F48]",
  }[accent];

  return (
    <article className={`rounded-2xl border px-5 py-5 ${accentClasses}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-75">
        {label}
      </p>
      <p className={`mt-3 font-black ${compact ? "text-lg leading-6" : "text-3xl"}`}>
        {value}
      </p>
      <p className="mt-2 text-xs font-bold opacity-70">{detail}</p>
    </article>
  );
}

function FilterChip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition ${
        active
          ? "border-[#176650] bg-[#176650] text-white"
          : "border-[#CDDAD5] bg-white text-[#557169] hover:border-[#69A893]"
      }`}
    >
      {label}
    </Link>
  );
}

function ActivityRow({ event }: { event: PlayerActivityMonitoringEvent }) {
  const eventPresentation = {
    page_view: { label: "Consultation", color: "bg-[#E7F5F0] text-[#21735B]" },
    form_submit: { label: "Action envoyée", color: "bg-[#FFF3CF] text-[#7B5C16]" },
    interaction: { label: "Interaction", color: "bg-[#EAF2FF] text-[#355F91]" },
  }[event.eventType];

  return (
    <article className="px-5 py-4 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${eventPresentation.color}`}>
              {eventPresentation.label}
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#82948E]">
              {event.sectionLabel}
            </span>
          </div>
          <p className="mt-2 text-sm font-black leading-5 text-[#102F29]">
            {event.actionLabel ?? `Ouverture de ${event.routePath}`}
          </p>
          <p className="mt-1 text-xs font-semibold text-[#647B73]">
            {event.actorName}
            {event.actorUsername ? ` · @${event.actorUsername}` : ""}
            {event.teamName ? ` · ${event.teamName}` : ""}
          </p>
          <p className="mt-1 truncate text-[10px] font-semibold text-[#96A49F]">
            {event.routePath}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-black text-[#435E55]">
            {formatActivityTime(event.occurredAt)}
          </p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#98A8A2]">
            {formatDevice(event.deviceType)}
          </p>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="px-6 py-14 text-center text-sm font-bold text-[#748A82]">
      {label}
    </div>
  );
}

function buildMonitoringHref({
  eventType,
  sectionKey,
  page,
}: {
  eventType: PlayerActivityEventType | null;
  sectionKey: string | null;
  page: number;
}) {
  const params = new URLSearchParams();
  if (eventType) params.set("type", eventType);
  if (sectionKey) params.set("section", sectionKey);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/jeu/monitoring-activite${query ? `?${query}` : ""}`;
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseEventType(value: string | undefined): PlayerActivityEventType | null {
  return value === "page_view" || value === "form_submit" || value === "interaction"
    ? value
    : null;
}

function parseSectionKey(value: string | undefined) {
  return value && /^[a-z0-9-]{1,64}$/.test(value) ? value : null;
}

function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function formatDevice(device: PlayerActivityMonitoringEvent["deviceType"]) {
  if (device === "mobile") return "Téléphone";
  if (device === "tablet") return "Tablette";
  return "Ordinateur";
}
