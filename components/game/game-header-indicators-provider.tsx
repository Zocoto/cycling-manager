"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import {
  CYCLO_STICKERS_BOOSTERS_CHANGED_EVENT,
  CYCLO_STICKERS_TRADES_CHANGED_EVENT,
  type CycloStickersBoostersChangedDetail,
  type CycloStickersTradesChangedDetail,
} from "@/lib/game/cyclo-stickers-booster-sync";
import { CYCLOGAZETTE_READ_EVENT } from "@/lib/game/cyclogazette-read-sync";
import {
  DIRECTOR_MAILBOX_CHANGED_EVENT,
  type DirectorMailboxChangedDetail,
} from "@/lib/game/director-mailbox-sync";
import { DIRECT_MESSAGES_CHANGED_EVENT } from "@/lib/game/direct-message-sync";
import { GLOBAL_CHAT_MESSAGES_READ_EVENT } from "@/lib/game/global-chat-read-sync";
import { GLOBAL_CHAT_QUIZ_READ_EVENT } from "@/lib/game/global-chat-quiz";
import { createVisibleRefreshScheduler } from "@/lib/game/visible-refresh-scheduler";
import type { GameStaffRole } from "@/lib/game/game-product-news";
import { canAccessCollectorAlbum } from "@/lib/game/collector-album-access";
import { canAccessDelegatedPcmExport } from "@/lib/game/pcm-export/access";

type SupabaseBrowserClient = ReturnType<
  (typeof import("@/lib/supabase/client"))["createSupabaseBrowserClient"]
>;

type GameHeaderIndicators = {
  gameStaffRole: GameStaffRole;
  mailboxUnreadCount: number;
  directMessageUnreadCount: number;
  hasUnreadGlobalChat: boolean;
  globalChatQuizUnreadUntil: string | null;
  hasUnreadCyclogazette: boolean;
};

type GameHeaderIndicatorsRow = {
  game_role?: string | null;
  current_sporting_director_id: string | null;
  mailbox_unread_count: number | null;
  direct_message_unread_count: number | null;
  has_unread_global_chat: boolean | null;
  global_chat_quiz_unread_until?: string | null;
  has_unread_cyclogazette: boolean | null;
  collector_album_available?: boolean | null;
  collector_album_has_unopened_boosters?: boolean | null;
  collector_album_pending_trade_count?: number | null;
};

type StickerTradeNotification = { senderName: string | null };

const EMPTY_INDICATORS: GameHeaderIndicators = {
  gameStaffRole: null,
  mailboxUnreadCount: 0,
  directMessageUnreadCount: 0,
  hasUnreadGlobalChat: false,
  globalChatQuizUnreadUntil: null,
  hasUnreadCyclogazette: false,
};

const GameHeaderIndicatorsContext =
  createContext<(GameHeaderIndicators & {
    hasUnreadGlobalChatQuiz: boolean;
    collectorAlbumAvailable: boolean;
    collectorAlbumHasUnopenedBoosters: boolean;
    collectorAlbumPendingTradeCount: number;
    pcmExportAvailable: boolean;
  }) | null>(null);

