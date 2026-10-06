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
    const { archive, filename, archiveSha256, database } =
      await generatePcmExport(new URL(request.url).searchParams.get("gala") === "fin-de-saison");
    const body = new Uint8Array(archive.byteLength);
    body.set(archive);

    return new Response(body, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(archive.byteLength),
        "Content-Type": "application/zip",
        "X-CS-Season": String(database.season),
        "X-CS-Teams": String(database.counts.teams),
        "X-CS-Riders": String(database.counts.riders),
        "X-CS-Contracts": String(database.counts.contracts),
        "X-CS-Rating-Range": `${database.ratingRange.minimum}-${database.ratingRange.maximum}`,
        "X-CS-Country-Fallbacks": String(database.countryFallbacks.length),
        "X-CS-Generated-At": database.generatedAt,
        "X-CS-Snapshot": database.snapshotSha256.slice(0, 16),
        "X-CS-Database": database.outputSha256.slice(0, 16),
        "X-CS-Output": archiveSha256.slice(0, 16),
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
