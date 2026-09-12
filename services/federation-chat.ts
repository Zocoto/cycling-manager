import "server-only";

import {
  FEDERATION_CHAT_PAGE_SIZE,
  mapFederationChatMessage,
  type FederationChatContext,
  type FederationChatMessageRow,
  type FederationChatOverview,
} from "@/lib/game/federation-chat";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

const FEDERATION_CHAT_SELECT = [
  "id",
  "country_id",
  "sporting_director_id",
  "team_id",
  "author_display_name",
  "team_display_name",
  "message",
  "created_at",
].join(", ");

type FederationChatContextRow = {
  country_id: string;
  country_code: string;
  country_name: string;
  sporting_director_id: string;
  team_id: string;
};

export async function getCurrentFederationChatContext(
  supabase: SupabaseServerClient,
): Promise<FederationChatContext | null> {
  const result = await supabase
    .rpc("get_current_chat_federation_context")
    .maybeSingle();

  if (result.error) {
    throw new Error(
      `Impossible d’identifier votre fédération : ${result.error.message}`,
    );
  }

  const row = result.data as FederationChatContextRow | null;
  if (!row) return null;

  return {
    countryId: row.country_id,
    countryCode: row.country_code,
    countryName: row.country_name,
    sportingDirectorId: row.sporting_director_id,
    teamId: row.team_id,
  };
}

export async function getFederationChatOverview(
  supabase: SupabaseServerClient,
  countryId: string,
): Promise<FederationChatOverview> {
  const result = await supabase
    .from("federation_chat_messages")
    .select(FEDERATION_CHAT_SELECT)
    .eq("country_id", countryId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(FEDERATION_CHAT_PAGE_SIZE + 1);

  if (result.error) {
    throw new Error(
      `Impossible de charger le salon fédéral : ${result.error.message}`,
    );
  }

  const rows =
    (result.data as unknown as FederationChatMessageRow[] | null) ?? [];

  return {
    messages: rows
      .slice(0, FEDERATION_CHAT_PAGE_SIZE)
      .reverse()
      .map(mapFederationChatMessage),
    hasMore: rows.length > FEDERATION_CHAT_PAGE_SIZE,
  };
}
