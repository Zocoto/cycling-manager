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

        <div className="mt-5">
          <GlobalGameChat
            identity={chat.identity}
            initialMessages={chat.messages}
            initialHasMore={chat.hasMore}
            initialCursor={chat.nextCursor}
          />
        </div>
      </section>
    </main>
  );
}
