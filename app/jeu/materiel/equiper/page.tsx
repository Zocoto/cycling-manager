import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { TeamEquipmentManager } from "@/components/game/team-equipment-manager";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import Link from "@/components/ui/app-link";
import {
  EQUIPMENT_SLOTS,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import {
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
} from "@/lib/rider-jersey";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EQUIPMENT_TUTORIAL_KEY } from "@/lib/tutorial/equipment";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentTeamEquipmentOverview } from "@/services/team-equipment";

export const metadata: Metadata = {
  title: "Équiper ses coureurs",
  description:
    "Gérez les équipements de tous les coureurs de votre équipe depuis une seule vue.",
};

type TeamEquipmentPageProps = {
  searchParams: Promise<{
    coureur?: string | string[];
    slot?: string | string[];
    succes?: string | string[];
    erreur?: string | string[];
  }>;
};

export default async function TeamEquipmentPage({
  searchParams,
}: TeamEquipmentPageProps) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentTeamEquipmentOverview(user.id),
  ]);

  if (!overview) redirect("/jeu");

  const requestedRiderId = readQuery(query.coureur);
  const initialRiderId = overview.riders.some(
    (rider) => rider.id === requestedRiderId,
  )
    ? requestedRiderId
    : null;
  const requestedSlot = readQuery(query.slot);
  const initialSlot = isEquipmentSlot(requestedSlot) ? requestedSlot : null;
  const successMessage = readQuery(query.succes);
  const errorMessage = readQuery(query.erreur);
  const riderJersey = headerData.teamSponsorIdentity
    ? createSponsoredRiderJersey({
        colors: headerData.teamSponsorIdentity.sponsor.colors,
        style: headerData.teamSponsorIdentity.selectedJersey.style,
        imagePath: headerData.teamSponsorIdentity.selectedJersey.imagePath,
      })
    : FREE_AGENT_RIDER_JERSEY;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 sm:py-10">
        <BackToOfficeLink />

        <nav
          aria-label="Rubriques du matériel"
          className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-[#315B3E]/12 bg-white p-2 shadow-sm"
        >
          <Link
            href="/jeu/materiel"
            className="shrink-0 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[#60756E] transition hover:bg-[#EAF5F3] hover:text-[#176951] sm:px-5 sm:text-xs"
          >
            Matériel commercial
          </Link>
          <Link
            href="/jeu/materiel/equipementier"
            className="shrink-0 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[#60756E] transition hover:bg-[#EAF5F3] hover:text-[#176951] sm:px-5 sm:text-xs"
          >
            Équipementier
          </Link>
          <Link
            href="/jeu/materiel/equiper"
            aria-current="page"
            className="shrink-0 rounded-xl bg-[#0B302B] px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white sm:px-5 sm:text-xs"
          >
            Équiper ses coureurs
          </Link>
        </nav>

        <header className="relative mt-5 overflow-hidden rounded-[1.8rem] bg-[linear-gradient(125deg,#071A17,#176951)] px-6 py-6 text-white shadow-[0_20px_60px_rgba(19,60,46,0.18)] sm:px-9 sm:py-8">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-24 h-64 w-64 rounded-full border-[42px] border-white/5"
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
                Atelier de l’équipe
              </p>
              <div className="mt-2 flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Équiper ses coureurs
                </h1>
                <TutorialLaunchButton
                  tutorialKey={EQUIPMENT_TUTORIAL_KEY}
                  iconOnly
                />
              </div>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
                Consultez tout l’effectif, repérez les emplacements libres et
                attribuez les pièces sans ouvrir chaque fiche coureur.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide">
                {overview.riders.length} coureurs
              </span>
              <span className="rounded-full border border-[#F2C94C]/35 bg-[#F2C94C]/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#FFE483]">
                8 emplacements
              </span>
            </div>
          </div>
        </header>

        {successMessage ? (
          <div className="mt-4 rounded-2xl border border-[#42B99A]/35 bg-[#EAF8F2] px-5 py-4 text-sm font-black text-[#176951]">
            {successMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-[#EF5B65]/35 bg-[#FFF0F1] px-5 py-4 text-sm font-black text-[#A5313A]">
            {errorMessage}
          </div>
        ) : null}

        <TeamEquipmentManager
          teamName={overview.teamName}
          riders={overview.riders}
          catalog={overview.catalog}
          assignments={overview.assignments}
          pendingAssignments={overview.pendingAssignments}
          jersey={riderJersey}
          initialRiderId={initialRiderId}
          initialSlot={initialSlot}
        />
      </section>
    </main>
  );
}

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isEquipmentSlot(value: string): value is EquipmentSlot {
  return EQUIPMENT_SLOTS.includes(value as EquipmentSlot);
}