export function GameHeaderIndicatorsProvider({
  children,
  attendanceReady,
}: {
  children: ReactNode;
  attendanceReady?: Promise<void>;
}) {
  const [indicators, setIndicators] =
    useState<GameHeaderIndicators>(EMPTY_INDICATORS);
  const requestVersionRef = useRef(0);
  const [collectorAlbumAvailable, setCollectorAlbumAvailable] = useState(false);
  const [pcmExportAvailable, setPcmExportAvailable] = useState(false);
  const [collectorAlbumHasUnopenedBoosters, setCollectorAlbumHasUnopenedBoosters] = useState(false);
  const [collectorAlbumPendingTradeCount, setCollectorAlbumPendingTradeCount] = useState(0);
  const [stickerTradeNotification, setStickerTradeNotification] = useState<StickerTradeNotification | null>(null);
  const quizUnreadUntil = indicators.globalChatQuizUnreadUntil;
  const contextValue = useMemo(() => ({
    ...indicators,
    hasUnreadGlobalChatQuiz: quizUnreadUntil !== null,
    collectorAlbumAvailable, collectorAlbumHasUnopenedBoosters, collectorAlbumPendingTradeCount, pcmExportAvailable,
  }), [indicators, quizUnreadUntil, collectorAlbumAvailable, collectorAlbumHasUnopenedBoosters, collectorAlbumPendingTradeCount, pcmExportAvailable]);

  useEffect(() => {
    let active = true;
    let supabase: SupabaseBrowserClient | null = null;
    let subscribedChannel: ReturnType<SupabaseBrowserClient["channel"]> | null = null;
    let channelRemoval: Promise<unknown> = Promise.resolve();
    let subscriptionGeneration = 0;
    let authUserId: string | null = null;
    let signedOut = false;
    let publicAlbumAvailable = false;
    let boosterRevision = 0;
    let stickerTradeRevision = 0;
    let authSubscription: { unsubscribe: () => void } | null = null;
    let latestStickerTradeSource: string | null = null;
    const refreshScheduler = createVisibleRefreshScheduler({
      isVisible: () => document.visibilityState === "visible",
      refresh: async () => {
        // The first connection of the day can grant a pack during game entry.
        await attendanceReady;
        if (!active || !supabase || signedOut || document.visibilityState !== "visible") return;
        const generation = subscriptionGeneration;
        const row = await refreshIndicators();
        if (active && row?.current_sporting_director_id && !subscribedChannel) {
          await channelRemoval;
          // A hide/show cycle while removal is pending requires a newer
          // snapshot before replacing the channel with the same name.
          if (generation !== subscriptionGeneration) return;
          subscribeToIndicators(row);
        }
      },
    });

    async function refreshIndicators() {
      if (!supabase) return null;

      const requestVersion = ++requestVersionRef.current;
      const requestedBoosterRevision = boosterRevision;
      const requestedStickerTradeRevision = stickerTradeRevision;
      const result = await supabase
        .rpc("get_current_game_header_indicators_v7")
        .maybeSingle();

      if (!active || result.error || requestVersion !== requestVersionRef.current) {
        return null;
      }

      const row = result.data as GameHeaderIndicatorsRow | null;

      setIndicators({
        gameStaffRole: row?.game_role === "owner" || row?.game_role === "game_staff" ? row.game_role : null,
        mailboxUnreadCount: Math.max(
          0,
          Number(row?.mailbox_unread_count ?? 0),
        ),
        directMessageUnreadCount: Math.max(
          0,
          Number(row?.direct_message_unread_count ?? 0),
        ),
        hasUnreadGlobalChat: row?.has_unread_global_chat === true,
        globalChatQuizUnreadUntil: row?.global_chat_quiz_unread_until ?? null,
        hasUnreadCyclogazette:
          row?.has_unread_cyclogazette === true,
      });

      // The same consolidated snapshot supplies the DB launch gate. No catalogue
      // fetch, additional polling or request from an individual shortcut.
      publicAlbumAvailable = Boolean(row?.current_sporting_director_id && row.collector_album_available === true);
      if (!signedOut) setCollectorAlbumAvailable(canAccessCollectorAlbum(authUserId) || publicAlbumAvailable);
      if (requestedBoosterRevision === boosterRevision) {
        setCollectorAlbumHasUnopenedBoosters(publicAlbumAvailable && row?.collector_album_has_unopened_boosters === true);
      }
      if (!publicAlbumAvailable || requestedStickerTradeRevision === stickerTradeRevision) {
        setCollectorAlbumPendingTradeCount(publicAlbumAvailable ? Math.max(0, row?.collector_album_pending_trade_count ?? 0) : 0);
      }

      return row;
    }

    function scheduleRefresh(delayMs = 150) {
      refreshScheduler.request(delayMs);
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        scheduleRefresh(0);
      } else {
        // Hidden tabs do not need five live Postgres subscriptions. Recover
        // their complete badge snapshot before subscribing on the next visit.
        requestVersionRef.current += 1;
        stopRealtimeIndicators();
      }
    }

    function stopRealtimeIndicators() {
      subscriptionGeneration += 1;
      const previous = subscribedChannel;
      subscribedChannel = null;
      if (previous && supabase) {
        channelRemoval = Promise.resolve(supabase.removeChannel(previous)).catch(() => undefined);
      }
    }

    function handleDirectorMailboxChanged(event: Event) {
      const unreadCount = (
        event as CustomEvent<DirectorMailboxChangedDetail>
      ).detail?.unreadCount;

      if (Number.isFinite(unreadCount)) {
        const normalizedUnreadCount = Math.max(
          0,
          Math.trunc(unreadCount ?? 0),
        );
        requestVersionRef.current += 1;
        setIndicators((current) => ({
          ...current,
          mailboxUnreadCount: normalizedUnreadCount,
        }));
      }

      refreshWhenVisible();
    }

    function acknowledgeGlobalChatRead() {
      requestVersionRef.current += 1;
      setIndicators((current) => ({
        ...current,
        hasUnreadGlobalChat: false,
      }));
    }

    function refreshQuizIndicator() {
      // A response started before the announcement or acknowledgement is stale.
      requestVersionRef.current += 1;
      scheduleRefresh();
    }

    function acknowledgeCyclogazetteRead() {
      requestVersionRef.current += 1;
      setIndicators((current) => ({
        ...current,
        hasUnreadCyclogazette: false,
      }));
    }

    function handleCycloStickersBoostersChanged(event: Event) {
      if (signedOut) return;
      boosterRevision += 1;
      const hasUnopenedBoosters = (event as CustomEvent<CycloStickersBoostersChangedDetail>).detail?.hasUnopenedBoosters;
      if (typeof hasUnopenedBoosters === "boolean") {
        setCollectorAlbumHasUnopenedBoosters(hasUnopenedBoosters);
      } else {
        refreshWhenVisible();
      }
    }

    function handleCycloStickersTradesChanged(event: Event) {
      if (signedOut) return;
      stickerTradeRevision += 1;
      const count = (event as CustomEvent<CycloStickersTradesChangedDetail>).detail?.pendingIncomingCount;
      if (typeof count === "number" && Number.isFinite(count)) {
        setCollectorAlbumPendingTradeCount(Math.max(0, Math.trunc(count)));
      } else {
        refreshWhenVisible();
      }
    }

    window.addEventListener(CYCLO_STICKERS_BOOSTERS_CHANGED_EVENT, handleCycloStickersBoostersChanged);
    window.addEventListener(CYCLO_STICKERS_TRADES_CHANGED_EVENT, handleCycloStickersTradesChanged);
    window.addEventListener(
      DIRECTOR_MAILBOX_CHANGED_EVENT,
      handleDirectorMailboxChanged,
    );
    window.addEventListener(
      DIRECT_MESSAGES_CHANGED_EVENT,
      refreshWhenVisible,
    );
    window.addEventListener(
      GLOBAL_CHAT_MESSAGES_READ_EVENT,
      acknowledgeGlobalChatRead,
    );
    window.addEventListener(GLOBAL_CHAT_QUIZ_READ_EVENT, refreshQuizIndicator);
    window.addEventListener(
      CYCLOGAZETTE_READ_EVENT,
      acknowledgeCyclogazetteRead,
    );
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    async function initialize() {
      const { createSupabaseBrowserClient } = await import(
        "@/lib/supabase/client"
      );
      if (!active) return;

      supabase = createSupabaseBrowserClient();
      // Reuse the local auth lifecycle for preview access and immediate logout.
      authSubscription = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
        if (active) {
          const nextUserId = session?.user.id ?? null;
          const accountChanged = authUserId !== null && authUserId !== nextUserId;
          const signedInAgain = signedOut && nextUserId !== null;
          signedOut = nextUserId === null;
          if (signedOut || accountChanged) {
            publicAlbumAvailable = false;
            requestVersionRef.current += 1;
            setIndicators(EMPTY_INDICATORS);
            setCollectorAlbumHasUnopenedBoosters(false);
            setCollectorAlbumPendingTradeCount(0);
            setStickerTradeNotification(null);
            latestStickerTradeSource = null;
            stopRealtimeIndicators();
          }
          authUserId = nextUserId;
          setCollectorAlbumAvailable(canAccessCollectorAlbum(authUserId) || publicAlbumAvailable);
          setPcmExportAvailable(canAccessDelegatedPcmExport(session?.user.id));
          if (!signedOut && (accountChanged || signedInAgain)) scheduleRefresh(0);
        }
      }).data.subscription;
      scheduleRefresh(0);
    }

    function subscribeToIndicators(row: GameHeaderIndicatorsRow | null) {
      if (!active || !supabase || subscribedChannel || document.visibilityState !== "visible") return;
      const generation = ++subscriptionGeneration;
      const canReceive = () => active && generation === subscriptionGeneration
        && document.visibilityState === "visible";

      let channel = supabase
        .channel("game-header-indicators:v2")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "global_chat_messages",
          },
          (payload: { new: Record<string, unknown> }) => {
            if (!canReceive()) return;
            const senderId = payload.new.sporting_director_id;
            if (senderId === row?.current_sporting_director_id) return;
            setIndicators((current) => ({
              ...current,
              hasUnreadGlobalChat: true,
            }));
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "global_chat_quiz_events" },
          (payload: { eventType: string; new: Record<string, unknown> }) => {
            if (!canReceive()) return;
            if (payload.eventType === "INSERT" || (payload.eventType === "UPDATE" && payload.new.status === "won")) {
              refreshQuizIndicator();
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "cyclogazette_editions",
          },
          () => {
            if (!canReceive()) return;
            setIndicators((current) => ({
              ...current,
              hasUnreadCyclogazette: true,
            }));
          },
        );

      if (row?.current_sporting_director_id) {
        channel = channel
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "sporting_director_messages",
              filter: `sporting_director_id=eq.${row.current_sporting_director_id}`,
            },
            (payload: { new: Record<string, unknown> }) => {
              if (!canReceive()) return;
              const message = payload.new;
              if (message.sporting_director_id !== row.current_sporting_director_id || message.read_at || message.archived_at) return;
              setIndicators((current) => ({
                ...current,
                mailboxUnreadCount: current.mailboxUnreadCount + 1,
              }));
              const source = message.source_reference;
              if (typeof source === "string" && /^cyclo-stickers:trade:[0-9a-f-]+:proposed$/i.test(source) && source !== latestStickerTradeSource) {
                latestStickerTradeSource = source;
                const senderName = typeof message.sender_name === "string" ? message.sender_name.trim() : "";
                setStickerTradeNotification({ senderName: senderName && senderName !== "La Cyclogazette" ? senderName : null });
                stickerTradeRevision += 1;
                scheduleRefresh();
              }
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "sporting_director_messages",
              filter: `sporting_director_id=eq.${row.current_sporting_director_id}`,
            },
            () => { if (canReceive()) scheduleRefresh(); },
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "direct_messages",
              filter: `recipient_id=eq.${row.current_sporting_director_id}`,
            },
            () => { if (canReceive()) scheduleRefresh(); },
          );
      }
      subscribedChannel = channel.subscribe();
    }

    void initialize();

    return () => {
      active = false;
      requestVersionRef.current += 1;
      refreshScheduler.dispose();
      authSubscription?.unsubscribe();
      window.removeEventListener(CYCLO_STICKERS_BOOSTERS_CHANGED_EVENT, handleCycloStickersBoostersChanged);
      window.removeEventListener(CYCLO_STICKERS_TRADES_CHANGED_EVENT, handleCycloStickersTradesChanged);
      window.removeEventListener(
        DIRECTOR_MAILBOX_CHANGED_EVENT,
        handleDirectorMailboxChanged,
      );
      window.removeEventListener(
        DIRECT_MESSAGES_CHANGED_EVENT,
        refreshWhenVisible,
      );
      window.removeEventListener(
        GLOBAL_CHAT_MESSAGES_READ_EVENT,
        acknowledgeGlobalChatRead,
      );
      window.removeEventListener(GLOBAL_CHAT_QUIZ_READ_EVENT, refreshQuizIndicator);
      window.removeEventListener(
        CYCLOGAZETTE_READ_EVENT,
        acknowledgeCyclogazetteRead,
      );
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      stopRealtimeIndicators();
    };
  }, [attendanceReady]);

  useEffect(() => {
    if (!quizUnreadUntil) return;
    const timer = window.setTimeout(() => setIndicators(current =>
      current.globalChatQuizUnreadUntil === quizUnreadUntil
        ? { ...current, globalChatQuizUnreadUntil: null }
        : current,
    ), Math.max(0, Date.parse(quizUnreadUntil) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [quizUnreadUntil]);

  return (
    <GameHeaderIndicatorsContext value={contextValue}>
      {children}
      <StickerTradeNotice notification={stickerTradeNotification} onDismiss={() => setStickerTradeNotification(null)} />
    </GameHeaderIndicatorsContext>
  );
}

function StickerTradeNotice({ notification, onDismiss }: {
  notification: StickerTradeNotification | null;
  onDismiss: () => void;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[130] sm:left-auto sm:right-4 sm:w-96">
      {notification ? (
        <article className="pointer-events-auto relative rounded-2xl border border-[#67998C] bg-[#102D27] p-4 text-[#FFFDF4] shadow-xl shadow-black/25">
          <p className="pr-8 text-sm font-black">
            {isEnglish ? "New Cyclo-Stickers trade offer" : "Nouvelle proposition d’échange Cyclo-Stickers"}
          </p>
          {notification.senderName ? <p className="mt-1 break-words text-xs text-[#CCE4D9]">{notification.senderName}</p> : null}
          {/* A document navigation also refreshes the already-open received offers view. */}
          <a href="/jeu/album?onglet=echanges&vue=recues" className="mt-3 inline-block rounded-lg bg-[#F4D48C] px-3 py-2 text-xs font-black text-[#493414] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4D48C]">
            {isEnglish ? "View received offers" : "Voir les propositions reçues"}
          </a>
          <button type="button" onClick={onDismiss} aria-label={isEnglish ? "Dismiss notification" : "Fermer la notification"} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-xl leading-none hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#F4D48C]">
            ×
          </button>
        </article>
      ) : null}
    </div>
  );
}

export function useGameHeaderIndicators() {
  return useContext(GameHeaderIndicatorsContext);
}
