import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HalloweenPreview } from "@/components/halloween-preview/halloween-preview";
import { isHalloweenPreviewBoard } from "@/lib/game/halloween-preview";
import { canAccessPrivateAdmin } from "@/lib/game/private-admin-access";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Planches Halloween · aperçu privé",
  description: "Planches de conception privées, sans effet sur le jeu.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function HalloweenPreviewPage({
  params,
}: {
  params: Promise<{ planche: string }>;
}) {
  const { planche } = await params;
  // Keep the previously shared candy-board URL usable, behind the same access gate.
  const board = planche === "trick-or-treat" ? "cycliste-sans-tete" : planche;
  if (!isHalloweenPreviewBoard(board)) notFound();

  // Fail closed if authentication is temporarily unavailable as well.
  const authentication = await createSupabaseServerClient()
    .then(getAuthenticatedUser)
    .catch(() => null);
  if (!authentication || authentication.error) notFound();
  const { data: { user } } = authentication;
  if (!user) notFound();
  if (!canAccessPrivateAdmin(user.email)) notFound();

  // No game layout, profile query, rewards action or gameplay mutation here.
  return <HalloweenPreview board={board} />;
}
