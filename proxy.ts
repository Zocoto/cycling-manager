import { NextResponse, type NextRequest } from "next/server";

import { getPublicRouteInfo, PUBLIC_LOCALE_HEADER } from "./lib/i18n/public-routes";
import { LOCALE_COOKIE_NAME } from "./lib/i18n/config";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // This override belongs to the URL, never to a caller-supplied header.
  request.headers.delete(PUBLIC_LOCALE_HEADER);
  const pathname = request.nextUrl.pathname;
  const publicRoute = getPublicRouteInfo(pathname);

  if (publicRoute) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(PUBLIC_LOCALE_HEADER, publicRoute.locale);
    const options = { request: { headers: requestHeaders } };

    return NextResponse.next(options);
  }

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "X-Robots-Tag": "noindex" },
    });
  }

  if (
    pathname === "/jeu" || pathname.startsWith("/jeu/") ||
    pathname === "/connexion" || pathname === "/inscription"
  ) {
    const authenticationLocale = pathname === "/connexion" || pathname === "/inscription"
      ? request.nextUrl.searchParams.get("lang")
      : null;
    const hasAuthenticationLocale = authenticationLocale === "fr" || authenticationLocale === "en";

    if (hasAuthenticationLocale) request.cookies.set(LOCALE_COOKIE_NAME, authenticationLocale);
    const response = await updateSession(request);
    if (hasAuthenticationLocale) {
      response.cookies.set(LOCALE_COOKIE_NAME, authenticationLocale, {
        path: "/", maxAge: 31536000, sameSite: "lax", secure: request.nextUrl.protocol === "https:",
      });
    }
    return response;
  }

  return NextResponse.next({ request: { headers: request.headers } });
}

export const config = {
  matcher: [
    "/",
    "/en/:path*",
    "/guide/:path*",
    "/a-propos",
    "/presse",
    "/nouveautes/:path*",
    "/mentions-legales",
    "/confidentialite",
    "/conditions-utilisation",
    "/jeu/:path*",
    "/connexion",
    "/inscription",
  ],
};
