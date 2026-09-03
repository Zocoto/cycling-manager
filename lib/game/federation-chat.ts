export const FEDERATION_CHAT_PAGE_SIZE = 30;

export type FederationChatMessage = {
  id: string;
  countryId: string;
  sportingDirectorId: string;
  teamId: string;
  authorDisplayName: string;
  teamDisplayName: string;
  message: string;
  createdAt: string;
};

export type FederationChatMessageRow = {
  id: string;
  country_id: string;
  sporting_director_id: string;
  team_id: string;
  author_display_name: string;
  team_display_name: string;
  message: string;
  created_at: string;
};

export type FederationChatOverview = {
  messages: FederationChatMessage[];
  hasMore: boolean;
};

export function mapFederationChatMessage(
  row: FederationChatMessageRow,
): FederationChatMessage {
  return {
    id: row.id,
    countryId: row.country_id,
    sportingDirectorId: row.sporting_director_id,
    teamId: row.team_id,
    authorDisplayName: row.author_display_name,
    teamDisplayName: row.team_display_name,
    message: row.message,
    createdAt: row.created_at,
  };
}
