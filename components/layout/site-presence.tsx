"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  claimSitePresenceRefresh,
  normalizeSitePresence,
  readSitePresenceSnapshot,
  releaseFailedSitePresenceRefresh,
  SITE_PRESENCE_REFRESH_MS,
  SITE_PRESENCE_SNAPSHOT_KEY,
  storeSitePresenceSnapshot,
  type SitePresence,
} from "@/lib/game/site-presence-polling";

export type { SitePresence } from "@/lib/game/site-presence-polling";
const PresenceContext = createContext<SitePresence | null>(null);

export function SitePresenceProvider({ children }: { children: ReactNode }) {
  const [presence, setPresence] = useState<SitePresence | null>(null);
  useEffect(() => {
    let active = true;
    let pending = false;
    let controller: AbortController | null = null;
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Presence remains available without storage. */ }
    async function refreshUnderLock() {
      // Another tab may have completed the request while this one waited.
      if (!active || document.visibilityState !== "visible") return;
      const attemptedAt = Date.now();
      const cached = readSitePresenceSnapshot(storage, attemptedAt);
      if (cached) { setPresence(cached); return; }
      if (!claimSitePresenceRefresh(storage, attemptedAt)) return;
      controller = new AbortController();
      const request = controller;
      const timeout = window.setTimeout(() => request.abort(), 10_000);
      let succeeded = false;
      try {
        const response = await fetch("/api/site-presence", { method: "POST", signal: request.signal });
        if (response.ok && response.status !== 204) {
          const data = normalizeSitePresence(await response.json());
          if (active && !request.signal.aborted && data) {
            storeSitePresenceSnapshot(storage, attemptedAt, data);
            setPresence(data);
            succeeded = true;
          }
        }
      } catch { /* Keep the last successful snapshot during a temporary outage. */ }
      finally {
        window.clearTimeout(timeout);
        if (!succeeded) releaseFailedSitePresenceRefresh(storage, attemptedAt);
        if (controller === request) controller = null;
      }
    }
    async function refresh() {
      if (!active || pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        if (typeof navigator !== "undefined" && navigator.locks) {
          // localStorage read/write is not atomic across tabs. Serialize the
          // check and request so simultaneous mounts reuse the same snapshot.
          let enteredLock = false;
          try {
            await navigator.locks.request("cyclostratege:site-presence", () => {
              enteredLock = true;
              return refreshUnderLock();
            });
          } catch {
            if (!enteredLock) await refreshUnderLock();
          }
        } else {
          await refreshUnderLock();
        }
      } catch { /* Retry on the next visit/tick if the browser lock is unavailable. */ }
      finally { pending = false; }
    }
    function receiveSnapshot(event: StorageEvent) {
      if (!active || event.key !== SITE_PRESENCE_SNAPSHOT_KEY) return;
      const cached = readSitePresenceSnapshot(storage, Date.now());
      if (cached) setPresence(cached);
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), SITE_PRESENCE_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("storage", receiveSnapshot);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("storage", receiveSnapshot);
    };
  }, []);
  return <PresenceContext.Provider value={presence}>{children}</PresenceContext.Provider>;
}

export function SitePresenceIndicator({ compact = false }: { compact?: boolean }) {
  const presence = useContext(PresenceContext);
  const { locale } = useLocale();
  const en = locale === "en";
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }
  function open() {
    cancelClose();
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)), top: rect.bottom + 6 });
  }
  function closeSoon() {
    cancelClose();
    if (pinned.current) return;
    closeTimer.current = setTimeout(() => setPosition(null), 150);
  }
  function dismiss() {
    pinned.current = false;
    setPosition(null);
  }
  useEffect(() => {
    if (!position) return;
    function outside(event: PointerEvent) {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) dismiss();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { dismiss(); }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss);
    };
  }, [position]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return <>
    <button ref={trigger} type="button" data-site-presence="true"
      aria-label={presence ? `${presence.total} ${en ? "online, players and visitors" : "en ligne, joueurs et visiteurs"}` : (en ? "Online presence loading" : "Chargement des présences")}
      aria-expanded={Boolean(position)} aria-controls={position ? id : undefined}
      onMouseEnter={open} onMouseLeave={closeSoon}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) open(); }} onBlur={closeSoon}
      onClick={() => {
        if (pinned.current) { cancelClose(); dismiss(); }
        else { pinned.current = true; open(); }
      }}
      className={`inline-flex ${compact ? "h-8" : "h-10"} w-14 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-[#78947D]/35 bg-[#42B99A]/8 px-1 text-[11px] font-semibold leading-none text-[#D6DFD2] transition hover:border-[#42B99A]/65 hover:bg-[#42B99A]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] sm:w-auto sm:min-w-16 sm:gap-2 sm:px-3`}
    >
      <span aria-hidden="true" className="relative h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
          <circle cx="7" cy="6.5" r="2.5" />
          <path d="M2.5 16v-1.5a4.5 4.5 0 0 1 9 0V16M13 4.5a2.5 2.5 0 0 1 0 5M14 11a4 4 0 0 1 3.5 4v1" />
        </svg>
        <span className={`absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full ring-2 ring-[#071A17] ${presence ? "bg-[#42B99A]" : "bg-[#78947D]"}`} />
      </span>
      <span className="tabular-nums">{presence ? (presence.total > 999 ? "999+" : presence.total) : "—"}</span>
    </button>
    {position && createPortal(<div ref={panel} id={id} role="region"
      aria-label={en ? "Online players and visitors" : "Joueurs et visiteurs en ligne"}
      onMouseEnter={cancelClose} onMouseLeave={closeSoon} onFocus={cancelClose} onBlur={closeSoon}
      className="fixed z-[100] w-72 max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-[#78947D]/40 bg-[#071A17] p-3 text-xs text-[#FFFDF4] shadow-xl shadow-black/30"
      style={{ left: position.left, top: position.top, maxHeight: `min(320px, calc(100dvh - ${position.top + 12}px))` }}
    >
      <p className="font-semibold">{presence?.total ?? "—"} {en ? "online" : "en ligne"}</p>
      <p className="mt-1 text-[#D6DFD2]">{presence?.players.length ?? "—"} {en ? "players" : "joueurs"} · {presence?.visitors ?? "—"} {en ? "visitors" : "visiteurs"}</p>
      <div className="mt-2 border-t border-white/10 pt-2">
        {!presence ? <p>{en ? "Loading…" : "Chargement…"}</p> : presence.players.length ? <ul className="space-y-1.5">{presence.players.map(player => <li key={player.id} className="break-words">{player.name}</li>)}</ul> : <p className="text-[#D6DFD2]/70">{en ? "No players online" : "Aucun joueur en ligne"}</p>}
      </div>
    </div>, document.body)}
  </>;
}
