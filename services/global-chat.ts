import "server-only";

import {
  GLOBAL_CHAT_INITIAL_MESSAGE_LIMIT,
  GLOBAL_CHAT_MESSAGE_PAGE_SIZE,
  getGlobalChatHistoryStart,
  type GlobalChatCursor,
  type GlobalChatMessageReactionEmoji,
  type GlobalChatPreviewType,
} from "@/lib/game/global-chat";
import {
  mapGlobalChatOnlineDirectorRows,
  mergeGlobalChatOnlineDirectors,
  type GlobalChatOnlineDirector,
} from "@/lib/game/global-chat-presence";
import type {
  RiderJerseyAppearance,
  RiderJerseyPattern,
} from "@/lib/rider-jersey";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type GlobalChatPreview = {
  type: GlobalChatPreviewType;
  entityId: string;
  publicIdentifier: string;
  title: string;
  subtitle: string;
  href: string;
  country: {
    name: string;
    code: string;
  } | null;
  age: number | null;
  riderAvatarProfileKey: string | null;
  riderAvatarSeed: string | number | null;
  directorAvatarKey: string | null;
  directorAvatarFrameKey: "alpha_tester" | null;
  teamId: string | null;
  palette: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  jerseyPattern: RiderJerseyPattern;
  jerseyStatus: RiderJerseyAppearance["status"];
};

export type GlobalChatReply = {
  messageId: string | null;
  authorDisplayName: string;
  excerpt: string;
};

export type GlobalChatReactionMember = {
  sportingDirectorId: string;
  displayName: string;
  teamId: string;
  teamDisplayName: string;
};

export type GlobalChatMessageReaction = {
  emoji: GlobalChatMessageReactionEmoji;
  sportingDirectorIds: string[];
  members: GlobalChatReactionMember[];
};

export type GlobalChatMessage = {
  id: string;
  sportingDirectorId: string;
  authorAvatarKey: string | null;
  authorAvatarFrameKey: "alpha_tester" | null;
  teamId: string;
  authorDisplayName: string;
  teamDisplayName: string;
  message: string;
  preview: GlobalChatPreview | null;
  replyTo: GlobalChatReply | null;
  reactions: GlobalChatMessageReaction[];
  createdAt: string;
  editedAt: string | null;
};

export type GlobalChatIdentity = GlobalChatOnlineDirector;

export type GlobalChatMentionRecipient = {
  sportingDirectorId: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
  avatarFrameKey: "alpha_tester" | null;
  teamId: string;
  teamName: string;
};

export type GlobalChatMessageRow = {
  id: string;
  sporting_director_id: string;
  team_id: string;
  author_display_name: string;
  team_display_name: string;
  message: string;
  preview_type: string | null;
  preview_entity_id: string | null;
  preview_title: string | null;
  preview_subtitle: string | null;
  preview_public_identifier: string | null;
  preview_country_name: string | null;
  preview_country_code: string | null;
  preview_age: number | null;
  preview_avatar_profile_key: string | null;
  preview_avatar_seed: string | number | null;
  preview_avatar_key: string | null;
  preview_avatar_frame_key: string | null;
  preview_team_id: string | null;
  preview_team_primary_color: string | null;
  preview_team_secondary_color: string | null;
  preview_team_accent_color: string | null;
  preview_jersey_pattern: string | null;
  preview_jersey_status: string | null;
  reply_to_message_id: string | null;
  reply_to_author_display_name: string | null;
  reply_to_message_excerpt: string | null;
  created_at: string;
  edited_at: string | null;
};

export type GlobalChatReactionRow = {
  message_id: string;
  sporting_director_id: string;
  reactor_display_name: string | null;
  team_id: string | null;
  team_display_name: string | null;
  emoji: GlobalChatMessageReactionEmoji;
  created_at?: string;
};

type GlobalChatIdentityRow = {
  sporting_director_id: string;
  username: string;
  display_name: string;
  avatar_key: string | null;
  avatar_frame_key: string | null;
  team_id: string;
  team_name: string;
};

type GlobalChatDirectorAvatarRow = {
  sporting_director_id: string;
  avatar_key: string | null;
  avatar_frame_key: string | null;
};

type GlobalChatDirectorAvatar = {
  avatarKey: string | null;
  avatarFrameKey: "alpha_tester" | null;
};

