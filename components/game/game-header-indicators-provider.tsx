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
import { DIRECTOR_MAILBOX_CHANGED_EVENT } from "@/lib/game/director-mailbox-sync";
import { GLOBAL_CHAT_MESSAGES_READ_EVENT } from "@/lib/game/global-chat-read-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type GameHeaderIndicators = {
  mailboxUnreadCount: number;
  hasUnreadGlobalChat: boolean;
  hasUnreadCyclogazette: boolean;
};

type GameHeaderIndicatorsRow = {
  mailbox_unread_count: number | null;
  has_unread_global_chat: boolean | null;
  has_unread_cyclogazette: boolean | null;
};

const EMPTY_INDICATORS: GameHeaderIndicators = {
  mailboxUnreadCount: 0,
  hasUnreadGlobalChat: false,
  hasUnreadCyclogazette: false,
};

const GameHeaderIndicatorsContext =
  createContext<GameHeaderIndicators | null>(null);

export function GameHeaderIndicatorsProvider({
  children,
  chatIsOpen = false,
  gazetteIsOpen = false,
  mailboxIsOpen = false,
}: {
  children: ReactNode;
  chatIsOpen?: boolean;
  gazetteIsOpen?: boolean;
  mailboxIsOpen?: boolean;
}) {
  const [indicators, setIndicators] =
    useState<GameHeaderIndicators>(EMPTY_INDICATORS);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | null = null;
    const supabase = createSupabaseBrowserClient();

    async function refreshIndicators() {
      const requestVersion = ++requestVersionRef.current;
      const result = await supabase
        .rpc("get_current_game_header_indicators")
        .maybeSingle();

      if (!active || result.error || requestVersion !== requestVersionRef.current) {
        return;
      }

      const row = result.data as GameHeaderIndicatorsRow | null;

      setIndicators({
        mailboxUnreadCount: Math.max(
          0,
          Number(row?.mailbox_unread_count ?? 0),
        ),
        hasUnreadGlobalChat: row?.has_unread_global_chat === true,
        hasUnreadCyclogazette:
          row?.has_unread_cyclogazette === true,
      });
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

    scheduleRefresh(0);

    let channel = supabase.channel("game-header-indicators:v1");
    if (!mailboxIsOpen) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sporting_director_messages",
        },
        () => scheduleRefresh(),
      );
    }
    if (!chatIsOpen) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "global_chat_messages",
        },
        () => scheduleRefresh(),
      );
    }
    if (!gazetteIsOpen) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cyclogazette_editions",
        },
        () => scheduleRefresh(),
      );
    }
    const subscribedChannel = channel.subscribe();

    return () => {
      active = false;
      requestVersionRef.current += 1;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener(
        DIRECTOR_MAILBOX_CHANGED_EVENT,
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
      void supabase.removeChannel(subscribedChannel);
    };
  }, [chatIsOpen, gazetteIsOpen, mailboxIsOpen]);

  return (
    <GameHeaderIndicatorsContext value={indicators}>
      {children}
    </GameHeaderIndicatorsContext>
  );
}

export function useGameHeaderIndicators() {
  return useContext(GameHeaderIndicatorsContext);
}
