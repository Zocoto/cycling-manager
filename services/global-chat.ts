import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type GlobalChatPreview = {
  type: "team" | "rider";
  entityId: string;
  title: string;
  subtitle: string;
  href: string;
};

export type GlobalChatMessage = {
  id: string;
  sportingDirectorId: string;
  teamId: string;
  authorDisplayName: string;
  teamDisplayName: string;
  message: string;
  preview: GlobalChatPreview | null;
  createdAt: string;
};

export type GlobalChatIdentity = {
  sportingDirectorId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  teamHref: string;
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
  created_at: string;
};

type GlobalChatIdentityRow = {
  sporting_director_id: string;
  display_name: string;
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
  "created_at",
].join(", ");

export async function getGlobalChatOverview(
  supabase: SupabaseServerClient,
  limit = 80,
): Promise<{
  identity: GlobalChatIdentity;
  messages: GlobalChatMessage[];
}> {
  const [identityResult, messagesResult] = await Promise.all([
    supabase.rpc("get_current_global_chat_identity"),
    supabase
      .from("global_chat_messages")
      .select(GLOBAL_CHAT_MESSAGE_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (identityResult.error) {
    throw new Error(
      `Impossible de charger votre identité dans le chat : ${identityResult.error.message}`,
    );
  }

  const identityRow = (
    (identityResult.data as GlobalChatIdentityRow[] | null) ?? []
  )[0];

  if (!identityRow) {
    throw new Error(
      "Vous devez diriger une équipe active pour accéder au chat général.",
    );
  }

  if (messagesResult.error) {
    throw new Error(
      `Impossible de charger le chat général : ${messagesResult.error.message}`,
    );
  }

  return {
    identity: {
      sportingDirectorId: identityRow.sporting_director_id,
      displayName: identityRow.display_name,
      teamId: identityRow.team_id,
      teamName: identityRow.team_name,
      teamHref: `/jeu/equipes/${identityRow.team_id}`,
    },
    messages: (
      (messagesResult.data as unknown as GlobalChatMessageRow[] | null) ?? []
    )
      .reverse()
      .map(mapGlobalChatMessage),
  };
}

export function mapGlobalChatMessage(
  row: GlobalChatMessageRow,
): GlobalChatMessage {
  return {
    id: row.id,
    sportingDirectorId: row.sporting_director_id,
    teamId: row.team_id,
    authorDisplayName: row.author_display_name,
    teamDisplayName: row.team_display_name,
    message: row.message,
    preview: mapGlobalChatPreview(row),
    createdAt: row.created_at,
  };
}

function mapGlobalChatPreview(
  row: GlobalChatMessageRow,
): GlobalChatPreview | null {
  if (
    (row.preview_type !== "team" && row.preview_type !== "rider") ||
    !row.preview_entity_id ||
    !row.preview_title ||
    !row.preview_subtitle
  ) {
    return null;
  }

  return {
    type: row.preview_type,
    entityId: row.preview_entity_id,
    title: row.preview_title,
    subtitle: row.preview_subtitle,
    href:
      row.preview_type === "team"
        ? `/jeu/equipes/${row.preview_entity_id}`
        : `/jeu/coureurs/${row.preview_entity_id}`,
  };
}
