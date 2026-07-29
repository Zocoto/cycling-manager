"use client";

import { useState } from "react";

import {
  GLOBAL_CHAT_CYCLING_REACTIONS,
  GLOBAL_CHAT_EMOJIS,
  type GlobalChatCyclingReactionKey,
} from "@/lib/game/global-chat";

type PickerPanel = "emoji" | "reaction" | null;

const REACTION_POSITIONS: Record<GlobalChatCyclingReactionKey, string> = {
  sprint: "0% 0%",
  climb: "100% 0%",
  attack: "0% 100%",
  victory: "100% 100%",
};

export function GlobalChatMediaPicker({
  onEmojiSelect,
  onReactionSelect,
}: {
  onEmojiSelect: (emoji: string) => void;
  onReactionSelect: (reaction: GlobalChatCyclingReactionKey) => void;
}) {
  const [panel, setPanel] = useState<PickerPanel>(null);

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setPanel((current) =>
          current === "emoji" ? null : "emoji"
        )}
        className="grid h-9 w-9 place-items-center rounded-lg border border-[#315B3E]/15 bg-[#F3F8F6] text-lg transition hover:border-[#176951]/35 hover:bg-[#E4F4EC]"
        aria-label="Ajouter un émoji"
        aria-expanded={panel === "emoji"}
      >
        😊
      </button>
      <button
        type="button"
        onClick={() => setPanel((current) =>
          current === "reaction" ? null : "reaction"
        )}
        className="h-9 rounded-lg border border-[#315B3E]/15 bg-[#F3F8F6] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#176951] transition hover:border-[#176951]/35 hover:bg-[#E4F4EC]"
        aria-label="Ajouter une réaction cycliste animée"
        aria-expanded={panel === "reaction"}
      >
        GIF 🚴
      </button>

      {panel ? (
        <div className="absolute bottom-12 left-0 z-30 w-[min(20rem,calc(100vw-3rem))] rounded-2xl border border-[#315B3E]/15 bg-white p-3 shadow-[0_18px_50px_rgba(7,26,23,0.2)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#176951]">
              {panel === "emoji" ? "Émojis" : "Réactions cyclistes"}
            </p>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="grid h-7 w-7 place-items-center rounded-full bg-[#F3F8F6] text-xs font-black text-[#60756E] hover:bg-[#E4F4EC]"
              aria-label="Fermer le sélecteur"
            >
              ×
            </button>
          </div>

          {panel === "emoji" ? (
            <div className="grid grid-cols-5 gap-1.5">
              {GLOBAL_CHAT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onEmojiSelect(emoji);
                    setPanel(null);
                  }}
                  className="grid aspect-square place-items-center rounded-lg bg-[#F7FBF9] text-xl transition hover:scale-105 hover:bg-[#E4F4EC]"
                  aria-label={`Ajouter ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {GLOBAL_CHAT_CYCLING_REACTIONS.map((reaction) => (
                <button
                  key={reaction.key}
                  type="button"
                  onClick={() => {
                    onReactionSelect(reaction.key);
                    setPanel(null);
                  }}
                  className="group rounded-xl border border-[#315B3E]/12 bg-[#F7FBF9] p-2 text-left transition hover:border-[#176951]/35 hover:bg-[#EAF7F1]"
                  aria-label={`Ajouter la réaction ${reaction.label}`}
                >
                  <CyclingReactionSticker
                    reactionKey={reaction.key}
                    compact
                    decorative
                  />
                  <span className="mt-1 block text-center text-[9px] font-black uppercase tracking-[0.08em] text-[#315B3E]">
                    {reaction.label}
                  </span>
                </button>
              ))}
            </div>
          )}
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

  return (
    <span
      className={`cm-chat-cycling-reaction relative block overflow-hidden rounded-xl ${
        compact ? "aspect-square w-full" : "aspect-square w-36 max-w-full"
      }`}
      data-reaction={reactionKey}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `Réaction cycliste : ${reaction?.label ?? reactionKey}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/images/chat/cycling-reactions.webp')] bg-[length:200%_200%] bg-no-repeat"
        style={{ backgroundPosition: REACTION_POSITIONS[reactionKey] }}
      />
    </span>
  );
}