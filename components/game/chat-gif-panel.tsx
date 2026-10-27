"use client";

import { useEffect, useState } from "react";
import { buildKlipySearchUrl, readKlipyPage, type ChatGifAttachment } from "@/lib/game/chat-gifs";
import { getKlipyCustomerId } from "@/lib/game/klipy-client";
import { requestKlipyPage } from "@/lib/game/klipy-request";

export function ChatGifPanel({ appKey, onSelect }: { appKey: string; onSelect: (media: ChatGifAttachment) => void }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"gif" | "meme">("gif");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{ query: string; kind: string; page: number; items: ReturnType<typeof readKlipyPage>["items"]; hasNext: boolean; error?: string } | null>(null);
  const shortQuery = query.length > 0 && query.trim().length < 2;
  const loading = Boolean(appKey && !shortQuery && (response?.query !== query || response?.kind !== kind || response?.page !== page));
  useEffect(() => {
    if (!appKey || shortQuery) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await requestKlipyPage(
          buildKlipySearchUrl(appKey, query, kind, page, getKlipyCustomerId()), kind, controller.signal,
        );
        if (controller.signal.aborted) return;
        setResponse((previous) => ({ query, kind, page, hasNext: result.hasNext,
          items: page > 1 && previous?.query === query && previous.kind === kind
            ? [...previous.items, ...result.items.map(item => ({ ...item, key: `${page}-${item.key}` }))] : result.items }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setResponse({ query, kind, page, items: [], hasNext: false,
          error: error instanceof Error ? error.message : "Les GIF sont momentanément indisponibles." });
      }
    }, query ? 450 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [appKey, query, kind, page, retry, shortQuery]);

  return <>
    <div className="shrink-0 space-y-3 border-b border-[#315B3E]/10 bg-white px-4 pb-3 pt-2">
      <div className="flex gap-2" aria-label="Type de média">
        {(["gif", "meme"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value}
          onClick={() => { setKind(value); setPage(1); }} className={`min-h-10 flex-1 rounded-xl text-sm font-black ${kind === value ? "bg-[#176951] text-white" : "bg-[#EAF5F0] text-[#176951]"}`}>{value === "gif" ? "GIF" : "Mèmes"}</button>)}
      </div>
      <label className="block">
        <span className="sr-only">Rechercher un GIF ou un mème</span>
        <input type="search" value={query} maxLength={80} disabled={!appKey} placeholder="Search KLIPY"
          onChange={(event) => { setQuery(event.target.value); setPage(1); }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
          className="h-12 w-full rounded-xl border border-[#315B3E]/20 bg-[#F7FBF9] px-4 text-base font-semibold outline-none focus:border-[#176951] disabled:opacity-50" />
      </label>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" aria-busy={loading}>
      {!appKey ? <p role="status" className="px-4 py-12 text-center text-sm font-semibold leading-6 text-[#60756E]">Les GIF arrivent bientôt dans le peloton.</p> :
        shortQuery ? <p role="status" className="p-6 text-center text-sm text-[#60756E]">Saisissez au moins deux caractères.</p> :
        response?.error && !loading ? <div role="alert" className="p-6 text-center text-sm text-[#60756E]">
          <p>{response.error}</p><button type="button" onClick={() => { setResponse(null); setPage(1); setRetry(value => value + 1); }} className="mt-4 min-h-11 rounded-xl bg-[#EAF5F0] px-5 font-black text-[#176951]">Réessayer</button>
        </div> : <>
          <div className="grid grid-cols-2 gap-2">
            {(response?.query === query && response.kind === kind ? response.items : []).map((item) => item.media ?
              <button key={item.key} type="button" disabled={loading} onClick={() => onSelect(item.media!)} aria-label={`Choisir ${item.media.title}`}
                className="relative grid min-h-28 place-items-center overflow-hidden rounded-xl bg-[#DCECE4] focus-visible:ring-2 focus-visible:ring-[#176951] disabled:opacity-60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.media.previewUrl} alt={item.media.title} loading="lazy" decoding="async" className="h-36 w-full object-cover" />
              </button> : <div key={item.key} className="grid h-36 place-items-center rounded-xl bg-[#EAF5F0] text-xs text-[#60756E]">Média indisponible</div>)}
          </div>
          {loading ? <p role="status" className="p-6 text-center text-sm font-semibold text-[#60756E]">Recherche…</p> :
            response && response.items.length === 0 ? <p role="status" className="p-6 text-center text-sm text-[#60756E]">Aucun résultat pour cette recherche.</p> : null}
          {!loading && response?.hasNext ? <button type="button" onClick={() => setPage(value => value + 1)} className="mt-3 min-h-11 w-full rounded-xl bg-white text-sm font-black text-[#176951]">Voir plus</button> : null}
        </>}
    </div>
    <p className="shrink-0 border-t border-[#315B3E]/10 bg-white px-4 py-2 text-center text-[10px] font-bold text-[#789087]" data-i18n-skip>Powered by KLIPY</p>
  </>;
}
