"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { postRaceLiveMessageAction } from "@/app/jeu/resultats/chat-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RaceLiveMessage } from "@/services/race-live-chat";

export function RaceLiveChat({
  stageId,
  raceEditionId,
  currentDirectorId,
  initialMessages,
  mode,
}: {
  stageId: string;
  raceEditionId: string;
  currentDirectorId: string;
  initialMessages: RaceLiveMessage[];
  mode: "live" | "replay";
}) {
  const supabase = useMemo(
    () => createSupabaseBrowserClient(),
    []
  );
  const [messages, setMessages] =
    useState<RaceLiveMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const hasPositionedInitialMessagesRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const viewport = messagesViewportRef.current;
      if (!viewport) return;

      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: hasPositionedInitialMessagesRef.current
          ? "smooth"
          : "auto",
      });
      hasPositionedInitialMessagesRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages.length]);

  useEffect(() => {
    const channel = supabase
      .channel(`race-live-chat:${raceEditionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "race_live_messages",
          filter: `race_edition_id=eq.${raceEditionId}`,
        },
        (payload: {
          new: Record<string, unknown>;
        }) => {
          const message = readRealtimeMessage(payload.new);
          if (!message) return;

          setMessages((current) =>
            appendUniqueMessage(current, message)
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [raceEditionId, supabase]);

  function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isPending) return;

    setError(null);
    startTransition(async () => {
      try {
        const savedMessage =
          await postRaceLiveMessageAction(stageId, message);
        setMessages((current) =>
          appendUniqueMessage(current, savedMessage)
        );
        setDraft("");
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Le message n’a pas pu être envoyé."
        );
      }
    });
  }

  return (
    <aside
      data-race-live-chat="persistent"
      data-race-chat-room={raceEditionId}
      aria-label={
        mode === "live"
          ? "Chat de la course en direct"
          : "Chat du replay"
      }
      className="flex h-[26rem] min-h-0 flex-col overflow-hidden rounded-[2rem] border border-[#1D5145]/20 bg-[#071A17] text-white shadow-[0_24px_70px_rgba(7,26,23,0.22)] sm:h-[32rem] xl:sticky xl:top-4 xl:h-[min(48rem,calc(100vh_-_2rem))] xl:min-h-[38rem]"
    >
      <header className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(66,185,154,0.28),transparent_58%)] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#72D4B7]">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  mode === "live"
                    ? "animate-pulse bg-[#EF5B65]"
                    : "bg-[#F2C94C]"
                }`}
              />
              {mode === "live" ? "En direct" : "Replay"}
            </p>
            <h2 className="mt-2 text-lg font-black">
              Chat des Directeurs Sportifs
            </h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#AFC6BB]">
              {mode === "live"
                ? "Réagissez ensemble à tous les mouvements de la course."
                : "Les réactions de la course, visibles au fil du replay."}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black text-[#D9E7E0]">
            {messages.length}
          </span>
        </div>
      </header>

      <div
        ref={messagesViewportRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-scroll overscroll-contain bg-[#0B2521] px-4 py-4 [scrollbar-color:#72D4B7_#0B2521] [scrollbar-gutter:stable] [scrollbar-width:thin]"
        aria-label="Messages du chat de course"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
      >
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#72D4B7]/30 bg-[#72D4B7]/5 px-4 py-8 text-center">
            <span
              aria-hidden="true"
              className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#72D4B7]/10 text-lg"
            >
              💬
            </span>
            <p className="mt-3 text-sm font-black text-[#DCE9E3]">
              La discussion est ouverte
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#8FA99D]">
              Lancez les réactions avec les autres Directeurs Sportifs.
            </p>
          </div>
        ) : null}
        {messages.map((message) => {
          const isCurrentDirector =
            message.sportingDirectorId === currentDirectorId;
          return (
            <article
              key={message.id}
              className={`flex items-start gap-2.5 ${
                isCurrentDirector ? "flex-row-reverse" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-black uppercase shadow-sm ${
                  isCurrentDirector
                    ? "bg-[#F2C94C] text-[#17261E]"
                    : "bg-[#296F5F] text-white"
                }`}
              >
                {getAuthorInitials(message.authorDisplayName)}
              </span>
              <div
                className={`min-w-0 max-w-[calc(100%_-_2.625rem)] rounded-2xl px-3 py-2.5 ${
                  isCurrentDirector
                    ? "rounded-tr-sm bg-[#176951] text-white"
                    : "rounded-tl-sm bg-white text-[#0B302B]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[10px] font-black">
                    {isCurrentDirector
                      ? "Vous"
                      : message.authorDisplayName}
                  </p>
                  <time
                    className={`shrink-0 text-[9px] font-bold ${
                      isCurrentDirector
                        ? "text-white/60"
                        : "text-[#789087]"
                    }`}
                  >
                    {formatMessageTime(message.createdAt)}
                  </time>
                </div>
                <p className="mt-1 break-words text-xs font-semibold leading-5">
                  {message.message}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <form
        onSubmit={submitMessage}
        className="border-t border-[#315B3E]/15 bg-[#F8FCFA] p-3"
      >
        <label htmlFor="race-live-message" className="sr-only">
          Votre commentaire
        </label>
        <div className="flex gap-2">
          <input
            id="race-live-message"
            value={draft}
            onChange={(event) =>
              setDraft(event.target.value.slice(0, 280))
            }
            placeholder="Réagir à la course…"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-semibold text-[#0B302B] outline-none focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/15"
          />
          <button
            type="submit"
            disabled={isPending || draft.trim().length === 0}
            className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-[#F2C94C] px-3 text-sm font-black text-[#17261E] transition hover:bg-[#F7DA73] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Envoyer le message"
          >
            {isPending ? "…" : "↑"}
          </button>
        </div>
        <div className="mt-1 flex min-h-4 items-center justify-between gap-3">
          <p className="text-[10px] font-semibold text-red-700">
            {error}
          </p>
          <p className="ml-auto text-[9px] font-bold text-[#789087]">
            {draft.length}/280
          </p>
        </div>
      </form>
    </aside>
  );
}

function appendUniqueMessage(
  messages: RaceLiveMessage[],
  message: RaceLiveMessage
) {
  if (messages.some((candidate) => candidate.id === message.id)) {
    return messages;
  }
  return [...messages, message].slice(-60);
}

function readRealtimeMessage(
  value: Record<string, unknown>
): RaceLiveMessage | null {
  if (
    typeof value.id !== "string" ||
    typeof value.stage_id !== "string" ||
    typeof value.race_edition_id !== "string" ||
    typeof value.sporting_director_id !== "string" ||
    typeof value.author_display_name !== "string" ||
    typeof value.message !== "string" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    stageId: value.stage_id,
    raceEditionId: value.race_edition_id,
    sportingDirectorId: value.sporting_director_id,
    authorDisplayName: value.author_display_name,
    message: value.message,
    createdAt: value.created_at,
  };
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getAuthorInitials(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("fr-FR");
}