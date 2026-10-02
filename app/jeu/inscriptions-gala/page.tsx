import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { PcmGalaRegistrationPanel } from "@/components/game/pcm-gala-registration-panel";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
} from "@/lib/rider-jersey";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPcmGalaRegistrationContext } from "@/services/pcm-gala-registration";
import { getTeamAmateurIdentityForAuthUser } from "@/services/team-amateur-identity";

export const metadata: Metadata = {
  title: "Inscriptions aux courses gala",
  description:
    "Choisissez une course gala et composez la sélection destinée à PCM26.",
};

type PcmGalaPageProps = {
  searchParams: Promise<{
    inscription?: string | string[];
    erreur?: string | string[];
  }>;
};

export default async function PcmGalaRegistrationPage({
  searchParams,
}: PcmGalaPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, context, resolvedSearchParams] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getPcmGalaRegistrationContext(supabase),
    searchParams,
  ]);
  const amateurIdentity = headerData.teamSponsorIdentity
    ? null
    : await getTeamAmateurIdentityForAuthUser(user.id).catch(() => null);
  const jersey = headerData.teamSponsorIdentity
    ? createSponsoredRiderJersey({
        colors: headerData.teamSponsorIdentity.sponsor.colors,
        style: headerData.teamSponsorIdentity.selectedJersey.style,
        imagePath: headerData.teamSponsorIdentity.selectedJersey.imagePath,
      })
    : amateurIdentity
      ? createAmateurRiderJersey(amateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorVisual}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1320px] px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <header className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
              Événement spécial · PCM26
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              Courses de gala
            </h1>
            <p className="mt-4 text-base font-medium leading-7 text-[#557068]">
              Engagez une sélection de sept coureurs sur l’un des trois profils.
              L’inscription servira exclusivement à construire la startlist de la
              retransmission PCM26.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                "1 équipe · 1 course",
                "7 coureurs",
                "Notes natives",
                "Aucun impact sportif",
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-[#BDD8D0] bg-white px-3 py-1.5 text-xs font-black text-[#42675C]"
                >
                  {label}
                </span>
              ))}
            </div>
          </header>
          <BackToOfficeLink />
        </div>

        <PcmGalaRegistrationPanel
          {...context}
          jersey={jersey}
          successMessage={readMessage(resolvedSearchParams.inscription)}
          errorMessage={readMessage(resolvedSearchParams.erreur)}
        />
      </section>
    </main>
  );
}

function readMessage(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
