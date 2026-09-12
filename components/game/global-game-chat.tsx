"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { GlobalChatSharePreview } from "@/components/game/global-chat-share-preview";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import { useGlobalChatReactions } from "@/components/game/use-global-chat-reactions";
import { GlobalChatMessageReactions } from "@/components/game/global-chat-message-reactions";
import {
  editGlobalChatMessageAction,
  postGlobalChatMessageAction,
} from "@/app/jeu/chat/actions";
import {
  CyclingReactionSticker,
  GlobalChatMediaPicker,
} from "@/components/game/global-chat-media-picker";
import Link from "@/components/ui/app-link";
import {
  expandGlobalChatEmoticons,
  extractGlobalChatCyclingReaction,
  extractGlobalChatPreviewReference,
  getGlobalChatMentionQuery,
  globalChatMessageMentionsUsername,
  GLOBAL_CHAT_MENTION_MAX_RECIPIENTS,
  GLOBAL_CHAT_MENTION_SEARCH_MIN_LENGTH,
  GLOBAL_CHAT_MESSAGE_MAX_LENGTH,
  hasForbiddenGlobalChatLink,
  normalizeGlobalChatMessage,
  splitGlobalChatMessageContent,
  stripGlobalChatCyclingReactionTokens,
  type GlobalChatCursor,
} from "@/lib/game/global-chat";
import { canEditChatMessage } from "@/lib/game/chat-message-text";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  hasTranslatableChatText,
  splitChatMessageForTranslation,
} from "@/lib/game/chat-translation";
import { notifyGlobalChatMessagesRead } from "@/lib/game/global-chat-read-sync";
import {
  GLOBAL_CHAT_ONLINE_REFRESH_INTERVAL_MS,
  GLOBAL_CHAT_ONLINE_WINDOW_MINUTES,
  mapGlobalChatOnlineDirectorRows,
  mergeGlobalChatOnlineDirectors,
  type GlobalChatOnlineDirector,
} from "@/lib/game/global-chat-presence";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  GlobalChatIdentity,
  GlobalChatMessage,
  GlobalChatMentionRecipient,
  GlobalChatMessagePage,
  GlobalChatMessageRow,
  GlobalChatPreview,
} from "@/services/global-chat";

const DirectMessagingPanel = dynamic(
  () =>
    import("@/components/game/direct-messaging-panel").then(
      (module) => module.DirectMessagingPanel,
    ),
  {
    loading: () => (
      <div className="grid h-full min-h-[28rem] place-items-center bg-[#F7FBF9] text-xs font-black text-[#60756E]">
        Ouverture des conversations…
      </div>
    ),
  },
);

const FederationMessagingPanel = dynamic(
  () =>
    import("@/components/game/federation-messaging-panel").then(
      (module) => module.FederationMessagingPanel,
    ),
  {
    loading: () => (
      <div className="grid min-h-0 flex-1 place-items-center bg-[#F3F8F5] text-xs font-black text-[#60756E]">
        Ouverture du vestiaire fédéral…
      </div>
    ),
  },
);

type ChatMode = "global" | "direct" | "federation";
type GlobalChatView = "all" | "races" | "mentions";

type ChatMessageTranslationState = {
  targetLocale: "fr" | "en";
  status: "loading" | "loaded" | "error";
  translatedText: string | null;
  detectedSourceLocale: string | null;
  error: string | null;
  visible: boolean;
};

