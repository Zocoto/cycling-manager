"use client";

import { useState } from "react";
import type { ChatImageAttachment } from "@/lib/game/chat-images";

export function ChatImage({ image, author }: { image: ChatImageAttachment; author: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p role="status" className="mt-2 text-xs font-semibold opacity-70">Image indisponible.</p>;
  return (
    <a href={image.href} target="_blank" rel="noopener noreferrer" className="mt-3 block w-fit max-w-full overflow-hidden rounded-xl border border-current/10" aria-label={`Agrandir l’image partagée par ${author}`}>
      {/* A protected Storage redirect already serves a resized WebP; no duplicate Next image transformation. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.href} alt={`Image partagée par ${author}`} width={image.width} height={image.height} loading="lazy" decoding="async" onError={() => setFailed(true)} className="max-h-72 max-w-full object-contain" style={{ width: Math.min(image.width, 420), height: "auto" }} />
    </a>
  );
}

export function ChatImageDraftPreview({ src, disabled, onRemove }: { src: string; disabled: boolean; onRemove: () => void }) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border border-[#176951]/20 bg-[#F3F8F6] p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Aperçu de l’image à envoyer" className="h-20 max-w-36 rounded-lg object-contain" />
      <p className="min-w-0 flex-1 text-xs font-semibold text-[#60756E]">Image jointe · ajoutez un message si vous le souhaitez.</p>
      <button type="button" disabled={disabled} onClick={onRemove} aria-label="Retirer l’image" className="h-8 w-8 shrink-0 rounded-full bg-white font-black text-[#60756E] hover:text-red-700 disabled:opacity-50">×</button>
    </div>
  );
}
