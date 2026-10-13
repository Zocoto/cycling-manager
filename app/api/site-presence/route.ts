import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const COOKIE = "cs-online-browser";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (/bot|crawler|spider|headless/i.test(request.headers.get("user-agent") ?? "")) {
    return new NextResponse(null, { status: 204 });
  }
  const storedId = request.cookies.get(COOKIE)?.value;
  const browserId = storedId && UUID.test(storedId) ? storedId : crypto.randomUUID();
  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("record_site_browser_presence", { p_browser_id: browserId });
  if (result.error) {
    return NextResponse.json({ error: "Presence unavailable" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
  const response = NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
  if (browserId !== storedId) {
    response.cookies.set(COOKIE, browserId, {
      httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:",
      path: "/", maxAge: 86400,
    });
  }
  return response;
}
