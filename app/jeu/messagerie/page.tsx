import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  archiveDirectorMessageAction,
  markAllDirectorMessagesReadAction,
  markDirectorMessageUnreadAction,
  restoreDirectorMessageAction,
} from "@/app/jeu/messagerie/actions";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { DirectorMailboxMessageLink } from "@/components/game/director-mailbox-message-link";
import { GameHeader } from "@/components/game/game-header";
import { RecruitmentAlertPanel } from "@/components/game/recruitment-alert-panel";
import Link from "@/components/ui/app-link";
import {
  DIRECTOR_MESSAGE_TYPE_LABELS,
  getDirectorMessageIdToMarkReadOnNavigation,
  normalizeDirectorMailboxFilter,
  type DirectorMailboxFilter,
  type DirectorMailboxMessage,
  type DirectorMessageType,
} from "@/lib/game/director-mailbox";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentDirectorMailbox } from "@/services/director-mailbox";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentDirectorRecruitmentAlertOverview } from "@/services/recruitment-alerts";

export const metadata: Metadata = {
  title: "Boîte mail du Directeur Sportif",
  description:
    "Retrouvez les annonces de courses, sélections et événements de votre équipe.",
};

type MailboxPageProps = {
  searchParams: Promise<{
    filtre?: string | string[];
    message?: string | string[];
    q?: string | string[];
    alerte?: string | string[];
  }>;
};

const folders: Array<{
  id: DirectorMailboxFilter;
  label: string;
  icon: string;
}> = [
  { id: "inbox", label: "Réception", icon: "✉" },
  { id: "unread", label: "Non lus", icon: "●" },
  { id: "important", label: "Importants", icon: "★" },
  { id: "archived", label: "Archives", icon: "▣" },
];

