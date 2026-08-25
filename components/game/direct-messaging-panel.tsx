"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  markDirectConversationReadAction,
  openDirectConversationAction,
  postDirectMessageAction,
} from "@/app/jeu/chat/direct-actions";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import Link from "@/components/ui/app-link";
import {
  DIRECT_MESSAGE_MAX_LENGTH,
  DIRECT_RECIPIENT_SEARCH_MIN_LENGTH,
  type DirectConversationCursor,
  type DirectMessageCursor,
} from "@/lib/game/direct-messages";
import { hasForbiddenGlobalChatLink } from "@/lib/game/global-chat";
import { notifyDirectMessagesChanged } from "@/lib/game/direct-message-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  DirectConversation,
  DirectConversationPage,
  DirectMessage,
  DirectMessagePage,
  DirectMessageRecipient,
  DirectMessageRow,
} from "@/services/direct-messages";
import type { GlobalChatIdentity } from "@/services/global-chat";

type DirectMessagingPanelProps = {
  identity: GlobalChatIdentity;
  active: boolean;
  requestedRecipientId: string | null;
  onRequestedRecipientHandled: () => void;
  onUnreadCountChange: (count: number) => void;
};

type DirectOverviewResponse = {
  conversationPage: DirectConversationPage;
  totalUnreadCount: number | null;
  error?: string;
};

