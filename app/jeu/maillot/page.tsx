import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { AmateurJerseyEditor } from "@/components/game/amateur-jersey-editor";
import { GameHeader } from "@/components/game/game-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getTeamAmateurIdentityForAuthUser } from "@/services/team-amateur-identity";

export const metadata: Metadata = {
  title: "Atelier du maillot",
  description:
    "Personnalisez les couleurs et le motif du maillot permanent de votre équipe.",
};

export default async function JerseyEditorPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, amateurIdentity] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getTeamAmateurIdentityForAuthUser(user.id),
  ]);

  if (!amateurIdentity?.isConfigured || !amateurIdentity.amateurName) {
    redirect("/jeu/directeur-sportif#equipe-amateur");
  }

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/jeu"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
          >
            <span aria-hidden="true">←</span>
            Retour au bureau
          </Link>
          <Link
            href="/jeu/effectif"
            className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white px-4 text-sm font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Voir l’effectif
          </Link>
        </div>

        <header className="relative mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-20 h-72 w-72 rounded-full border-[42px] border-white/5"
          />
          <div className="relative max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9BE0CA]">
                Identité visuelle
              </p>
              <span className="rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#17261E]">
                12 motifs
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Atelier du maillot
            </h1>
            <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-[#D2E1DA] sm:text-lg">
              Faites évoluer le maillot de {amateurIdentity.amateurName} à tout moment. Chaque motif possède une version dédiée aux portraits afin de conserver la même identité dans tout le jeu.
            </p>
          </div>
        </header>

        <div className="mt-7 rounded-[2rem] border border-[#315B3E]/15 bg-white p-5 shadow-[0_24px_70px_rgba(19,60,46,0.1)] sm:p-8">
          <AmateurJerseyEditor
            initialJersey={amateurIdentity.jersey}
            teamName={amateurIdentity.amateurName}
            activeSponsorName={
              headerData.teamSponsorIdentity?.sponsor.name ?? null
            }
          />
        </div>
      </section>
    </main>
  );
}
