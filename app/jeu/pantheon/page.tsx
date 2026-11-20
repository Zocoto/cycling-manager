import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { GameSectionTabLink, GameSectionTabs } from "@/components/game/game-section-tabs";
import { PantheonRecords } from "@/components/game/pantheon-records";
import {
  getPantheonHref,
  readPantheonFilters,
  type PantheonSearchParams,
} from "@/lib/game/pantheon";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPantheonData } from "@/services/pantheon";

export const metadata: Metadata = {
  title: "Panthéon",
  description: "Tous les vainqueurs et classements historiques de Cyclo Stratège.",
};

export default async function PantheonPage({ searchParams }: {
  searchParams: Promise<PantheonSearchParams>;
}) {
  const filters = readPantheonFilters(await searchParams);
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const [header, records] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getPantheonData(supabase, filters).catch((error: unknown) => {
      console.error("Impossible de charger le Panthéon", error);
      return null;
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={header.displayName}
        sponsor={header.teamSponsorVisual}
        maxWidth="wide"
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <header className="relative isolate overflow-hidden rounded-3xl border border-[#d8bf79]/25 bg-[#102720] text-[#FFFDF4] shadow-xl">
          <div className="absolute inset-y-0 right-0 w-1/2 sm:w-2/5">
            <Image
              src="/images/race-trophies/boucle-des-provinces.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 460px, 50vw"
              className="object-cover object-center opacity-70 sm:opacity-100"
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#102720_42%,#102720cf_61%,transparent_95%)]" />
          <div className="relative max-w-2xl px-6 py-10 sm:px-10 sm:py-14">
            <h1 className="font-serif text-5xl leading-tight font-black tracking-tight sm:text-6xl">Panthéon</h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-[#E1EBDE]">
              Retrouvez les vainqueurs de chaque course et comparez les palmarès des coureurs, actifs et retraités.
            </p>
          </div>
        </header>

        <GameSectionTabs ariaLabel="Rubriques du Panthéon" columns={2} className="mt-5">
          <GameSectionTabLink
            href={getPantheonHref(filters, { view: "palmares", query: "", raceKey: null, page: 1 })}
            active={filters.view === "palmares"}
            label="Palmarès des courses"
            description="Vainqueurs et éditions"
          />
          <GameSectionTabLink
            href={getPantheonHref(filters, { view: "classement", query: "", page: 1 })}
            active={filters.view === "classement"}
            label="Classement des coureurs"
            description="Victoires et prestige"
          />
        </GameSectionTabs>

        {records ? (
          <PantheonRecords filters={filters} records={records} />
        ) : (
          <p role="status" className="mt-6 rounded-2xl border border-[#315B3E]/15 bg-white p-6 text-[#415E52]">
            Le Panthéon est temporairement indisponible. Réessayez dans un instant.
          </p>
        )}
      </div>
    </main>
  );
}
