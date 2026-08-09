"use client";

import { useState } from "react";

import Link from "@/components/ui/app-link";
import {
  GLOBAL_CHAT_MESSAGE_REACTION_EMOJIS,
  type GlobalChatMessageReactionEmoji,
} from "@/lib/game/global-chat";
import type {
  GlobalChatMessage,
  GlobalChatMessageReaction,
} from "@/services/global-chat";

export function GlobalChatMessageReactions({
  message,
  isCurrentDirector,
  currentDirectorId,
  pendingReactionKey,
  reactionsDisabled,
  onReply,
  onReaction,
}: {
  message: GlobalChatMessage;
  isCurrentDirector: boolean;
  currentDirectorId: string;
  pendingReactionKey: string | null;
  reactionsDisabled: boolean;
  onReply?: (message: GlobalChatMessage) => void;
  onReaction: (
    messageId: string,
    emoji: GlobalChatMessageReactionEmoji,
  ) => void;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const actionClass = isCurrentDirector
    ? "border-white/15 bg-white/10 text-white/75 hover:bg-white/20 hover:text-white"
    : "border-[#176951]/15 bg-[#F3F8F6] text-[#60756E] hover:border-[#176951]/35 hover:text-[#176951]";

  return (
    <div className="relative mt-2.5 flex flex-wrap items-center gap-1.5">
      {message.reactions.map((reaction) => (
        <ReactionPill
          key={reaction.emoji}
          messageId={message.id}
          reaction={reaction}
          currentDirectorId={currentDirectorId}
          pendingReactionKey={pendingReactionKey}
          reactionsDisabled={reactionsDisabled}
          actionClass={actionClass}
          onReaction={onReaction}
        />
      ))}

      {onReply ? (
        <button
          type="button"
          onClick={() => onReply(message)}
          className={[
            "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-black transition",
            actionClass,
          ].join(" ")}
          aria-label={"Répondre à " + message.authorDisplayName}
        >
          <span aria-hidden="true">↩</span>
          Répondre
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setIsPickerOpen((current) => !current)}
        className={[
          "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-black transition",
          actionClass,
        ].join(" ")}
        aria-label="Ajouter une réaction"
        aria-expanded={isPickerOpen}
      >
        <span aria-hidden="true">☺</span>
        Réagir
      </button>

      {isPickerOpen ? (
        <div
          className={[
            "absolute bottom-9 z-30 grid grid-cols-6 gap-1 rounded-xl border p-2 shadow-xl",
            isCurrentDirector
              ? "right-0 border-white/15 bg-[#0B302B]"
              : "left-0 border-[#176951]/15 bg-white",
          ].join(" ")}
          role="group"
          aria-label="Réactions au message"
        >
          {GLOBAL_CHAT_MESSAGE_REACTION_EMOJIS.map((emoji) => {
            const reactionKey = message.id + ":" + emoji;
            return (
              <button
                key={emoji}
                type="button"
                disabled={reactionsDisabled}
                aria-busy={
                  reactionsDisabled && pendingReactionKey === reactionKey
                }
                onClick={() => {
                  onReaction(message.id, emoji);
                  setIsPickerOpen(false);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg text-lg transition hover:bg-[#DDF3E7] disabled:opacity-50"
                aria-label={"Réagir avec " + emoji}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ReactionPill({
  messageId,
  reaction,
  currentDirectorId,
  pendingReactionKey,
  reactionsDisabled,
  actionClass,
  onReaction,
}: {
  messageId: string;
  reaction: GlobalChatMessageReaction;
  currentDirectorId: string;
  pendingReactionKey: string | null;
  reactionsDisabled: boolean;
  actionClass: string;
  onReaction: (
    messageId: string,
    emoji: GlobalChatMessageReactionEmoji,
  ) => void;
}) {
  const isActive = reaction.members.some(
    (member) => member.sportingDirectorId === currentDirectorId,
  );
  const reactionKey = messageId + ":" + reaction.emoji;
  const memberNames = reaction.members
    .map((member) => member.displayName + " (" + member.teamDisplayName + ")")
    .join(", ");
  const reactionLabel =
    reaction.emoji +
    ", " +
    reaction.members.length +
    " réaction" +
    (reaction.members.length > 1 ? "s" : "") +
    " : " +
    memberNames;

  return (
    <span className="group/reaction relative">
      <button
        type="button"
        disabled={reactionsDisabled}
        aria-busy={reactionsDisabled && pendingReactionKey === reactionKey}
        onClick={() => onReaction(messageId, reaction.emoji)}
        className={[
          "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-black transition disabled:opacity-50",
          isActive
            ? "border-[#F2C94C] bg-[#FFF4C4] text-[#493A00]"
            : actionClass,
        ].join(" ")}
        aria-pressed={isActive}
        aria-label={reactionLabel}
        title={memberNames}
      >
        <span aria-hidden="true">{reaction.emoji}</span>
        <span>{reaction.members.length}</span>
      </button>

      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-9 left-0 z-40 hidden w-64 rounded-xl border border-[#176951]/15 bg-white p-2.5 text-left text-[#0B302B] shadow-[0_14px_40px_rgba(7,26,23,0.24)] group-hover/reaction:block group-focus-within/reaction:pointer-events-auto group-focus-within/reaction:block"
      >
        <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-[#278B70]">
          {reaction.emoji} Membres ayant réagi
        </span>
        <span className="grid gap-1">
          {reaction.members.map((member) => (
            <Link
              key={member.sportingDirectorId}
              href={"/jeu/equipes/" + member.teamId}
              className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-[#EAF7F1]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#176951] text-[8px] font-black text-white">
                {getInitials(member.displayName)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-black">
                  {member.displayName}
                </span>
                <span className="block truncate text-[9px] font-semibold text-[#789087]">
                  {member.teamDisplayName}
                </span>
              </span>
            </Link>
          ))}
        </span>
      </span>
    </span>
  );
}

function getInitials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toLocaleUpperCase("fr-FR") || "DS"
  );
}
