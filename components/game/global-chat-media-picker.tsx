"use client";

import { useState } from "react";

import { GLOBAL_CHAT_EMOJIS } from "@/lib/game/global-chat";

export function GlobalChatMediaPicker({
  onEmojiSelect,
}: {
  onEmojiSelect: (emoji: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-[#315B3E]/15 bg-[#F3F8F6] text-lg transition hover:border-[#176951]/35 hover:bg-[#E4F4EC]"
        aria-label="Ajouter un émoji"
        aria-expanded={isOpen}
      >
        😊
      </button>

      {isOpen ? (
        <div className="absolute bottom-12 left-0 z-30 w-[min(23rem,calc(100vw-3rem))] rounded-2xl border border-[#315B3E]/15 bg-white p-3 shadow-[0_18px_50px_rgba(7,26,23,0.2)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#176951]">
              Émojis
            </p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-full bg-[#F3F8F6] text-xs font-black text-[#60756E] hover:bg-[#E4F4EC]"
              aria-label="Fermer le sélecteur"
            >
              ×
            </button>
          </div>

          <div className="grid max-h-52 grid-cols-7 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-8">
            {GLOBAL_CHAT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onEmojiSelect(emoji);
                  setIsOpen(false);
                }}
                className="grid aspect-square place-items-center rounded-lg bg-[#F7FBF9] text-xl transition hover:scale-105 hover:bg-[#E4F4EC]"
                aria-label={`Ajouter ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
