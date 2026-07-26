import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRiderQuickPreview } from "@/services/rider-quick-preview";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ identifiant: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    return Response.json(
      { message: "Authentification requise." },
      { status: 401 }
    );
  }

  try {
    const { identifiant } = await params;
    const preview = await getRiderQuickPreview({
      riderIdentifier: identifiant,
      viewerAuthUserId: user.id,
    });

    if (!preview) {
      return Response.json(
        { message: "Coureur introuvable." },
        { status: 404 }
      );
    }

    return Response.json(preview, {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (error) {
    console.error("Échec du chargement de l’aperçu coureur :", error);
    return Response.json(
      { message: "L’aperçu du coureur est momentanément indisponible." },
      { status: 500 }
    );
  }
}
