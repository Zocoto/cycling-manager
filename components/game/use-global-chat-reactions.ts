"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";

import { toggleGlobalChatMessageReactionAction } from "@/app/jeu/chat/reaction-actions";
import {
  isGlobalChatMessageReactionEmoji,
  type GlobalChatMessageReactionEmoji,
} from "@/lib/game/global-chat";
import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  GlobalChatIdentity,
  GlobalChatMessage,
  GlobalChatReactionRow,
  GlobalChatReactionMember,
} from "@/services/global-chat";

export function useGlobalChatReactions({
  supabase,
  identity,
  setMessages,
}: {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  identity: GlobalChatIdentity;
  setMessages: Dispatch<SetStateAction<GlobalChatMessage[]>>;
}) {
  const [pendingReactionKey, setPendingReactionKey] = useState<string | null>(
    null,
  );
  const pendingReactionKeyRef = useRef<string | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [isReactionPending, startReactionTransition] = useTransition();

  useEffect(() => {
    const channel = supabase
      .channel("global-game-chat-reactions:v1")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "global_chat_message_reactions",
        },
        (payload: {
          eventType: string;
          new: Record<string, unknown>;
          old: Record<string, unknown>;
        }) => {
          const row = readRealtimeReaction(
            payload.eventType === "DELETE" ? payload.old : payload.new,
          );
          if (!row) return;

          setMessages((current) =>
            updateMessageReaction(current, row, payload.eventType !== "DELETE"),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [setMessages, supabase]);

  function toggleMessageReaction(
    messageId: string,
    emoji: GlobalChatMessageReactionEmoji,
  ) {
    const reactionKey = messageId + ":" + emoji;
    if (pendingReactionKeyRef.current) return;
    pendingReactionKeyRef.current = reactionKey;

    setReactionError(null);
    setPendingReactionKey(reactionKey);
    startReactionTransition(async () => {
      try {
        const { active } = await toggleGlobalChatMessageReactionAction(
          messageId,
          emoji,
        );
        setMessages((current) =>
          updateMessageReaction(
            current,
            {
              message_id: messageId,
              sporting_director_id: identity.sportingDirectorId,
              reactor_display_name: identity.displayName,
              team_id: identity.teamId,
              team_display_name: identity.teamName,
              emoji,
            },
            active,
          ),
        );
      } catch (error) {
        setReactionError(
          error instanceof Error
            ? error.message
            : "La réaction n’a pas pu être enregistrée.",
        );
      } finally {
        pendingReactionKeyRef.current = null;
        setPendingReactionKey(null);
      }
    });
  }

  return {
    pendingReactionKey,
    isReactionPending,
    reactionError,
    toggleMessageReaction,
  };
}

export function updateMessageReaction(
  messages: GlobalChatMessage[],
  row: GlobalChatReactionRow,
  active: boolean,
) {
  return messages.map((message) => {
    if (message.id !== row.message_id) return message;

    const reactions = message.reactions.map((reaction) => ({
      ...reaction,
      sportingDirectorIds: [...reaction.sportingDirectorIds],
      members: [...reaction.members],
    }));
    const reactionIndex = reactions.findIndex(
      (reaction) => reaction.emoji === row.emoji,
    );

    if (!active) {
      if (reactionIndex < 0) return message;
      const reaction = reactions[reactionIndex];
      reaction.sportingDirectorIds = reaction.sportingDirectorIds.filter(
        (directorId) => directorId !== row.sporting_director_id,
      );
      reaction.members = reaction.members.filter(
        (member) => member.sportingDirectorId !== row.sporting_director_id,
      );
      if (reaction.members.length === 0) {
        reactions.splice(reactionIndex, 1);
      }
      return { ...message, reactions };
    }

    const member = readReactionMember(row);
    if (!member) return message;

    if (reactionIndex >= 0) {
      const reaction = reactions[reactionIndex];
      if (!reaction.sportingDirectorIds.includes(row.sporting_director_id)) {
        reaction.sportingDirectorIds.push(row.sporting_director_id);
      }
      if (
        !reaction.members.some(
          (candidate) =>
            candidate.sportingDirectorId === member.sportingDirectorId,
        )
      ) {
        reaction.members.push(member);
      }
    } else {
      reactions.push({
        emoji: row.emoji,
        sportingDirectorIds: [row.sporting_director_id],
        members: [member],
      });
    }

    return { ...message, reactions };
  });
}

function readRealtimeReaction(
  value: Record<string, unknown>,
): GlobalChatReactionRow | null {
  if (
    typeof value.message_id !== "string" ||
    typeof value.sporting_director_id !== "string" ||
    !isGlobalChatMessageReactionEmoji(value.emoji)
  ) {
    return null;
  }

  return {
    message_id: value.message_id,
    sporting_director_id: value.sporting_director_id,
    reactor_display_name: readNullableString(value.reactor_display_name),
    team_id: readNullableString(value.team_id),
    team_display_name: readNullableString(value.team_display_name),
    emoji: value.emoji,
  };
}

function readReactionMember(
  row: GlobalChatReactionRow,
): GlobalChatReactionMember | null {
  if (!row.reactor_display_name || !row.team_id || !row.team_display_name) {
    return null;
  }

  return {
    sportingDirectorId: row.sporting_director_id,
    displayName: row.reactor_display_name,
    teamId: row.team_id,
    teamDisplayName: row.team_display_name,
  };
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
