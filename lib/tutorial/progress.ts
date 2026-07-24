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

/**
 * Retrouve le profil métier associé au compte actuellement connecté.
 *
 * Cette fonction est réservée au serveur. La politique RLS de
 * `sporting_directors` garantit également que l’utilisateur ne peut
 * consulter que son propre profil.
 */
export async function requireAuthenticatedSportingDirectorId(
  supabase: SupabaseServerClient,
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
  const sportingDirectorId =
    await requireAuthenticatedSportingDirectorId(
      supabase,
    );

  const { data, error } = await supabase
    .from("tutorial_progress")
    .select("*")
    .eq(
      "sporting_director_id",
      sportingDirectorId,
    )
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Impossible de charger la progression des didacticiels : ${error.message}`,
    );
  }

  return (data ?? []) as TutorialProgressRow[];
}

/**
 * Charge l’état d’un parcours précis pour le joueur connecté.
 */
export async function getAuthenticatedTutorialProgress(
  supabase: SupabaseServerClient,
  tutorialKey: string,
): Promise<TutorialProgressRow | null> {
  const sportingDirectorId =
    await requireAuthenticatedSportingDirectorId(
      supabase,
    );

  const { data, error } = await supabase
    .from("tutorial_progress")
    .select("*")
    .eq(
      "sporting_director_id",
      sportingDirectorId,
    )
    .eq("tutorial_key", tutorialKey)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Impossible de charger le didacticiel "${tutorialKey}" : ${error.message}`,
    );
  }

  return (data ?? null) as TutorialProgressRow | null;
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
): Promise<TutorialSessionRow | null> {
  const { data, error } = await supabase
    .from("tutorial_sessions")
    .select("*")
    .eq(
      "tutorial_progress_id",
      tutorialProgressId,
    )
    .eq("status", "in_progress")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Impossible de charger la session active du didacticiel : ${error.message}`,
    );
  }

  return (data ?? null) as TutorialSessionRow | null;
}