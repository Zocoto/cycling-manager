"use client";

import { useState } from "react";
import { CHAT_EMOJI_CATEGORIES } from "@/lib/game/chat-emojis";

export function ChatEmojiPanel({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [category, setCategory] = useState<string>(CHAT_EMOJI_CATEGORIES[0].key);
  const selected = CHAT_EMOJI_CATEGORIES.find((item) => item.key === category) ?? CHAT_EMOJI_CATEGORIES[0];
  return <>
    <nav aria-label="Catégories d’émojis" className="flex shrink-0 justify-around gap-1 border-b border-[#315B3E]/10 bg-white px-3 py-2">
      {CHAT_EMOJI_CATEGORIES.map((item) => <button key={item.key} type="button" title={item.label}
        aria-label={item.label} aria-pressed={category === item.key} onClick={() => setCategory(item.key)}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl ${category === item.key ? "bg-[#DDF3E7] ring-1 ring-[#176951]/25" : "hover:bg-[#EAF5F0]"}`}>
        {item.icon}
      </button>)}
    </nav>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
      <p className="mb-3 px-1 text-xs font-black text-[#60756E]">{selected.label}</p>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        {selected.emojis.split(" ").map((emoji) => <button key={emoji} type="button" onClick={() => onSelect(emoji)}
          aria-label={`Ajouter ${emoji}`} className="grid aspect-square min-h-11 place-items-center rounded-xl bg-white text-2xl transition hover:bg-[#DDF3E7] active:scale-90">{emoji}</button>)}
      </div>
    </div>
  </>;
}
