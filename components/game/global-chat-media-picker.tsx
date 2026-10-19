"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChatMediaDialog } from "./chat-media-dialog";
import { ChatEmojiPanel } from "./chat-emoji-panel";
import type { ChatGifAttachment } from "@/lib/game/chat-gifs";
const ChatGifPanel = dynamic(() => import("./chat-gif-panel").then(module => module.ChatGifPanel), { loading: () => <p role="status" className="p-6 text-sm">Chargement…</p> });

import {
  GLOBAL_CHAT_CYCLING_REACTIONS,
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

export function GlobalChatMediaPicker({ onEmojiSelect, onGifSelect, klipyAppKey = "", disabled = false }: {
  onEmojiSelect: (emoji: string) => void;
  onGifSelect?: (media: ChatGifAttachment) => void;
  klipyAppKey?: string;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"emoji" | "gif" | null>(null);
  const buttonClass = "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#315B3E]/15 bg-[#F3F8F6] transition hover:border-[#176951]/35 hover:bg-[#E4F4EC] disabled:opacity-50";
  return <div className="flex items-center gap-1.5">
    <button type="button" disabled={disabled} onClick={() => setMode("emoji")} className={buttonClass + " text-lg"} aria-label="Ajouter un émoji" aria-haspopup="dialog" aria-expanded={mode === "emoji"}>😊</button>
    {onGifSelect ? <button type="button" disabled={disabled} onClick={() => setMode("gif")} className={buttonClass + " text-[10px] font-black text-[#176951]"} aria-label="Ajouter un GIF" aria-haspopup="dialog" aria-expanded={mode === "gif"}>GIF</button> : null}
    {mode ? <ChatMediaDialog title={mode === "emoji" ? "Émojis" : "GIF et mèmes"} onClose={() => setMode(null)}>
      {mode === "emoji" ? <ChatEmojiPanel onSelect={emoji => { onEmojiSelect(emoji); setMode(null); }} /> :
        <ChatGifPanel appKey={klipyAppKey} onSelect={media => { onGifSelect?.(media); setMode(null); }} />}
    </ChatMediaDialog> : null}
  </div>;
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
