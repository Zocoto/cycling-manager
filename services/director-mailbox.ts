import "server-only";

import type {
  DirectorMailboxFilter,
  DirectorMailboxMessage,
  DirectorMessageType,
} from "@/lib/game/director-mailbox";
import {
  filterDirectorMailboxMessages,
  normalizeDirectorMessageActionLinks,
} from "@/lib/game/director-mailbox";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type DirectorMessageRow = {
  id: string;
  message_type: DirectorMessageType;
  sender_name: string;
  subject: string;
  preview: string;
  body: string;
  action_href: string | null;
  action_label: string | null;
  action_links: unknown;
  is_important: boolean;
  sent_at: string;
  read_at: string | null;
  archived_at: string | null;
};

export type DirectorMailbox = {
  messages: DirectorMailboxMessage[];
  selectedMessage: DirectorMailboxMessage | null;
  counts: {
    inbox: number;
    unread: number;
    important: number;
    archived: number;
  };
};

export async function getCurrentDirectorMailbox(
  supabase: SupabaseServerClient,
  {
    filter,
    query,
    selectedMessageId,
  }: {
    filter: DirectorMailboxFilter;
    query?: string | null;
    selectedMessageId?: string | null;
  },
): Promise<DirectorMailbox> {
  const { data, error } = await supabase
    .from("sporting_director_messages")
    .select(
      "id, message_type, sender_name, subject, preview, body, action_href, action_label, action_links, is_important, sent_at, read_at, archived_at",
    )
    .order("sent_at", { ascending: false })
    .limit(200)
    .returns<DirectorMessageRow[]>();

  if (error) {
    throw new Error(
      `Impossible de charger la boîte mail du DS : ${error.message}`,
    );
  }

  const allMessages = (data ?? []).map(mapDirectorMessage);
  const messages = filterDirectorMailboxMessages({
    messages: allMessages,
    filter,
    query,
  });
  const selectedMessage =
    (selectedMessageId
      ? allMessages.find((message) => message.id === selectedMessageId)
      : null) ??
    messages[0] ??
    null;

  return {
    messages,
    selectedMessage,
    counts: {
      inbox: allMessages.filter((message) => message.archivedAt === null)
        .length,
      unread: allMessages.filter(
        (message) =>
          message.archivedAt === null && message.readAt === null,
      ).length,
      important: allMessages.filter(
        (message) =>
          message.archivedAt === null && message.isImportant,
      ).length,
      archived: allMessages.filter((message) => message.archivedAt !== null)
        .length,
    },
  };
}

function mapDirectorMessage(row: DirectorMessageRow): DirectorMailboxMessage {
  return {
    id: row.id,
    type: row.message_type,
    senderName: row.sender_name,
    subject: row.subject,
    preview: row.preview,
    body: row.body,
    actionHref: row.action_href,
    actionLabel: row.action_label,
    actionLinks: normalizeDirectorMessageActionLinks(row.action_links),
    isImportant: row.is_important,
    sentAt: row.sent_at,
    readAt: row.read_at,
    archivedAt: row.archived_at,
  };
}
