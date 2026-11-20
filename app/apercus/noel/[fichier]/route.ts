import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const previewAccountIds = new Set([
  "58140add-54c6-40af-9528-f823d0051d0f", // Zocoto
  "c95a8ad8-3771-4c23-9141-5d1b9d749a00", // Ujik
  "0c5bb531-5fc4-4bfa-85c9-02ece5487b44", // Fra Troisset
]);

const fileTypes = new Map([
  ["index.html", "text/html; charset=utf-8"],
  ["tournee.html", "text/html; charset=utf-8"],
  ["tournee.js", "text/javascript; charset=utf-8"],
  ["flight-physics.js", "text/javascript; charset=utf-8"],
  ["catalogue.js", "text/javascript; charset=utf-8"],
  ["rules.js", "text/javascript; charset=utf-8"],
  ["album-s4.js", "text/javascript; charset=utf-8"],
  ["avent.js", "text/javascript; charset=utf-8"],
  ["sapin.js", "text/javascript; charset=utf-8"],
  ["sapin.css", "text/css; charset=utf-8"],
  ["noel.js", "text/javascript; charset=utf-8"],
  ["portrait.js", "text/javascript; charset=utf-8"],
  ["noel.css", "text/css; charset=utf-8"],
  ["logo.png", "image/png"],
  ["village-hiver.jpg", "image/jpeg"],
]);

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

function notFound() {
  return new Response(null, { status: 404, headers: privateHeaders });
}

export async function GET(_request: Request, { params }: RouteContext<"/apercus/noel/[fichier]">) {
  const { fichier } = await params;
  const contentType = fileTypes.get(fichier);
  if (!contentType) return notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user || !previewAccountIds.has(user.id)) return notFound();

  const content = await readFile(join(process.cwd(), "assets", "christmas-preview", fichier));
  return new Response(new Uint8Array(content), {
    headers: { ...privateHeaders, "Content-Type": contentType },
  });
}
