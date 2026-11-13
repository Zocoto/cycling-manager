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

import {
  CYCLO_STICKERS_BOOSTERS_CHANGED_EVENT,
  type CycloStickersBoostersChangedDetail,
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
};

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
  const quizUnreadUntil = indicators.globalChatQuizUnreadUntil;
  const contextValue = useMemo(() => ({
    ...indicators,
    hasUnreadGlobalChatQuiz: quizUnreadUntil !== null,
    collectorAlbumAvailable, collectorAlbumHasUnopenedBoosters, pcmExportAvailable,
  }), [indicators, quizUnreadUntil, collectorAlbumAvailable, collectorAlbumHasUnopenedBoosters, pcmExportAvailable]);

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
    let authSubscription: { unsubscribe: () => void } | null = null;
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
      const result = await supabase
        .rpc("get_current_game_header_indicators_v6")
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

    window.addEventListener(CYCLO_STICKERS_BOOSTERS_CHANGED_EVENT, handleCycloStickersBoostersChanged);
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
              if (message.read_at || message.archived_at) return;
              setIndicators((current) => ({
                ...current,
                mailboxUnreadCount: current.mailboxUnreadCount + 1,
              }));
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
    </GameHeaderIndicatorsContext>
  );
}

export function useGameHeaderIndicators() {
  return useContext(GameHeaderIndicatorsContext);
}
