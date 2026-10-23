import { canAccessSeasonFourGala } from "@/lib/game/season-four-gala-access";
import { seasonFourGalaResultsSchema } from "@/lib/game/season-four-gala-rewards";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GalaResultImportError, importSeasonFourGalaResults } from "@/services/season-four-gala-results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) return Response.json({ error: "Authentification requise." }, { status: 401, headers });
  if (!canAccessSeasonFourGala(user.id)) return Response.json({ error: "Ressource introuvable." }, { status: 404, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin
    || request.headers.get("x-cs-requested-with") !== "gala-s4-results"
    || !request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Requête d’import invalide." }, { status: 403, headers });
  }
  if (Number(request.headers.get("content-length")) > 16384) return Response.json({ error: "Fichier trop volumineux." }, { status: 413, headers });
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 16384) return Response.json({ error: "Fichier trop volumineux." }, { status: 413, headers });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Classement JSON invalide." }, { status: 400, headers });
  }
  if (!body || typeof body !== "object" || !("confirm" in body) || body.confirm !== true) {
    return Response.json({ error: "La confirmation explicite de l’attribution est requise." }, { status: 400, headers });
  }
  const input: Record<string, unknown> = { ...body };
  delete input.confirm;
  const parsed = seasonFourGalaResultsSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Les dix places, coureurs et équipes valides sont requis, sans doublon." }, { status: 400, headers });
  try {
    return Response.json({ receipt: await importSeasonFourGalaResults(parsed.data) }, { headers });
  } catch (failure) {
    if (failure instanceof GalaResultImportError) return Response.json({ error: failure.message }, { status: 409, headers });
    return Response.json({ error: "Attribution non confirmée. Réessayez avec le même classement pour éviter tout doublon." }, { status: 500, headers });
  }
}
