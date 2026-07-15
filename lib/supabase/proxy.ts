import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutePrefixes = ["/jeu"];

const authenticationRoutes = ["/connexion", "/inscription"];

export async function updateSession(
  request: NextRequest
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    console.error(
      "Les variables Supabase nécessaires au Proxy sont manquantes."
    );

    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              supabaseResponse.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getClaims();

  const isAuthenticated =
    !error && Boolean(data?.claims?.sub);

  const pathname = request.nextUrl.pathname;

  const isProtectedRoute = protectedRoutePrefixes.some(
    (routePrefix) =>
      pathname === routePrefix ||
      pathname.startsWith(`${routePrefix}/`)
  );

  const isAuthenticationRoute =
    authenticationRoutes.includes(pathname);

  if (!isAuthenticated && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone();

    redirectUrl.pathname = "/connexion";
    redirectUrl.search = "";

    return createRedirectResponse(
      redirectUrl,
      supabaseResponse
    );
  }

  if (isAuthenticated && isAuthenticationRoute) {
    const redirectUrl = request.nextUrl.clone();

    redirectUrl.pathname = "/jeu";
    redirectUrl.search = "";

    return createRedirectResponse(
      redirectUrl,
      supabaseResponse
    );
  }

  return supabaseResponse;
}

function createRedirectResponse(
  redirectUrl: URL,
  supabaseResponse: NextResponse
): NextResponse {
  const redirectResponse =
    NextResponse.redirect(redirectUrl);

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}