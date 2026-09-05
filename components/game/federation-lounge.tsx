"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FEDERATION_CHAT_PAGE_SIZE,
  mapFederationChatMessage,
  type FederationChatMessage,
  type FederationChatMessageRow,
} from "@/lib/game/federation-chat";

const MESSAGE_MAX_LENGTH = 500;

export function FederationLounge({
  countryId,
  countryCode,
  countryName,
  currentTeamId,
  initialMessages,
  initialHasMore,
}: {
  countryId: string;
  countryCode: string;
  countryName: string;
  currentTeamId: string;
  initialMessages: FederationChatMessage[];
  initialHasMore: boolean;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const positionedRef = useRef(false);

  useEffect(() => {
    const channel = supabase
      .channel(`federation-chat:${countryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "federation_chat_messages",
          filter: `country_id=eq.${countryId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const message = readRealtimeMessage(payload.new);
          if (!message) return;
          setMessages((current) => appendUniqueMessage(current, message));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [countryId, supabase]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (!positionedRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
      positionedRef.current = true;
      return;
    }
    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    if (distanceFromBottom < 180) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.replace(/\s+/g, " ").trim();
    if (!message || message.length > MESSAGE_MAX_LENGTH) return;

    setError(null);
    startTransition(async () => {
      const result = await supabase.rpc("post_federation_chat_message", {
        p_country_code: countryCode,
        p_message: message,
      });
      if (result.error) {
        setError(result.error.message || "Le message n’a pas pu être envoyé.");
        return;
      }

      const row = readFederationChatRow(
        Array.isArray(result.data) ? result.data[0] : result.data,
      );
      if (row) {
        setMessages((current) =>
          appendUniqueMessage(current, mapFederationChatMessage(row)),
        );
      }
      setDraft("");
    });
  }

  async function loadOlderMessages() {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    setError(null);

    const result = await supabase
      .from("federation_chat_messages")
      .select(
        "id, country_id, sporting_director_id, team_id, author_display_name, team_display_name, message, created_at",
      )
      .eq("country_id", countryId)
      .lt("created_at", oldest.createdAt)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(FEDERATION_CHAT_PAGE_SIZE + 1);

    setLoadingOlder(false);
    if (result.error) {
      setError("L’historique précédent n’a pas pu être chargé.");
      return;
    }

    const rows = ((result.data as unknown as FederationChatMessageRow[] | null) ?? []);
    const olderMessages = rows
      .slice(0, FEDERATION_CHAT_PAGE_SIZE)
      .reverse()
      .map(mapFederationChatMessage);
    setHasMore(rows.length > FEDERATION_CHAT_PAGE_SIZE);
    setMessages((current) => prependUniqueMessages(current, olderMessages));
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
      <header className="flex flex-col gap-4 bg-[var(--federation-primary)] px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-accent)]">
            Salon privé de la fédération
          </p>
          <h2 className="mt-2 text-2xl font-black">Le vestiaire de {countryName}</h2>
          <p className="mt-2 text-sm font-semibold text-[#BFD1C6]">
            Réservé aux équipes affiliées · échanges en direct
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black">
          <span className={`fi fi-${countryCode.toLowerCase()} rounded-sm`} />
          Salon ouvert
        </span>
      </header>

      <div
        ref={viewportRef}
        className="h-[min(58dvh,38rem)] space-y-3 overflow-y-auto overscroll-contain bg-[#F3F8F5] p-4 sm:p-6"
      >
        {hasMore ? (
          <div className="text-center">
            <button
              type="button"
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="rounded-full border border-[#315B3E]/15 bg-white px-4 py-2 text-xs font-black text-[var(--federation-secondary)] shadow-sm disabled:opacity-50"
            >
              {loadingOlder ? "Chargement…" : "Afficher les messages précédents"}
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-[#315B3E]/20 bg-white px-6 py-10 text-center">
            <p className="font-black text-[#183F37]">Le salon est ouvert</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
              Lancez le premier échange entre Directeurs Sportifs belges.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const ownMessage = message.teamId === currentTeamId;
            return (
              <article
                key={message.id}
                className={`max-w-[min(88%,42rem)] rounded-2xl border px-4 py-3 shadow-sm ${
                  ownMessage
                    ? "ml-auto border-[var(--federation-secondary)]/25 bg-[var(--federation-secondary)] text-white"
                    : "border-[#315B3E]/12 bg-white text-[#183F37]"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className={`text-xs font-black ${ownMessage ? "text-[#FFF4B8]" : "text-[var(--federation-secondary)]"}`}>
                    {ownMessage ? "Vous" : message.authorDisplayName}
                  </p>
                  <time className={`text-[10px] font-bold ${ownMessage ? "text-[#BFE2D4]" : "text-[#789087]"}`} dateTime={message.createdAt}>
                    {formatMessageTime(message.createdAt)}
                  </time>
                </div>
                <p className={`mt-0.5 text-[10px] font-bold ${ownMessage ? "text-[#BFE2D4]" : "text-[#789087]"}`}>
                  {message.teamDisplayName}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6">
                  {message.message}
                </p>
              </article>
            );
          })
        )}
      </div>

      <form onSubmit={sendMessage} className="border-t border-[#315B3E]/12 bg-white p-4 sm:p-6">
        <label htmlFor="federation-chat-message" className="sr-only">
          Votre message dans le salon fédéral
        </label>
        <div className="flex items-end gap-3">
          <textarea
            id="federation-chat-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MESSAGE_MAX_LENGTH}
            rows={2}
            placeholder="Écrire aux équipes affiliées…"
            className="min-h-12 flex-1 resize-none rounded-xl border border-[#315B3E]/18 bg-[#F8FBF9] px-4 py-3 text-sm font-semibold text-[#183F37] outline-none focus:border-[var(--federation-secondary)] focus:ring-2 focus:ring-[#42B99A]/25"
          />
          <button
            type="submit"
            disabled={isPending || !draft.trim()}
            className="min-h-12 rounded-xl bg-[var(--federation-secondary)] px-5 text-sm font-black text-white transition hover:bg-[#0F5944] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isPending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-bold text-[#789087]">
          <p aria-live="polite" className={error ? "text-[#B9343F]" : ""}>
            {error ?? "Messages limités à 500 caractères."}
          </p>
          <span>{draft.length}/{MESSAGE_MAX_LENGTH}</span>
        </div>
      </form>
    </section>
  );
}

function appendUniqueMessage(
  messages: FederationChatMessage[],
  message: FederationChatMessage,
) {
  return messages.some((candidate) => candidate.id === message.id)
    ? messages
    : [...messages, message];
}

function prependUniqueMessages(
  messages: FederationChatMessage[],
  olderMessages: FederationChatMessage[],
) {
  const knownIds = new Set(messages.map((message) => message.id));
  return [
    ...olderMessages.filter((message) => !knownIds.has(message.id)),
    ...messages,
  ];
}

function readRealtimeMessage(value: Record<string, unknown>) {
  const row = readFederationChatRow(value);
  return row ? mapFederationChatMessage(row) : null;
}

function readFederationChatRow(value: unknown): FederationChatMessageRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.country_id !== "string" ||
    typeof row.sporting_director_id !== "string" ||
    typeof row.team_id !== "string" ||
    typeof row.author_display_name !== "string" ||
    typeof row.team_display_name !== "string" ||
    typeof row.message !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }
  return row as FederationChatMessageRow;
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
