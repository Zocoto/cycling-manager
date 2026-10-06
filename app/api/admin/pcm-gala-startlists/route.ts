import { canAccessPcmExport } from "@/lib/game/pcm-export/access";
import { isPcmGalaRaceKey } from "@/lib/game/pcm-gala-races";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generatePcmGalaStartlistExport } from "@/services/pcm-gala-startlist-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
  if (!isTrustedRequest(request)) {
    return Response.json({ error: "Requête d’export invalide." }, { status: 403 });
  }

  const eventKey = new URL(request.url).searchParams.get("eventKey");
  if (eventKey !== null && !isPcmGalaRaceKey(eventKey)) {
    return Response.json({ error: "Course gala inconnue." }, { status: 400 });
  }

  try {
    const result = await generatePcmGalaStartlistExport(eventKey ?? undefined);
    const body = new Uint8Array(result.archive.byteLength);
    body.set(result.archive);

    return new Response(body, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.archive.byteLength),
        "Content-Type": "application/zip",
        "X-CS-Season": String(result.season),
        "X-CS-Events": String(result.eventCount),
        "X-CS-Simulations": String(result.simulationCount),
        "X-CS-Teams": String(result.registeredTeamCount),
        "X-CS-Riders": String(result.registeredRiderCount),
        "X-CS-Generated-At": result.generatedAt,
      },
    });
  } catch (error) {
    console.error("Échec de l’export des startlists gala PCM26.", error);
    return Response.json(
      { error: "Les startlists n’ont pas pu être générées. Aucune donnée n’a été modifiée." },
      { status: 500 },
    );
  }
}

function isTrustedRequest(request: Request) {
  return (
    request.headers.get("origin") === new URL(request.url).origin &&
    request.headers.get("x-cs-requested-with") === "pcm-gala-startlists-admin"
  );
}

