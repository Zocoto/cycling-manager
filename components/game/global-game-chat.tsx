"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  postGlobalChatMessageAction,
  toggleGlobalChatMessageReactionAction,
} from "@/app/jeu/chat/actions";
import { GlobalChatMediaPicker } from "@/components/game/global-chat-media-picker";
import Link from "@/components/ui/app-link";
import {
  expandGlobalChatEmoticons,
  extractGlobalChatPreviewReference,
  GLOBAL_CHAT_HISTORY_DAYS,
  GLOBAL_CHAT_MESSAGE_MAX_LENGTH,
  GLOBAL_CHAT_MESSAGE_REACTION_EMOJIS,
  isGlobalChatMessageReactionEmoji,
  normalizeGlobalChatMessage,
  stripGlobalChatCyclingReactionTokens,
  type GlobalChatCursor,
  type GlobalChatMessageReactionEmoji,
} from "@/lib/game/global-chat";
import { notifyGlobalChatMessagesRead } from "@/lib/game/global-chat-read-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  GlobalChatIdentity,
  GlobalChatMessage,
  GlobalChatMessagePage,
  GlobalChatMessageRow,
  GlobalChatReactionRow,
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
  initialHasMore,
  initialCursor,
}: {
  identity: GlobalChatIdentity;
  initialMessages: GlobalChatMessage[];
  initialHasMore: boolean;
  initialCursor: GlobalChatCursor | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] =
    useState<GlobalChatMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [olderCursor, setOlderCursor] = useState(initialCursor);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [onlineDirectors, setOnlineDirectors] = useState<OnlineDirector[]>([
    identity,
  ]);
  const [draft, setDraft] = useState("");

  const [replyTo, setReplyTo] = useState<GlobalChatMessage | null>(null);
  const [pendingReactionKey, setPendingReactionKey] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isReactionPending, startReactionTransition] = useTransition();
  const viewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const positionedRef = useRef(false);
  const prependedScrollRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);

  const latestDisplayedMessage = messages.at(-1) ?? null;
  const latestDisplayedMessageAt = latestDisplayedMessage?.createdAt ?? null;
  const latestDisplayedMessageId = latestDisplayedMessage?.id ?? null;
  const oldestDisplayedMessageId = messages[0]?.id ?? null;

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
  }, [latestDisplayedMessageId]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const previous = prependedScrollRef.current;
    if (!viewport || !previous) return;

    viewport.scrollTop =
      viewport.scrollHeight - previous.scrollHeight + previous.scrollTop;
    prependedScrollRef.current = null;
  }, [oldestDisplayedMessageId]);

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
          event: "*",
          schema: "public",
          table: "global_chat_messages",
        },
        (payload: {
          eventType: string;
          new: Record<string, unknown>;
          old: Record<string, unknown>;
        }) => {
          if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            if (typeof deletedId === "string") {
              setMessages((current) =>
                current.filter((message) => message.id !== deletedId),
              );
            }
            return;
          }

          const message = readRealtimeMessage(payload.new);
          if (!message) return;
          setMessages((current) => upsertRealtimeMessage(current, message));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "global_chat_message_reactions",
        },
        (payload: {
          eventType: string;
          new: Record<string, unknown>;
          old: Record<string, unknown>;
        }) => {
          const row = readRealtimeReaction(
            payload.eventType === "DELETE" ? payload.old : payload.new,
          );
          if (!row) return;

          setMessages((current) =>
            updateMessageReaction(
              current,
              row,
              payload.eventType !== "DELETE",
            ),
          );
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

  const draftLimit = GLOBAL_CHAT_MESSAGE_MAX_LENGTH;

  async function loadOlderMessages() {
    if (!olderCursor || isLoadingOlder) return;

    setHistoryError(null);
    setIsLoadingOlder(true);
    try {
      const parameters = new URLSearchParams({
        beforeCreatedAt: olderCursor.createdAt,
        beforeId: olderCursor.id,
      });
      const response = await fetch(`/jeu/chat/messages?${parameters}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const page = (await response.json()) as GlobalChatMessagePage & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          page.error ?? "Les anciens messages n’ont pas pu être chargés.",
        );
      }

      const viewport = viewportRef.current;
      if (viewport) {
        prependedScrollRef.current = {
          scrollHeight: viewport.scrollHeight,
          scrollTop: viewport.scrollTop,
        };
      }

      setMessages((current) =>
        prependUniqueMessages(current, page.messages),
      );
      setHasMore(page.hasMore);
      setOlderCursor(page.nextCursor);
    } catch (loadingError) {
      setHistoryError(
        loadingError instanceof Error
          ? loadingError.message
          : "Les anciens messages n’ont pas pu être chargés.",
      );
    } finally {
      setIsLoadingOlder(false);
    }
  }

  function appendEmoji(emoji: string) {
    setDraft((current) => {
      const separator = current.length > 0 && !/\s$/.test(current) ? " " : "";
      return `${current}${separator}${emoji}`.slice(0, draftLimit);
    });
  }


  function beginReply(message: GlobalChatMessage) {
    setReplyTo(message);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function toggleMessageReaction(
    messageId: string,
    emoji: GlobalChatMessageReactionEmoji,
  ) {
    const reactionKey = `${messageId}:${emoji}`;
    if (pendingReactionKey === reactionKey) return;

    setError(null);
    setPendingReactionKey(reactionKey);
    startReactionTransition(async () => {
      try {
        const { active } = await toggleGlobalChatMessageReactionAction(
          messageId,
          emoji,
        );
        setMessages((current) =>
          updateMessageReaction(
            current,
            {
              message_id: messageId,
              sporting_director_id: identity.sportingDirectorId,
              emoji,
            },
            active,
          ),
        );
      } catch (reactionError) {
        setError(
          reactionError instanceof Error
            ? reactionError.message
            : "La réaction n’a pas pu être enregistrée.",
        );
      } finally {
        setPendingReactionKey(null);
      }
    });
  }

  function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = normalizeGlobalChatMessage(draft);
    if (!message || isPending) return;

    setError(null);
    startTransition(async () => {
      try {
        const savedMessage = await postGlobalChatMessageAction(
          message,
          replyTo?.id ?? null,
        );
        setMessages((current) =>
          appendUniqueMessage(current, savedMessage),
        );
        setDraft("");
        setReplyTo(null);
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
    <div className="grid overflow-hidden rounded-[2rem] border border-[#1D5145]/20 bg-white shadow-[0_24px_70px_rgba(7,26,23,0.16)] lg:h-[46rem] lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="flex h-[min(42rem,calc(100dvh-6rem))] min-h-[34rem] min-w-0 flex-col bg-[#F7FBF9] lg:h-auto lg:min-h-0">
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
          {messages.length > 0 ? (
            <div className="flex flex-col items-center gap-2 pb-1 text-center">
              {hasMore && olderCursor ? (
                <button
                  type="button"
                  onClick={() => void loadOlderMessages()}
                  disabled={isLoadingOlder}
                  className="rounded-full border border-[#176951]/20 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#176951] shadow-sm transition hover:border-[#176951]/45 hover:bg-[#EAF7F1] disabled:cursor-wait disabled:opacity-60"
                >
                  {isLoadingOlder
                    ? "Chargement…"
                    : "Afficher les messages précédents"}
                </button>
              ) : (
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#789087]">
                  Début de l’historique visible
                </p>
              )}
              <p className="text-[9px] font-semibold text-[#8AA097]">
                Historique limité aux {GLOBAL_CHAT_HISTORY_DAYS} derniers jours
              </p>
              {historyError ? (
                <p role="alert" className="text-[10px] font-bold text-red-700">
                  {historyError}
                </p>
              ) : null}
            </div>
          ) : null}

          {messages.length === 0 ? <EmptyChat /> : null}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isCurrentDirector={
                message.sportingDirectorId === identity.sportingDirectorId
              }
              currentDirectorId={identity.sportingDirectorId}
              pendingReactionKey={pendingReactionKey}
              reactionsDisabled={isReactionPending}
              onReply={beginReply}
              onReaction={toggleMessageReaction}
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
          {replyTo ? (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-[#176951]/20 bg-[#EAF7F1] px-3 py-2">
              <span aria-hidden="true" className="text-lg text-[#176951]">
                ↩
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#176951]">
                  Réponse à {replyTo.authorDisplayName}
                </span>
                <span className="block truncate text-[11px] font-semibold text-[#60756E]">
                  {getMessageExcerpt(replyTo.message)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sm font-black text-[#60756E] shadow-sm hover:text-red-700"
                aria-label="Annuler la réponse"
              >
                ×
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              id="global-chat-message"
              rows={2}
              value={draft}
              onChange={(event) =>
                setDraft(
                  expandGlobalChatEmoticons(event.target.value).slice(
                    0,
                    draftLimit,
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
          <div className="mt-2 flex min-h-9 flex-wrap items-center gap-2">
            <GlobalChatMediaPicker onEmojiSelect={appendEmoji} />
            <p role="alert" className="min-w-0 flex-1 text-[10px] font-bold text-red-700">
              {error}
            </p>
            <p className="ml-auto shrink-0 text-[9px] font-bold text-[#789087]">
              Entrée pour envoyer · {draft.length}/{draftLimit}
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
  currentDirectorId,
  pendingReactionKey,
  reactionsDisabled,
  onReply,
  onReaction,
}: {
  message: GlobalChatMessage;
  isCurrentDirector: boolean;
  currentDirectorId: string;
  pendingReactionKey: string | null;
  reactionsDisabled: boolean;
  onReply: (message: GlobalChatMessage) => void;
  onReaction: (
    messageId: string,
    emoji: GlobalChatMessageReactionEmoji,
  ) => void;
}) {
  return (
    <article
      id={`global-chat-message-${message.id}`}
      className={`flex scroll-mt-4 items-start gap-3 ${
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

        {message.replyTo ? (
          <button
            type="button"
            disabled={!message.replyTo.messageId}
            onClick={() =>
              message.replyTo?.messageId
                ? focusChatMessage(message.replyTo.messageId)
                : undefined
            }
            className={`mt-2 block w-full rounded-lg border-l-2 px-3 py-2 text-left transition ${
              isCurrentDirector
                ? "border-[#F2C94C] bg-black/10 hover:bg-black/15"
                : "border-[#42B99A] bg-[#EAF7F1] hover:bg-[#DDF3E7]"
            } disabled:cursor-default`}
            aria-label={`Message cité de ${message.replyTo.authorDisplayName}`}
          >
            <span
              className={`block text-[9px] font-black uppercase tracking-[0.1em] ${
                isCurrentDirector ? "text-[#F7DA73]" : "text-[#176951]"
              }`}
            >
              ↩ {message.replyTo.authorDisplayName}
            </span>
            <span
              className={`mt-0.5 block truncate text-[11px] font-semibold ${
                isCurrentDirector ? "text-white/70" : "text-[#60756E]"
              }`}
            >
              {message.replyTo.excerpt}
            </span>
          </button>
        ) : null}

        <div className="mt-1.5 whitespace-pre-wrap break-words text-sm font-semibold leading-6">
          {renderMessageText(message.message, isCurrentDirector)}
        </div>

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

        <ChatMessageActions
          message={message}
          isCurrentDirector={isCurrentDirector}
          currentDirectorId={currentDirectorId}
          pendingReactionKey={pendingReactionKey}
          reactionsDisabled={reactionsDisabled}
          onReply={onReply}
          onReaction={onReaction}
        />
      </div>
    </article>
  );
}

function ChatMessageActions({
  message,
  isCurrentDirector,
  currentDirectorId,
  pendingReactionKey,
  reactionsDisabled,
  onReply,
  onReaction,
}: {
  message: GlobalChatMessage;
  isCurrentDirector: boolean;
  currentDirectorId: string;
  pendingReactionKey: string | null;
  reactionsDisabled: boolean;
  onReply: (message: GlobalChatMessage) => void;
  onReaction: (
    messageId: string,
    emoji: GlobalChatMessageReactionEmoji,
  ) => void;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const actionClass = isCurrentDirector
    ? "border-white/15 bg-white/10 text-white/75 hover:bg-white/20 hover:text-white"
    : "border-[#176951]/15 bg-[#F3F8F6] text-[#60756E] hover:border-[#176951]/35 hover:text-[#176951]";

  return (
    <div className="relative mt-2.5 flex flex-wrap items-center gap-1.5">
      {message.reactions.map((reaction) => {
        const isActive = reaction.sportingDirectorIds.includes(
          currentDirectorId,
        );
        const reactionKey = `${message.id}:${reaction.emoji}`;
        return (
          <button
            key={reaction.emoji}
            type="button"
            disabled={
              reactionsDisabled && pendingReactionKey === reactionKey
            }
            onClick={() => onReaction(message.id, reaction.emoji)}
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-black transition ${
              isActive
                ? "border-[#F2C94C] bg-[#FFF4C4] text-[#493A00]"
                : actionClass
            } disabled:opacity-50`}
            aria-pressed={isActive}
            aria-label={`${reaction.emoji}, ${reaction.sportingDirectorIds.length} réaction${reaction.sportingDirectorIds.length > 1 ? "s" : ""}`}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span>{reaction.sportingDirectorIds.length}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onReply(message)}
        className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-black transition ${actionClass}`}
        aria-label={`Répondre à ${message.authorDisplayName}`}
      >
        <span aria-hidden="true">↩</span>
        Répondre
      </button>
      <button
        type="button"
        onClick={() => setIsPickerOpen((current) => !current)}
        className={`grid h-7 w-7 place-items-center rounded-full border text-sm transition ${actionClass}`}
        aria-label="Ajouter une réaction"
        aria-expanded={isPickerOpen}
      >
        ☺
      </button>

      {isPickerOpen ? (
        <div
          className={`absolute bottom-9 z-30 grid grid-cols-6 gap-1 rounded-xl border p-2 shadow-xl ${
            isCurrentDirector
              ? "right-0 border-white/15 bg-[#0B302B]"
              : "left-0 border-[#176951]/15 bg-white"
          }`}
          role="group"
          aria-label="Réactions au message"
        >
          {GLOBAL_CHAT_MESSAGE_REACTION_EMOJIS.map((emoji) => {
            const reactionKey = `${message.id}:${emoji}`;
            return (
              <button
                key={emoji}
                type="button"
                disabled={
                  reactionsDisabled && pendingReactionKey === reactionKey
                }
                onClick={() => {
                  onReaction(message.id, emoji);
                  setIsPickerOpen(false);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg text-lg transition hover:bg-[#DDF3E7] disabled:opacity-50"
                aria-label={`Réagir avec ${emoji}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
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
  return [...messages, message];
}

function upsertRealtimeMessage(
  messages: GlobalChatMessage[],
  message: GlobalChatMessage,
) {
  const existing = messages.find((candidate) => candidate.id === message.id);
  if (!existing) return [...messages, message];

  return messages.map((candidate) =>
    candidate.id === message.id
      ? { ...message, reactions: candidate.reactions }
      : candidate,
  );
}

function updateMessageReaction(
  messages: GlobalChatMessage[],
  row: GlobalChatReactionRow,
  active: boolean,
) {
  return messages.map((message) => {
    if (message.id !== row.message_id) return message;

    const existing = message.reactions.find(
      (reaction) => reaction.emoji === row.emoji,
    );
    if (active) {
      if (
        existing?.sportingDirectorIds.includes(row.sporting_director_id)
      ) {
        return message;
      }
      if (existing) {
        return {
          ...message,
          reactions: message.reactions.map((reaction) =>
            reaction.emoji === row.emoji
              ? {
                  ...reaction,
                  sportingDirectorIds: [
                    ...reaction.sportingDirectorIds,
                    row.sporting_director_id,
                  ],
                }
              : reaction,
          ),
        };
      }
      return {
        ...message,
        reactions: [
          ...message.reactions,
          {
            emoji: row.emoji,
            sportingDirectorIds: [row.sporting_director_id],
          },
        ],
      };
    }

    if (!existing) return message;
    const remainingDirectorIds = existing.sportingDirectorIds.filter(
      (directorId) => directorId !== row.sporting_director_id,
    );
    return {
      ...message,
      reactions:
        remainingDirectorIds.length > 0
          ? message.reactions.map((reaction) =>
              reaction.emoji === row.emoji
                ? {
                    ...reaction,
                    sportingDirectorIds: remainingDirectorIds,
                  }
                : reaction,
            )
          : message.reactions.filter(
              (reaction) => reaction.emoji !== row.emoji,
            ),
    };
  });
}

function prependUniqueMessages(
  messages: GlobalChatMessage[],
  olderMessages: GlobalChatMessage[],
) {
  const knownIds = new Set(messages.map((message) => message.id));
  return [
    ...olderMessages.filter((message) => !knownIds.has(message.id)),
    ...messages,
  ];
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
    reply_to_message_id:
      typeof value.reply_to_message_id === "string"
        ? value.reply_to_message_id
        : null,
    reply_to_author_display_name:
      typeof value.reply_to_author_display_name === "string"
        ? value.reply_to_author_display_name
        : null,
    reply_to_message_excerpt:
      typeof value.reply_to_message_excerpt === "string"
        ? value.reply_to_message_excerpt
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
    replyTo:
      row.reply_to_author_display_name && row.reply_to_message_excerpt
        ? {
            messageId: row.reply_to_message_id,
            authorDisplayName: row.reply_to_author_display_name,
            excerpt: row.reply_to_message_excerpt,
          }
        : null,
    reactions: [],
    createdAt: row.created_at,
  };
}

function readRealtimeReaction(
  value: Record<string, unknown>,
): GlobalChatReactionRow | null {
  if (
    typeof value.message_id !== "string" ||
    typeof value.sporting_director_id !== "string" ||
    !isGlobalChatMessageReactionEmoji(value.emoji)
  ) {
    return null;
  }

  return {
    message_id: value.message_id,
    sporting_director_id: value.sporting_director_id,
    emoji: value.emoji,
  };
}

function focusChatMessage(messageId: string) {
  document
    .getElementById(`global-chat-message-${messageId}`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function getMessageExcerpt(message: string) {
  return stripGlobalChatCyclingReactionTokens(message) || "GIF retiré";
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
  const content = stripGlobalChatCyclingReactionTokens(message);

  if (!content) {
    return (
      <span
        className={`italic ${inverted ? "text-white/60" : "text-[#789087]"}`}
      >
        GIF retiré
      </span>
    );
  }

  return renderLinkedMessageText(content, inverted, 0);
}


function renderLinkedMessageText(
  message: string,
  inverted: boolean,
  contentIndex: number,
) {
  const tokenPattern =
    /(https?:\/\/[^\s]+|\/jeu\/(?:equipes|coureurs)\/[0-9a-f-]{36})/gi;
  const tokens = message.split(tokenPattern);

  return tokens.map((token, index) => {
    const key = `${contentIndex}-${token}-${index}`;
    const internalReference =
      extractGlobalChatPreviewReference(token);
    if (internalReference) {
      return (
        <Link
          key={key}
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
          key={key}
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
