import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateChristmasFlight } from "@/lib/game/christmas-flight-validation";

export const runtime = "nodejs";
export const maxDuration = 20;
const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const shapes: Record<string, string[]> = {
  join: [], start: ["practice", "retry", "sniper"], abandon: ["runId"], finish: ["runId", "proof"],
  prepare: ["item", "prepared"], advent: ["day"], buy: ["item", "quantity"], tree: ["goal"], equip: ["slot", "item"],
  use: ["item", "stageIds", "riderIds", "startDayNumber", "preparerContractId"],
};
function validatePayload(kind: string, payload: Record<string, unknown>) {
  if (!Object.hasOwn(shapes, kind) || Object.keys(payload).some(key => !shapes[kind].includes(key))) throw new Error("Demande invalide.");
  for (const key of ["practice", "retry", "sniper", "prepared"]) if (key in payload && typeof payload[key] !== "boolean") throw new Error("Option invalide.");
  for (const key of ["item", "slot"]) if (key in payload && (typeof payload[key] !== "string" || !/^[a-z0-9-]{1,80}$/.test(String(payload[key])))) throw new Error("Objet invalide.");
  for (const key of ["quantity", "day", "goal", "startDayNumber"]) if (key in payload && (!Number.isSafeInteger(payload[key]) || Number(payload[key]) < 1 || Number(payload[key]) > (key === "goal" ? 28000 : key === "day" ? 24 : key === "quantity" ? 30 : 366))) throw new Error("Quantité ou jour invalide.");
  if ((kind === "finish" || kind === "abandon") && !uuid.test(String(payload.runId ?? ""))) throw new Error("Session invalide.");
  for (const key of ["stageIds", "riderIds"]) if (key in payload && (!Array.isArray(payload[key]) || payload[key].length > (key === "stageIds" ? 2 : 100) || payload[key].some(id => typeof id !== "string" || !uuid.test(id)))) throw new Error("Sélection invalide.");
  if (payload.preparerContractId !== undefined && payload.preparerContractId !== null && !uuid.test(String(payload.preparerContractId))) throw new Error("Préparateur invalide.");
}
export async function GET(request: Request) {
  const server = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await server.auth.getUser();
  if (authError || !user) return Response.json({ error: "Connexion requise." }, { status: 401, headers });
  const context = new URL(request.url).searchParams.get("context");
  if (context && context !== "reconnaissance") return Response.json({ error: "Contexte inconnu." }, { status: 400, headers });
  const { data, error } = await server.rpc(context ? "get_current_christmas_reconnaissance_context" : "get_current_christmas_state");
  if (error) return Response.json({ error: "Le village de Noël est momentanément indisponible." }, { status: 503, headers });
  return Response.json(context ? { context: data } : { state: data }, { headers });
}
export async function POST(request: Request) {
  if (process.env.CHRISTMAS_LOCAL_REVIEW === "1" || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production")) return Response.json({ error: "Les actions réelles sont désactivées dans les aperçus." }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin || !request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Origine invalide." }, { status: 403, headers });
  if (Number(request.headers.get("content-length")) > 900000) return Response.json({ error: "Demande trop volumineuse." }, { status: 413, headers });
  const server = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await server.auth.getUser();
  if (authError || !user) return Response.json({ error: "Connexion requise." }, { status: 401, headers });
  try {
    const raw = await request.text();
    if (raw.length > 900000) return Response.json({ error: "Demande trop volumineuse." }, { status: 413, headers });
    const input = JSON.parse(raw);
    if (!input || !uuid.test(input.id ?? "") || typeof input.kind !== "string" || !input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) throw new Error("Demande invalide.");
    let payload = input.payload as Record<string, unknown>;
    validatePayload(input.kind, payload);
    const admin = createSupabaseAdminClient();
    let result: unknown;
    if (input.kind === "finish") {
      const { data: run, error } = await admin.from("christmas_runs").select("id,status,started_at,expires_at,sniper,score,deliveries,qualities,coins,lights,practice,retry").eq("id", payload.runId).eq("user_id", user.id).eq("edition_id", "christmas-2026").maybeSingle();
      if (error || !run) throw new Error("Session inconnue.");
      if (run.status === "finished") {
        result = { runId: run.id, grelots: run.coins, lights: run.lights, score: run.score, deliveries: run.deliveries, qualities: run.qualities, practice: run.practice, retry: run.retry };
      } else {
        if (run.status !== "running" || Date.parse(run.expires_at) < Date.now()) throw new Error("Cette tournée est expirée.");
        const reservation = await admin.rpc("claim_christmas_run_validation", { p_run: run.id, p_user: user.id });
        if (reservation.error) throw new Error(reservation.error.message);
        const verdict = validateChristmasFlight(payload.proof, (Date.now() - Date.parse(run.started_at)) / 1000, run.sniper === true);
        payload = { runId: run.id, ...verdict, proof: { engineVersion: 1, ticks: (payload.proof as { ticks: number }).ticks, traceHash: createHash("sha256").update(JSON.stringify(payload.proof)).digest("hex") } };
      }
    }
    if (result === undefined) {
      const response = await admin.rpc("christmas_action", { p_auth_user_id: user.id, p_request_id: input.id, p_kind: input.kind, p_payload: payload });
      if (response.error) throw new Error(response.error.message);
      result = response.data;
    }
    // Refresh from the authenticated read-only RPC; no enrollment or reward on GET.
    const snapshot = await server.rpc("get_current_christmas_state");
    if (["buy", "advent", "tree", "use", "equip"].includes(input.kind)) {
      try {
        for (const path of ["/jeu", "/jeu/inventaire", "/jeu/directeur-sportif", "/jeu/noel", "/jeu/album"]) revalidatePath(path);
      } catch (error) { console.error("Actualisation après Noël indisponible.", error); }
    }
    // A failed refresh must never turn a committed purchase into a failed transaction.
    return Response.json({ result, ...(snapshot.error ? { refreshRequired: true } : { state: snapshot.data }) }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Action indisponible." }, { status: 400, headers });
  }
}
