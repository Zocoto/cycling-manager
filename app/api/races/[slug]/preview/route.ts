import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRaceQuickPreview } from "@/services/race-quick-preview";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    return Response.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  try {
    const { slug } = await params;
    const editionId = new URL(request.url).searchParams.get("editionId");
    const preview = await getRaceQuickPreview(slug, editionId);

    if (!preview) {
      return Response.json(
        { message: "Course introuvable." },
        { status: 404 },
      );
    }

    return Response.json(preview, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Échec du chargement de l’aperçu de course :", error);
    return Response.json(
      {
        message:
          "L’aperçu de la course est momentanément indisponible.",
      },
      { status: 500 },
    );
  }
}
