import { type NextRequest, NextResponse } from "next/server";

import { getEmailCallbackCredentials } from "../../../lib/auth/email-callback";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const credentials = getEmailCallbackCredentials(
    request.nextUrl.searchParams,
    "email"
  );

  const redirectUrl = request.nextUrl.clone();

  redirectUrl.pathname = "/inscription/confirmee";
  redirectUrl.search = "";

  const supabase = await createSupabaseServerClient();

  let confirmationError: Error | null = null;

  if (credentials?.strategy === "code") {
    const { error } =
      await supabase.auth.exchangeCodeForSession(credentials.code);

    confirmationError = error;
  } else if (credentials?.strategy === "token-hash") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: credentials.tokenHash,
      type: credentials.type,
    });

    confirmationError = error;
  } else {
    redirectUrl.searchParams.set("status", "error");

    return NextResponse.redirect(redirectUrl);
  }

  if (confirmationError) {
    console.error(
      "Échec de la confirmation de l’adresse e-mail :",
      {
        message: confirmationError.message,
      }
    );

    redirectUrl.searchParams.set("status", "error");

    return NextResponse.redirect(redirectUrl);
  }

  /*
   * La confirmation crée temporairement une session.
   * La connexion étant traitée dans l’US 6, cette session
   * est immédiatement fermée.
   */
  const { error: signOutError } = await supabase.auth.signOut();

  if (signOutError) {
    console.error(
      "L’adresse e-mail est confirmée, mais la session temporaire n’a pas pu être fermée :",
      {
        code: signOutError.code,
        status: signOutError.status,
        message: signOutError.message,
      }
    );
  }

  redirectUrl.searchParams.set("status", "success");

  return NextResponse.redirect(redirectUrl);
}