export default async function DirectorMailboxPage({
  searchParams,
}: MailboxPageProps) {
  const params = await searchParams;
  const filter = normalizeDirectorMailboxFilter(params.filtre);
  const selectedMessageId = readSingleParam(params.message);
  const query = readSingleParam(params.q)?.slice(0, 80) ?? "";
  const showRecruitmentAlerts = readSingleParam(params.alerte) === "nouvelle";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, mailbox, recruitmentAlertOverview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentDirectorMailbox(supabase, {
      filter,
      query,
      selectedMessageId,
    }),
    getCurrentDirectorRecruitmentAlertOverview(supabase),
  ]);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
        mailboxIsOpen
      />

      <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 sm:py-10">
        <BackToOfficeLink />

        <header className="mt-5 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
              Bureau du Directeur Sportif
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Boîte mail
            </h1>
            <p className="mt-3 max-w-2xl font-medium leading-7 text-[#48665F]">
              Résultats majeurs, sélections, décisions et nouvelles de
              l’équipe sont désormais conservés ici.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={buildMailboxHref({
                filter,
                query,
                showRecruitmentAlerts: true,
              })}
              aria-expanded={showRecruitmentAlerts}
              className="inline-flex min-h-11 items-center rounded-xl bg-[#176951] px-4 text-sm font-black text-white shadow-md shadow-[#176951]/15 transition hover:-translate-y-0.5 hover:bg-[#0F5641]"
            >
              Créer une alerte
              {recruitmentAlertOverview.alerts.length > 0 ? (
                <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
                  {recruitmentAlertOverview.alerts.length}
                </span>
              ) : null}
            </Link>
            {mailbox.counts.unread > 0 ? (
              <form action={markAllDirectorMessagesReadAction}>
                <button
                  type="submit"
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-[#176951]/25 bg-white px-4 text-sm font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  Tout marquer comme lu
                </button>
              </form>
            ) : null}
          </div>
        </header>

        {showRecruitmentAlerts ? (
          <RecruitmentAlertPanel
            overview={recruitmentAlertOverview}
            closeHref={buildMailboxHref({ filter, query })}
          />
        ) : null}

        <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#176951]/15 bg-white shadow-[0_20px_55px_rgba(18,74,60,0.12)] lg:grid lg:min-h-[680px] lg:grid-cols-[210px_340px_minmax(0,1fr)] xl:grid-cols-[230px_410px_minmax(0,1fr)]">
          <aside className="border-b border-[#176951]/12 bg-[#071A17] p-4 text-white lg:border-b-0 lg:border-r lg:p-5">
            <p className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
              Dossiers
            </p>
            <nav className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
              {folders.map((folder) => {
                const count = mailbox.counts[folder.id];
                const active = filter === folder.id;

                return (
                  <Link
                    key={folder.id}
                    href={buildMailboxHref({ filter: folder.id, query })}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
                      active
                        ? "bg-[#F2C94C] text-[#071A17]"
                        : "text-[#D6DFD2] hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span aria-hidden="true" className="w-4 text-center text-xs">
                      {folder.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{folder.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        active ? "bg-[#071A17]/12" : "bg-white/10"
                      }`}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="px-2 text-xs font-semibold leading-5 text-[#9BB4AD]">
                Les messages restent privés et ne sont visibles que par votre
                compte de DS.
              </p>
            </div>
          </aside>

          <section className="border-b border-[#176951]/12 bg-[#F7FBFA] lg:border-b-0 lg:border-r">
            <form action="/jeu/messagerie" method="get" className="border-b border-[#176951]/10 p-3">
              <input type="hidden" name="filtre" value={filter} />
              <label htmlFor="mailbox-search" className="sr-only">
                Rechercher dans les messages
              </label>
              <div className="flex items-center rounded-xl border border-[#176951]/15 bg-white px-3 focus-within:border-[#278B70] focus-within:ring-2 focus-within:ring-[#278B70]/10">
                <span aria-hidden="true" className="text-[#78947D]">⌕</span>
                <input
                  id="mailbox-search"
                  type="search"
                  name="q"
                  maxLength={80}
                  defaultValue={query}
                  placeholder="Rechercher un message"
                  className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm font-semibold outline-none placeholder:text-[#78947D]"
                />
              </div>
            </form>

            <div className="max-h-[540px] overflow-y-auto lg:max-h-[680px]">
              {mailbox.messages.length > 0 ? (
                mailbox.messages.map((message) => (
                  <MessageListItem
                    key={message.id}
                    message={message}
                    active={mailbox.selectedMessage?.id === message.id}
                    messageToMarkReadId={getDirectorMessageIdToMarkReadOnNavigation(
                      {
                        currentMessageId: mailbox.selectedMessage?.id ?? null,
                        currentMessageReadAt:
                          mailbox.selectedMessage?.readAt ?? null,
                        targetMessageId: message.id,
                      },
                    )}
                    filter={filter}
                    query={query}
                  />
                ))
              ) : (
                <div className="px-6 py-20 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#176951]/8 text-xl text-[#176951]">
                    ✉
                  </div>
                  <p className="mt-4 font-black">Aucun message ici</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#5C746E]">
                    {query
                      ? "Aucun courrier ne correspond à votre recherche."
                      : "Les prochaines annonces apparaîtront automatiquement."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 bg-white">
            {mailbox.selectedMessage ? (
              <MessageReader message={mailbox.selectedMessage} />
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center lg:min-h-[680px]">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#176951]/8 text-2xl text-[#176951]">
                  ✉
                </div>
                <p className="mt-5 text-xl font-black">Votre bureau est à jour</p>
                <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-[#5C746E]">
                  Sélectionnez un courrier pour en lire le détail.
                </p>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function MessageListItem({
  message,
  active,
  messageToMarkReadId,
  filter,
  query,
}: {
  message: DirectorMailboxMessage;
  active: boolean;
  messageToMarkReadId: string | null;
  filter: DirectorMailboxFilter;
  query: string;
}) {
  const unread = message.readAt === null;

  return (
    <DirectorMailboxMessageLink
      href={buildMailboxHref({ filter, query, messageId: message.id })}
      active={active}
      messageToMarkReadId={messageToMarkReadId}
      className={`relative block border-b border-[#176951]/10 px-4 py-4 transition ${
        active
          ? "bg-[#E2F3EE] shadow-[inset_4px_0_0_#278B70]"
          : unread
            ? "bg-white hover:bg-[#EFF8F5]"
            : "bg-[#F7FBFA] hover:bg-[#EFF8F5]"
      }`}
    >
      <div className="flex items-start gap-3">
        <MessageTypeMark type={message.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`min-w-0 flex-1 truncate text-xs ${unread ? "font-black text-[#082A2A]" : "font-bold text-[#48665F]"}`}>
              {message.senderName}
            </p>
            <time className="shrink-0 text-[10px] font-bold text-[#78947D]">
              {formatMessageListDate(message.sentAt)}
            </time>
          </div>
          <p className={`mt-1 truncate text-sm ${unread ? "font-black" : "font-bold text-[#48665F]"}`}>
            {message.subject}
          </p>
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#69807A]">
            {message.preview}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-[#176951]/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#176951]">
              {DIRECTOR_MESSAGE_TYPE_LABELS[message.type]}
            </span>
            {message.isImportant ? (
              <span title="Message important" className="text-xs text-[#D39B12]">★</span>
            ) : null}
          </div>
        </div>
      </div>
      {unread ? (
        <span className="absolute right-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#278B70]" />
      ) : null}
    </DirectorMailboxMessageLink>
  );
}

function MessageReader({ message }: { message: DirectorMailboxMessage }) {
  return (
    <article className="p-5 sm:p-8 xl:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#176951]/12 pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#176951]/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#176951]">
              {DIRECTOR_MESSAGE_TYPE_LABELS[message.type]}
            </span>
            {message.isImportant ? (
              <span className="rounded-full bg-[#FFF4CE] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#8A6100]">
                ★ Important
              </span>
            ) : null}
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
            {message.subject}
          </h2>
          <p className="mt-3 text-sm font-bold text-[#48665F]">
            De : <span className="text-[#082A2A]">{message.senderName}</span>
          </p>
          <time className="mt-1 block text-xs font-semibold text-[#78947D]">
            {formatMessageReaderDate(message.sentAt)}
          </time>
        </div>

        <div className="flex flex-wrap gap-2">
          {message.readAt !== null ? (
            <form action={markDirectorMessageUnreadAction}>
              <input type="hidden" name="messageId" value={message.id} />
              <ReaderActionButton label="Marquer non lu" />
            </form>
          ) : null}
          <form
            action={
              message.archivedAt
                ? restoreDirectorMessageAction
                : archiveDirectorMessageAction
            }
          >
            <input type="hidden" name="messageId" value={message.id} />
            <ReaderActionButton
              label={message.archivedAt ? "Restaurer" : "Archiver"}
            />
          </form>
        </div>
      </div>

      <div className="mt-8 max-w-3xl whitespace-pre-wrap text-[15px] font-medium leading-8 text-[#304F48]">
        {message.body}
      </div>

      {message.actionLinks.length > 0 ? (
        <nav
          aria-label="Raccourcis conseillés"
          className="mt-8 max-w-3xl rounded-2xl border border-[#176951]/12 bg-[#F3F9F7] p-4 sm:p-5"
        >
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#176951]">
            Accès rapides
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {message.actionLinks.map((link) => (
              <Link
                key={`${link.href}:${link.label}`}
                href={link.href}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[#176951]/12 bg-white px-4 py-2.5 text-sm font-black text-[#174D40] transition hover:-translate-y-0.5 hover:border-[#176951]/35 hover:text-[#176951]"
              >
                <span>{link.label}</span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </nav>
      ) : null}

      {message.actionHref && message.actionLabel ? (
        <div className="mt-9 border-t border-[#176951]/12 pt-6">
          <Link
            href={message.actionHref}
            className="inline-flex min-h-12 items-center rounded-xl bg-[#176951] px-5 text-sm font-black text-white shadow-lg shadow-[#176951]/15 transition hover:-translate-y-0.5 hover:bg-[#0F5641]"
          >
            {message.actionLabel} →
          </Link>
        </div>
      ) : null}
    </article>
  );
}

function ReaderActionButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="min-h-9 cursor-pointer rounded-lg border border-[#176951]/18 bg-[#F7FBFA] px-3 text-xs font-black text-[#48665F] transition hover:border-[#176951]/35 hover:text-[#176951]"
    >
      {label}
    </button>
  );
}

function MessageTypeMark({ type }: { type: DirectorMessageType }) {
  const initials: Record<DirectorMessageType, string> = {
    race_result: "R",
    national_championship_selection: "CN",
    national_championship_result: "CN",
    international_selection: "S",
    roster_alert: "+",
    wildcard: "WC",
    academy: "A",
    infrastructure: "I",
    trophy: "T",
    system: "DS",
  };

  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-black shadow-sm ${
        type === "trophy"
          ? "bg-[#F2C94C] text-[#183F37]"
          : "bg-[#176951] text-white"
      }`}
    >
      {initials[type]}
    </span>
  );
}

function buildMailboxHref({
  filter,
  query,
  messageId,
  showRecruitmentAlerts,
}: {
  filter: DirectorMailboxFilter;
  query?: string;
  messageId?: string;
  showRecruitmentAlerts?: boolean;
}) {
  const params = new URLSearchParams();
  if (filter !== "inbox") params.set("filtre", filter);
  if (query) params.set("q", query);
  if (messageId) params.set("message", messageId);
  if (showRecruitmentAlerts) params.set("alerte", "nouvelle");
  const serialized = params.toString();
  return serialized ? `/jeu/messagerie?${serialized}` : "/jeu/messagerie";
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatMessageListDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    ...(sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short" }),
  }).format(date);
}

function formatMessageReaderDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
