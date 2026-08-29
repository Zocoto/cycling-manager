import Link from "@/components/ui/app-link";
import {
  deleteDirectorMessageAction,
  deleteDirectorMessagesAction,
} from "@/app/jeu/messagerie/actions";
import { DashboardJournalDeleteButton } from "@/components/game/dashboard-journal-delete-button";
import { DirectorMailboxMessageLink } from "@/components/game/director-mailbox-message-link";
import {
  buildDashboardAssistantLines,
  formatDashboardAssistantDate,
  type DashboardAssistantLine,
  type DashboardRaceRosterAlert,
  type DashboardAssistantSnapshot,
  type DashboardJournalItem,
} from "@/lib/game/dashboard-assistant";

export async function DashboardAssistant({
  summaryPromise,
  raceRosterAlerts,
  rewardCount,
  cashBalance,
  hasTeam,
}: {
  summaryPromise: Promise<DashboardAssistantSnapshot | null>;
  raceRosterAlerts: DashboardRaceRosterAlert[];
  rewardCount: number;
  cashBalance: number | null;
  hasTeam: boolean;
}) {
  const summary = await summaryPromise;

  if (!summary) {
    return hasTeam
      ? <DashboardAssistantUnavailable />
      : <DashboardAssistantAwaitingTeam />;
  }

  const groups = buildDashboardAssistantLines({
    snapshot: summary,
    raceRosterAlerts,
    rewardCount,
    cashBalance,
  });

  return (
    <section
      aria-labelledby="dashboard-assistant-title"
      className="mt-4 overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] shadow-[0_18px_48px_rgba(7,48,42,0.14)] sm:mt-6"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 bg-[#0B302B] px-4 py-2.5 text-white sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#42B99A]/18 text-[#9BE0BC]">
            <AssistantIcon />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7CCF9C]">
              Point quotidien
            </p>
            <h2
              id="dashboard-assistant-title"
              className="truncate text-sm font-black sm:text-base"
            >
              Assistant du DS
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <time
            dateTime={summary.gameDate}
            className="rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1 text-[9px] font-extrabold text-[#D7E8DF] sm:px-3 sm:text-[11px]"
          >
            {formatDashboardAssistantDate(summary.gameDate)}
          </time>
          {summary.journalItems.length > 0 ? <JournalCleanupMenu /> : null}
        </div>
      </header>

      <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-[#315B3E]/12">
        <AssistantGroup
          label="Alertes"
          lines={groups.alerts}
          collapsibleAfter={5}
        />
        <AssistantGroup
          label="À savoir"
          lines={groups.information}
          collapsibleAfter={3}
        />
      </div>
      <JournalSection items={summary.journalItems} />
    </section>
  );
}

export function DashboardAssistantSkeleton() {
  return (
    <section
      aria-label="Chargement de l’assistant du DS"
      className="mt-4 overflow-hidden rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] shadow-[0_18px_48px_rgba(7,48,42,0.1)] sm:mt-6"
    >
      <div className="h-14 animate-pulse bg-[#0B302B]" />
      <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-[#315B3E]/10">
        {[0, 1].map((group) => (
          <div key={group} className="p-3">
            <div className="mb-2 h-3 w-16 animate-pulse rounded bg-[#DCE9E3]" />
            {[0, 1, 2].map((line) => (
              <div
                key={line}
                className="mt-1 h-11 animate-pulse rounded-xl bg-[#E8F1ED]"
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function AssistantGroup({
  label,
  lines,
  collapsibleAfter,
}: {
  label: string;
  lines: DashboardAssistantLine[];
  collapsibleAfter?: number;
}) {
  const visibleLines = collapsibleAfter
    ? lines.slice(0, collapsibleAfter)
    : lines;
  const additionalLines = collapsibleAfter
    ? lines.slice(collapsibleAfter)
    : [];

  return (
    <div className="min-w-0 border-t border-[#315B3E]/10 first:border-t-0 lg:border-t-0">
      <p className="px-3 pb-1 pt-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#658077] sm:px-4">
        {label}
      </p>
      <ul className="divide-y divide-[#315B3E]/8 px-2 pb-2 sm:px-3">
        {visibleLines.map((line) => (
          <li key={line.id}>
            <AssistantLine line={line} />
          </li>
        ))}
      </ul>
      {additionalLines.length > 0 ? (
        <details className="group/more border-t border-[#315B3E]/8">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between px-4 text-[10px] font-black text-[#278B70] transition hover:bg-white [&::-webkit-details-marker]:hidden">
            <span className="group-open/more:hidden">
              Voir {additionalLines.length} autre{additionalLines.length > 1 ? "s" : ""} information{additionalLines.length > 1 ? "s" : ""}
            </span>
            <span className="hidden group-open/more:inline">Réduire</span>
            <span aria-hidden="true" className="transition group-open/more:rotate-180">⌄</span>
          </summary>
          <ul className="divide-y divide-[#315B3E]/8 px-2 pb-2 sm:px-3">
            {additionalLines.map((line) => (
              <li key={line.id}>
                <AssistantLine line={line} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function JournalSection({ items }: { items: DashboardJournalItem[] }) {
  if (!items.length) return null;

  const visibleItems = items.slice(0, 3);
  const additionalItems = items.slice(3);

  return (
    <div className="border-t border-[#315B3E]/12 bg-white/65">
      <div className="flex min-h-8 items-center justify-between px-3 sm:px-4">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#658077]">
          Journal récent
        </p>
        <Link
          href="/jeu/messagerie"
          className="text-[9px] font-black text-[#278B70] hover:underline"
        >
          Ouvrir la messagerie
        </Link>
      </div>
      <ul className="divide-y divide-[#315B3E]/8 px-2 pb-2 sm:px-3">
        {visibleItems.map((item) => (
          <li key={item.id}>
            <JournalRow item={item} />
          </li>
        ))}
      </ul>
      {additionalItems.length > 0 ? (
        <details className="group/journal border-t border-[#315B3E]/8">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between px-4 text-[10px] font-black text-[#278B70] transition hover:bg-white [&::-webkit-details-marker]:hidden">
            <span className="group-open/journal:hidden">
              Afficher {additionalItems.length} autre{additionalItems.length > 1 ? "s" : ""} actualité{additionalItems.length > 1 ? "s" : ""}
            </span>
            <span className="hidden group-open/journal:inline">Réduire le journal</span>
            <span aria-hidden="true" className="transition group-open/journal:rotate-180">⌄</span>
          </summary>
          <ul className="divide-y divide-[#315B3E]/8 px-2 pb-2 sm:px-3">
            {additionalItems.map((item) => (
              <li key={item.id}>
                <JournalRow item={item} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function JournalRow({ item }: { item: DashboardJournalItem }) {
  return (
    <div className="flex min-h-11 items-center gap-1 rounded-xl transition hover:bg-white">
      <DirectorMailboxMessageLink
        href={item.href}
        messageToMarkReadId={item.read ? null : item.id}
        active={false}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70]"
      >
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            item.important
              ? "bg-[#E1AE1A]"
              : item.read
                ? "bg-[#AABCB5]"
                : "bg-[#278B70]"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[12px] font-black text-[#173D35] sm:text-[13px]">
              {item.title}
            </span>
            <time
              dateTime={item.sentAt}
              className="shrink-0 text-[9px] font-bold text-[#81948E]"
            >
              {formatJournalDate(item.sentAt)}
            </time>
          </span>
          <span className="block truncate text-[9px] font-semibold text-[#6B8179] sm:text-[10px]">
            {item.detail}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-sm font-black text-[#278B70]">→</span>
      </DirectorMailboxMessageLink>
      <form action={deleteDirectorMessageAction}>
        <input type="hidden" name="messageId" value={item.id} />
        <DashboardJournalDeleteButton
          compact
          label={`Supprimer définitivement « ${item.title} »`}
        />
      </form>
    </div>
  );
}

function JournalCleanupMenu() {
  return (
    <details className="group/cleanup relative">
      <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-lg border border-white/15 bg-white/[0.07] text-sm text-[#D7E8DF] transition hover:bg-white/15 [&::-webkit-details-marker]:hidden" aria-label="Nettoyer le journal">
        ⋯
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-[#315B3E]/15 bg-white p-2 text-[#173D35] shadow-[0_18px_48px_rgba(7,48,42,0.25)]">
        <p className="px-2 pb-2 pt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#658077]">
          Nettoyer définitivement
        </p>
        <CleanupForm scope="read" label="Supprimer les informations lues" />
        <CleanupForm scope="older_than_7_days" label="Supprimer celles de plus de 7 jours" />
        <CleanupForm
          scope="all"
          label="Tout supprimer"
          confirmation="Supprimer définitivement toutes les actualités et tous les messages de votre boîte mail ? Cette action est irréversible."
          danger
        />
      </div>
    </details>
  );
}

function CleanupForm({
  scope,
  label,
  confirmation,
  danger = false,
}: {
  scope: "read" | "older_than_7_days" | "all";
  label: string;
  confirmation?: string;
  danger?: boolean;
}) {
  return (
    <form action={deleteDirectorMessagesAction}>
      <input type="hidden" name="scope" value={scope} />
      <DashboardJournalDeleteButton
        label={label}
        confirmation={confirmation}
        variant={danger ? "danger" : "neutral"}
        fullWidth
      />
    </form>
  );
}

function AssistantLine({ line }: { line: DashboardAssistantLine }) {
  const content = (
    <>
      <span
        className={`grid h-7 min-w-7 shrink-0 place-items-center rounded-lg px-1.5 text-[10px] font-black ${
          line.tone === "alert"
            ? "bg-[#FDE8E9] text-[#B62D39]"
            : line.tone === "success"
              ? "bg-[#DDF5EA] text-[#176951]"
              : "bg-[#E4F0EC] text-[#176951]"
        }`}
      >
        {line.metric}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-black text-[#173D35] sm:text-[13px]">
          {line.title}
        </span>
        <span className="block truncate text-[9px] font-semibold text-[#6B8179] sm:text-[10px]">
          {line.detail}
        </span>
      </span>
      {line.href ? (
        <span aria-hidden="true" className="shrink-0 text-sm font-black text-[#278B70]">
          →
        </span>
      ) : null}
    </>
  );
  const className =
    "flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5 transition sm:px-2.5";

  return line.href ? (
    <Link
      href={line.href}
      prefetchOnIntent
      className={`${className} hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70]`}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function DashboardAssistantUnavailable() {
  return (
    <section className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] px-4 py-2.5 text-[#173D35] shadow-[0_12px_34px_rgba(7,48,42,0.08)] sm:mt-6">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#E4F0EC] text-[#176951]">
        <AssistantIcon />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black">Assistant du DS</p>
        <p className="truncate text-[10px] font-semibold text-[#6B8179]">
          Le point quotidien est momentanément indisponible ; le reste du Bureau reste accessible.
        </p>
      </div>
    </section>
  );
}

function DashboardAssistantAwaitingTeam() {
  return (
    <section
      aria-label="Assistant du DS"
      className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl border border-[#42B99A]/20 bg-[#F3FBF7] px-4 py-2.5 text-[#173D35] shadow-[0_12px_34px_rgba(7,48,42,0.08)] sm:mt-6"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#DDF5EA] text-[#176951]">
        <AssistantIcon />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black">Assistant du DS</p>
        <p className="text-[10px] font-semibold leading-4 text-[#6B8179]">
          Fondez votre équipe amateur : votre point quotidien s’activera aussitôt.
        </p>
      </div>
    </section>
  );
}

function formatJournalDate(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const dayFormatter = new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Paris",
  });

  if (dayFormatter.format(date) === dayFormatter.format(now)) {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    }).format(date);
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
}

function AssistantIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
      <path d="m5.6 5.6 1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}
