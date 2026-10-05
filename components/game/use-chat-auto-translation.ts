"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type RefObject, type SetStateAction } from "react";
import { ChatAutoTranslationQueue, type AutoTranslationMessage } from "@/lib/game/chat-auto-translation";
import { readChatTranslationPreferences, type ChatMessageTranslationState, type ChatTranslationTargetLocale } from "@/lib/game/chat-translation";

export function useChatAutoTranslation({ directorId, locale, enabled, active, messages, viewportRef, translations, setTranslations }: {
  directorId: string; locale: "fr" | "en"; enabled: boolean; active: boolean;
  messages: readonly AutoTranslationMessage[]; viewportRef: RefObject<HTMLDivElement | null>;
  translations: Record<string, ChatMessageTranslationState>;
  setTranslations: Dispatch<SetStateAction<Record<string, ChatMessageTranslationState>>>;
}) {
  const storageKey = `cyclostratege:chat:translation:${directorId}`;
  const store = useMemo(() => createPreferenceStore(storageKey, locale), [storageKey, locale]);
  const preferences = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = preferences.ready;
  const [pausedConfiguration, setPausedConfiguration] = useState<string | null>(null);
  const configuration = `${directorId}:${preferences.targetLocale}:${preferences.automatic}:${active}`;
  const stateRef = useRef(translations);
  const engineRef = useRef<ChatAutoTranslationQueue | null>(null);
  const followBottomRef = useRef(false);
  useEffect(() => { stateRef.current = translations; }, [translations]);
  useEffect(() => {
    if (!ready || !enabled || !active || !preferences.automatic) return;
    const engine = new ChatAutoTranslationQueue({ directorId, targetLocale: preferences.targetLocale,
      getState: (id) => stateRef.current[id],
      onState: (id, state) => {
        const viewport = viewportRef.current;
        if (viewport && viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 64) followBottomRef.current = true;
        setTranslations((current) => ({ ...current, [id]: state }));
      },
      onPause: () => setPausedConfiguration(configuration), canRun: () => document.visibilityState !== "hidden",
    });
    engineRef.current = engine;
    const wake = () => engine.wake();
    document.addEventListener("visibilitychange", wake);
    return () => { engine.dispose(); engineRef.current = null; document.removeEventListener("visibilitychange", wake);
      setTranslations((current) => Object.fromEntries(Object.entries(current).filter(([, state]) => state.status !== "loading"))); };
  }, [ready, enabled, active, preferences.automatic, preferences.targetLocale, directorId, setTranslations, configuration, viewportRef]);
  useLayoutEffect(() => {
    if (followBottomRef.current && active && viewportRef.current) viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    followBottomRef.current = false;
  }, [translations, active, viewportRef]);
  useEffect(() => {
    const engine = engineRef.current;
    const viewport = viewportRef.current;
    if (!engine || !viewport || typeof IntersectionObserver === "undefined") return;
    engine.setMessages(messages);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.chatTranslationId;
        if (id) engine.observe(id, entry.isIntersecting);
      }
    }, { root: viewport, threshold: 0.05 });
    const nodes = [...viewport.querySelectorAll<HTMLElement>("[data-chat-translation-id]")];
    nodes.forEach((node) => observer.observe(node));
    return () => { observer.disconnect(); nodes.forEach((node) => engine.observe(node.dataset.chatTranslationId!, false)); };
  }, [messages, viewportRef, ready, enabled, active, preferences.automatic, preferences.targetLocale]);
  return { ...preferences, paused: pausedConfiguration === configuration,
    setAutomatic: (automatic: boolean) => store.save({ ...preferences, automatic }),
    setTargetLocale: (targetLocale: ChatTranslationTargetLocale) => store.save({ ...preferences, targetLocale }),
  };
}

function createPreferenceStore(storageKey: string, locale: "fr" | "en") {
  const server = { automatic: true, targetLocale: locale as ChatTranslationTargetLocale, ready: false };
  let snapshot: typeof server | null = null;
  const listeners = new Set<() => void>();
  const getSnapshot = () => {
    if (!snapshot) {
      let saved: string | null = null;
      try { saved = localStorage.getItem(storageKey); } catch { /* Private browsing: session defaults. */ }
      snapshot = { ...readChatTranslationPreferences(saved, navigator.languages ?? [navigator.language], locale), ready: true };
    }
    return snapshot;
  };
  return {
    getSnapshot, getServerSnapshot: () => server,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => { if (event.key === storageKey) { snapshot = null; listener(); } };
      window.addEventListener("storage", onStorage);
      return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
    },
    save: (next: typeof server) => {
      snapshot = { ...next, ready: true };
      try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch { /* Session choice still works. */ }
      listeners.forEach((listener) => listener());
    },
  };
}
