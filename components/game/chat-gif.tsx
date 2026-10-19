"use client";

import { useState } from "react";
import type { ChatGifAttachment } from "@/lib/game/chat-gifs";

export function ChatGif({ gif }: { gif: ChatGifAttachment }) {
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  if (unavailable) return <p className="mt-3 rounded-xl bg-[#EAF5F0] p-4 text-xs text-[#60756E]">Média indisponible <span data-i18n-skip>· KLIPY</span></p>;
  const media = <>
    {/* Direct KLIPY URLs: never proxy, optimize, cache or rewrite provider media. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={playing || gif.kind === "meme" ? gif.url : gif.previewUrl} alt={gif.title} width={gif.width} height={gif.height}
      onError={() => setUnavailable(true)} loading="lazy" decoding="async" className="max-h-72 w-full object-contain" />
    <span data-i18n-skip className="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold text-white">KLIPY</span>
  </>;
  if (gif.kind === "meme") return <figure className="relative mt-3 max-w-full overflow-hidden rounded-xl bg-[#DCECE4]" style={{ width: Math.min(320, gif.width) }}>{media}</figure>;
  return <button type="button" onClick={() => setPlaying(value => !value)} aria-label={playing ? "Mettre le GIF en pause" : `Lire ${gif.title}`}
    className="relative mt-3 block max-w-full overflow-hidden rounded-xl bg-[#DCECE4] text-left" style={{ width: Math.min(320, gif.width) }}>
    {media}
    <span aria-hidden="true" className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-1 text-[10px] font-black text-white">{playing ? "Ⅱ" : "▶"} GIF</span>
  </button>;
}

export function ChatGifDraft({ gif, onRemove, disabled }: { gif: ChatGifAttachment; onRemove: () => void; disabled: boolean }) {
  return <div className="mb-2 flex items-center gap-3 rounded-xl border border-[#176951]/20 bg-[#EAF5F0] p-2">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={gif.previewUrl} alt={gif.title} className="h-16 w-20 rounded-lg object-cover" />
    <span className="min-w-0 flex-1 truncate text-xs font-bold">{gif.title}</span>
    <button type="button" disabled={disabled} onClick={onRemove} aria-label="Retirer le GIF" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white font-black text-[#60756E]">×</button>
  </div>;
}
