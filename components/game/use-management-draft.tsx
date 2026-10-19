"use client";

import { useEffect, useRef, useState } from "react";
import { decodeManagementDraft, encodeManagementDraft } from "@/lib/game/management-drafts";
import { registerUnsavedManagementChanges } from "@/lib/game/management-navigation";

export function useUnsavedManagementChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    return registerUnsavedManagementChanges();
  }, [dirty]);
}

export function useManagementDraft<T>({ scope, baseline, value, dirty, restore }: {
  scope?: string;
  baseline: string;
  value: T;
  dirty: boolean;
  restore: (value: unknown) => boolean;
}) {
  const key = scope ? `cs:management:v1:${scope}` : null;
  const [candidate, setCandidate] = useState<{ key: string; baseline: string; value: unknown } | null>(null);
  const loaded = useRef<string | null>(null);
  const wasDirty = useRef(false);
  const serialized = JSON.stringify(value);
  const latest = useRef({ serialized, dirty });
  useUnsavedManagementChanges(dirty);

  useEffect(() => {
    if (!key) return;
    loaded.current = `${key}:${baseline}`;
    try {
      const raw = localStorage.getItem(key);
      const saved = decodeManagementDraft(raw, baseline);
      // Loading a browser draft is external synchronization, never a game action.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCandidate(saved ? { key, baseline, value: saved.value } : null);
      if (raw && !saved) localStorage.removeItem(key);
    } catch { /* Recovery is optional when browser storage is unavailable. */ }
    return () => {
      // A soft navigation does not fire pagehide. Preserve its last local edit too.
      if (!latest.current.dirty) return;
      try {
        const encoded = encodeManagementDraft(baseline, JSON.parse(latest.current.serialized));
        if (encoded) localStorage.setItem(key, encoded);
      } catch { /* Recovery remains optional. */ }
    };
  }, [key, baseline]);

  useEffect(() => {
    latest.current = { serialized, dirty };
    if (!key || loaded.current !== `${key}:${baseline}`) return;
    // Preserve the offer until the user explicitly restores or discards it.
    if (!dirty) {
      if (wasDirty.current) try { localStorage.removeItem(key); } catch { /* Optional storage. */ }
      wasDirty.current = false;
      return;
    }
    wasDirty.current = true;
    const write = () => {
      try {
        const encoded = encodeManagementDraft(baseline, JSON.parse(serialized));
        if (encoded) localStorage.setItem(key, encoded);
      } catch { /* Private browsing/quota: saving the real form still works. */ }
    };
    const timer = window.setTimeout(write, 350);
    // Flush only to local storage on reload/close; no network or background work.
    window.addEventListener("pagehide", write);
    return () => { window.clearTimeout(timer); window.removeEventListener("pagehide", write); };
  }, [key, baseline, serialized, dirty]);

  function discard() {
    latest.current = { ...latest.current, dirty: false };
    if (key) try { localStorage.removeItem(key); } catch { /* Optional storage. */ }
    setCandidate(null);
  }

  return {
    discard,
    recovery: candidate?.key === key && candidate.baseline === baseline && !dirty ? (
      <div role="status" className="my-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#D7A51E]/30 bg-[#FFF8E5] px-4 py-3 text-xs font-bold text-[#71580A]">
        <p className="min-w-0 flex-1">Un brouillon récent est disponible sur cet appareil. Rien n’a été appliqué.</p>
        <button type="button" className="min-h-11 rounded-xl bg-[#71580A] px-3 text-white" onClick={() => { restore(candidate.value); discard(); }}>Reprendre les réglages</button>
        <button type="button" className="min-h-11 rounded-xl border border-[#71580A]/25 px-3" onClick={discard}>Ignorer le brouillon</button>
      </div>
    ) : null,
  };
}
