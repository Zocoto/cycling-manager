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
  currentDirectorId,
  initialMessages,
}: {
  stageId: string;
  currentDirectorId: string;
  initialMessages: RaceLiveMessage[];
}) {
  const supabase = useMemo(
    () => createSupabaseBrowserClient(),
    []
  );
  const [messages, setMessages] =
    useState<RaceLiveMessage[]>(initialMessages);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({
        block: "end",
      });
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    const channel = supabase
      .channel(`race-live-chat:${stageId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "race_live_messages",
          filter: `stage_id=eq.${stageId}`,
        },
        (payload: {
          new: Record<string, unknown>;
        }) => {
          const message = readRealtimeMessage(payload.new);
          if (!message) return;

          setMessages((current) =>
            appendUniqueMessage(current, message)
          );
          if (
            !isOpenRef.current &&
            message.sportingDirectorId !== currentDirectorId
          ) {
            setUnreadCount((current) => current + 1);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentDirectorId, stageId, supabase]);

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
    <aside className="fixed bottom-3 right-3 z-50 w-[min(23rem,calc(100vw-1.5rem))]">
      {isOpen ? (
        <div className="overflow-hidden rounded-2xl border border-[#315B3E]/20 bg-[#F8FCFA] shadow-[0_24px_80px_rgba(7,26,23,0.34)]">
          <header className="flex items-center justify-between bg-[#071A17] px-4 py-3 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#72D4B7]">
                Autour de la course
              </p>
              <p className="text-sm font-black">Chat des DS</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg transition hover:bg-white/20"
              aria-label="Réduire le chat"
            >
              −
            </button>
          </header>

          <div
            className="max-h-[min(22rem,52vh)] space-y-2 overflow-y-auto px-3 py-3"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <p className="rounded-xl bg-[#EAF5F0] px-3 py-4 text-center text-xs font-semibold text-[#5D776D]">
                Le chat est ouvert. Lancez la discussion avec les autres Directeurs Sportifs.
              </p>
            ) : null}
            {messages.map((message) => {
              const isCurrentDirector =
                message.sportingDirectorId === currentDirectorId;
              return (
                <article
                  key={message.id}
                  className={`max-w-[88%] rounded-xl px-3 py-2 ${
                    isCurrentDirector
                      ? "ml-auto bg-[#176951] text-white"
                      : "bg-white text-[#0B302B] shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[10px] font-black">
                      {message.authorDisplayName}
                    </p>
                    <time className={`shrink-0 text-[9px] ${isCurrentDirector ? "text-white/65" : "text-[#789087]"}`}>
                      {formatMessageTime(message.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 break-words text-xs font-semibold leading-5">
                    {message.message}
                  </p>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={submitMessage}
            className="border-t border-[#315B3E]/12 bg-white p-3"
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
                placeholder="Votre commentaire…"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#315B3E]/20 bg-[#F8FBF9] px-3 text-sm font-semibold text-[#0B302B] outline-none focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/15"
              />
              <button
                type="submit"
                disabled={isPending || draft.trim().length === 0}
                className="min-h-11 rounded-xl bg-[#F2C94C] px-4 text-xs font-black uppercase text-[#17261E] transition hover:bg-[#F7DA73] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "…" : "Envoyer"}
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold text-red-700">
                {error}
              </p>
              <p className="ml-auto text-[9px] font-bold text-[#789087]">
                {draft.length}/280
              </p>
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setUnreadCount(0);
            setIsOpen(true);
          }}
          className="ml-auto flex min-h-12 items-center gap-3 rounded-full border border-[#315B3E]/20 bg-[#071A17] px-5 text-sm font-black text-white shadow-[0_14px_45px_rgba(7,26,23,0.3)] transition hover:-translate-y-0.5"
        >
          <span aria-hidden="true">💬</span>
          Chat des DS
          {unreadCount > 0 ? (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#EF5B65] px-1 text-[10px] text-white">
              {Math.min(99, unreadCount)}
            </span>
          ) : null}
        </button>
      )}
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