type GlobalChatMentionRecipientRow = {
  sporting_director_id: string;
  username: string;
  display_name: string;
  avatar_key: string | null;
  avatar_frame_key: string | null;
  team_id: string;
  team_name: string;
};

const GLOBAL_CHAT_MESSAGE_SELECT = [
  "id",
  "sporting_director_id",
  "team_id",
  "author_display_name",
  "team_display_name",
  "message",
  "preview_type",
  "preview_entity_id",
  "preview_title",
  "preview_subtitle",
  "preview_public_identifier",
  "preview_country_name",
  "preview_country_code",
  "preview_age",
  "preview_avatar_profile_key",
  "preview_avatar_seed",
  "preview_avatar_key",
  "preview_avatar_frame_key",
  "preview_team_id",
  "preview_team_primary_color",
  "preview_team_secondary_color",
  "preview_team_accent_color",
  "preview_jersey_pattern",
  "preview_jersey_status",
  "reply_to_message_id",
  "reply_to_author_display_name",
  "reply_to_message_excerpt",
  "created_at",
  "edited_at",
].join(", ");

export type GlobalChatMessagePage = {
  messages: GlobalChatMessage[];
  hasMore: boolean;
  nextCursor: GlobalChatCursor | null;
};

export async function getGlobalChatOverview(
  supabase: SupabaseServerClient,
): Promise<{
  identity: GlobalChatIdentity;
  onlineDirectors: GlobalChatOnlineDirector[];
  messages: GlobalChatMessage[];
  hasMore: boolean;
  nextCursor: GlobalChatCursor | null;
}> {
  const [identityResult, onlineDirectorsResult, messagePage] = await Promise.all([
    supabase.rpc("get_current_global_chat_identity_v2"),
    supabase.rpc("get_online_global_chat_directors_v2"),
    getGlobalChatMessagePage(supabase, {
      limit: GLOBAL_CHAT_INITIAL_MESSAGE_LIMIT,
    }),
  ]);

  if (identityResult.error) {
    throw new Error(
      `Impossible de charger votre identité dans le chat : ${identityResult.error.message}`,
    );
  }

  const identityRow = ((identityResult.data as
    GlobalChatIdentityRow[] | null) ?? [])[0];

  if (!identityRow) {
    throw new Error(
      "Vous devez diriger une équipe active pour accéder au chat général.",
    );
  }

  const identity: GlobalChatIdentity = {
    sportingDirectorId: identityRow.sporting_director_id,
    username: identityRow.username,
    displayName: identityRow.display_name,
    avatarKey: identityRow.avatar_key,
    avatarFrameKey: readAvatarFrameKey(identityRow.avatar_frame_key),
    teamId: identityRow.team_id,
    teamName: identityRow.team_name,
    teamHref: `/jeu/equipes/${identityRow.team_id}`,
  };

  if (onlineDirectorsResult.error) {
    console.error(
      "Global chat online directors unavailable; continuing with the current director.",
      onlineDirectorsResult.error,
    );
  }

  return {
    identity,
    onlineDirectors: mergeGlobalChatOnlineDirectors({
      currentDirector: identity,
      recentDirectors: onlineDirectorsResult.error
        ? []
        : mapGlobalChatOnlineDirectorRows(
            (onlineDirectorsResult.data as Record<string, unknown>[] | null) ??
              [],
          ),
      realtimeDirectors: [],
    }),
    ...messagePage,
  };
}

