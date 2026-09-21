import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PurchaseRiskRow = {
  currency: string;
  current_projected_balance: number | string;
  projected_balance_after_purchase: number | string;
  requires_confirmation: boolean;
  was_already_negative: boolean;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return noStoreJson({ error: "Origine de la requête invalide." }, 403);
  }

  const payload = await readJson(request);
  const expense =
    payload && typeof payload === "object" && "expense" in payload
      ? Number((payload as { expense?: unknown }).expense)
      : Number.NaN;

  if (!Number.isFinite(expense) || expense <= 0 || expense > 1_000_000_000) {
    return noStoreJson({ error: "Montant d’achat invalide." }, 400);
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } =
    await getAuthenticatedUser(supabase);
  if (authError || !user) {
    return noStoreJson({ error: "Authentification requise." }, 401);
  }

  const result = await supabase
    .rpc("get_current_team_purchase_financial_risk", {
      p_expense: expense,
    })
    .maybeSingle();

  if (result.error || !result.data) {
    console.error("purchase_financial_risk_check_error", {
      userId: user.id,
      message: result.error?.message ?? "No financial risk returned",
    });
    return noStoreJson(
      { error: "La projection financière n’a pas pu être vérifiée." },
      500,
    );
  }

  const risk = result.data as PurchaseRiskRow;
  return noStoreJson({
    currency: risk.currency,
    currentProjectedBalance: Number(risk.current_projected_balance),
    projectedBalanceAfterPurchase: Number(
      risk.projected_balance_after_purchase,
    ),
    requiresConfirmation: risk.requires_confirmation === true,
    wasAlreadyNegative: risk.was_already_negative === true,
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
