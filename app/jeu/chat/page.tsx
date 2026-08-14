import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { GlobalGameChat } from "@/components/game/global-game-chat";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getGlobalChatOverview } from "@/services/global-chat";

export const metadata: Metadata = {
  title: "Chat général",
  description:
    "Discutez en direct avec les autres Directeurs Sportifs de Cyclo Stratège.",
};

export default async function GlobalChatPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, chat] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getGlobalChatOverview(supabase),
  ]);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
        chatIsOpen
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17_0%,#0B302B_58%,#176951_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.22)] sm:px-10">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[42px] border-white/5"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]"
          />

          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
              Communauté · Temps réel
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Chat général
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
              Échangez avec les autres Directeurs Sportifs connectés. Partagez
              une URL de fiche équipe ou coureur pour afficher automatiquement
              sa tuile dans la conversation.
            </p>
          </div>
        </header>

        <div className="mt-7">
          <GlobalGameChat
            identity={chat.identity}
            initialOnlineDirectors={chat.onlineDirectors}
            initialMessages={chat.messages}
            initialHasMore={chat.hasMore}
            initialCursor={chat.nextCursor}
          />
        </div>
      </section>
    </main>
  );
}