export async function getGlobalChatMessagePage(
  supabase: SupabaseServerClient,
  {
    before = null,
    limit = GLOBAL_CHAT_MESSAGE_PAGE_SIZE,
    now = new Date(),
  }: {
    before?: GlobalChatCursor | null;
    limit?: number;
    now?: Date;
  } = {},
): Promise<GlobalChatMessagePage> {
  const pageSize = Math.min(Math.max(Math.trunc(limit), 1), 50);
  let query = supabase
    .from("global_chat_messages")
    .select(GLOBAL_CHAT_MESSAGE_SELECT)
    .gte("created_at", getGlobalChatHistoryStart(now))
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (before) {
    query = query.or(
      `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`,
    );
  }

  const messagesResult = await query.limit(pageSize + 1);
  if (messagesResult.error) {
    throw new Error(
      `Impossible de charger le chat général : ${messagesResult.error.message}`,
    );
  }

  const rows =
    (messagesResult.data as unknown as GlobalChatMessageRow[] | null) ?? [];
  const hasMore = rows.length > pageSize;
  const selectedRows = rows.slice(0, pageSize);
  const oldestRow = selectedRows.at(-1) ?? null;
  const [reactionsByMessageId, avatarsByDirectorId] = await Promise.all([
    getReactionsByMessageId(
      supabase,
      selectedRows.map((row) => row.id),
    ),
    getAvatarsByDirectorId(
      supabase,
      selectedRows.map((row) => row.sporting_director_id),
    ),
  ]);

  return {
    messages: selectedRows
      .reverse()
      .map((row) =>
        mapGlobalChatMessage(
          row,
          reactionsByMessageId.get(row.id) ?? [],
          avatarsByDirectorId.get(row.sporting_director_id),
        ),
      ),
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

export function mapGlobalChatMessage(
  row: GlobalChatMessageRow,
  reactions: GlobalChatMessageReaction[] = [],
  avatar: GlobalChatDirectorAvatar | undefined = undefined,
): GlobalChatMessage {
  return {
    id: row.id,
    sportingDirectorId: row.sporting_director_id,
    authorAvatarKey: avatar?.avatarKey ?? null,
    authorAvatarFrameKey: avatar?.avatarFrameKey ?? null,
    teamId: row.team_id,
    authorDisplayName: row.author_display_name,
    teamDisplayName: row.team_display_name,
    message: row.message,
    preview: mapGlobalChatPreview(row),
    replyTo: mapGlobalChatReply(row),
    reactions,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

export async function searchGlobalChatMentionRecipients(
  supabase: SupabaseServerClient,
  query: string,
): Promise<GlobalChatMentionRecipient[]> {
  const { data, error } = await supabase.rpc(
    "search_current_global_chat_mentions",
    {
      p_query: query,
      p_limit: 6,
    },
  );

  if (error) {
    throw new Error(
      `Impossible de rechercher un membre à mentionner : ${error.message}`,
    );
  }

  return ((data as GlobalChatMentionRecipientRow[] | null) ?? []).map(
    (row) => ({
      sportingDirectorId: row.sporting_director_id,
      username: row.username,
      displayName: row.display_name,
      avatarKey: row.avatar_key,
      avatarFrameKey: readAvatarFrameKey(row.avatar_frame_key),
      teamId: row.team_id,
      teamName: row.team_name,
    }),
  );
}

async function getAvatarsByDirectorId(
  supabase: SupabaseServerClient,
  directorIds: string[],
) {
  const result = new Map<string, GlobalChatDirectorAvatar>();
  const uniqueDirectorIds = [...new Set(directorIds)];
  if (uniqueDirectorIds.length === 0) return result;

  const avatarsResult = await supabase.rpc("get_global_chat_director_avatars", {
    p_sporting_director_ids: uniqueDirectorIds,
  });

  if (avatarsResult.error) {
    console.error(
      "Global chat avatars unavailable; continuing with default avatars.",
      avatarsResult.error,
    );
    return result;
  }

  for (const row of ((avatarsResult.data as
    GlobalChatDirectorAvatarRow[] | null) ?? [])) {
    result.set(row.sporting_director_id, {
      avatarKey: row.avatar_key,
      avatarFrameKey: readAvatarFrameKey(row.avatar_frame_key),
    });
  }

  return result;
}

async function getReactionsByMessageId(
  supabase: SupabaseServerClient,
  messageIds: string[],
) {
  const result = new Map<string, GlobalChatMessageReaction[]>();
  if (messageIds.length === 0) return result;

  const reactionsResult = await supabase
    .from("global_chat_message_reactions")
    .select(
      "message_id, sporting_director_id, reactor_display_name, team_id, team_display_name, emoji, created_at",
    )
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (reactionsResult.error) {
    console.error(
      "Global chat reactions unavailable; continuing without reactions.",
      reactionsResult.error,
    );
    return result;
  }

  for (const row of (reactionsResult.data as unknown as
    GlobalChatReactionRow[] | null) ?? []) {
    const member = mapGlobalChatReactionMember(row);
    if (!member) continue;

    const messageReactions = result.get(row.message_id) ?? [];
    const reaction = messageReactions.find(
      (candidate) => candidate.emoji === row.emoji,
    );
    if (reaction) {
      reaction.sportingDirectorIds.push(row.sporting_director_id);
      reaction.members.push(member);
    } else {
      messageReactions.push({
        emoji: row.emoji,
        sportingDirectorIds: [row.sporting_director_id],
        members: [member],
      });
    }
    result.set(row.message_id, messageReactions);
  }

  return result;
}

function mapGlobalChatReply(row: GlobalChatMessageRow): GlobalChatReply | null {
  if (!row.reply_to_author_display_name || !row.reply_to_message_excerpt) {
    return null;
  }

  return {
    messageId: row.reply_to_message_id,
    authorDisplayName: row.reply_to_author_display_name,
    excerpt: row.reply_to_message_excerpt,
  };
}

function mapGlobalChatReactionMember(
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

function mapGlobalChatPreview(
  row: GlobalChatMessageRow,
): GlobalChatPreview | null {
  if (
    (row.preview_type !== "team" &&
      row.preview_type !== "rider" &&
      row.preview_type !== "director") ||
    !row.preview_entity_id ||
    !row.preview_title ||
    !row.preview_subtitle
  ) {
    return null;
  }

  const publicIdentifier =
    row.preview_public_identifier ?? row.preview_entity_id;

  return {
    type: row.preview_type,
    entityId: row.preview_entity_id,
    publicIdentifier,
    title: row.preview_title,
    subtitle: row.preview_subtitle,
    href:
      row.preview_type === "team"
        ? `/jeu/equipes/${row.preview_entity_id}`
        : row.preview_type === "rider"
          ? `/jeu/coureurs/${row.preview_entity_id}`
          : `/jeu/directeurs-sportifs/${encodeURIComponent(publicIdentifier)}`,
    country:
      row.preview_country_name &&
      row.preview_country_code &&
      /^[A-Z]{2}$/i.test(row.preview_country_code)
        ? {
            name: row.preview_country_name,
            code: row.preview_country_code.toUpperCase(),
          }
        : null,
    age:
      typeof row.preview_age === "number" &&
      Number.isFinite(row.preview_age)
        ? row.preview_age
        : null,
    riderAvatarProfileKey: row.preview_avatar_profile_key,
    riderAvatarSeed: row.preview_avatar_seed,
    directorAvatarKey: row.preview_avatar_key,
    directorAvatarFrameKey: readAvatarFrameKey(
      row.preview_avatar_frame_key,
    ),
    teamId: row.preview_team_id,
    palette: {
      primaryColor: readPreviewColor(
        row.preview_team_primary_color,
        row.preview_type === "rider" && !row.preview_team_id
          ? "#6B7280"
          : "#176951",
      ),
      secondaryColor: readPreviewColor(
        row.preview_team_secondary_color,
        row.preview_type === "rider" && !row.preview_team_id
          ? "#D1D5DB"
          : "#42B99A",
      ),
      accentColor: readPreviewColor(
        row.preview_team_accent_color,
        row.preview_type === "rider" && !row.preview_team_id
          ? "#F3F4F6"
          : "#F2C94C",
      ),
    },
    jerseyPattern: readJerseyPattern(row.preview_jersey_pattern),
    jerseyStatus: readJerseyStatus(
      row.preview_jersey_status,
      row.preview_type === "rider" && !row.preview_team_id,
    ),
  };
}

function readPreviewColor(value: string | null, fallback: string) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function readJerseyPattern(value: string | null): RiderJerseyPattern {
  const patterns: RiderJerseyPattern[] = [
    "center",
    "diagonal",
    "hoops",
    "solid",
    "split",
    "vertical",
    "chevron",
    "quarters",
    "cross",
    "shoulders",
    "checkerboard",
    "wave",
    "pinstripes",
  ];
  return patterns.find((pattern) => pattern === value) ?? "solid";
}

function readJerseyStatus(
  value: string | null,
  isFreeAgent: boolean,
): RiderJerseyAppearance["status"] {
  if (isFreeAgent) return "free-agent";
  return value === "sponsored" ? "sponsored" : "amateur";
}

function readAvatarFrameKey(value: string | null): "alpha_tester" | null {
  return value === "alpha_tester" ? value : null;
}
