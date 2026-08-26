import "server-only";

import {
  DIRECT_CONVERSATION_PAGE_SIZE,
  DIRECT_MESSAGE_INITIAL_LIMIT,
  DIRECT_MESSAGE_PAGE_SIZE,
  type DirectConversationCursor,
  type DirectMessageCursor,
} from "@/lib/game/direct-messages";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type DirectConversation = {
  id: string;
  counterpartDirectorId: string;
  counterpartDisplayName: string;
  counterpartAvatarKey: string | null;
  counterpartAvatarFrameKey: "alpha_tester" | null;
  counterpartTeamId: string | null;
  counterpartTeamName: string;
  lastMessageBody: string | null;
  lastMessageSenderId: string | null;
  lastActivityAt: string;
  unreadCount: number;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
};

export type DirectMessageRecipient = {
  sportingDirectorId: string;
  displayName: string;
  avatarKey: string | null;
  avatarFrameKey: "alpha_tester" | null;
  teamId: string;
  teamName: string;
};

export type DirectConversationPage = {
  conversations: DirectConversation[];
  hasMore: boolean;
  nextCursor: DirectConversationCursor | null;
};

export type DirectMessagePage = {
  messages: DirectMessage[];
  hasMore: boolean;
  nextCursor: DirectMessageCursor | null;
};

type DirectConversationRow = {
  conversation_id: string;
  counterpart_director_id: string;
  counterpart_display_name: string;
  counterpart_avatar_key: string | null;
  counterpart_avatar_frame_key: string | null;
  counterpart_team_id: string | null;
  counterpart_team_name: string;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  last_activity_at: string;
  unread_count: number | string | null;
};

export type DirectMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
};

type DirectMessageRecipientRow = {
  sporting_director_id: string;
  display_name: string;
  avatar_key: string | null;
  avatar_frame_key: string | null;
  team_id: string;
  team_name: string;
};

const DIRECT_MESSAGE_SELECT = [
  "id",
  "conversation_id",
  "sender_id",
  "recipient_id",
  "body",
  "created_at",
  "edited_at",
].join(", ");

export async function getDirectMessagingOverview(
  supabase: SupabaseServerClient,
): Promise<{
  conversationPage: DirectConversationPage;
  totalUnreadCount: number;
}> {
  const [conversationPage, unreadResult] = await Promise.all([
    getDirectConversationPage(supabase),
    supabase.rpc("get_current_unread_direct_message_count"),
  ]);

  if (unreadResult.error) {
    throw new Error(
      `Impossible de charger les MP non lus : ${unreadResult.error.message}`,
    );
  }

  return {
    conversationPage,
    totalUnreadCount: Math.max(0, Number(unreadResult.data ?? 0)),
  };
}

export async function getCurrentDirectUnreadCount(
  supabase: SupabaseServerClient,
) {
  const { data, error } = await supabase.rpc(
    "get_current_unread_direct_message_count",
  );

  if (error) {
    throw new Error(
      `Impossible de charger les MP non lus : ${error.message}`,
    );
  }

  return Math.max(0, Number(data ?? 0));
}

export async function getDirectConversationPage(
  supabase: SupabaseServerClient,
  {
    before = null,
    limit = DIRECT_CONVERSATION_PAGE_SIZE,
  }: {
    before?: DirectConversationCursor | null;
    limit?: number;
  } = {},
): Promise<DirectConversationPage> {
  const pageSize = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const { data, error } = await supabase.rpc(
    "get_current_direct_conversations",
    {
      p_before_activity_at: before?.lastActivityAt ?? null,
      p_before_id: before?.id ?? null,
      p_limit: pageSize + 1,
    },
  );

  if (error) {
    throw new Error(
      `Impossible de charger les conversations privées : ${error.message}`,
    );
  }

  const rows = (data as DirectConversationRow[] | null) ?? [];
  const hasMore = rows.length > pageSize;
  const selectedRows = rows.slice(0, pageSize);
  const oldestRow = selectedRows.at(-1) ?? null;

  return {
    conversations: selectedRows.map(mapDirectConversation),
    hasMore,
    nextCursor:
      hasMore && oldestRow
        ? {
            lastActivityAt: new Date(
              oldestRow.last_activity_at,
            ).toISOString(),
            id: oldestRow.conversation_id,
          }
        : null,
  };
}

