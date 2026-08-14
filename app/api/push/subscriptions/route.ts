import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PushSubscriptionRequest = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } =
    await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return Response.json({ error: "Authentification requise." }, { status: 401 });
  }

  const payload = await readJson(request);
  const subscription = parseSubscription(payload);
  if (!subscription) {
    return Response.json({ error: "Abonnement push invalide." }, { status: 400 });
  }

  const result = await supabase.rpc("upsert_current_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.p256dh,
    p_auth: subscription.auth,
    p_user_agent: request.headers.get("user-agent"),
  });
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 400 });
  }

  return Response.json({ enabled: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } =
    await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return Response.json({ error: "Authentification requise." }, { status: 401 });
  }

  const payload = await readJson(request);
  const endpoint =
    payload && typeof payload === "object" && "endpoint" in payload
      ? (payload as { endpoint?: unknown }).endpoint
      : null;
  if (
    typeof endpoint !== "string"
    || !endpoint.startsWith("https://")
    || endpoint.length > 2048
  ) {
    return Response.json({ error: "Abonnement push invalide." }, { status: 400 });
  }

  const result = await supabase.rpc("disable_current_push_subscription", {
    p_endpoint: endpoint,
  });
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 400 });
  }

  return Response.json({ enabled: false });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parseSubscription(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as PushSubscriptionRequest;
  if (
    typeof candidate.endpoint !== "string"
    || !candidate.endpoint.startsWith("https://")
    || candidate.endpoint.length > 2048
    || !candidate.keys
    || typeof candidate.keys.p256dh !== "string"
    || candidate.keys.p256dh.length > 512
    || typeof candidate.keys.auth !== "string"
    || candidate.keys.auth.length > 256
  ) {
    return null;
  }

  return {
    endpoint: candidate.endpoint,
    p256dh: candidate.keys.p256dh,
    auth: candidate.keys.auth,
  };
}
