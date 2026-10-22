"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { GAME_NEWS_IMAGES } from "@/lib/game/game-product-news";
import { GAME_NEWS_IMAGE_PREFIX, uploadGameNewsIllustration } from "@/lib/game/game-news-images";

export function GameNewsIllustrationPicker({ value, alt, disabled, onChange, onBusyChange }: {
  value: string; alt: string; disabled: boolean;
  onChange: (path: string) => void; onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const locked = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const busy = disabled || uploading;

  async function upload(file: File | undefined) {
    if (!file || locked.current || disabled) return;
    locked.current = true;
    setUploading(true); onBusyChange(true); setMessage(null);
    try {
      const path = await uploadGameNewsIllustration(file);
      onChange(path);
      setMessage({ error: false, text: "Illustration importée. Enregistrez le brouillon ou publiez pour l’utiliser." });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "L’illustration n’a pas pu être importée. Réessayez." });
    } finally {
      locked.current = false;
      setUploading(false); onBusyChange(false);
    }
  }

  return <section className="mt-5 rounded-xl border border-[#D8E3DE] bg-[#FBFCFA] p-4" aria-labelledby={`${id}-title`} aria-busy={uploading}>
    <input type="hidden" name="image_path" value={value} />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={`${id}-title`} className="text-xs font-bold text-[#315B3E]">Illustration</h3>
      {value ? <button type="button" disabled={busy} onClick={() => { onChange(""); setMessage(null); }} className="text-xs font-bold text-[#8A4B16] underline underline-offset-4 disabled:opacity-50">Retirer l’illustration</button> : null}
    </div>
    {value ? <div className="relative mt-3 aspect-[16/7] max-h-64 overflow-hidden rounded-lg bg-[#0B302B]">
      <Image src={value} alt={alt} unoptimized={value.startsWith(GAME_NEWS_IMAGE_PREFIX)} fill sizes="(max-width:768px) 100vw, 800px" className="object-contain" />
    </div> : null}
    <label htmlFor={`${id}-file`} className="mt-3 block text-xs font-bold text-[#315B3E]">Importer une illustration
      <input id={`${id}-file`} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} aria-describedby={`${id}-help`} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = ""; void upload(file);
      }} className="mt-2 block w-full min-w-0 text-xs text-[#60756E] file:mr-3 file:rounded-lg file:border file:border-[#C7D8CE] file:bg-white file:px-3 file:py-2 file:font-bold file:text-[#315B3E] disabled:opacity-50" />
    </label>
    <p id={`${id}-help`} className="mt-2 text-xs leading-5 text-[#60756E]">PNG, JPEG ou WebP · 2 Mo maximum. L’image est optimisée sans être déformée.</p>
    {uploading ? <p role="status" className="mt-2 text-xs font-semibold text-[#315B3E]">Import de l’illustration…</p> : null}
    {message ? <p role={message.error ? "alert" : "status"} className={`mt-2 text-xs font-semibold leading-5 ${message.error ? "text-[#8A4B16]" : "text-[#176951]"}`}>{message.text}</p> : null}
    <details className="mt-3 border-t border-[#D8E3DE] pt-3">
      <summary className="cursor-pointer text-xs font-bold text-[#315B3E]">Choisir dans la galerie générique</summary>
      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Galerie d’illustrations">
        {GAME_NEWS_IMAGES.map((image) => <button key={image.path} type="button" disabled={busy} aria-pressed={value === image.path} onClick={() => { onChange(image.path); setMessage(null); }} className={`min-w-0 overflow-hidden rounded-lg border bg-white p-1.5 text-left disabled:opacity-50 ${value === image.path ? "border-[#B67A44] ring-2 ring-[#B67A44]/20" : "border-[#D8E3DE] hover:border-[#B67A44]"}`}>
          <span className="relative block aspect-[16/9] overflow-hidden rounded"><Image src={image.path} alt="" fill sizes="(max-width:768px) 30vw, 240px" className="object-cover" /></span>
          <span className="mt-1.5 block break-words text-[11px] font-bold text-[#315B3E]">{image.label}</span>
        </button>)}
      </div>
    </details>
  </section>;
}
