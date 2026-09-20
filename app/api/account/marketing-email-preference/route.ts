import { legalConfig } from "@/lib/legal-config";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } =
    await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return noStoreJson({ error: "Authentification requise." }, 401);
  }

  const preferenceResult = await supabase
    .from("user_marketing_email_preferences")
    .select("enabled,consented_at,withdrawn_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (preferenceResult.error) {
    console.error("marketing_email_preference_read_error", {
      userId: user.id,
      message: preferenceResult.error.message,
    });
    return noStoreJson(
      { error: "La préférence e-mail est indisponible." },
      500,
    );
  }

  return noStoreJson({
    enabled: preferenceResult.data?.enabled === true,
    consentedAt: preferenceResult.data?.consented_at ?? null,
    withdrawnAt: preferenceResult.data?.withdrawn_at ?? null,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return noStoreJson({ error: "Origine de la requête invalide." }, 403);
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } =
    await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return noStoreJson({ error: "Authentification requise." }, 401);
  }

  const payload = await readJson(request);
  const enabled =
    payload && typeof payload === "object" && "enabled" in payload
      ? (payload as { enabled?: unknown }).enabled
      : null;
  if (typeof enabled !== "boolean") {
    return noStoreJson({ error: "Préférence e-mail invalide." }, 400);
  }

  const result = await supabase
    .rpc("set_current_user_marketing_email_preference", {
      p_enabled: enabled,
      p_consent_version: legalConfig.privacyNoticeVersion,
    })
    .maybeSingle();

  if (result.error || !result.data) {
    console.error("marketing_email_preference_update_error", {
      userId: user.id,
      message: result.error?.message ?? "No preference returned",
    });
    return noStoreJson(
      { error: "La préférence e-mail n’a pas pu être enregistrée." },
      500,
    );
  }

  const preference = result.data as {
    enabled: boolean;
    consented_at: string | null;
    withdrawn_at: string | null;
  };

  return noStoreJson({
    enabled: preference.enabled === true,
    consentedAt: preference.consented_at ?? null,
    withdrawnAt: preference.withdrawn_at ?? null,
  });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function noStoreJson(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
