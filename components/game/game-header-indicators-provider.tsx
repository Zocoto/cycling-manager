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

import { CYCLOGAZETTE_READ_EVENT } from "@/lib/game/cyclogazette-read-sync";
import {
  DIRECTOR_MAILBOX_CHANGED_EVENT,
  type DirectorMailboxChangedDetail,
} from "@/lib/game/director-mailbox-sync";
import { DIRECT_MESSAGES_CHANGED_EVENT } from "@/lib/game/direct-message-sync";
import { GLOBAL_CHAT_MESSAGES_READ_EVENT } from "@/lib/game/global-chat-read-sync";
import { createVisibleRefreshScheduler } from "@/lib/game/visible-refresh-scheduler";
import type { GameStaffRole } from "@/lib/game/game-product-news";
import { canAccessCollectorAlbum } from "@/lib/game/collector-album-access";

type SupabaseBrowserClient = ReturnType<
  (typeof import("@/lib/supabase/client"))["createSupabaseBrowserClient"]
>;

type GameHeaderIndicators = {
  gameStaffRole: GameStaffRole;
  mailboxUnreadCount: number;
  directMessageUnreadCount: number;
  hasUnreadGlobalChat: boolean;
  hasUnreadCyclogazette: boolean;
};

type GameHeaderIndicatorsRow = {
  game_role?: string | null;
  current_sporting_director_id: string | null;
  mailbox_unread_count: number | null;
  direct_message_unread_count: number | null;
  has_unread_global_chat: boolean | null;
  has_unread_cyclogazette: boolean | null;
};

const EMPTY_INDICATORS: GameHeaderIndicators = {
  gameStaffRole: null,
  mailboxUnreadCount: 0,
  directMessageUnreadCount: 0,
  hasUnreadGlobalChat: false,
  hasUnreadCyclogazette: false,
};

const GameHeaderIndicatorsContext =
  createContext<(GameHeaderIndicators & { collectorAlbumAvailable: boolean }) | null>(null);

export function GameHeaderIndicatorsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [indicators, setIndicators] =
    useState<GameHeaderIndicators>(EMPTY_INDICATORS);
  const requestVersionRef = useRef(0);
  const [collectorAlbumAvailable, setCollectorAlbumAvailable] = useState(false);
  const contextValue = useMemo(() => ({ ...indicators, collectorAlbumAvailable }), [indicators, collectorAlbumAvailable]);

  useEffect(() => {
    let active = true;
    let supabase: SupabaseBrowserClient | null = null;
    let subscribedChannel: ReturnType<SupabaseBrowserClient["channel"]> | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;
    const refreshScheduler = createVisibleRefreshScheduler({
      isVisible: () => document.visibilityState === "visible",
      refresh: async () => {
        if (!supabase) return;
        const row = await refreshIndicators();
        if (active && row?.current_sporting_director_id && !subscribedChannel) {
          subscribeToIndicators(row);
        }
      },
    });

    async function refreshIndicators() {
      if (!supabase) return null;

      const requestVersion = ++requestVersionRef.current;
      const result = await supabase
        .rpc("get_current_game_header_indicators_v3")
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
        hasUnreadCyclogazette:
          row?.has_unread_cyclogazette === true,
      });

      return row;
    }

    function scheduleRefresh(delayMs = 150) {
      refreshScheduler.request(delayMs);
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") scheduleRefresh(0);
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

    function acknowledgeCyclogazetteRead() {
      requestVersionRef.current += 1;
      setIndicators((current) => ({
        ...current,
        hasUnreadCyclogazette: false,
      }));
    }

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
      // Reuse the local auth lifecycle: no new RPC, user lookup or polling.
      authSubscription = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
        if (active) setCollectorAlbumAvailable(canAccessCollectorAlbum(session?.user.id));
      }).data.subscription;
      scheduleRefresh(0);
    }

    function subscribeToIndicators(row: GameHeaderIndicatorsRow | null) {
      if (!supabase) return;

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
          {
            event: "INSERT",
            schema: "public",
            table: "cyclogazette_editions",
          },
          () => {
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
            () => scheduleRefresh(),
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "direct_messages",
              filter: `recipient_id=eq.${row.current_sporting_director_id}`,
            },
            () => scheduleRefresh(),
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
      window.removeEventListener(
        CYCLOGAZETTE_READ_EVENT,
        acknowledgeCyclogazetteRead,
      );
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (subscribedChannel && supabase) {
        void supabase.removeChannel(subscribedChannel);
      }
    };
  }, []);

  return (
    <GameHeaderIndicatorsContext value={contextValue}>
      {children}
    </GameHeaderIndicatorsContext>
  );
}

export function useGameHeaderIndicators() {
  return useContext(GameHeaderIndicatorsContext);
}
