import { NextResponse } from "next/server";

import { isMarketingUnsubscribeToken } from "@/lib/marketing/email-preferences";
import { unsubscribeMarketingEmailToken } from "@/services/marketing-email-preferences";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const pageUrl = new URL("/emails/desinscription", requestUrl.origin);
  const token = requestUrl.searchParams.get("token");
  const language = requestUrl.searchParams.get("lang");
  if (token) pageUrl.searchParams.set("token", token);
  if (language === "en") pageUrl.searchParams.set("lang", "en");
  return NextResponse.redirect(pageUrl);
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!isMarketingUnsubscribeToken(token)) {
    return noStoreJson({ unsubscribed: false }, 400);
  }

  const unsubscribed = await unsubscribeMarketingEmailToken(token);
  return noStoreJson({ unsubscribed }, unsubscribed ? 200 : 503);
}

function noStoreJson(payload: unknown, status: number) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
