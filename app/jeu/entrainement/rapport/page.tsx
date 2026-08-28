import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { DailyTrainingTextReport } from "@/components/game/daily-training-text-report";
import { GameHeader } from "@/components/game/game-header";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDailySeniorTrainingReport } from "@/services/daily-training-report";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Rapport quotidien des seniors",
  description: "Résumé textuel des gains d’entraînement de l’équipe senior.",
};

export default async function SeniorTrainingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string | string[] }>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const [report, headerData] = await Promise.all([
    getDailySeniorTrainingReport(user.id, query.jour),
    getGameHeaderData(supabase, user.id),
  ]);
  if (!report) redirect("/jeu/entrainement");

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />
      <section className="mx-auto max-w-[1250px] px-5 py-8 sm:px-8 sm:py-11">
        <BackToOfficeLink />
        <DailyTrainingTextReport
          report={report}
          baseHref="/jeu/entrainement/rapport"
          sectionHref="/jeu/entrainement?onglet=training"
          sectionLabel="Entraînements"
        />
      </section>
    </main>
  );
}