export async function getDirectConversation(
  supabase: SupabaseServerClient,
  conversationId: string,
): Promise<DirectConversation | null> {
  const { data, error } = await supabase.rpc(
    "get_current_direct_conversation",
    { p_conversation_id: conversationId },
  );

  if (error) {
    throw new Error(
      `Impossible de charger cette conversation privée : ${error.message}`,
    );
  }

  const row = ((data as DirectConversationRow[] | null) ?? [])[0];
  return row ? mapDirectConversation(row) : null;
}

export async function getDirectMessagePage(
  supabase: SupabaseServerClient,
  conversationId: string,
  {
    before = null,
    limit = DIRECT_MESSAGE_PAGE_SIZE,
  }: {
    before?: DirectMessageCursor | null;
    limit?: number;
  } = {},
): Promise<DirectMessagePage> {
  const pageSize = Math.min(
    Math.max(Math.trunc(limit), 1),
    DIRECT_MESSAGE_INITIAL_LIMIT,
  );
  let query = supabase
    .from("direct_messages")
    .select(DIRECT_MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (before) {
    query = query.or(
      `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`,
    );
  }

  const { data, error } = await query.limit(pageSize + 1);

  if (error) {
    throw new Error(
      `Impossible de charger les messages privés : ${error.message}`,
    );
  }

  const rows = (data as unknown as DirectMessageRow[] | null) ?? [];
  const hasMore = rows.length > pageSize;
  const selectedRows = rows.slice(0, pageSize);
  const oldestRow = selectedRows.at(-1) ?? null;

  return {
    messages: selectedRows.reverse().map(mapDirectMessage),
    hasMore,
    nextCursor:
      hasMore && oldestRow
        ? {
            createdAt: new Date(oldestRow.created_at).toISOString(),
            id: oldestRow.id,
          }
        : null,
  };
}

export async function searchDirectMessageRecipients(
  supabase: SupabaseServerClient,
  query: string,
): Promise<DirectMessageRecipient[]> {
  const { data, error } = await supabase.rpc(
    "search_current_direct_message_recipients",
    {
      p_query: query,
      p_limit: 8,
    },
  );

  if (error) {
    throw new Error(
      `Impossible de rechercher un destinataire : ${error.message}`,
    );
  }

  return ((data as DirectMessageRecipientRow[] | null) ?? []).map((row) => ({
    sportingDirectorId: row.sporting_director_id,
    displayName: row.display_name,
    avatarKey: row.avatar_key,
    avatarFrameKey: readAvatarFrameKey(row.avatar_frame_key),
    teamId: row.team_id,
    teamName: row.team_name,
  }));
}

export function mapDirectMessage(row: DirectMessageRow): DirectMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

function mapDirectConversation(
  row: DirectConversationRow,
): DirectConversation {
  return {
    id: row.conversation_id,
    counterpartDirectorId: row.counterpart_director_id,
    counterpartDisplayName: row.counterpart_display_name,
    counterpartAvatarKey: row.counterpart_avatar_key,
    counterpartAvatarFrameKey: readAvatarFrameKey(
      row.counterpart_avatar_frame_key,
    ),
    counterpartTeamId: row.counterpart_team_id,
    counterpartTeamName: row.counterpart_team_name,
    lastMessageBody: row.last_message_body,
    lastMessageSenderId: row.last_message_sender_id,
    lastActivityAt: new Date(row.last_activity_at).toISOString(),
    unreadCount: Math.max(0, Number(row.unread_count ?? 0)),
  };
}

function readAvatarFrameKey(value: string | null): "alpha_tester" | null {
  return value === "alpha_tester" ? value : null;
}
