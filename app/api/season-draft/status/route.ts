import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getSeasonDraftView } from "@/services/season-draft";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) return NextResponse.json({ error: "Connexion requise." }, { status: 401, headers });
  try {
    const view = await getSeasonDraftView(supabase, false);
    return NextResponse.json({ editionId: view.edition?.id, version: view.edition?.version, status: view.edition?.status, serverNow: view.serverNow }, { headers });
  } catch { return NextResponse.json({ error: "Suivi momentanément indisponible." }, { status: 503, headers }); }
}