export function DirectMessagingPanel({
  identity,
  active,
  requestedRecipientId,
  onRequestedRecipientHandled,
  onUnreadCountChange,
}: DirectMessagingPanelProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [conversationCursor, setConversationCursor] =
    useState<DirectConversationCursor | null>(null);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(null);
  const [loadedConversationId, setLoadedConversationId] =
    useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageCursor, setMessageCursor] =
    useState<DirectMessageCursor | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [isLoadingOlderConversations, setIsLoadingOlderConversations] =
    useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    DirectMessageRecipient[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showRecipientSearch, setShowRecipientSearch] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [isSending, startSendingTransition] = useTransition();
  const [isOpening, startOpeningTransition] = useTransition();
  const viewportRef = useRef<HTMLDivElement>(null);
  const positionedRef = useRef(false);
  const prependedScrollRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const activeRef = useRef(active);
  const activeConversationIdRef = useRef(activeConversationId);
  const messageRequestVersionRef = useRef(0);
  const handledRecipientRef = useRef<string | null>(null);
  const overviewRefreshTimerRef = useRef<number | null>(null);
  const markReadTimerRef = useRef<number | null>(null);
  const conversationsRef = useRef(conversations);

  const activeConversation =
    conversations.find(
      (conversation) => conversation.id === activeConversationId,
    ) ?? null;
  const latestMessageId = messages.at(-1)?.id ?? null;
  const oldestMessageId = messages[0]?.id ?? null;

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    onUnreadCountChange(totalUnreadCount);
  }, [onUnreadCountChange, totalUnreadCount]);

  const refreshOverview = useCallback(
    async ({ preserve = true }: { preserve?: boolean } = {}) => {
      setIsLoadingOverview(true);
      try {
        const response = await fetch("/jeu/chat/prives/conversations", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const result = (await response.json()) as DirectOverviewResponse;
        if (!response.ok) {
          throw new Error(
            result.error ?? "Les conversations privées sont indisponibles.",
          );
        }

        setConversations((current) =>
          preserve
            ? mergeConversations(
                result.conversationPage.conversations,
                current.filter((conversation) =>
                  result.conversationPage.conversations.every(
                    (candidate) => candidate.id !== conversation.id,
                  ),
                ),
              )
            : result.conversationPage.conversations,
        );
        setHasMoreConversations(result.conversationPage.hasMore);
        setConversationCursor(result.conversationPage.nextCursor);
        if (result.totalUnreadCount !== null) {
          setTotalUnreadCount(result.totalUnreadCount);
        }
        setOverviewLoaded(true);
        setError(null);
      } catch (loadingError) {
        setError(
          loadingError instanceof Error
            ? loadingError.message
            : "Les conversations privées sont indisponibles.",
        );
      } finally {
        setIsLoadingOverview(false);
      }
    },
    [],
  );

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      const clearedCount =
        conversationsRef.current.find(
          (conversation) => conversation.id === conversationId,
        )?.unreadCount ?? 0;
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
      if (clearedCount > 0) {
        setTotalUnreadCount((current) =>
          Math.max(0, current - clearedCount),
        );
      }

      try {
        await markDirectConversationReadAction(conversationId);
        notifyDirectMessagesChanged();
      } catch {
        void refreshOverview();
      }
    },
    [refreshOverview],
  );

  const scheduleConversationRead = useCallback(
    (conversationId: string) => {
      if (markReadTimerRef.current !== null) {
        window.clearTimeout(markReadTimerRef.current);
      }
      markReadTimerRef.current = window.setTimeout(() => {
        markReadTimerRef.current = null;
        void markConversationRead(conversationId);
      }, 120);
    },
    [markConversationRead],
  );

  const loadConversationMessages = useCallback(
    async (conversationId: string) => {
      const requestVersion = ++messageRequestVersionRef.current;
      setActiveConversationId(conversationId);
      setLoadedConversationId(null);
      setMessages([]);
      setMessageCursor(null);
      setHasMoreMessages(false);
      setIsLoadingMessages(true);
      positionedRef.current = false;
      setError(null);

      try {
        const parameters = new URLSearchParams({ conversationId });
        const response = await fetch(
          `/jeu/chat/prives/messages?${parameters}`,
          {
            cache: "no-store",
            headers: { Accept: "application/json" },
          },
        );
        const page = (await response.json()) as DirectMessagePage & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(
            page.error ?? "Les messages privés sont indisponibles.",
          );
        }
        if (requestVersion !== messageRequestVersionRef.current) return;

        setMessages(page.messages);
        setHasMoreMessages(page.hasMore);
        setMessageCursor(page.nextCursor);
        setLoadedConversationId(conversationId);
        scheduleConversationRead(conversationId);
      } catch (loadingError) {
        if (requestVersion !== messageRequestVersionRef.current) return;
        setError(
          loadingError instanceof Error
            ? loadingError.message
            : "Les messages privés sont indisponibles.",
        );
      } finally {
        if (requestVersion === messageRequestVersionRef.current) {
          setIsLoadingMessages(false);
        }
      }
    },
    [scheduleConversationRead],
  );

  const openRecipient = useCallback(
    (recipientId: string) => {
      setError(null);
      startOpeningTransition(async () => {
        try {
          const conversation =
            await openDirectConversationAction(recipientId);
          setConversations((current) =>
            mergeConversations([conversation], current),
          );
          setOverviewLoaded(true);
          setShowRecipientSearch(false);
          setSearchQuery("");
          setSearchResults([]);
          await loadConversationMessages(conversation.id);
          void refreshOverview();
        } catch (openingError) {
          setError(
            openingError instanceof Error
              ? openingError.message
              : "La conversation privée n’a pas pu être ouverte.",
          );
        }
      });
    },
    [loadConversationMessages, refreshOverview],
  );

  useEffect(() => {
    if (!active || overviewLoaded || isLoadingOverview) return;
    const timer = window.setTimeout(() => {
      void refreshOverview({ preserve: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active, isLoadingOverview, overviewLoaded, refreshOverview]);

  useEffect(() => {
    if (
      !active ||
      !overviewLoaded ||
      activeConversationId !== null ||
      conversations.length === 0
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void loadConversationMessages(conversations[0].id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    active,
    activeConversationId,
    conversations,
    loadConversationMessages,
    overviewLoaded,
  ]);

  useEffect(() => {
    if (!requestedRecipientId) {
      handledRecipientRef.current = null;
      return;
    }
    if (handledRecipientRef.current === requestedRecipientId) return;

    handledRecipientRef.current = requestedRecipientId;
    onRequestedRecipientHandled();
    openRecipient(requestedRecipientId);
  }, [
    onRequestedRecipientHandled,
    openRecipient,
    requestedRecipientId,
  ]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (
      !showRecipientSearch ||
      normalizedQuery.length < DIRECT_RECIPIENT_SEARCH_MIN_LENGTH
    ) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const parameters = new URLSearchParams({ q: normalizedQuery });
        const response = await fetch(
          `/jeu/chat/prives/destinataires?${parameters}`,
          {
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        const result = (await response.json()) as {
          recipients?: DirectMessageRecipient[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "La recherche a échoué.");
        }
        setSearchResults(result.recipients ?? []);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setError(
          searchError instanceof Error
            ? searchError.message
            : "La recherche a échoué.",
        );
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, showRecipientSearch]);

  useEffect(() => {
    function scheduleOverviewRefresh() {
      if (overviewRefreshTimerRef.current !== null) {
        window.clearTimeout(overviewRefreshTimerRef.current);
      }
      overviewRefreshTimerRef.current = window.setTimeout(() => {
        overviewRefreshTimerRef.current = null;
        void refreshOverview();
      }, 180);
    }

    const channel = supabase
      .channel(`direct-messages:${identity.sportingDirectorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${identity.sportingDirectorId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const message = readRealtimeDirectMessage(payload.new);
          if (!message) return;

          const isVisibleConversation =
            activeRef.current &&
            activeConversationIdRef.current === message.conversationId &&
            document.visibilityState === "visible";

          if (activeConversationIdRef.current === message.conversationId) {
            setMessages((current) => appendUniqueMessage(current, message));
          }

          setConversations((current) =>
            updateConversationFromIncomingMessage(
              current,
              message,
              isVisibleConversation,
            ),
          );
          if (!isVisibleConversation) {
            setTotalUnreadCount((current) => current + 1);
          } else {
            scheduleConversationRead(message.conversationId);
          }

          notifyDirectMessagesChanged();
          scheduleOverviewRefresh();
        },
      )
      .subscribe();

    return () => {
      if (overviewRefreshTimerRef.current !== null) {
        window.clearTimeout(overviewRefreshTimerRef.current);
      }
      if (markReadTimerRef.current !== null) {
        window.clearTimeout(markReadTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [identity.sportingDirectorId, refreshOverview, scheduleConversationRead, supabase]);

  useEffect(() => {
    if (!active || document.visibilityState !== "visible") return;
    if (activeConversationId && activeConversation?.unreadCount) {
      scheduleConversationRead(activeConversationId);
    }
  }, [
    active,
    activeConversation?.unreadCount,
    activeConversationId,
    scheduleConversationRead,
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport || loadedConversationId !== activeConversationId) return;
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: positionedRef.current ? "smooth" : "auto",
      });
      positionedRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeConversationId, latestMessageId, loadedConversationId]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const previous = prependedScrollRef.current;
    if (!viewport || !previous) return;
    viewport.scrollTop =
      viewport.scrollHeight - previous.scrollHeight + previous.scrollTop;
    prependedScrollRef.current = null;
  }, [oldestMessageId]);

  async function loadOlderMessages() {
    if (
      !activeConversationId ||
      !messageCursor ||
      isLoadingOlderMessages
    ) {
      return;
    }

    setIsLoadingOlderMessages(true);
    try {
      const parameters = new URLSearchParams({
        conversationId: activeConversationId,
        beforeCreatedAt: messageCursor.createdAt,
        beforeId: messageCursor.id,
      });
      const response = await fetch(
        `/jeu/chat/prives/messages?${parameters}`,
        { cache: "no-store", headers: { Accept: "application/json" } },
      );
      const page = (await response.json()) as DirectMessagePage & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(page.error ?? "L’historique n’a pas pu être chargé.");
      }

      const viewport = viewportRef.current;
      if (viewport) {
        prependedScrollRef.current = {
          scrollHeight: viewport.scrollHeight,
          scrollTop: viewport.scrollTop,
        };
      }
      setMessages((current) => prependUniqueMessages(current, page.messages));
      setHasMoreMessages(page.hasMore);
      setMessageCursor(page.nextCursor);
    } catch (loadingError) {
      setError(
        loadingError instanceof Error
          ? loadingError.message
          : "L’historique n’a pas pu être chargé.",
      );
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }

  async function loadOlderConversations() {
    if (!conversationCursor || isLoadingOlderConversations) return;

    setIsLoadingOlderConversations(true);
    try {
      const parameters = new URLSearchParams({
        beforeActivityAt: conversationCursor.lastActivityAt,
        beforeId: conversationCursor.id,
      });
      const response = await fetch(
        `/jeu/chat/prives/conversations?${parameters}`,
        { cache: "no-store", headers: { Accept: "application/json" } },
      );
      const result = (await response.json()) as DirectOverviewResponse;
      if (!response.ok) {
        throw new Error(
          result.error ?? "Les anciennes conversations sont indisponibles.",
        );
      }

      setConversations((current) =>
        mergeConversations(current, result.conversationPage.conversations),
      );
      setHasMoreConversations(result.conversationPage.hasMore);
      setConversationCursor(result.conversationPage.nextCursor);
    } catch (loadingError) {
      setError(
        loadingError instanceof Error
          ? loadingError.message
          : "Les anciennes conversations sont indisponibles.",
      );
    } finally {
      setIsLoadingOlderConversations(false);
    }
  }

  function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversation || isSending) return;
    const body = draft.trim();
    if (!body) return;
    if (hasForbiddenGlobalChatLink(body)) {
      setError(
        "Seuls les liens Cyclo Stratège vers une fiche coureur, équipe ou DS sont autorisés.",
      );
      return;
    }

    setError(null);
    startSendingTransition(async () => {
      try {
        const savedMessage = await postDirectMessageAction(
          activeConversation.id,
          body,
        );
        setMessages((current) => appendUniqueMessage(current, savedMessage));
        setConversations((current) =>
          updateConversationFromSentMessage(current, savedMessage),
        );
        setDraft("");
      } catch (sendingError) {
        setError(
          sendingError instanceof Error
            ? sendingError.message
            : "Le message privé n’a pas pu être envoyé.",
        );
      }
    });
  }

  return (
    <div
      className={
        active
          ? "grid min-h-[34rem] lg:h-[46rem] lg:grid-cols-[20rem_minmax(0,1fr)]"
          : "hidden"
      }
    >
      <aside className="border-b border-[#315B3E]/12 bg-[#071A17] text-white lg:border-b-0 lg:border-r">
        <header className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#72D4B7]">
                Conversations
              </p>
              <p className="mt-1 text-sm font-black text-white">
                Messages privés
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRecipientSearch((current) => !current)}
              className="rounded-lg bg-[#F2C94C] px-3 py-2 text-[10px] font-black text-[#17261E] transition hover:bg-[#F7DA73]"
              aria-expanded={showRecipientSearch}
            >
              Nouveau MP
            </button>
          </div>

          {showRecipientSearch ? (
            <div className="mt-3">
              <label htmlFor="direct-recipient-search" className="sr-only">
                Rechercher un membre
              </label>
              <input
                id="direct-recipient-search"
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchQuery(value);
                  if (
                    value.trim().length <
                    DIRECT_RECIPIENT_SEARCH_MIN_LENGTH
                  ) {
                    setSearchResults([]);
                    setIsSearching(false);
                  }
                }}
                maxLength={80}
                autoFocus
                placeholder="Nom du DS ou de l’équipe"
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-semibold text-white outline-none placeholder:text-[#8FA99D] focus:border-[#72D4B7]"
              />
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {isSearching ? (
                  <p className="px-2 py-3 text-xs font-semibold text-[#AFC6BB]">
                    Recherche…
                  </p>
                ) : null}
                {!isSearching &&
                searchQuery.trim().length >=
                  DIRECT_RECIPIENT_SEARCH_MIN_LENGTH &&
                searchResults.length === 0 ? (
                  <p className="px-2 py-3 text-xs font-semibold text-[#AFC6BB]">
                    Aucun membre trouvé.
                  </p>
                ) : null}
                {searchResults.map((recipient) => (
                  <button
                    key={recipient.sportingDirectorId}
                    type="button"
                    disabled={isOpening}
                    onClick={() => openRecipient(recipient.sportingDirectorId)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10 disabled:opacity-60"
                  >
                    <Avatar
                      name={recipient.displayName}
                      avatarKey={recipient.avatarKey}
                      frameKey={recipient.avatarFrameKey}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-black text-white">
                        {recipient.displayName}
                      </span>
                      <span className="block truncate text-[10px] font-semibold text-[#8FA99D]">
                        {recipient.teamName}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </header>

        <div className="max-h-72 overflow-y-auto p-2 lg:max-h-[37rem]">
          {isLoadingOverview && !overviewLoaded ? (
            <p className="px-3 py-8 text-center text-xs font-semibold text-[#AFC6BB]">
              Chargement des conversations…
            </p>
          ) : null}
          {overviewLoaded && conversations.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs font-semibold leading-5 text-[#AFC6BB]">
              Aucun MP pour le moment. Recherchez un membre ou contactez-le
              depuis le chat général.
            </p>
          ) : null}
          {conversations.map((conversation) => {
            const selected = conversation.id === activeConversationId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void loadConversationMessages(conversation.id)}
                className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                  selected
                    ? "bg-white/14 shadow-[inset_3px_0_0_#F2C94C]"
                    : "hover:bg-white/8"
                }`}
              >
                <Avatar
                  name={conversation.counterpartDisplayName}
                  avatarKey={conversation.counterpartAvatarKey}
                  frameKey={conversation.counterpartAvatarFrameKey}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-black text-white">
                      {conversation.counterpartDisplayName}
                    </span>
                    <time className="shrink-0 text-[9px] font-semibold text-[#8FA99D]">
                      {formatCompactDate(conversation.lastActivityAt)}
                    </time>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#8FA99D]">
                    {conversation.lastMessageBody ?? "Nouvelle conversation"}
                  </span>
                </span>
                {conversation.unreadCount > 0 ? (
                  <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-[#EF5B65] px-1 text-[9px] font-black text-white">
                    {Math.min(99, conversation.unreadCount)}
                  </span>
                ) : null}
              </button>
            );
          })}
          {hasMoreConversations && conversationCursor ? (
            <button
              type="button"
              disabled={isLoadingOlderConversations}
              onClick={() => void loadOlderConversations()}
              className="mt-2 w-full rounded-xl border border-white/10 px-3 py-2 text-[10px] font-black text-[#AFC6BB] transition hover:bg-white/8 hover:text-white disabled:opacity-60"
            >
              {isLoadingOlderConversations
                ? "Chargement…"
                : "Conversations précédentes"}
            </button>
          ) : null}
        </div>
      </aside>

      <section className="flex min-h-[34rem] min-w-0 flex-col bg-[#F7FBF9] lg:min-h-0">
        {activeConversation ? (
          <>
            <header className="flex min-h-[4.75rem] items-center gap-3 border-b border-[#315B3E]/12 bg-white px-5 py-3 sm:px-7">
              <Avatar
                name={activeConversation.counterpartDisplayName}
                avatarKey={activeConversation.counterpartAvatarKey}
                frameKey={activeConversation.counterpartAvatarFrameKey}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[#0B302B]">
                  {activeConversation.counterpartDisplayName}
                </p>
                <p className="truncate text-[10px] font-semibold text-[#60756E]">
                  {activeConversation.counterpartTeamName}
                </p>
              </div>
              {activeConversation.counterpartTeamId ? (
                <Link
                  href={`/jeu/equipes/${activeConversation.counterpartTeamId}`}
                  className="rounded-lg border border-[#176951]/15 bg-[#EAF7F1] px-3 py-2 text-[10px] font-black text-[#176951] transition hover:border-[#176951]/35"
                >
                  Voir l’équipe
                </Link>
              ) : null}
            </header>

            <div
              ref={viewportRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-7"
              aria-live="polite"
              aria-relevant="additions"
            >
              {hasMoreMessages && messageCursor ? (
                <div className="text-center">
                  <button
                    type="button"
                    disabled={isLoadingOlderMessages}
                    onClick={() => void loadOlderMessages()}
                    className="rounded-full border border-[#176951]/20 bg-white px-4 py-2 text-[10px] font-black text-[#176951] shadow-sm transition hover:bg-[#EAF7F1] disabled:opacity-60"
                  >
                    {isLoadingOlderMessages
                      ? "Chargement…"
                      : "Afficher les messages précédents"}
                  </button>
                </div>
              ) : null}

              {isLoadingMessages ? (
                <p className="py-16 text-center text-xs font-semibold text-[#60756E]">
                  Chargement des messages…
                </p>
              ) : null}
              {!isLoadingMessages &&
              loadedConversationId === activeConversation.id &&
              messages.length === 0 ? (
                <div className="mx-auto max-w-sm py-16 text-center">
                  <p className="text-sm font-black text-[#183F37]">
                    Commencez la conversation
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
                    Seuls vous et {activeConversation.counterpartDisplayName}
                    pourrez lire ces messages.
                  </p>
                </div>
              ) : null}

              {messages.map((message) => {
                const isCurrentDirector =
                  message.senderId === identity.sportingDirectorId;
                return (
                  <article
                    key={message.id}
                    className={`flex ${
                      isCurrentDirector ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[min(40rem,85%)] rounded-2xl border px-4 py-2.5 shadow-sm ${
                        isCurrentDirector
                          ? "rounded-br-sm border-[#176951] bg-[#176951] text-white"
                          : "rounded-bl-sm border-[#315B3E]/12 bg-white text-[#0B302B]"
                      }`}
                    >
                      <p
                        data-i18n-skip
                        className="whitespace-pre-wrap break-words text-sm font-semibold leading-6"
                      >
                        {message.body}
                      </p>
                      <time
                        dateTime={message.createdAt}
                        className={`mt-1 block text-right text-[9px] font-semibold ${
                          isCurrentDirector
                            ? "text-white/55"
                            : "text-[#789087]"
                        }`}
                      >
                        {formatMessageTime(message.createdAt)}
                      </time>
                    </div>
                  </article>
                );
              })}
            </div>

            <form
              onSubmit={submitMessage}
              className="border-t border-[#315B3E]/12 bg-white p-4 sm:px-7"
            >
              <label htmlFor="direct-message-body" className="sr-only">
                Votre message privé
              </label>
              <div className="flex items-end gap-2">
                <textarea
                  id="direct-message-body"
                  rows={2}
                  value={draft}
                  maxLength={DIRECT_MESSAGE_MAX_LENGTH}
                  onChange={(event) => setDraft(event.target.value)}
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
                  placeholder={`Écrire à ${activeConversation.counterpartDisplayName}…`}
                  className="min-h-[3.25rem] min-w-0 flex-1 resize-none rounded-xl border border-[#315B3E]/20 bg-[#F7FBF9] px-4 py-3 text-sm font-semibold leading-6 text-[#0B302B] outline-none transition focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/15"
                />
                <button
                  type="submit"
                  disabled={isSending || draft.trim().length === 0}
                  className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-xl bg-[#F2C94C] text-[#17261E] transition hover:bg-[#F7DA73] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Envoyer le message privé"
                >
                  {isSending ? "…" : <SendIcon />}
                </button>
              </div>
              <div className="mt-2 flex min-h-5 items-center gap-3">
                <p
                  role="alert"
                  className="min-w-0 flex-1 text-[10px] font-bold text-red-700"
                >
                  {error}
                </p>
                <p className="shrink-0 text-[9px] font-bold text-[#789087]">
                  {draft.length}/{DIRECT_MESSAGE_MAX_LENGTH}
                </p>
                <p className="w-full text-[9px] font-semibold text-[#789087]">
                  Liens autorisés : fiches coureurs, équipes et DS Cyclo Stratège
                </p>
              </div>
            </form>
          </>
        ) : (
          <div className="flex min-h-[34rem] flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#DDF3E7] text-2xl text-[#176951]">
              ✉
            </span>
            <p className="mt-5 text-lg font-black text-[#183F37]">
              Vos conversations privées
            </p>
            <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-[#60756E]">
              Sélectionnez une conversation ou recherchez un Directeur
              Sportif pour lui écrire.
            </p>
            <button
              type="button"
              onClick={() => setShowRecipientSearch(true)}
              className="mt-5 rounded-xl bg-[#176951] px-4 py-3 text-xs font-black text-white transition hover:bg-[#0F5641]"
            >
              Nouveau message privé
            </button>
            {error ? (
              <p role="alert" className="mt-4 text-xs font-bold text-red-700">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function Avatar({
  name,
  avatarKey,
  frameKey,
}: {
  name: string;
  avatarKey: string | null;
  frameKey: "alpha_tester" | null;
}) {
  return (
    <SportingDirectorAvatar
      avatarKey={avatarKey}
      frameKey={frameKey}
      size="small"
      label={`Avatar de ${name}`}
      className="ring-1 ring-white/10"
    />
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

function readRealtimeDirectMessage(
  value: Record<string, unknown>,
): DirectMessage | null {
  const row = value as Partial<DirectMessageRow>;
  if (
    typeof row.id !== "string" ||
    typeof row.conversation_id !== "string" ||
    typeof row.sender_id !== "string" ||
    typeof row.recipient_id !== "string" ||
    typeof row.body !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mergeConversations(
  prioritized: DirectConversation[],
  remaining: DirectConversation[],
) {
  const byId = new Map<string, DirectConversation>();
  for (const conversation of [...remaining, ...prioritized]) {
    byId.set(conversation.id, conversation);
  }
  return [...byId.values()].sort(compareConversationActivity);
}

function updateConversationFromIncomingMessage(
  conversations: DirectConversation[],
  message: DirectMessage,
  isReadImmediately: boolean,
) {
  return conversations
    .map((conversation) =>
      conversation.id === message.conversationId
        ? {
            ...conversation,
            lastMessageBody: message.body,
            lastMessageSenderId: message.senderId,
            lastActivityAt: message.createdAt,
            unreadCount: isReadImmediately
              ? 0
              : conversation.unreadCount + 1,
          }
        : conversation,
    )
    .sort(compareConversationActivity);
}

function updateConversationFromSentMessage(
  conversations: DirectConversation[],
  message: DirectMessage,
) {
  return conversations
    .map((conversation) =>
      conversation.id === message.conversationId
        ? {
            ...conversation,
            lastMessageBody: message.body,
            lastMessageSenderId: message.senderId,
            lastActivityAt: message.createdAt,
            unreadCount: 0,
          }
        : conversation,
    )
    .sort(compareConversationActivity);
}

function compareConversationActivity(
  first: DirectConversation,
  second: DirectConversation,
) {
  return (
    second.lastActivityAt.localeCompare(first.lastActivityAt) ||
    second.id.localeCompare(first.id)
  );
}

function appendUniqueMessage(
  messages: DirectMessage[],
  message: DirectMessage,
) {
  return messages.some((candidate) => candidate.id === message.id)
    ? messages
    : [...messages, message];
}

function prependUniqueMessages(
  messages: DirectMessage[],
  olderMessages: DirectMessage[],
) {
  const existingIds = new Set(messages.map((message) => message.id));
  return [
    ...olderMessages.filter((message) => !existingIds.has(message.id)),
    ...messages,
  ];
}

function formatCompactDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    ...(date.toDateString() === now.toDateString()
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short" }),
  }).format(date);
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
