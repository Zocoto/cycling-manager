import "server-only";

import { SPONSORS } from "@/data/sponsors";
import {
  DEFAULT_AMATEUR_JERSEY, isAmateurJerseyPattern, normalizeHexColor,
} from "@/lib/amateur-team";
import {
  parseSeasonFiveGalaPublicStartlistsPayload,
  type RawSeasonFiveGalaPublicStartlists,
  type SeasonFiveGalaPublicJersey,
  type SeasonFiveGalaPublicStartlists,
} from "@/lib/game/season-five-gala-public-startlists";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type RawTeam = RawSeasonFiveGalaPublicStartlists["courses"][number]["teams"][number];
const sponsorsByKey = new Map(SPONSORS.map(sponsor => [sponsor.id, sponsor]));
const unavailableMessage = "Impossible de charger les engagés du gala. Réessayez dans un instant.";

function resolveJersey(team: RawTeam): SeasonFiveGalaPublicJersey {
  const sponsor = team.sponsorCatalogKey ? sponsorsByKey.get(team.sponsorCatalogKey) : null;
  const selected = sponsor?.jerseys.find(jersey => jersey.id === team.jerseyId) ?? sponsor?.jerseys[0];
  if (selected) return { kind: "sponsor", imagePath: selected.imagePath };
  const raw = team.amateurJersey;
  return { kind: "amateur", jersey: {
    pattern: raw?.pattern && isAmateurJerseyPattern(raw.pattern) ? raw.pattern : DEFAULT_AMATEUR_JERSEY.pattern,
    primaryColor: (raw?.primaryColor && normalizeHexColor(raw.primaryColor)) || DEFAULT_AMATEUR_JERSEY.primaryColor,
    secondaryColor: (raw?.secondaryColor && normalizeHexColor(raw.secondaryColor)) || DEFAULT_AMATEUR_JERSEY.secondaryColor,
    accentColor: (raw?.accentColor && normalizeHexColor(raw.accentColor)) || DEFAULT_AMATEUR_JERSEY.accentColor,
  } };
}

/** One authenticated RPC; no shared cache, HTTP fan-out or per-team lookup. */
export async function getSeasonFiveGalaPublicStartlists(client: Client): Promise<SeasonFiveGalaPublicStartlists> {
  try {
    const result = await client.rpc("get_season_five_gala_startlists").abortSignal(AbortSignal.timeout(8000));
    const payload = result.error ? null : parseSeasonFiveGalaPublicStartlistsPayload(result.data);
    if (!payload) throw new Error(unavailableMessage);
    return {
      editionId: payload.editionId, sourceSeason: payload.sourceSeason,
      targetGameYear: payload.targetGameYear, closesAt: payload.closesAt,
      courses: payload.courses.map(course => ({
        eventKey: course.eventKey, program: course.program,
        teams: course.teams.map(team => ({
          teamId: team.teamId, name: team.name, futureName: team.futureName,
          identityReady: team.identityReady, riders: team.riders, jersey: resolveJersey(team),
        })),
      })),
    };
  } catch {
    throw new Error(unavailableMessage);
  }
}