export function GlobalGameChat({
  identity,
  initialOnlineDirectors,
  initialMessages,
  initialHasMore,
  initialCursor,
  initialLastReadAt = null,
  initialDirectRecipientId = null,
  initialDirectUnreadCount = 0,
  translationEnabled = false,
}: {
  identity: GlobalChatIdentity;
  initialOnlineDirectors: GlobalChatOnlineDirector[];
  initialMessages: GlobalChatMessage[];
  initialHasMore: boolean;
  initialCursor: GlobalChatCursor | null;
  initialLastReadAt?: string | null;
  initialDirectRecipientId?: string | null;
  initialDirectUnreadCount?: number;
  translationEnabled?: boolean;
}) {
  const { locale } = useLocale();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] =
    useState<GlobalChatMessage[]>(initialMessages);
  const {
    pendingReactionKey,
    isReactionPending,
    reactionError,
    toggleMessageReaction,
  } = useGlobalChatReactions({ supabase, identity, setMessages });
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [olderCursor, setOlderCursor] = useState(initialCursor);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [recentOnlineDirectors, setRecentOnlineDirectors] =
    useState<GlobalChatOnlineDirector[]>(initialOnlineDirectors);
  const [realtimeOnlineDirectors, setRealtimeOnlineDirectors] = useState<
    GlobalChatOnlineDirector[]
  >([identity]);
  const onlineDirectors = useMemo(
    () =>
      mergeGlobalChatOnlineDirectors({
        currentDirector: identity,
        recentDirectors: recentOnlineDirectors,
        realtimeDirectors: realtimeOnlineDirectors,
      }),
    [identity, realtimeOnlineDirectors, recentOnlineDirectors],
  );
  const [activeMode, setActiveMode] = useState<ChatMode>(
    initialDirectRecipientId ? "direct" : "global",
  );
  const [hasOpenedDirect, setHasOpenedDirect] = useState(
    Boolean(initialDirectRecipientId),
  );
  const [hasOpenedFederation, setHasOpenedFederation] = useState(false);
  const [showOnlineDirectors, setShowOnlineDirectors] = useState(false);
  const [requestedDirectRecipientId, setRequestedDirectRecipientId] =
    useState<string | null>(initialDirectRecipientId);
  const [directUnreadCount, setDirectUnreadCount] = useState(
    Math.max(0, initialDirectUnreadCount),
  );
  const [hasUnreadGlobalWhilePrivate, setHasUnreadGlobalWhilePrivate] =
    useState(false);
  const [globalView, setGlobalView] = useState<GlobalChatView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingLiveMessageCount, setPendingLiveMessageCount] = useState(0);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [selectedMentions, setSelectedMentions] = useState<
    GlobalChatMentionRecipient[]
  >([]);
  const [mentionQuery, setMentionQuery] = useState<ReturnType<
    typeof getGlobalChatMentionQuery
  >>(null);
  const [mentionResults, setMentionResults] = useState<
    GlobalChatMentionRecipient[]
  >([]);
  const [isSearchingMentions, setIsSearchingMentions] = useState(false);
  const [mentionAlert, setMentionAlert] = useState<{
    messageId: string;
    authorDisplayName: string;
  } | null>(null);
  const [messageTranslations, setMessageTranslations] = useState<
    Record<string, ChatMessageTranslationState>
  >({});

  const [replyTo, setReplyTo] = useState<GlobalChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(
    null,
  );
  const [editingDraft, setEditingDraft] = useState("");
  const [editingError, setEditingError] = useState<string | null>(null);
  const [editClockMs, setEditClockMs] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isEditing, startEditingTransition] = useTransition();
  const viewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const positionedRef = useRef(false);
  const prependedScrollRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const activeModeRef = useRef(activeMode);
  const viewportNearBottomRef = useRef(false);
  const forceScrollToLatestRef = useRef(false);
  const lastAcknowledgedReadAtRef = useRef(initialLastReadAt);
  const pendingReadRequestAtRef = useRef<string | null>(null);

  const latestDisplayedMessage = messages.at(-1) ?? null;
  const latestDisplayedMessageAt = latestDisplayedMessage?.createdAt ?? null;
  const latestDisplayedMessageId = latestDisplayedMessage?.id ?? null;
  const oldestDisplayedMessageId = messages[0]?.id ?? null;
  const mentionSearchText = mentionQuery?.query.trim() ?? "";
  const acknowledgeLatestMessages = useCallback(() => {
    if (
      !latestDisplayedMessageAt ||
      pendingReadRequestAtRef.current === latestDisplayedMessageAt ||
      (lastAcknowledgedReadAtRef.current !== null &&
        lastAcknowledgedReadAtRef.current >= latestDisplayedMessageAt)
    ) {
      return;
    }

    pendingReadRequestAtRef.current = latestDisplayedMessageAt;
    void markGlobalChatMessagesAsRead(
      supabase,
      latestDisplayedMessageAt,
    ).then((success) => {
      if (success) {
        lastAcknowledgedReadAtRef.current = latestDisplayedMessageAt;
      }
      if (pendingReadRequestAtRef.current === latestDisplayedMessageAt) {
        pendingReadRequestAtRef.current = null;
      }
    });
  }, [latestDisplayedMessageAt, supabase]);
  const initialUnreadMessageIds = useMemo(
    () =>
      initialLastReadAt
        ? initialMessages
            .filter(
              (message) =>
                message.sportingDirectorId !== identity.sportingDirectorId &&
                message.createdAt > initialLastReadAt,
            )
            .map((message) => message.id)
        : [],
    [identity.sportingDirectorId, initialLastReadAt, initialMessages],
  );
  const firstInitialUnreadMessageId = initialUnreadMessageIds[0] ?? null;
  const initialUnreadMessageCount = initialUnreadMessageIds.length;
  const filteredMessages = useMemo(
    () => {
      const normalizedQuery = normalizeChatSearchQuery(searchQuery);
      return messages.filter((message) => {
        if (globalView === "races" && !message.raceContext) return false;
        if (
          globalView === "mentions" &&
          !globalChatMessageMentionsUsername(message.message, identity.username)
        ) {
          return false;
        }

        if (!normalizedQuery) return true;
        return [
          message.message,
          message.authorDisplayName,
          message.teamDisplayName,
          message.raceContext?.label ?? "",
        ].some((value) =>
          normalizeChatSearchQuery(value).includes(normalizedQuery),
        );
      });
    },
    [globalView, identity.username, messages, searchQuery],
  );

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(
      getGlobalChatDraftStorageKey(identity.sportingDirectorId),
    );
    if (savedDraft) {
      setDraft(savedDraft.slice(0, GLOBAL_CHAT_MESSAGE_MAX_LENGTH));
    }
    setDraftHydrated(true);
  }, [identity.sportingDirectorId]);

  useEffect(() => {
    if (!draftHydrated) return;
    const timer = window.setTimeout(() => {
      const storageKey = getGlobalChatDraftStorageKey(
        identity.sportingDirectorId,
      );
      if (draft.trim()) window.localStorage.setItem(storageKey, draft);
      else window.localStorage.removeItem(storageKey);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [draft, draftHydrated, identity.sportingDirectorId]);

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  useEffect(() => {
    if (!showOnlineDirectors) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowOnlineDirectors(false);
    };
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [showOnlineDirectors]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setEditClockMs(Date.now()),
      30_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (
      activeMode !== "global" ||
      document.visibilityState !== "visible" ||
      !latestDisplayedMessageAt ||
      !viewportNearBottomRef.current
    ) {
      return;
    }

    acknowledgeLatestMessages();
  }, [acknowledgeLatestMessages, activeMode, latestDisplayedMessageAt]);

  useEffect(() => {
    function markVisibleMessagesAsRead() {
      if (
        activeMode === "global" &&
        document.visibilityState === "visible" &&
        latestDisplayedMessageAt &&
        viewportNearBottomRef.current
      ) {
        acknowledgeLatestMessages();
      }
    }

    window.addEventListener("focus", markVisibleMessagesAsRead);
    document.addEventListener("visibilitychange", markVisibleMessagesAsRead);

    return () => {
      window.removeEventListener("focus", markVisibleMessagesAsRead);
      document.removeEventListener(
        "visibilitychange",
        markVisibleMessagesAsRead,
      );
    };
  }, [acknowledgeLatestMessages, activeMode, latestDisplayedMessageAt]);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    async function refreshOnlineDirectors() {
      if (
        !active ||
        requestInFlight ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      requestInFlight = true;
      const result = await supabase.rpc("get_online_global_chat_directors_v2");
      requestInFlight = false;

      if (!active || result.error) return;
      setRecentOnlineDirectors(
        mapGlobalChatOnlineDirectorRows(
          (result.data as Record<string, unknown>[] | null) ?? [],
        ),
      );
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refreshOnlineDirectors();
      }
    }

    const interval = window.setInterval(
      () => void refreshOnlineDirectors(),
      GLOBAL_CHAT_ONLINE_REFRESH_INTERVAL_MS,
    );
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [supabase]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport || activeMode !== "global") return;

      if (!positionedRef.current && firstInitialUnreadMessageId) {
        document
          .getElementById(`global-chat-message-${firstInitialUnreadMessageId}`)
          ?.scrollIntoView({ block: "start" });
      } else if (
        !positionedRef.current ||
        viewportNearBottomRef.current ||
        forceScrollToLatestRef.current
      ) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: positionedRef.current ? "smooth" : "auto",
        });
        viewportNearBottomRef.current = true;
        setShowJumpToLatest(false);
        setPendingLiveMessageCount(0);
        if (
          latestDisplayedMessageAt &&
          document.visibilityState === "visible"
        ) {
          acknowledgeLatestMessages();
        }
      }
      forceScrollToLatestRef.current = false;
      positionedRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    activeMode,
    firstInitialUnreadMessageId,
    latestDisplayedMessageAt,
    latestDisplayedMessageId,
    acknowledgeLatestMessages,
  ]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const previous = prependedScrollRef.current;
    if (!viewport || !previous) return;

    viewport.scrollTop =
      viewport.scrollHeight - previous.scrollHeight + previous.scrollTop;
    prependedScrollRef.current = null;
  }, [oldestDisplayedMessageId]);

  useEffect(() => {
    if (
      mentionSearchText.length < GLOBAL_CHAT_MENTION_SEARCH_MIN_LENGTH
    ) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearchingMentions(true);
      try {
        const parameters = new URLSearchParams({ q: mentionSearchText });
        const response = await fetch(`/jeu/chat/mentions?${parameters}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const result = (await response.json()) as
          | GlobalChatMentionRecipient[]
          | { error?: string };
        if (!response.ok || !Array.isArray(result)) {
          throw new Error(
            "La recherche des membres est momentanément indisponible.",
          );
        }
        setMentionResults(result);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setMentionResults([]);
        setError(
          searchError instanceof Error
            ? searchError.message
            : "La recherche des membres est momentanément indisponible.",
        );
      } finally {
        if (!controller.signal.aborted) setIsSearchingMentions(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mentionSearchText]);

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
        setRealtimeOnlineDirectors(
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
              setMessageTranslations((current) =>
                omitMessageTranslation(current, deletedId),
              );
            }
            return;
          }

          const message = readRealtimeMessage(payload.new);
          if (!message) return;
          if (payload.eventType === "UPDATE") {
            setMessageTranslations((current) =>
              omitMessageTranslation(current, message.id),
            );
          }
          if (
            payload.eventType === "INSERT" &&
            message.sportingDirectorId !== identity.sportingDirectorId &&
            globalChatMessageMentionsUsername(
              message.message,
              identity.username,
            )
          ) {
            setMentionAlert({
              messageId: message.id,
              authorDisplayName: message.authorDisplayName,
            });
          }
          if (
            payload.eventType === "INSERT" &&
            activeModeRef.current !== "global" &&
            message.sportingDirectorId !== identity.sportingDirectorId
          ) {
            setHasUnreadGlobalWhilePrivate(true);
          }
          if (
            payload.eventType === "INSERT" &&
            activeModeRef.current === "global" &&
            !viewportNearBottomRef.current &&
            message.sportingDirectorId !== identity.sportingDirectorId
          ) {
            setPendingLiveMessageCount((current) => current + 1);
            setShowJumpToLatest(true);
          }
          setMessages((current) => upsertRealtimeMessage(current, message));
        },
      )
      .subscribe(async (status: string) => {
        if (status !== "SUBSCRIBED") return;

        await channel.track({
          sportingDirectorId: identity.sportingDirectorId,
          displayName: identity.displayName,
          username: identity.username,
          avatarKey: identity.avatarKey,
          avatarFrameKey: identity.avatarFrameKey,
          country: identity.country,
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

  function handleGlobalViewportScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const nearBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 96;
    viewportNearBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom);

    if (
      nearBottom &&
      activeModeRef.current === "global" &&
      document.visibilityState === "visible"
    ) {
      setPendingLiveMessageCount(0);
      if (latestDisplayedMessageAt) {
        acknowledgeLatestMessages();
      }
    }
  }

  function scrollToLatestMessages() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewportNearBottomRef.current = true;
    setShowJumpToLatest(false);
    setPendingLiveMessageCount(0);
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    if (latestDisplayedMessageAt) {
      acknowledgeLatestMessages();
    }
  }

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

      setMessages((current) => prependUniqueMessages(current, page.messages));
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

  async function toggleMessageTranslation(message: GlobalChatMessage) {
    const current = messageTranslations[message.id];
    if (current?.status === "loading") return;
    if (current?.status === "loaded" && current.targetLocale === locale) {
      setMessageTranslations((translations) => ({
        ...translations,
        [message.id]: { ...current, visible: !current.visible },
      }));
      return;
    }

    setMessageTranslations((translations) => ({
      ...translations,
      [message.id]: {
        targetLocale: locale,
        status: "loading",
        translatedText: null,
        detectedSourceLocale: null,
        error: null,
        visible: true,
      },
    }));

    try {
      const response = await fetch(
        `/jeu/chat/messages/${encodeURIComponent(message.id)}/translation`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ targetLocale: locale }),
        },
      );
      const result = (await response.json()) as {
        translatedText?: unknown;
        detectedSourceLocale?: unknown;
        error?: unknown;
      };
      if (!response.ok || typeof result.translatedText !== "string") {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Le message n’a pas pu être traduit.",
        );
      }
      const translatedText = result.translatedText;

      setMessageTranslations((translations) => ({
        ...translations,
        [message.id]: {
          targetLocale: locale,
          status: "loaded",
          translatedText,
          detectedSourceLocale:
            typeof result.detectedSourceLocale === "string"
              ? result.detectedSourceLocale
              : null,
          error: null,
          visible: true,
        },
      }));
    } catch (translationError) {
      setMessageTranslations((translations) => ({
        ...translations,
        [message.id]: {
          targetLocale: locale,
          status: "error",
          translatedText: null,
          detectedSourceLocale: null,
          error:
            translationError instanceof Error
              ? translationError.message
              : "Le message n’a pas pu être traduit.",
          visible: false,
        },
      }));
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

  function updateDraftAndMentionSearch(
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) {
    const nextDraft = expandGlobalChatEmoticons(event.target.value).slice(
      0,
      draftLimit,
    );
    const cursor = Math.min(
      event.target.selectionStart ?? nextDraft.length,
      nextDraft.length,
    );
    const nextMentionQuery = getGlobalChatMentionQuery(nextDraft, cursor);

    setDraft(nextDraft);
    setMentionQuery(nextMentionQuery);
    if (
      !nextMentionQuery ||
      nextMentionQuery.query.trim().length <
        GLOBAL_CHAT_MENTION_SEARCH_MIN_LENGTH
    ) {
      setMentionResults([]);
      setIsSearchingMentions(false);
    }
  }

  function selectMention(recipient: GlobalChatMentionRecipient) {
    if (!mentionQuery) return;
    const alreadySelected = selectedMentions.some(
      (candidate) =>
        candidate.sportingDirectorId === recipient.sportingDirectorId,
    );
    if (
      !alreadySelected &&
      selectedMentions.length >= GLOBAL_CHAT_MENTION_MAX_RECIPIENTS
    ) {
      setError("Un message peut notifier au maximum 5 membres.");
      return;
    }

    const insertion = `@${recipient.username}, `;
    const nextDraft = `${draft.slice(0, mentionQuery.start)}${insertion}${draft.slice(mentionQuery.end)}`.slice(
      0,
      draftLimit,
    );
    const nextCursor = Math.min(
      mentionQuery.start + insertion.length,
      nextDraft.length,
    );

    setDraft(nextDraft);
    setSelectedMentions((current) =>
      current.some(
        (candidate) =>
          candidate.sportingDirectorId === recipient.sportingDirectorId,
      )
        ? current
        : [...current, recipient],
    );
    setMentionQuery(null);
    setMentionResults([]);
    setError(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  const beginDirectMessage = useCallback((recipientId: string) => {
    setRequestedDirectRecipientId(recipientId);
    setHasOpenedDirect(true);
    setActiveMode("direct");
  }, []);

  const changeMode = useCallback((mode: ChatMode) => {
    if (mode === "direct") setHasOpenedDirect(true);
    if (mode === "federation") setHasOpenedFederation(true);
    setActiveMode(mode);
    if (mode === "global") setHasUnreadGlobalWhilePrivate(false);
  }, []);

  const acknowledgeDirectRecipient = useCallback(() => {
    setRequestedDirectRecipientId(null);
  }, []);

  function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = normalizeGlobalChatMessage(draft);
    if (!message || isPending) return;
    if (hasForbiddenGlobalChatLink(message)) {
      setError(
        "Seuls les liens Cyclo Stratège vers une fiche coureur, équipe ou DS sont autorisés.",
      );
      return;
    }

    const mentionedDirectorIds = selectedMentions
      .filter((recipient) =>
        globalChatMessageMentionsUsername(message, recipient.username),
      )
      .map((recipient) => recipient.sportingDirectorId);

    setError(null);
    startTransition(async () => {
      try {
        const savedMessage = await postGlobalChatMessageAction(
          message,
          replyTo?.id ?? null,
          mentionedDirectorIds,
        );
        forceScrollToLatestRef.current = true;
        setMessages((current) => appendUniqueMessage(current, savedMessage));
        setDraft("");
        setReplyTo(null);
        setSelectedMentions([]);
        setMentionQuery(null);
        setMentionResults([]);
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Le message n’a pas pu être envoyé.",
        );
      }
    });
  }

  function beginMessageEdit(message: GlobalChatMessage) {
    setEditingMessageId(message.id);
    setEditingDraft(message.message);
    setEditingError(null);
  }

  function cancelMessageEdit() {
    if (isEditing) return;
    setEditingMessageId(null);
    setEditingDraft("");
    setEditingError(null);
  }

  function submitMessageEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingMessageId || isEditing) return;

    const message = normalizeGlobalChatMessage(editingDraft);
    if (!message) return;
    if (hasForbiddenGlobalChatLink(message)) {
      setEditingError(
        "Seuls les liens Cyclo Stratège vers une fiche coureur, équipe ou DS sont autorisés.",
      );
      return;
    }

    setEditingError(null);
    startEditingTransition(async () => {
      try {
        const savedMessage = await editGlobalChatMessageAction(
          editingMessageId,
          message,
        );
        setMessages((current) =>
          upsertRealtimeMessage(current, savedMessage),
        );
        setEditingMessageId(null);
        setEditingDraft("");
      } catch (editingFailure) {
        setEditingError(
          editingFailure instanceof Error
            ? editingFailure.message
            : "Le message n’a pas pu être modifié.",
        );
      }
    });
  }

  return (
    <div
      data-chat-hub="true"
      className="flex h-[calc(100dvh-var(--game-mobile-navigation-clearance)-4rem)] min-h-[30rem] flex-col overflow-hidden border-y border-[#1D5145]/20 bg-white shadow-[0_24px_70px_rgba(7,26,23,0.16)] sm:h-[calc(100dvh-8.5rem)] sm:min-h-[34rem] sm:rounded-[2rem] sm:border"
    >
      <ChatModeTabs
        activeMode={activeMode}
        directUnreadCount={directUnreadCount}
        hasUnreadGlobal={hasUnreadGlobalWhilePrivate}
        onModeChange={changeMode}
      />

      <div
        className={
          activeMode === "global"
            ? "grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_19rem]"
            : "hidden"
        }
      >
      <section className="relative flex h-full min-h-0 min-w-0 flex-col bg-[#F7FBF9]">
        <header className="shrink-0 border-b border-[#315B3E]/12 bg-white px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 animate-pulse rounded-full bg-[#42B99A]"
            />
            <h2 className="min-w-0 flex-1 truncate text-base font-black text-[#0B302B] sm:text-lg">
              Le peloton parle
            </h2>
            <button
              type="button"
              onClick={() => setSearchOpen((current) => !current)}
              className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black transition ${
                searchOpen
                  ? "bg-[#176951] text-white"
                  : "bg-[#EAF7F1] text-[#176951] hover:bg-[#D7EFE3]"
              }`}
              aria-label="Rechercher dans les messages chargés"
              aria-expanded={searchOpen}
            >
             ⌕
            </button>
            <button
              type="button"
              onClick={() => setShowOnlineDirectors(true)}
              className="rounded-full bg-[#E4F4EC] px-2.5 py-1.5 text-[9px] font-black text-[#176951] transition hover:bg-[#D7EFE3] lg:hidden"
              aria-label="Voir les Directeurs Sportifs en ligne"
            >
              {onlineDirectors.length} en ligne
            </button>
            <span className="hidden rounded-full bg-[#E4F4EC] px-3 py-1 text-[10px] font-black text-[#176951] lg:inline-flex">
              {onlineDirectors.length} en ligne
            </span>
          </div>

          <div
            className="mt-2 flex items-center gap-1.5 overflow-x-auto"
            data-mobile-scroll-rail="true"
          >
            {(
              [
                ["all", "Tous"],
                ["races", "Courses"],
                ["mentions", "Mes mentions"],
              ] as const
            ).map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => setGlobalView(view)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black transition ${
                  globalView === view
                    ? "bg-[#0B302B] text-white"
                    : "bg-[#F0F6F3] text-[#60756E] hover:bg-[#E4F4EC] hover:text-[#176951]"
                }`}
                aria-pressed={globalView === view}
              >
                {label}
              </button>
            ))}
          </div>

          {searchOpen ? (
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="global-chat-search" className="sr-only">
                Rechercher dans les messages chargés
              </label>
              <input
                id="global-chat-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                autoFocus
                placeholder="Message, DS, équipe ou course…"
                className="h-10 min-w-0 flex-1 rounded-xl border border-[#315B3E]/15 bg-[#F7FBF9] px-3 text-base font-semibold text-[#0B302B] outline-none focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/15 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-[#F0F6F3] font-black text-[#60756E]"
                aria-label="Fermer la recherche"
              >
                ×
              </button>
            </div>
          ) : null}
        </header>

        {mentionAlert ? (
          <button
            type="button"
            onClick={() => {
              focusChatMessage(mentionAlert.messageId);
              setMentionAlert(null);
            }}
            className="flex items-center justify-between gap-3 border-b border-[#F2C94C]/45 bg-[#FFF7D6] px-5 py-2.5 text-left text-[11px] font-black text-[#5B4700] sm:px-7"
          >
            <span>
              @{identity.username} · {mentionAlert.authorDisplayName} vous a
              mentionné
            </span>
            <span aria-hidden="true">Voir ↓</span>
          </button>
        ) : null}

        <div
          ref={viewportRef}
          onScroll={handleGlobalViewportScroll}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-7 sm:py-4"
          aria-live="polite"
          aria-relevant="additions"
        >
          {hasMore && olderCursor ? (
            <div className="pb-1 text-center">
              <button
                type="button"
                onClick={() => void loadOlderMessages()}
                disabled={isLoadingOlder}
                className="rounded-full border border-[#176951]/15 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#176951] shadow-sm transition hover:bg-[#EAF7F1] disabled:cursor-wait disabled:opacity-60"
              >
                {isLoadingOlder ? "Chargement…" : "↑ Messages précédents"}
              </button>
              {historyError ? (
                <p role="alert" className="mt-1 text-[10px] font-bold text-red-700">
                  {historyError}
                </p>
              ) : null}
            </div>
          ) : null}

          {messages.length === 0 ? <EmptyChat /> : null}
          {messages.length > 0 && filteredMessages.length === 0 ? (
            <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-[#315B3E]/18 bg-white px-5 py-8 text-center">
              <p className="text-sm font-black text-[#183F37]">
                Aucun message dans cette vue
              </p>
              <p className="mt-1 text-xs font-semibold text-[#60756E]">
                Modifiez le filtre ou la recherche pour retrouver la discussion.
              </p>
            </div>
          ) : null}

          {filteredMessages.map((message) => {
            const onlineAuthor = onlineDirectors.find(
              (director) =>
                director.sportingDirectorId === message.sportingDirectorId,
            );
            const isCurrentDirector =
              message.sportingDirectorId === identity.sportingDirectorId;
            return (
              <Fragment key={message.id}>
                {globalView === "all" &&
                !searchQuery.trim() &&
                message.id === firstInitialUnreadMessageId ? (
                  <div
                    className="flex items-center gap-3 py-1"
                    data-chat-unread-divider="true"
                  >
                    <span className="h-px flex-1 bg-[#EF5B65]/30" />
                    <span className="rounded-full bg-[#FFE6E8] px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#B9343F]">
                      {initialUnreadMessageCount} nouveau
                      {initialUnreadMessageCount > 1 ? "x" : ""} message
                      {initialUnreadMessageCount > 1 ? "s" : ""}
                    </span>
                    <span className="h-px flex-1 bg-[#EF5B65]/30" />
                  </div>
                ) : null}
              <ChatMessage
                message={message}
                avatarKey={
                  message.authorAvatarKey ??
                  onlineAuthor?.avatarKey ??
                  (isCurrentDirector ? identity.avatarKey : null)
                }
                avatarFrameKey={
                  message.authorAvatarFrameKey ??
                  onlineAuthor?.avatarFrameKey ??
                  (isCurrentDirector ? identity.avatarFrameKey : null)
                }
                authorCountry={
                  message.authorCountry ?? onlineAuthor?.country ?? null
                }
                isCurrentDirector={isCurrentDirector}
                isMentioned={globalChatMessageMentionsUsername(
                  message.message,
                  identity.username,
                )}
                currentDirectorId={identity.sportingDirectorId}
                pendingReactionKey={pendingReactionKey}
                reactionsDisabled={isReactionPending}
                canEdit={
                  isCurrentDirector &&
                  canEditChatMessage(message.createdAt, editClockMs)
                }
                isEditing={editingMessageId === message.id}
                editingDraft={editingDraft}
                editingError={editingError}
                isEditPending={isEditing}
                translation={messageTranslations[message.id] ?? null}
                translationEnabled={translationEnabled}
                onReply={beginReply}
                onReaction={toggleMessageReaction}
                onDirectMessage={beginDirectMessage}
                onBeginEdit={beginMessageEdit}
                onEditingDraftChange={setEditingDraft}
                onCancelEdit={cancelMessageEdit}
                onSubmitEdit={submitMessageEdit}
                onToggleTranslation={() =>
                  void toggleMessageTranslation(message)
                }
              />
              </Fragment>
            );
          })}
        </div>

        {showJumpToLatest ? (
          <div className="pointer-events-none relative z-20 h-0">
            <button
              type="button"
              onClick={scrollToLatestMessages}
              className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0B302B] px-4 py-2 text-[10px] font-black text-white shadow-[0_10px_30px_rgba(7,26,23,0.3)] transition hover:bg-[#176951]"
            >
              ↓ {pendingLiveMessageCount > 0
                ? `${pendingLiveMessageCount} nouveau${pendingLiveMessageCount > 1 ? "x" : ""}`
                : "Messages récents"}
            </button>
          </div>
        ) : null}

        <form
          onSubmit={submitMessage}
          className="shrink-0 border-t border-[#315B3E]/12 bg-white p-3 sm:px-6"
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
                  <span data-i18n-skip>{getMessageExcerpt(replyTo.message)}</span>
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
          {mentionQuery &&
          mentionSearchText.length >=
            GLOBAL_CHAT_MENTION_SEARCH_MIN_LENGTH ? (
            <div
              role="listbox"
              aria-label="Membres à mentionner"
              className="mb-2 max-h-52 overflow-y-auto rounded-xl border border-[#176951]/20 bg-white p-1.5 shadow-lg"
            >
              {isSearchingMentions ? (
                <p className="px-3 py-3 text-xs font-semibold text-[#60756E]">
                  Recherche…
                </p>
              ) : null}
              {!isSearchingMentions && mentionResults.length === 0 ? (
                <p className="px-3 py-3 text-xs font-semibold text-[#60756E]">
                  Aucun membre trouvé.
                </p>
              ) : null}
              {mentionResults.map((recipient) => (
                <button
                  key={recipient.sportingDirectorId}
                  type="button"
                  role="option"
                  aria-selected={selectedMentions.some(
                    (candidate) =>
                      candidate.sportingDirectorId ===
                      recipient.sportingDirectorId,
                  )}
                  onClick={() => selectMention(recipient)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[#EAF7F1]"
                >
                  <SportingDirectorAvatar
                    avatarKey={recipient.avatarKey}
                    frameKey={recipient.avatarFrameKey}
                    size="small"
                    label={`Avatar de ${recipient.displayName}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-[#0B302B]">
                      {recipient.displayName} · @{recipient.username}
                    </span>
                    <span className="block truncate text-[10px] font-semibold text-[#60756E]">
                      {recipient.teamName}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              id="global-chat-message"
              rows={1}
              value={draft}
              onChange={updateDraftAndMentionSearch}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  mentionQuery &&
                  mentionResults[0] &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  selectMention(mentionResults[0]);
                  return;
                }
                if (event.key === "Escape" && mentionQuery) {
                  setMentionQuery(null);
                  setMentionResults([]);
                  return;
                }
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
              className="min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-[#315B3E]/20 bg-[#F7FBF9] px-4 py-3 text-base font-semibold leading-6 text-[#0B302B] outline-none transition focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/15 sm:text-sm"
            />
            <button
              type="submit"
              disabled={
                isPending || draft.trim().length === 0
              }
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F2C94C] text-[#17261E] transition hover:bg-[#F7DA73] disabled:cursor-not-allowed disabled:opacity-50"
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
            <GlobalChatMediaPicker
              onEmojiSelect={appendEmoji}
            />
            <p
              role="alert"
              className="min-w-0 flex-1 text-[10px] font-bold text-red-700"
            >
              {error ?? reactionError}
            </p>
            <p className="ml-auto shrink-0 text-[9px] font-bold text-[#789087]">
              Entrée pour envoyer · {draft.length}/{draftLimit}
            </p>
            <p className="hidden w-full text-[9px] font-semibold text-[#789087] sm:block">
              Tapez @ pour notifier un membre · liens autorisés : fiches
              coureurs, équipes et DS Cyclo Stratège
            </p>
          </div>
        </form>
      </section>

      <OnlineDirectors
        directors={onlineDirectors}
        currentDirectorId={identity.sportingDirectorId}
        onDirectMessage={beginDirectMessage}
        mobileOpen={showOnlineDirectors}
        onClose={() => setShowOnlineDirectors(false)}
      />
      </div>

      {hasOpenedDirect ? (
        <DirectMessagingPanel
          identity={identity}
          active={activeMode === "direct"}
          requestedRecipientId={requestedDirectRecipientId}
          onRequestedRecipientHandled={acknowledgeDirectRecipient}
          onUnreadCountChange={setDirectUnreadCount}
        />
      ) : null}
      {hasOpenedFederation ? (
        <FederationMessagingPanel active={activeMode === "federation"} />
      ) : null}
    </div>
  );
}

function ChatModeTabs({
  activeMode,
  directUnreadCount,
  hasUnreadGlobal,
  onModeChange,
}: {
  activeMode: ChatMode;
  directUnreadCount: number;
  hasUnreadGlobal: boolean;
  onModeChange: (mode: ChatMode) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-[#315B3E]/12 bg-white/95 px-4 py-3 backdrop-blur sm:px-6"
      role="tablist"
      aria-label="Type de discussion"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeMode === "global"}
        onClick={() => onModeChange("global")}
        className={`relative rounded-xl px-4 py-2 text-xs font-black transition ${
          activeMode === "global"
            ? "bg-[#176951] text-white shadow-sm"
            : "bg-[#EAF7F1] text-[#176951] hover:bg-[#DDF3E7]"
        }`}
      >
        Général
        {hasUnreadGlobal && activeMode !== "global" ? (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#EF5B65]" />
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeMode === "direct"}
        onClick={() => onModeChange("direct")}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
          activeMode === "direct"
            ? "bg-[#176951] text-white shadow-sm"
            : "bg-[#EAF7F1] text-[#176951] hover:bg-[#DDF3E7]"
        }`}
      >
        Privés
        {directUnreadCount > 0 ? (
          <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-[#EF5B65] px-1 text-[9px] font-black text-white">
            {Math.min(99, directUnreadCount)}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeMode === "federation"}
        onClick={() => onModeChange("federation")}
        className={`rounded-xl px-3 py-2 text-xs font-black transition sm:px-4 ${
          activeMode === "federation"
            ? "bg-[#176951] text-white shadow-sm"
            : "bg-[#EAF7F1] text-[#176951] hover:bg-[#DDF3E7]"
        }`}
      >
        Fédération
      </button>
      <p className="ml-auto hidden text-[10px] font-semibold text-[#789087] sm:block">
        Les salons secondaires sont chargés à la demande
      </p>
    </div>
  );
}

function ChatMessage({
  message,
  avatarKey,
  avatarFrameKey,
  authorCountry,
  isCurrentDirector,
  isMentioned,
  currentDirectorId,
  pendingReactionKey,
  reactionsDisabled,
  canEdit,
  isEditing,
  editingDraft,
  editingError,
  isEditPending,
  translation,
  translationEnabled,
  onReply,
  onReaction,
  onDirectMessage,
  onBeginEdit,
  onEditingDraftChange,
  onCancelEdit,
  onSubmitEdit,
  onToggleTranslation,
}: {
  message: GlobalChatMessage;
  avatarKey: string | null;
  avatarFrameKey: "alpha_tester" | null;
  authorCountry: { name: string; code: string } | null;
  isCurrentDirector: boolean;
  isMentioned: boolean;
  currentDirectorId: string;
  pendingReactionKey: string | null;
  reactionsDisabled: boolean;
  canEdit: boolean;
  isEditing: boolean;
  editingDraft: string;
  editingError: string | null;
  isEditPending: boolean;
  translation: ChatMessageTranslationState | null;
  translationEnabled: boolean;
  onReply: (message: GlobalChatMessage) => void;
  onReaction: React.ComponentProps<
    typeof GlobalChatMessageReactions
  >["onReaction"];
  onDirectMessage: (recipientId: string) => void;
  onBeginEdit: (message: GlobalChatMessage) => void;
  onEditingDraftChange: (value: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (event: React.FormEvent<HTMLFormElement>) => void;
  onToggleTranslation: () => void;
}) {
  const canTranslate =
    translationEnabled &&
    !isCurrentDirector &&
    hasTranslatableChatText(splitChatMessageForTranslation(message.message));

  return (
    <article
      id={`global-chat-message-${message.id}`}
      className={`flex scroll-mt-4 items-start gap-3 ${
        isCurrentDirector ? "flex-row-reverse" : ""
      }`}
    >
      <SportingDirectorAvatar
        avatarKey={avatarKey}
        frameKey={avatarFrameKey}
        size="small"
        label={`Avatar de ${message.authorDisplayName}`}
      />

      <div
        className={`min-w-0 max-w-[min(42rem,calc(100%_-_3rem))] rounded-2xl border px-4 py-3 shadow-sm ${
          isCurrentDirector
            ? "rounded-tr-sm border-[#176951] bg-[#176951] text-white"
            : isMentioned
              ? "rounded-tl-sm border-[#E3B91C] bg-[#FFF9E5] text-[#0B302B] ring-2 ring-[#F2C94C]/35"
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
            {!isCurrentDirector && authorCountry ? (
              <span
                role="img"
                title={authorCountry.name}
                aria-label={`Pays : ${authorCountry.name}`}
                className={`fi fi-${authorCountry.code.toLowerCase()} ml-1.5 rounded-sm`}
              />
            ) : null}
            <span
              className={`ml-1.5 font-bold ${
                isCurrentDirector ? "text-white/60" : "text-[#789087]"
              }`}
            >
              · {message.teamDisplayName}
            </span>
          </Link>
          <span className="flex shrink-0 items-center gap-2">
            {isMentioned && !isCurrentDirector ? (
              <span className="rounded-full bg-[#F2C94C] px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-[#493A00]">
                @vous
              </span>
            ) : null}
            {!isCurrentDirector ? (
              <button
                type="button"
                onClick={() => onDirectMessage(message.sportingDirectorId)}
                className="rounded-full border border-[#176951]/15 bg-[#EAF7F1] px-2 py-1 text-[9px] font-black text-[#176951] transition hover:border-[#176951]/40 hover:bg-[#DDF3E7]"
                aria-label={`Envoyer un message privé à ${message.authorDisplayName}`}
              >
                MP
              </button>
            ) : null}
            {canEdit && !isEditing ? (
              <button
                type="button"
                onClick={() => onBeginEdit(message)}
                className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] font-black text-white/80 transition hover:bg-white/20 hover:text-white"
                aria-label="Modifier ce message"
                title="Modifiable pendant 15 minutes après l’envoi"
              >
                ✎ Modifier
              </button>
            ) : null}
            <time
              dateTime={message.createdAt}
              className={`text-[9px] font-bold ${
                isCurrentDirector ? "text-white/55" : "text-[#789087]"
              }`}
            >
              {formatMessageTime(message.createdAt)}
              {message.editedAt ? " · modifié" : ""}
            </time>
          </span>
        </div>

        {message.raceContext ? (
          <Link
            href={message.raceContext.href}
            data-chat-race-context={message.raceContext.raceEditionId}
            className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] transition ${
              isCurrentDirector
                ? "border-white/15 bg-white/10 text-[#F7DA73] hover:bg-white/15"
                : "border-[#42B99A]/25 bg-[#EAF7F1] text-[#176951] hover:bg-[#DDF3E7]"
            }`}
          >
            <span aria-hidden="true">◉</span>
            <span className="truncate">
              {isCurrentDirector ? "Vous" : message.authorDisplayName} sur «{" "}
              {message.raceContext.label} »
            </span>
          </Link>
        ) : null}

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
              data-i18n-skip
              className={`mt-0.5 block truncate text-[11px] font-semibold ${
                isCurrentDirector ? "text-white/70" : "text-[#60756E]"
              }`}
            >
              {message.replyTo.excerpt}
            </span>
          </button>
        ) : null}

        {isEditing ? (
          <form onSubmit={onSubmitEdit} className="mt-2 space-y-2">
            <label htmlFor={`edit-global-message-${message.id}`} className="sr-only">
              Modifier votre message
            </label>
            <textarea
              id={`edit-global-message-${message.id}`}
              data-i18n-skip
              autoFocus
              rows={3}
              value={editingDraft}
              maxLength={GLOBAL_CHAT_MESSAGE_MAX_LENGTH}
              onChange={(event) => onEditingDraftChange(event.target.value)}
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
              className="w-full resize-y rounded-xl border border-white/25 bg-black/15 px-3 py-2 text-sm font-semibold leading-6 text-white outline-none placeholder:text-white/50 focus:border-[#F2C94C] focus:ring-2 focus:ring-[#F2C94C]/25"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {editingError ? (
                <p
                  role="alert"
                  className="mr-auto text-[10px] font-bold text-[#FFD6D9]"
                >
                  {editingError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={isEditPending}
                onClick={onCancelEdit}
                className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-black text-white/80 transition hover:bg-white/10 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isEditPending || editingDraft.trim().length === 0}
                className="rounded-lg bg-[#F2C94C] px-3 py-2 text-[10px] font-black text-[#17261E] transition hover:bg-[#F7DA73] disabled:opacity-50"
              >
                {isEditPending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        ) : (
          <div data-i18n-skip className="mt-1.5 whitespace-pre-wrap break-words text-sm font-semibold leading-6">
            {renderMessageText(message.message, isCurrentDirector)}
          </div>
        )}

        {!isEditing && translation?.status === "loaded" && translation.visible ? (
          <div
            data-i18n-skip
            className={`mt-2 rounded-xl border px-3 py-2.5 ${
              isCurrentDirector
                ? "border-white/15 bg-black/10"
                : "border-[#42B99A]/25 bg-[#EAF7F1]"
            }`}
          >
            <p
              className={`text-[8px] font-black uppercase tracking-[0.12em] ${
                isCurrentDirector ? "text-white/60" : "text-[#278B70]"
              }`}
            >
              {formatTranslationLabel(translation)}
            </p>
            <div className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-6">
              {renderMessageText(
                translation.translatedText ?? message.message,
                isCurrentDirector,
              )}
            </div>
          </div>
        ) : null}

        {!isEditing && canTranslate ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleTranslation}
              disabled={translation?.status === "loading"}
              className="rounded-full border border-[#176951]/15 bg-[#F3F8F6] px-2.5 py-1 text-[9px] font-black text-[#176951] transition hover:border-[#176951]/35 hover:bg-[#EAF7F1] disabled:cursor-wait disabled:opacity-60"
            >
              {translation?.status === "loading"
                ? "Traduction…"
                : translation?.status === "loaded" && translation.visible
                  ? "Masquer la traduction"
                  : translation?.status === "loaded"
                    ? "Voir la traduction"
                    : "Traduire"}
            </button>
            {translation?.status === "error" && translation.error ? (
              <span role="alert" className="text-[9px] font-bold text-red-700">
                {translation.error}
              </span>
            ) : null}
          </div>
        ) : null}

        {message.preview ? (
          <GlobalChatSharePreview preview={message.preview} />
        ) : null}
        {!isEditing ? (
          <GlobalChatMessageReactions
            message={message}
            isCurrentDirector={isCurrentDirector}
            currentDirectorId={currentDirectorId}
            pendingReactionKey={pendingReactionKey}
            reactionsDisabled={reactionsDisabled}
            onReply={onReply}
            onReaction={onReaction}
          />
        ) : null}
      </div>
    </article>
  );
}

function OnlineDirectors({
  directors,
  currentDirectorId,
  onDirectMessage,
  mobileOpen,
  onClose,
}: {
  directors: GlobalChatOnlineDirector[];
  currentDirectorId: string;
  onDirectMessage: (recipientId: string) => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-[70] bg-[#03110E]/55 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Directeurs Sportifs en ligne"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Fermer les présences"
          />
          <aside className="absolute inset-x-0 bottom-0 max-h-[72dvh] overflow-hidden rounded-t-[2rem] bg-[#071A17] pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-20px_70px_rgba(3,17,14,0.45)]">
            <OnlineDirectorsContent
              directors={directors}
              currentDirectorId={currentDirectorId}
              onDirectMessage={(recipientId) => {
                onClose();
                onDirectMessage(recipientId);
              }}
              onClose={onClose}
            />
          </aside>
        </div>
      ) : null}
      <aside className="hidden border-l border-[#315B3E]/12 bg-[#071A17] text-white lg:block">
        <OnlineDirectorsContent
          directors={directors}
          currentDirectorId={currentDirectorId}
          onDirectMessage={onDirectMessage}
        />
      </aside>
    </>
  );
}

function OnlineDirectorsContent({
  directors,
  currentDirectorId,
  onDirectMessage,
  onClose,
}: {
  directors: GlobalChatOnlineDirector[];
  currentDirectorId: string;
  onDirectMessage: (recipientId: string) => void;
  onClose?: () => void;
}) {
  return (
    <>
      <header className="border-b border-white/10 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#72D4B7]">
              Présences
            </p>
        <h2 className="mt-1 text-lg font-black">DS en ligne</h2>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg font-black text-white"
              aria-label="Fermer"
            >
              ×
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#AFC6BB]">
          Actifs dans le jeu ces {GLOBAL_CHAT_ONLINE_WINDOW_MINUTES} dernières
          minutes. Cliquez sur un nom pour consulter son équipe.
        </p>
      </header>

      <div className="grid max-h-[54dvh] gap-1 overflow-y-auto p-3 lg:max-h-[35rem]">
        {directors.map((director) => {
          const isCurrent = director.sportingDirectorId === currentDirectorId;
          return (
            <div
              key={director.sportingDirectorId}
              className="group flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/8"
            >
              <Link
                href={director.teamHref}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="relative shrink-0">
                  <SportingDirectorAvatar
                    avatarKey={director.avatarKey}
                    frameKey={director.avatarFrameKey}
                    size="small"
                    label={`Avatar de ${director.displayName}`}
                  />
                  <span
                    aria-label="En ligne"
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#071A17] bg-[#42B99A]"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-xs font-black text-[#EAF5F0] group-hover:text-[#F2C94C]">
                      {isCurrent ? "Vous" : director.displayName}
                    </span>
                    <span className="shrink-0 rounded-full bg-[#42B99A]/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#72D4B7]">
                      Online
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#8FA99D]">
                    {director.teamName}
                  </span>
                </span>
              </Link>
              {!isCurrent ? (
                <button
                  type="button"
                  onClick={() =>
                    onDirectMessage(director.sportingDirectorId)
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-black text-[#72D4B7] transition hover:border-[#F2C94C]/40 hover:text-[#F2C94C]"
                  aria-label={`Envoyer un message privé à ${director.displayName}`}
                >
                  MP
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
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
      ? {
          ...message,
          authorAvatarKey:
            message.authorAvatarKey ?? candidate.authorAvatarKey,
          authorAvatarFrameKey:
            message.authorAvatarFrameKey ?? candidate.authorAvatarFrameKey,
          reactions: candidate.reactions,
        }
      : candidate,
  );
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
  const { error } = await supabase.rpc("mark_global_chat_messages_read", {
    p_last_read_at: latestDisplayedMessageAt,
  });

  if (!error) {
    notifyGlobalChatMessagesRead();
  }
  return !error;
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
      typeof value.preview_title === "string" ? value.preview_title : null,
    preview_subtitle:
      typeof value.preview_subtitle === "string"
        ? value.preview_subtitle
        : null,
    preview_public_identifier:
      typeof value.preview_public_identifier === "string"
        ? value.preview_public_identifier
        : null,
    preview_country_name:
      typeof value.preview_country_name === "string"
        ? value.preview_country_name
        : null,
    preview_country_code:
      typeof value.preview_country_code === "string"
        ? value.preview_country_code
        : null,
    preview_age:
      typeof value.preview_age === "number" ? value.preview_age : null,
    preview_avatar_profile_key:
      typeof value.preview_avatar_profile_key === "string"
        ? value.preview_avatar_profile_key
        : null,
    preview_avatar_seed:
      typeof value.preview_avatar_seed === "string" ||
      typeof value.preview_avatar_seed === "number"
        ? value.preview_avatar_seed
        : null,
    preview_avatar_key:
      typeof value.preview_avatar_key === "string"
        ? value.preview_avatar_key
        : null,
    preview_avatar_frame_key:
      typeof value.preview_avatar_frame_key === "string"
        ? value.preview_avatar_frame_key
        : null,
    preview_team_id:
      typeof value.preview_team_id === "string"
        ? value.preview_team_id
        : null,
    preview_team_primary_color:
      typeof value.preview_team_primary_color === "string"
        ? value.preview_team_primary_color
        : null,
    preview_team_secondary_color:
      typeof value.preview_team_secondary_color === "string"
        ? value.preview_team_secondary_color
        : null,
    preview_team_accent_color:
      typeof value.preview_team_accent_color === "string"
        ? value.preview_team_accent_color
        : null,
    preview_jersey_pattern:
      typeof value.preview_jersey_pattern === "string"
        ? value.preview_jersey_pattern
        : null,
    preview_jersey_status:
      typeof value.preview_jersey_status === "string"
        ? value.preview_jersey_status
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
    edited_at:
      typeof value.edited_at === "string" ? value.edited_at : null,
    source_race_edition_id:
      typeof value.source_race_edition_id === "string"
        ? value.source_race_edition_id
        : null,
    source_stage_id:
      typeof value.source_stage_id === "string"
        ? value.source_stage_id
        : null,
    source_label:
      typeof value.source_label === "string" ? value.source_label : null,
    source_href:
      typeof value.source_href === "string" ? value.source_href : null,
  };

  return {
    id: row.id,
    sportingDirectorId: row.sporting_director_id,
    authorAvatarKey: null,
    authorAvatarFrameKey: null,
    authorCountry: null,
    teamId: row.team_id,
    authorDisplayName: row.author_display_name,
    teamDisplayName: row.team_display_name,
    message: row.message,
    preview: readRealtimePreview(row),
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
    editedAt: row.edited_at,
    raceContext:
      row.source_race_edition_id &&
      row.source_stage_id &&
      row.source_label &&
      row.source_href?.startsWith("/jeu/resultats/")
        ? {
            raceEditionId: row.source_race_edition_id,
            stageId: row.source_stage_id,
            label: row.source_label,
            href: row.source_href,
          }
        : null,
  };
}

function getGlobalChatDraftStorageKey(sportingDirectorId: string) {
  return `cyclostratege:chat:draft:global:${sportingDirectorId}`;
}

function normalizeChatSearchQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

function readRealtimePreview(
  row: GlobalChatMessageRow,
): GlobalChatPreview | null {
  if (
    (row.preview_type !== "team" &&
      row.preview_type !== "rider" &&
      row.preview_type !== "director") ||
    !row.preview_entity_id ||
    !row.preview_title ||
    !row.preview_subtitle
  ) {
    return null;
  }

  const publicIdentifier =
    row.preview_public_identifier ?? row.preview_entity_id;
  const isFreeAgent = row.preview_type === "rider" && !row.preview_team_id;

  return {
    type: row.preview_type,
    entityId: row.preview_entity_id,
    publicIdentifier,
    title: row.preview_title,
    subtitle: row.preview_subtitle,
    href:
      row.preview_type === "team"
        ? `/jeu/equipes/${row.preview_entity_id}`
        : row.preview_type === "rider"
          ? `/jeu/coureurs/${row.preview_entity_id}`
          : `/jeu/directeurs-sportifs/${encodeURIComponent(publicIdentifier)}`,
    country:
      row.preview_country_name &&
      row.preview_country_code &&
      /^[A-Z]{2}$/i.test(row.preview_country_code)
        ? {
            name: row.preview_country_name,
            code: row.preview_country_code.toUpperCase(),
          }
        : null,
    age:
      typeof row.preview_age === "number" &&
      Number.isFinite(row.preview_age)
        ? row.preview_age
        : null,
    riderAvatarProfileKey: row.preview_avatar_profile_key,
    riderAvatarSeed: row.preview_avatar_seed,
    directorAvatarKey: row.preview_avatar_key,
    directorAvatarFrameKey:
      row.preview_avatar_frame_key === "alpha_tester"
        ? "alpha_tester"
        : null,
    teamId: row.preview_team_id,
    palette: {
      primaryColor: readRealtimePreviewColor(
        row.preview_team_primary_color,
        isFreeAgent ? "#6B7280" : "#176951",
      ),
      secondaryColor: readRealtimePreviewColor(
        row.preview_team_secondary_color,
        isFreeAgent ? "#D1D5DB" : "#42B99A",
      ),
      accentColor: readRealtimePreviewColor(
        row.preview_team_accent_color,
        isFreeAgent ? "#F3F4F6" : "#F2C94C",
      ),
    },
    jerseyPattern: readRealtimeJerseyPattern(row.preview_jersey_pattern),
    jerseyStatus: isFreeAgent
      ? "free-agent"
      : row.preview_jersey_status === "sponsored"
        ? "sponsored"
        : "amateur",
  };
}

function readRealtimePreviewColor(value: string | null, fallback: string) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function readRealtimeJerseyPattern(
  value: string | null,
): GlobalChatPreview["jerseyPattern"] {
  const patterns: GlobalChatPreview["jerseyPattern"][] = [
    "center",
    "diagonal",
    "hoops",
    "solid",
    "split",
    "vertical",
    "chevron",
    "quarters",
    "cross",
    "shoulders",
    "checkerboard",
    "wave",
    "pinstripes",
  ];
  return patterns.find((pattern) => pattern === value) ?? "solid";
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
): GlobalChatOnlineDirector[] {
  const byDirectorId = new Map<string, GlobalChatOnlineDirector>();

  for (const presences of Object.values(presenceState)) {
    for (const presence of presences) {
      if (!isOnlineDirector(presence)) continue;
      byDirectorId.set(presence.sportingDirectorId, presence);
    }
  }

  byDirectorId.set(fallbackIdentity.sportingDirectorId, fallbackIdentity);

  return [...byDirectorId.values()].sort((left, right) => {
    if (left.sportingDirectorId === fallbackIdentity.sportingDirectorId) {
      return -1;
    }
    if (right.sportingDirectorId === fallbackIdentity.sportingDirectorId) {
      return 1;
    }
    return left.displayName.localeCompare(right.displayName, "fr");
  });
}

function isOnlineDirector(value: unknown): value is GlobalChatOnlineDirector {
  if (!value || typeof value !== "object") return false;

  const director = value as Record<string, unknown>;
  return (
    typeof director.sportingDirectorId === "string" &&
    typeof director.username === "string" &&
    typeof director.displayName === "string" &&
    (director.avatarKey === null || typeof director.avatarKey === "string") &&
    (director.avatarFrameKey === null ||
      director.avatarFrameKey === "alpha_tester") &&
    isOnlineDirectorCountry(director.country) &&
    typeof director.teamId === "string" &&
    typeof director.teamName === "string" &&
    typeof director.teamHref === "string" &&
    director.teamHref === `/jeu/equipes/${director.teamId}`
  );
}

function isOnlineDirectorCountry(value: unknown) {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const country = value as Record<string, unknown>;
  return (
    typeof country.name === "string" &&
    typeof country.code === "string" &&
    /^[A-Z]{2}$/.test(country.code)
  );
}

function omitMessageTranslation(
  translations: Record<string, ChatMessageTranslationState>,
  messageId: string,
) {
  if (!(messageId in translations)) return translations;
  const nextTranslations = { ...translations };
  delete nextTranslations[messageId];
  return nextTranslations;
}

function formatTranslationLabel(translation: ChatMessageTranslationState) {
  const isEnglish = translation.targetLocale === "en";
  const baseLabel = isEnglish
    ? "Automatic translation"
    : "Traduction automatique";
  if (!translation.detectedSourceLocale) return baseLabel;

  const normalizedSourceLocale = translation.detectedSourceLocale.toLowerCase();
  const knownLanguage = {
    en: isEnglish ? "English" : "anglais",
    fr: isEnglish ? "French" : "français",
  }[normalizedSourceLocale];
  const sourceLanguage = knownLanguage ?? normalizedSourceLocale.toUpperCase();
  return `${baseLabel} · source ${sourceLanguage}`;
}

function renderMessageText(message: string, inverted: boolean) {
  return splitGlobalChatMessageContent(message).map((content, index) => {
    const reaction = extractGlobalChatCyclingReaction(content);
    if (reaction) {
      return (
        <CyclingReactionSticker
          key={`${reaction.key}-${index}`}
          reactionKey={reaction.key}
        />
      );
    }

    return (
      <span key={`${content}-${index}`}>
        {renderLinkedMessageText(content, inverted, index)}
      </span>
    );
  });
}

function renderLinkedMessageText(
  message: string,
  inverted: boolean,
  contentIndex: number,
) {
  const tokenPattern =
    /((?:(?:https:\/\/(?:www\.)?|www\.)?cyclostratege\.fr)?\/jeu\/(?:(?:equipes|coureurs)\/[0-9a-f-]{36}|directeurs-sportifs\/[^/?#\s<>]+)(?:[/?#][^\s]*)?)/gi;
  const tokens = message.split(tokenPattern);

  return tokens.map((token, index) => {
    const key = `${contentIndex}-${token}-${index}`;
    const internalReference = extractGlobalChatPreviewReference(token);
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
