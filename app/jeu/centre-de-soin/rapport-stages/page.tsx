import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { DailyFormCampTextReport } from "@/components/game/daily-form-camp-report";
import { GameHeader } from "@/components/game/game-header";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDailyFormCampReport } from "@/services/daily-form-camp-report";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Rapport des stages de forme",
  description: "Consultez les gains de forme réellement reçus par vos coureurs en stage.",
};

export default async function DailyFormCampReportPage({ searchParams }: {
  searchParams: Promise<{ jour?: string | string[] }>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const [report, headerData] = await Promise.all([
    getDailyFormCampReport(supabase, query.jour),
    getGameHeaderData(supabase, user.id),
  ]);
  if (!report) redirect("/jeu/centre-de-soin?onglet=forme");

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader simulatorEmail={user.email} displayName={headerData.displayName} sponsor={headerData.teamSponsorVisual} maxWidth="wide" />
      <section className="mx-auto max-w-[1250px] px-5 py-8 sm:px-8 sm:py-11">
        <BackToOfficeLink />
        <DailyFormCampTextReport report={report} />
      </section>
    </main>
  );
}
