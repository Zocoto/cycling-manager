"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { postGlobalChatMessageAction } from "@/app/jeu/chat/actions";
import Link from "@/components/ui/app-link";
import {
  extractGlobalChatPreviewReference,
  GLOBAL_CHAT_MESSAGE_MAX_LENGTH,
} from "@/lib/game/global-chat";
import { notifyGlobalChatMessagesRead } from "@/lib/game/global-chat-read-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  GlobalChatIdentity,
  GlobalChatMessage,
  GlobalChatMessageRow,
} from "@/services/global-chat";

type OnlineDirector = {
  sportingDirectorId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  teamHref: string;
};

export function GlobalGameChat({
  identity,
  initialMessages,
}: {
  identity: GlobalChatIdentity;
  initialMessages: GlobalChatMessage[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] =
    useState<GlobalChatMessage[]>(initialMessages);
  const [onlineDirectors, setOnlineDirectors] = useState<OnlineDirector[]>([
    identity,
  ]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const viewportRef = useRef<HTMLDivElement>(null);
  const positionedRef = useRef(false);

  const latestDisplayedMessageAt = messages.at(-1)?.createdAt ?? null;

  useEffect(() => {
    if (
      document.visibilityState !== "visible" ||
      !latestDisplayedMessageAt
    ) {
      return;
    }

    void markGlobalChatMessagesAsRead(
      supabase,
      latestDisplayedMessageAt,
    );
  }, [latestDisplayedMessageAt, supabase]);

  useEffect(() => {
    function markVisibleMessagesAsRead() {
      if (
        document.visibilityState === "visible" &&
        latestDisplayedMessageAt
      ) {
        void markGlobalChatMessagesAsRead(
          supabase,
          latestDisplayedMessageAt,
        );
      }
    }

    window.addEventListener("focus", markVisibleMessagesAsRead);
    document.addEventListener(
      "visibilitychange",
      markVisibleMessagesAsRead,
    );

    return () => {
      window.removeEventListener("focus", markVisibleMessagesAsRead);
      document.removeEventListener(
        "visibilitychange",
        markVisibleMessagesAsRead,
      );
    };
  }, [latestDisplayedMessageAt, supabase]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: positionedRef.current ? "smooth" : "auto",
      });
      positionedRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages.length]);

  useEffect(() => {
    const channel = supabase
      .channel("global-game-chat:v1", {
        config: {
          presence: {
            key: identity.sportingDirectorId,
          },
        },
      })
      .on("presence", { event: "sync" }, () => {
        setOnlineDirectors(
          readOnlineDirectors(channel.presenceState(), identity),
        );
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "global_chat_messages",
        },
        (payload: { new: Record<string, unknown> }) => {
          const message = readRealtimeMessage(payload.new);
          if (!message) return;

          setMessages((current) => appendUniqueMessage(current, message));
        },
      )
      .subscribe(async (status: string) => {
        if (status !== "SUBSCRIBED") return;

        await channel.track({
          sportingDirectorId: identity.sportingDirectorId,
          displayName: identity.displayName,
          teamId: identity.teamId,
          teamName: identity.teamName,
          teamHref: identity.teamHref,
          onlineAt: new Date().toISOString(),
        });
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [identity, supabase]);

  function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isPending) return;

    setError(null);
    startTransition(async () => {
      try {
        const savedMessage =
          await postGlobalChatMessageAction(message);
        setMessages((current) =>
          appendUniqueMessage(current, savedMessage),
        );
        setDraft("");
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Le message n’a pas pu être envoyé.",
        );
      }
    });
  }

  return (
    <div className="grid min-h-[42rem] overflow-hidden rounded-[2rem] border border-[#1D5145]/20 bg-white shadow-[0_24px_70px_rgba(7,26,23,0.16)] lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="flex min-h-[42rem] min-w-0 flex-col bg-[#F7FBF9]">
        <header className="border-b border-[#315B3E]/12 bg-white px-5 py-4 sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 animate-pulse rounded-full bg-[#42B99A]"
                />
                Discussion en direct
              </p>
              <h2 className="mt-1 text-xl font-black text-[#0B302B]">
                Le peloton parle
              </h2>
            </div>
            <span className="rounded-full bg-[#E4F4EC] px-3 py-1 text-[10px] font-black text-[#176951]">
              {onlineDirectors.length} en ligne
            </span>
          </div>
        </header>

        <div
          ref={viewportRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-7"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.length === 0 ? <EmptyChat /> : null}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isCurrentDirector={
                message.sportingDirectorId === identity.sportingDirectorId
              }
            />
          ))}
        </div>

        <form
          onSubmit={submitMessage}
          className="border-t border-[#315B3E]/12 bg-white p-4 sm:px-7"
        >
          <label htmlFor="global-chat-message" className="sr-only">
            Votre message
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="global-chat-message"
              rows={2}
              value={draft}
              onChange={(event) =>
                setDraft(
                  event.target.value.slice(
                    0,
                    GLOBAL_CHAT_MESSAGE_MAX_LENGTH,
                  ),
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Écrivez au peloton ou partagez une fiche équipe/coureur…"
              className="min-h-[3.25rem] min-w-0 flex-1 resize-none rounded-xl border border-[#315B3E]/20 bg-[#F7FBF9] px-4 py-3 text-sm font-semibold leading-6 text-[#0B302B] outline-none transition focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/15"
            />
            <button
              type="submit"
              disabled={isPending || draft.trim().length === 0}
              className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-xl bg-[#F2C94C] text-[#17261E] transition hover:bg-[#F7DA73] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Envoyer le message"
            >
              {isPending ? (
                <span className="animate-pulse text-sm font-black">…</span>
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
          <div className="mt-1.5 flex min-h-4 items-start justify-between gap-3">
            <p role="alert" className="text-[10px] font-bold text-red-700">
              {error}
            </p>
            <p className="ml-auto shrink-0 text-[9px] font-bold text-[#789087]">
              Entrée pour envoyer · {draft.length}/
              {GLOBAL_CHAT_MESSAGE_MAX_LENGTH}
            </p>
          </div>
        </form>
      </section>

      <OnlineDirectors
        directors={onlineDirectors}
        currentDirectorId={identity.sportingDirectorId}
      />
    </div>
  );
}

function ChatMessage({
  message,
  isCurrentDirector,
}: {
  message: GlobalChatMessage;
  isCurrentDirector: boolean;
}) {
  return (
    <article
      className={`flex items-start gap-3 ${
        isCurrentDirector ? "flex-row-reverse" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-black uppercase shadow-sm ${
          isCurrentDirector
            ? "bg-[#F2C94C] text-[#17261E]"
            : "bg-[#176951] text-white"
        }`}
      >
        {getInitials(message.authorDisplayName)}
      </span>

      <div
        className={`min-w-0 max-w-[min(42rem,calc(100%_-_3rem))] rounded-2xl border px-4 py-3 shadow-sm ${
          isCurrentDirector
            ? "rounded-tr-sm border-[#176951] bg-[#176951] text-white"
            : "rounded-tl-sm border-[#315B3E]/12 bg-white text-[#0B302B]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <Link
            href={`/jeu/equipes/${message.teamId}`}
            className={`truncate text-[11px] font-black transition ${
              isCurrentDirector
                ? "text-white hover:text-[#F2C94C]"
                : "text-[#176951] hover:text-[#0B302B]"
            }`}
          >
            {isCurrentDirector ? "Vous" : message.authorDisplayName}
            <span
              className={`ml-1.5 font-bold ${
                isCurrentDirector ? "text-white/60" : "text-[#789087]"
              }`}
            >
              · {message.teamDisplayName}
            </span>
          </Link>
          <time
            dateTime={message.createdAt}
            className={`shrink-0 text-[9px] font-bold ${
              isCurrentDirector ? "text-white/55" : "text-[#789087]"
            }`}
          >
            {formatMessageTime(message.createdAt)}
          </time>
        </div>

        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm font-semibold leading-6">
          {renderMessageText(message.message, isCurrentDirector)}
        </p>

        {message.preview ? (
          <Link
            href={message.preview.href}
            className={`group mt-3 flex items-center gap-3 rounded-xl border p-3 transition ${
              isCurrentDirector
                ? "border-white/15 bg-white/10 hover:bg-white/15"
                : "border-[#315B3E]/12 bg-[#F3F8F6] hover:border-[#176951]/35"
            }`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                isCurrentDirector
                  ? "bg-white/15 text-[#F2C94C]"
                  : "bg-[#DDF3E7] text-[#176951]"
              }`}
            >
              {message.preview.type === "team" ? (
                <TeamIcon />
              ) : (
                <RiderIcon />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-[9px] font-black uppercase tracking-[0.14em] ${
                  isCurrentDirector ? "text-white/55" : "text-[#789087]"
                }`}
              >
                {message.preview.type === "team"
                  ? "Équipe partagée"
                  : "Coureur partagé"}
              </span>
              <span className="mt-0.5 block truncate text-sm font-black">
                {message.preview.title}
              </span>
              <span
                className={`block truncate text-[10px] font-semibold ${
                  isCurrentDirector ? "text-white/65" : "text-[#60756E]"
                }`}
              >
                {message.preview.subtitle}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="font-black transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function OnlineDirectors({
  directors,
  currentDirectorId,
}: {
  directors: OnlineDirector[];
  currentDirectorId: string;
}) {
  return (
    <aside className="border-t border-[#315B3E]/12 bg-[#071A17] text-white lg:border-l lg:border-t-0">
      <header className="border-b border-white/10 px-5 py-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#72D4B7]">
          Présences
        </p>
        <h2 className="mt-1 text-lg font-black">DS en ligne</h2>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#AFC6BB]">
          Cliquez sur un nom pour consulter son équipe.
        </p>
      </header>

      <div className="grid max-h-72 gap-1 overflow-y-auto p-3 lg:max-h-[35rem]">
        {directors.map((director) => {
          const isCurrent =
            director.sportingDirectorId === currentDirectorId;
          return (
            <Link
              key={director.sportingDirectorId}
              href={director.teamHref}
              className="group flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/8"
            >
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#17493F] text-[10px] font-black text-white">
                {getInitials(director.displayName)}
                <span
                  aria-label="En ligne"
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#071A17] bg-[#42B99A]"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-[#EAF5F0] group-hover:text-[#F2C94C]">
                  {isCurrent ? "Vous" : director.displayName}
                </span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#8FA99D]">
                  {director.teamName}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="text-[#72D4B7] opacity-0 transition group-hover:opacity-100"
              >
                →
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

function EmptyChat() {
  return (
    <div className="rounded-2xl border border-dashed border-[#176951]/25 bg-white px-5 py-10 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#DDF3E7] text-[#176951]">
        <BubbleIcon />
      </span>
      <p className="mt-3 text-sm font-black text-[#183F37]">
        La discussion générale est ouverte
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-5 text-[#60756E]">
        Présentez-vous, échangez sur la saison ou partagez l’URL d’une fiche
        équipe ou coureur.
      </p>
    </div>
  );
}

function appendUniqueMessage(
  messages: GlobalChatMessage[],
  message: GlobalChatMessage,
) {
  if (messages.some((candidate) => candidate.id === message.id)) {
    return messages;
  }
  return [...messages, message].slice(-100);
}

async function markGlobalChatMessagesAsRead(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  latestDisplayedMessageAt: string,
) {
  const { error } = await supabase.rpc(
    "mark_global_chat_messages_read",
    {
      p_last_read_at: latestDisplayedMessageAt,
    },
  );

  if (!error) {
    notifyGlobalChatMessagesRead();
  }
}

function readRealtimeMessage(
  value: Record<string, unknown>,
): GlobalChatMessage | null {
  if (
    typeof value.id !== "string" ||
    typeof value.sporting_director_id !== "string" ||
    typeof value.team_id !== "string" ||
    typeof value.author_display_name !== "string" ||
    typeof value.team_display_name !== "string" ||
    typeof value.message !== "string" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  const row: GlobalChatMessageRow = {
    id: value.id,
    sporting_director_id: value.sporting_director_id,
    team_id: value.team_id,
    author_display_name: value.author_display_name,
    team_display_name: value.team_display_name,
    message: value.message,
    preview_type:
      typeof value.preview_type === "string" ? value.preview_type : null,
    preview_entity_id:
      typeof value.preview_entity_id === "string"
        ? value.preview_entity_id
        : null,
    preview_title:
      typeof value.preview_title === "string"
        ? value.preview_title
        : null,
    preview_subtitle:
      typeof value.preview_subtitle === "string"
        ? value.preview_subtitle
        : null,
    created_at: value.created_at,
  };

  return {
    id: row.id,
    sportingDirectorId: row.sporting_director_id,
    teamId: row.team_id,
    authorDisplayName: row.author_display_name,
    teamDisplayName: row.team_display_name,
    message: row.message,
    preview:
      (row.preview_type === "team" || row.preview_type === "rider") &&
      row.preview_entity_id &&
      row.preview_title &&
      row.preview_subtitle
        ? {
            type: row.preview_type,
            entityId: row.preview_entity_id,
            title: row.preview_title,
            subtitle: row.preview_subtitle,
            href:
              row.preview_type === "team"
                ? `/jeu/equipes/${row.preview_entity_id}`
                : `/jeu/coureurs/${row.preview_entity_id}`,
          }
        : null,
    createdAt: row.created_at,
  };
}

function readOnlineDirectors(
  presenceState: Record<string, unknown[]>,
  fallbackIdentity: GlobalChatIdentity,
): OnlineDirector[] {
  const byDirectorId = new Map<string, OnlineDirector>();

  for (const presences of Object.values(presenceState)) {
    for (const presence of presences) {
      if (!isOnlineDirector(presence)) continue;
      byDirectorId.set(presence.sportingDirectorId, presence);
    }
  }

  byDirectorId.set(
    fallbackIdentity.sportingDirectorId,
    fallbackIdentity,
  );

  return [...byDirectorId.values()].sort((left, right) => {
    if (
      left.sportingDirectorId === fallbackIdentity.sportingDirectorId
    ) {
      return -1;
    }
    if (
      right.sportingDirectorId === fallbackIdentity.sportingDirectorId
    ) {
      return 1;
    }
    return left.displayName.localeCompare(right.displayName, "fr");
  });
}

function isOnlineDirector(value: unknown): value is OnlineDirector {
  if (!value || typeof value !== "object") return false;

  const director = value as Record<string, unknown>;
  return (
    typeof director.sportingDirectorId === "string" &&
    typeof director.displayName === "string" &&
    typeof director.teamId === "string" &&
    typeof director.teamName === "string" &&
    typeof director.teamHref === "string" &&
    director.teamHref === `/jeu/equipes/${director.teamId}`
  );
}

function renderMessageText(message: string, inverted: boolean) {
  const tokenPattern =
    /(https?:\/\/[^\s]+|\/jeu\/(?:equipes|coureurs)\/[0-9a-f-]{36})/gi;
  const tokens = message.split(tokenPattern);

  return tokens.map((token, index) => {
    const internalReference =
      extractGlobalChatPreviewReference(token);
    if (internalReference) {
      return (
        <Link
          key={`${token}-${index}`}
          href={internalReference.href}
          className={`underline decoration-2 underline-offset-2 ${
            inverted
              ? "decoration-[#F2C94C]/60 hover:text-[#F2C94C]"
              : "text-[#176951] decoration-[#42B99A]/55 hover:text-[#0B302B]"
          }`}
        >
          {token}
        </Link>
      );
    }

    if (/^https?:\/\//i.test(token)) {
      return (
        <a
          key={`${token}-${index}`}
          href={token}
          target="_blank"
          rel="nofollow noreferrer"
          className="underline decoration-2 underline-offset-2"
        >
          {token}
        </a>
      );
    }

    return token;
  });
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toLocaleUpperCase("fr-FR") || "DS"
  );
}

function BubbleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 3v-3a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
      <path d="M7.5 11.5h.01M12 11.5h.01M16.5 11.5h.01" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2.5 20c.5-4.5 2.5-7 5.5-7s5 2.5 5.5 7M14 14c3.5-.3 5.5 1.7 6 5" />
    </svg>
  );
}

function RiderIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5 21c.5-5.5 2.8-8 7-8s6.5 2.5 7 8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 4 17 8-17 8 3-8-3-8Z" />
      <path d="M7 12h14" />
    </svg>
  );
}
