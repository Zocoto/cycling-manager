import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { FanClubPilot } from "@/components/game/fan-club-pilot";
import { GameHeader } from "@/components/game/game-header";
import { getFanClubLiveData } from "@/services/fan-club-data";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTeamFanClubBuildings } from "@/services/fan-club-buildings";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Pilote Fan Club",
  description:
    "Prototype interactif de la future rubrique de gestion des supporters.",
};

export default async function FanClubPilotPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const headerData = await getGameHeaderData(supabase, user.id);
  if (!headerData.teamId) {
    redirect("/jeu");
  }

  const buildings = await getTeamFanClubBuildings(supabase, headerData.teamId);
  if (buildings.headquartersLevel < 1) {
    redirect("/jeu");
  }
  const liveData = await getFanClubLiveData({
    supabase,
    authUserId: user.id,
    headquartersLevel: buildings.headquartersLevel,
  });
  if (!liveData) {
    redirect("/jeu");
  }
  const metrics = [
    {
      label: "Supporters",
      value: liveData.supporterCount.toLocaleString("fr-FR"),
      detail: "40 % mobilisables par déplacement",
    },
    {
      label: "Ferveur",
      value: `${liveData.fervor} / 100`,
      detail:
        liveData.supporterTrend > 0
          ? `+${liveData.supporterTrend.toLocaleString("fr-FR")} liés aux résultats`
          : "Audience stable cette saison",
    },
    {
      label: "Popularité de l’effectif",
      value: `${liveData.popularityIndex} / 100`,
      detail: `${liveData.sportingResultCount} résultat(s) analysé(s)`,
    },
  ];

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <aside className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#D29F32]/35 bg-[#FFF5D8] px-5 py-4 text-sm font-bold text-[#76530D]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.17em]">
              Pilote en conditions réelles
            </p>
            <p className="mt-1 leading-6">
              Effectif, résultats, popularités et supporters sont calculés
              depuis votre équipe. Les achats, ventes et effets sportifs
              restent locaux au pilote pendant cette phase d’épreuve.
            </p>
          </div>
          <span className="rounded-full bg-[#F2C94C] px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#513A0B]">
            Accès limité par bâtiment
          </span>
        </aside>

        <header className="relative mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17_0%,#0B302B_52%,#176951_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.22)] sm:px-10 sm:py-11">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:28px_28px]"
          />

          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(310px,0.48fr)] xl:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Communauté · Fidélité · Rayonnement
              </p>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Fan Club de {liveData.teamName}
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2] sm:text-base">
                Développez la communauté, valorisez les figures du club,
                organisez les déplacements et transformez la ferveur en une
                nouvelle force collective.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <article
                    key={metric.label}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#9BE0BC]">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-black text-[#F2C94C]">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#BFD1C6]">
                      {metric.detail}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/10 p-5 backdrop-blur-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9BE0BC]">
                Infrastructures de l’équipe
              </p>
              <BuildingLevel
                name="Siège du Fan Club"
                level={buildings.headquartersLevel}
                detail="Popularité et déplacements de supporters"
              />
              {buildings.shopLevel > 0 ? (
                <BuildingLevel
                  name="Magasin du club"
                  level={buildings.shopLevel}
                  detail="Maillot de l’équipe · 300 objets maximum au niveau 1"
                />
              ) : null}
            </div>
          </div>
        </header>

        <FanClubPilot
          headquartersLevel={buildings.headquartersLevel}
          shopLevel={buildings.shopLevel}
          data={liveData}
        />
      </section>
    </main>
  );
}

function BuildingLevel({
  name,
  level,
  detail,
}: {
  name: string;
  level: number;
  detail: string;
}) {
  return (
    <div className="mt-4 border-t border-white/10 pt-4 first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-4">
        <p className="font-black text-white">{name}</p>
        <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-black text-[#F2C94C]">
          N{level}
        </span>
      </div>
      <p className="mt-1 text-xs font-bold leading-5 text-[#BFD1C6]">
        {detail}
      </p>
    </div>
  );
}
