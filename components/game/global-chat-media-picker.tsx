"use client";

import { useState } from "react";

import {
  GLOBAL_CHAT_CYCLING_REACTIONS,
  GLOBAL_CHAT_EMOJIS,
  type GlobalChatCyclingReactionKey,
} from "@/lib/game/global-chat";

const LEGACY_REACTION_POSITIONS: Partial<
  Record<GlobalChatCyclingReactionKey, string>
> = {
  sprint: "0% 0%",
  climb: "100% 0%",
  attack: "0% 100%",
  victory: "100% 100%",
};

const CUSTOM_REACTION_SOURCES: Partial<
  Record<GlobalChatCyclingReactionKey, string>
> = {
  train: "/images/chat/reactions/team-train.gif",
  late_attack: "/images/chat/reactions/tactical-attack.gif",
  feed_zone: "/images/chat/reactions/feed-zone-chaos.gif",
  puncture: "/images/chat/reactions/flat-tire-shrug.gif",
  too_early: "/images/chat/reactions/early-celebration.gif",
  snack_attack: "/images/chat/reactions/gel-spray.gif",
};

export function GlobalChatMediaPicker({
  onEmojiSelect,
}: {
  onEmojiSelect: (emoji: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-1.5">
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

export function CyclingReactionSticker({
  reactionKey,
  compact = false,
  decorative = false,
}: {
  reactionKey: GlobalChatCyclingReactionKey;
  compact?: boolean;
  decorative?: boolean;
}) {
  const reaction = GLOBAL_CHAT_CYCLING_REACTIONS.find(
    (candidate) => candidate.key === reactionKey,
  );
  const customSource = CUSTOM_REACTION_SOURCES[reactionKey];

  return (
    <span
      className={`cm-chat-cycling-reaction relative block overflow-hidden rounded-xl ${
        compact
          ? `${customSource ? "aspect-[4/3]" : "aspect-square"} w-full`
          : `${
              customSource ? "aspect-[4/3] w-48" : "aspect-square w-36"
            } max-w-full`
      }`}
      data-reaction={reactionKey}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={
        decorative
          ? undefined
          : `Réaction cycliste : ${reaction?.label ?? reactionKey}`
      }
    >
      {customSource ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${customSource}')` }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[url('/images/chat/cycling-reactions.webp')] bg-[length:200%_200%] bg-no-repeat"
          style={{
            backgroundPosition:
              LEGACY_REACTION_POSITIONS[reactionKey] ?? "0% 0%",
          }}
        />
      )}
    </span>
  );
}
