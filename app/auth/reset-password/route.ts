import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  const tokenHash =
    request.nextUrl.searchParams.get("token_hash");

  const type = request.nextUrl.searchParams.get(
    "type"
  ) as EmailOtpType | null;

  const redirectUrl = request.nextUrl.clone();

  redirectUrl.pathname = "/reinitialiser-mot-de-passe";
  redirectUrl.search = "";

  const supabase = await createSupabaseServerClient();

  let recoveryError: Error | null = null;

  if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    recoveryError = error;
  } else if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    recoveryError = error;
  } else {
    redirectUrl.searchParams.set("status", "error");

    return NextResponse.redirect(redirectUrl);
  }

  if (recoveryError) {
    console.error(
      "Échec de l’ouverture de la session de récupération :",
      {
        message: recoveryError.message,
      }
    );

    redirectUrl.searchParams.set("status", "error");

    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.searchParams.set("status", "ready");

  return NextResponse.redirect(redirectUrl);
}