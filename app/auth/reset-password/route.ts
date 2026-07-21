import { type NextRequest, NextResponse } from "next/server";

import { getEmailCallbackCredentials } from "../../../lib/auth/email-callback";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const credentials = getEmailCallbackCredentials(
    request.nextUrl.searchParams,
    "recovery"
  );

  const redirectUrl = request.nextUrl.clone();

  redirectUrl.pathname = "/reinitialiser-mot-de-passe";
  redirectUrl.search = "";

  const supabase = await createSupabaseServerClient();

  let recoveryError: Error | null = null;

  if (credentials?.strategy === "code") {
    const { error } =
      await supabase.auth.exchangeCodeForSession(credentials.code);

    recoveryError = error;
  } else if (credentials?.strategy === "token-hash") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: credentials.tokenHash,
      type: credentials.type,
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
