import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { normalizePlayerActivityInput } from "@/lib/game/player-activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 16_384;
const MAX_EVENTS_PER_REQUEST = 20;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return new Response(null, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const rawEvents =
    body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events)
      ? (body as { events: unknown[] }).events.slice(0, MAX_EVENTS_PER_REQUEST)
      : [];
  const events = rawEvents
    .map(normalizePlayerActivityInput)
    .filter((event) => event !== null);

  if (events.length === 0) {
    return Response.json({ error: "Aucun événement valide." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    return new Response(null, { status: 401 });
  }

  const results = await Promise.all(
    events.map((event) =>
      supabase.rpc("record_current_player_activity", {
        p_event_type: event.eventType,
        p_route_path: event.routePath,
        p_section_key: event.sectionKey,
        p_action_key: event.actionKey,
        p_action_label: event.actionLabel,
        p_device_type: event.deviceType,
      }),
    ),
  );
  const firstError = results.find((result) => result.error)?.error;

  if (firstError) {
    console.error("Impossible d’enregistrer l’activité joueur.", firstError);
    return new Response(null, { status: 503 });
  }

  return new Response(null, { status: 204 });
}
