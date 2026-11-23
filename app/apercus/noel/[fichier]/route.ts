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
  ["rudolphe-lanterne-rouge.webp", "image/webp"],
]);

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

function notFound() {
  return new Response(null, { status: 404, headers: privateHeaders });
}

function accessNotice(authenticated: boolean) {
  const loginHref = "/connexion?returnTo=" + encodeURIComponent("/apercus/noel/index.html#tournee");
  const heading = authenticated ? "Cet aperçu est privé" : "Connecte-toi pour ouvrir l’aperçu";
  const message = authenticated
    ? "Le compte actuellement connecté n’a pas accès à ce brouillon. Ouvre-le avec ton compte de test autorisé."
    : "Ton navigateur doit être connecté à Cyclo Stratège pour afficher le brouillon de Noël. Après connexion, tu retrouveras directement le mini-jeu.";
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aperçu privé · Cyclo Stratège</title>
    <style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#132e28;color:#fff6df;font:16px/1.6 system-ui,sans-serif}main{box-sizing:border-box;width:min(540px,calc(100% - 32px));padding:32px;border:1px solid #c5a361;border-radius:16px;background:#1b3b31}p{color:#e0dfcd}h1{font:600 clamp(1.6rem,6vw,2.2rem)/1.2 Georgia,serif}a{display:inline-block;margin-top:12px;padding:12px 18px;border-radius:8px;background:#f0ce82;color:#19362b;font-weight:750;text-decoration:none}a:focus-visible{outline:3px solid white;outline-offset:4px}.brand{color:#f0ce82;font-size:13px;letter-spacing:.12em;text-transform:uppercase}</style></head>
    <body><main><p class="brand">Cyclo Stratège · Noël</p><h1>${heading}</h1><p>${message}</p><a href="${authenticated ? "/jeu" : loginHref}" target="_top">${authenticated ? "Ouvrir mon bureau du DS" : "Se connecter et ouvrir le mini-jeu"}</a></main></body></html>`, {
    status: authenticated ? 403 : 401,
    headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(_request: Request, { params }: RouteContext<"/apercus/noel/[fichier]">) {
  const { fichier } = await params;
  const contentType = fileTypes.get(fichier);
  if (!contentType) return notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user || !previewAccountIds.has(user.id)) {
    return fichier.endsWith(".html") ? accessNotice(!error && !!user) : notFound();
  }

  const content = await readFile(join(process.cwd(), "assets", "christmas-preview", fichier));
  return new Response(new Uint8Array(content), {
    headers: { ...privateHeaders, "Content-Type": contentType },
  });
}
