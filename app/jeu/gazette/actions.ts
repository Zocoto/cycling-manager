"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function publishMediaCenterArticleAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const includeSponsor = formData.get("includeSponsor") === "on";
  if (
    title.length < 5 ||
    title.length > 100 ||
    body.length < 40 ||
    body.length > 1600
  ) {
    redirect(
      "/jeu/gazette?erreur=" +
        encodeURIComponent(
          "Le titre doit contenir 5 à 100 caractères et la tribune 40 à 1 600 caractères.",
        ),
    );
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("publish_current_team_media_article", {
    p_title: title,
    p_body: body,
    p_include_sponsor: includeSponsor,
  });
  if (error) {
    redirect(
      `/jeu/gazette?erreur=${encodeURIComponent(error.message.slice(0, 300))}`,
    );
  }
  revalidatePath("/jeu/gazette");
  revalidatePath("/jeu");
  revalidatePath("/jeu/profil");
  redirect("/jeu/gazette?article=propose");
}
