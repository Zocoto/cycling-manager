import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateHalloweenRun } from "@/lib/game/halloween-event";
import { revalidatePath } from "next/cache";

export const maxDuration = 20;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = new Set(["join", "start", "finish", "draw", "buy", "use", "equip", "curse", "dispel", "unwrap"]);
export async function POST(request: Request) {
  if (process.env.HALLOWEEN_LOCAL_REVIEW === "1" || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production")) return Response.json({ error: "Les actions réelles sont désactivées dans les aperçus." }, { status: 403 });
  // Cookie-authenticated mutations must come from this origin, not an external form.
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || !request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Origine invalide." }, { status: 403 });
  const length = Number(request.headers.get("content-length"));
  if (length > 600000) return Response.json({ error: "Demande trop volumineuse." }, { status: 413 });
  const server = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await server.auth.getUser();
  if (authError || !user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  try {
    const body = await request.text();
    if (body.length > 600000) return Response.json({ error: "Demande trop volumineuse." }, { status: 413 });
    const input = JSON.parse(body);
    if (!input || !uuid.test(input.id ?? "") || !actions.has(input.kind) || !input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) throw new Error("Demande invalide.");
    const admin = createSupabaseAdminClient();
    let payload = input.payload as Record<string, unknown>;
    if (input.kind === "finish") {
      if (!uuid.test(String(payload.runId ?? ""))) throw new Error("Session invalide.");
      const { data: run, error } = await admin.from("halloween_runs").select("id,seed,started_at,expires_at,status,coins,score").eq("id", payload.runId).eq("user_id", user.id).eq("edition_id", "halloween-2026").maybeSingle();
      if (error || !run) throw new Error("Session inconnue.");
      if (run.status === "finished") return Response.json({ message: "Score déjà enregistré. Aucun second crédit.", score: run.score }, { headers: { "Cache-Control": "no-store" } });
      if (new Date(run.expires_at).getTime() < Date.now() && run.status !== "finished") throw new Error("Cet essai est expiré.");
      const result = validateHalloweenRun(Number(run.seed), payload.proof, (Date.now() - new Date(run.started_at).getTime()) / 1000);
      payload = { runId: run.id, proof: payload.proof, score: result.score, distance: result.distance, coins: result.coins };
    } else {
      const allowed = new Set(["item", "target", "bandage", ...(input.kind === "use" ? ["quantity"] : [])]);
      if (payload.quantity !== undefined && (!Number.isSafeInteger(payload.quantity) || Number(payload.quantity) < 1 || Number(payload.quantity) > 30)) throw new Error("Choisissez une quantité entière entre 1 et 30.");
      if (Object.keys(payload).some(key => !allowed.has(key)) || (payload.item !== undefined && (typeof payload.item !== "string" || payload.item.length > 80)) || (payload.target !== undefined && !uuid.test(String(payload.target))) || (payload.bandage !== undefined && (!Number.isInteger(payload.bandage) || Number(payload.bandage) < 0 || Number(payload.bandage) > 4))) throw new Error("Demande invalide.");
    }
    const { data, error } = await admin.rpc("halloween_action", { p_user: user.id, p_id: input.id, p_kind: input.kind, p_payload: payload });
    if (error) throw new Error(error.message);
    if (input.kind === "use") {
      try {
        revalidatePath("/jeu/inventaire");
        revalidatePath("/jeu/halloween");
        revalidatePath("/jeu/effectif");
        revalidatePath("/jeu");
        if (typeof payload.target === "string") revalidatePath(`/jeu/coureurs/${payload.target}`);
      } catch (cacheError) {
        // The action has committed: a cache failure must not invite a second use.
        console.error("Actualisation après consommable Halloween indisponible.", cacheError);
      }
    }
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Action indisponible." }, { status: 400 });
  }
}
