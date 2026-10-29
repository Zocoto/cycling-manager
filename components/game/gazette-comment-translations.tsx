"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { ChatAutoTranslationQueue } from "@/lib/game/chat-auto-translation";
import { getChatTranslationSourceKey, type ChatMessageTranslationState } from "@/lib/game/chat-translation";
import type { GazetteCommentLanguageHints, GazetteCommentSource } from "@/lib/game/gazette-comment-translation";

type Context = {
  states: Record<string, ChatMessageTranslationState>;
  observe: (key: string, subscriber: string, visible: boolean) => void;
  eligible: Set<string>;
};
const TranslationContext = createContext<Context | null>(null);

export function GazetteCommentTranslations({ editionId, sources, languages, enabled, children }: {
  editionId: string; sources: GazetteCommentSource[];
  languages: GazetteCommentLanguageHints; enabled: boolean; children: ReactNode;
}) {
  const { locale } = useLocale();
  const [states, setStates] = useState<Record<string, ChatMessageTranslationState>>({});
  const latestStates = useRef<Record<string, ChatMessageTranslationState>>({});
  const queue = useRef<ChatAutoTranslationQueue | null>(null);
  const subscriptions = useRef(new Map<string, Set<string>>());
  const messages = useMemo(() => enabled ? sources.filter(source => languages[source.messageId] !== locale && languages[source.messageId] !== "und")
    .map(source => ({ id: source.messageId, message: source.sourceMessage, editedAt: null, sportingDirectorId: "gazette" })) : [], [enabled, sources, languages, locale]);
  const eligible = useMemo(() => new Set(messages.map(message => message.id)), [messages]);
  const observe = useCallback((key: string, subscriber: string, visible: boolean) => {
    const observers = subscriptions.current.get(key) ?? new Set<string>();
    if (visible) observers.add(subscriber); else observers.delete(subscriber);
    if (observers.size) subscriptions.current.set(key, observers); else subscriptions.current.delete(key);
    queue.current?.observe(key, observers.size > 0);
  }, []);
  useEffect(() => {
    if (!messages.length) return;
    const current = new ChatAutoTranslationQueue({
      directorId: "", targetLocale: locale,
      endpoint: "/jeu/gazette/commentaires/traductions", requestContext: { editionId },
      // A disposed queue may leave an aborted request marked as loading.
      // Only completed results can be reused when returning to a language.
      getState: key => latestStates.current[key]?.status === "loaded" ? latestStates.current[key] : undefined,
      onState: (key, state) => {
        latestStates.current = { ...latestStates.current, [key]: state };
        setStates(latestStates.current);
      },
      onPause: () => undefined,
      canRun: () => document.visibilityState === "visible",
    });
    current.setMessages(messages);
    queue.current = current;
    for (const [key, subscribers] of subscriptions.current) if (subscribers.size) current.observe(key, true);
    const wake = () => { if (document.visibilityState === "visible") current.wake(); };
    document.addEventListener("visibilitychange", wake);
    return () => { current.dispose(); if (queue.current === current) queue.current = null; document.removeEventListener("visibilitychange", wake); };
  }, [messages, editionId, locale]);
  const value = useMemo(() => ({ states, observe, eligible }), [states, observe, eligible]);
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function GazetteCommentText({ commentKey, text }: { commentKey: string; text: string }) {
  const { locale } = useLocale();
  const context = useContext(TranslationContext);
  const subscriber = useId();
  const element = useRef<HTMLSpanElement>(null);
  const [originalFor, setOriginalFor] = useState<string | null>(null);
  const observe = context?.observe;
  const eligible = context?.eligible.has(commentKey) ?? false;
  useEffect(() => {
    if (!eligible || !observe || !element.current) return;
    if (typeof IntersectionObserver === "undefined") { observe(commentKey, subscriber, true); return () => observe(commentKey, subscriber, false); }
    const observer = new IntersectionObserver(entries => observe(commentKey, subscriber, entries.some(entry => entry.isIntersecting)), { rootMargin: "100px" });
    observer.observe(element.current);
    return () => { observer.disconnect(); observe(commentKey, subscriber, false); };
  }, [eligible, observe, commentKey, subscriber]);
  const state = context?.states[commentKey];
  const sourceKey = getChatTranslationSourceKey({ id: commentKey, message: text, editedAt: null });
  const translated = state?.status === "loaded" && state.targetLocale === locale && state.sourceKey === sourceKey && state.visible && state.translatedText;
  const originalKey = `${locale}:${sourceKey}`;
  const showOriginal = originalFor === originalKey;
  return <span ref={element} data-i18n-skip data-gazette-comment={commentKey}>
    <span lang={translated && !showOriginal ? locale : undefined}>{translated && !showOriginal ? translated : text}</span>
    {translated ? <span className="mt-1 block font-sans text-[10px] font-normal leading-4 text-[var(--gazette-muted)]">
      <span>{locale === "en" ? "Automatic translation" : "Traduction automatique"} · </span>
      <button type="button" onClick={() => setOriginalFor(showOriginal ? null : originalKey)}
        className="font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gazette-accent)]">
        {showOriginal ? locale === "en" ? "Show translation" : "Voir la traduction" : locale === "en" ? "Show original" : "Voir l’original"}
      </button>
    </span> : null}
  </span>;
}
