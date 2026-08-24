import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { TeamEquipmentBulkEditor } from "@/components/game/team-equipment-bulk-editor";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import Link from "@/components/ui/app-link";
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
  title: "Équiper l’équipe",
  description:
    "Attribuez le matériel de tous les coureurs depuis une seule vue et une seule validation.",
};

export const maxDuration = 300;

type TeamEquipmentPageProps = {
  searchParams: Promise<{
    affectations?: string | string[];
    nombre?: string | string[];
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
    getCurrentTeamEquipmentOverview(user.id, supabase),
  ]);

  if (!overview) redirect("/jeu");

  const success = readQuery(query.affectations) === "confirmees";
  const changedCount = Math.max(0, Number(readQuery(query.nombre)) || 0);
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
            href="/jeu/materiel/laboratoire"
            className="shrink-0 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[#60756E] transition hover:bg-[#EAF5F3] hover:text-[#176951] sm:px-5 sm:text-xs"
          >
            Labo R&D
          </Link>
          <Link
            href="/jeu/materiel/equiper"
            aria-current="page"
            className="shrink-0 rounded-xl bg-[#0B302B] px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white sm:px-5 sm:text-xs"
          >
            Équiper l’équipe
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
                  Équiper l’équipe
                </h1>
                <TutorialLaunchButton
                  tutorialKey={EQUIPMENT_TUTORIAL_KEY}
                  iconOnly
                />
              </div>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
                Choisissez les pièces de chaque coureur, contrôlez le stock
                projeté, puis appliquez tous les changements d’un coup.
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

        {success ? (
          <div className="mt-4 rounded-2xl border border-[#42B99A]/35 bg-[#EAF8F2] px-5 py-4 text-sm font-black text-[#176951]">
            {changedCount} affectation{changedCount > 1 ? "s" : ""} de matériel
            enregistrée{changedCount > 1 ? "s" : ""} en une seule fois.
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-[#EF5B65]/35 bg-[#FFF0F1] px-5 py-4 text-sm font-black text-[#A5313A]">
            {errorMessage.slice(0, 300)}
          </div>
        ) : null}

        <TeamEquipmentBulkEditor
          riders={overview.riders}
          catalog={overview.catalog}
          assignments={overview.assignments}
          pendingAssignments={overview.pendingAssignments}
          canSwapWheelSlots={overview.canSwapWheelSlots}
          jersey={riderJersey}
        />
      </section>
    </main>
  );
}

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
