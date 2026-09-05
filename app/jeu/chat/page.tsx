import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { GlobalGameChat } from "@/components/game/global-game-chat";
import { isUuid } from "@/lib/game/direct-messages";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentDirectUnreadCount } from "@/services/direct-messages";
import { getGlobalChatOverview } from "@/services/global-chat";
import { isChatTranslationConfigured } from "@/services/chat-translation-provider";

export const metadata: Metadata = {
  title: "Chat général",
  description:
    "Discutez en direct avec les autres Directeurs Sportifs de Cyclo Stratège.",
};

type GlobalChatPageProps = {
  searchParams: Promise<{
    mp?: string | string[];
  }>;
};

export default async function GlobalChatPage({
  searchParams,
}: GlobalChatPageProps) {
  const params = await searchParams;
  const rawDirectRecipientId = Array.isArray(params.mp)
    ? params.mp[0]
    : params.mp;
  const initialDirectRecipientId =
    rawDirectRecipientId && isUuid(rawDirectRecipientId)
      ? rawDirectRecipientId
      : null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, chat, directUnreadCount] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getGlobalChatOverview(supabase),
    getCurrentDirectUnreadCount(supabase),
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
            initialOnlineDirectors={chat.onlineDirectors}
            initialMessages={chat.messages}
            initialHasMore={chat.hasMore}
            initialCursor={chat.nextCursor}
            initialDirectRecipientId={initialDirectRecipientId}
            initialDirectUnreadCount={directUnreadCount}
            translationEnabled={isChatTranslationConfigured()}
          />
        </div>
      </section>
    </main>
  );
}
