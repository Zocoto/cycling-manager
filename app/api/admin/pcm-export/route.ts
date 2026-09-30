import { canAccessPcmExport } from "@/lib/game/pcm-export/access";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generatePcmExport } from "@/services/pcm-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    return Response.json({ error: "Authentification requise." }, { status: 401 });
  }
  if (!canAccessPcmExport(user.email)) {
    return Response.json({ error: "Ressource introuvable." }, { status: 404 });
  }
  if (!isTrustedExportRequest(request)) {
    return Response.json({ error: "Requête d’export invalide." }, { status: 403 });
  }

  try {
    const { cdb, metadata } = await generatePcmExport();
    const body = new Uint8Array(cdb.byteLength);
    body.set(cdb);

    return new Response(body, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="${metadata.filename}"`,
        "Content-Length": String(metadata.bytes),
        "Content-Type": "application/octet-stream",
        "X-CS-Season": String(metadata.season),
        "X-CS-Teams": String(metadata.counts.teams),
        "X-CS-Riders": String(metadata.counts.riders),
        "X-CS-Contracts": String(metadata.counts.contracts),
        "X-CS-Rating-Range": `${metadata.ratingRange.minimum}-${metadata.ratingRange.maximum}`,
        "X-CS-Country-Fallbacks": String(metadata.countryFallbacks.length),
        "X-CS-Generated-At": metadata.generatedAt,
        "X-CS-Snapshot": metadata.snapshotSha256.slice(0, 16),
        "X-CS-Output": metadata.outputSha256.slice(0, 16),
      },
    });
  } catch (error) {
    console.error("Echec de l'export PCM26.", error);
    return Response.json(
      {
        error:
          "L’export PCM26 n’a pas pu être généré. Les données n’ont pas été modifiées.",
      },
      { status: 500 },
    );
  }
}

function isTrustedExportRequest(request: Request) {
  const origin = request.headers.get("origin");
  const requestedWith = request.headers.get("x-cs-requested-with");

  return (
    origin === new URL(request.url).origin &&
    requestedWith === "pcm-export-admin"
  );
}
