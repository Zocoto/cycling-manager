"use client";

import {
  createContext,
  useContext,
  useEffect,
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

type SupabaseBrowserClient = ReturnType<
  (typeof import("@/lib/supabase/client"))["createSupabaseBrowserClient"]
>;

type GameHeaderIndicators = {
  mailboxUnreadCount: number;
  directMessageUnreadCount: number;
  hasUnreadGlobalChat: boolean;
  hasUnreadCyclogazette: boolean;
};

type GameHeaderIndicatorsRow = {
  current_sporting_director_id: string | null;
  mailbox_unread_count: number | null;
  direct_message_unread_count: number | null;
  has_unread_global_chat: boolean | null;
  has_unread_cyclogazette: boolean | null;
};

const EMPTY_INDICATORS: GameHeaderIndicators = {
  mailboxUnreadCount: 0,
  directMessageUnreadCount: 0,
  hasUnreadGlobalChat: false,
  hasUnreadCyclogazette: false,
};

const GameHeaderIndicatorsContext =
  createContext<GameHeaderIndicators | null>(null);

export function GameHeaderIndicatorsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [indicators, setIndicators] =
    useState<GameHeaderIndicators>(EMPTY_INDICATORS);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | null = null;
    let supabase: SupabaseBrowserClient | null = null;

    async function refreshIndicators() {
      if (!supabase) return null;

      const requestVersion = ++requestVersionRef.current;
      const result = await supabase
        .rpc("get_current_game_header_indicators_v2")
        .maybeSingle();

      if (!active || result.error || requestVersion !== requestVersionRef.current) {
        return null;
      }

      const row = result.data as GameHeaderIndicatorsRow | null;

      setIndicators({
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
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshIndicators();
      }, delayMs);
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

    let subscribedChannel: ReturnType<SupabaseBrowserClient["channel"]> | null = null;

    async function initialize() {
      const { createSupabaseBrowserClient } = await import(
        "@/lib/supabase/client"
      );
      if (!active) return;

      supabase = createSupabaseBrowserClient();
      const row = await refreshIndicators();
      if (!active || !supabase) return;

      let channel = supabase
        .channel("game-header-indicators:v2")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "global_chat_messages",
          },
          () => scheduleRefresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "cyclogazette_editions",
          },
          () => scheduleRefresh(),
        );

      if (row?.current_sporting_director_id) {
        channel = channel
          .on(
            "postgres_changes",
            {
              event: "*",
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
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
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
    <GameHeaderIndicatorsContext value={indicators}>
      {children}
    </GameHeaderIndicatorsContext>
  );
}

export function useGameHeaderIndicators() {
  return useContext(GameHeaderIndicatorsContext);
}
