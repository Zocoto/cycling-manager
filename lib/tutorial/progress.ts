import "server-only";

import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  TutorialProgressRow,
  TutorialSessionRow,
} from "@/types/tutorial";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type SportingDirectorIdRow = {
  id: string;
};

// Cursor/history consumers never need the frozen Critérium replay. Keep its
// large timeline in PostgreSQL until an actual race/replay page requests it.
const PROGRESS_COLUMNS = "id,sporting_director_id,tutorial_key,tutorial_type,tutorial_version,status,current_step_key,current_route,started_at,completed_at,skipped_at,created_at,updated_at";
const SESSION_COLUMNS = "id,tutorial_progress_id,tutorial_version,launch_source,status,first_step_key,last_step_key,started_at,ended_at,created_at,updated_at";
type ProgressReadOptions = {
  includeMetadata?: boolean;
  signal?: AbortSignal;
  sportingDirectorId?: string;
};
type TutorialProgressReadRow = Omit<TutorialProgressRow, "metadata"> &
  Partial<Pick<TutorialProgressRow, "metadata">>;

/**
 * Retrouve le profil métier associé au compte actuellement connecté.
 *
 * Cette fonction est réservée au serveur. La politique RLS de
 * `sporting_directors` garantit également que l’utilisateur ne peut
 * consulter que son propre profil.
 */
export async function requireAuthenticatedSportingDirectorId(
  supabase: SupabaseServerClient,
  signal: AbortSignal = AbortSignal.timeout(8_000),
): Promise<string> {
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    throw new Error(
      "La session utilisateur est absente ou invalide.",
    );
  }

  const {
    data: sportingDirector,
    error: sportingDirectorError,
  } = await supabase
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .abortSignal(signal)
    .maybeSingle<SportingDirectorIdRow>();

  if (sportingDirectorError) {
    throw new Error(
      `Impossible de retrouver le Directeur Sportif connecté : ${sportingDirectorError.message}`,
    );
  }

  if (!sportingDirector) {
    throw new Error(
      "Aucun Directeur Sportif actif n’est associé à ce compte.",
    );
  }

  return sportingDirector.id;
}

/**
 * Charge l’ensemble des états de progression du joueur connecté.
 *
 * Le catalogue des didacticiels reste défini dans le code. Cette
 * fonction ne retourne que les états personnels stockés en base.
 */
export async function listAuthenticatedTutorialProgress(
  supabase: SupabaseServerClient,
): Promise<TutorialProgressRow[]> {
  const signal = AbortSignal.timeout(8_000);
  const sportingDirectorId =
    await requireAuthenticatedSportingDirectorId(
      supabase,
      signal,
    );

  const { data, error } = await supabase
    .from("tutorial_progress")
    .select(PROGRESS_COLUMNS)
    .eq(
      "sporting_director_id",
      sportingDirectorId,
    )
    .order("created_at", {
      ascending: true,
    })
    .limit(64)
    .abortSignal(signal);

  if (error) {
    throw new Error(
      `Impossible de charger la progression des didacticiels : ${error.message}`,
    );
  }

  return (data ?? []).map(row => ({...row, metadata: {}})) as TutorialProgressRow[];
}

/**
 * Charge l’état d’un parcours précis pour le joueur connecté.
 */
export async function getAuthenticatedTutorialProgress(
  supabase: SupabaseServerClient,
  tutorialKey: string,
  options: ProgressReadOptions = {},
): Promise<TutorialProgressRow | null> {
  const signal = options.signal ?? AbortSignal.timeout(8_000);
  const sportingDirectorId =
    options.sportingDirectorId ?? await requireAuthenticatedSportingDirectorId(
      supabase,
      signal,
    );

  const { data, error } = await supabase
    .from("tutorial_progress")
    .select(options.includeMetadata === false ? PROGRESS_COLUMNS : "*")
    .eq(
      "sporting_director_id",
      sportingDirectorId,
    )
    .eq("tutorial_key", tutorialKey)
    .abortSignal(signal)
    .maybeSingle<TutorialProgressReadRow>();

  if (error) {
    throw new Error(
      `Impossible de charger le didacticiel "${tutorialKey}" : ${error.message}`,
    );
  }

  if (!data) return null;
  return {
    ...data,
    metadata: options.includeMetadata === false ? {} : (data.metadata ?? {}),
  };
}

/**
 * Charge l’unique session active d’un parcours.
 *
 * L’index partiel PostgreSQL garantit qu’il ne peut exister qu’une
 * seule session `in_progress` pour une même progression.
 */
export async function getActiveTutorialSession(
  supabase: SupabaseServerClient,
  tutorialProgressId: string,
  signal: AbortSignal = AbortSignal.timeout(8_000),
): Promise<TutorialSessionRow | null> {
  const { data, error } = await supabase
    .from("tutorial_sessions")
    .select(SESSION_COLUMNS)
    .eq(
      "tutorial_progress_id",
      tutorialProgressId,
    )
    .eq("status", "in_progress")
    .abortSignal(signal)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Impossible de charger la session active du didacticiel : ${error.message}`,
    );
  }

  return data ? {...data, metadata: {}} as TutorialSessionRow : null;
}
