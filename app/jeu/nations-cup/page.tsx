import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { SvgCountryFlag } from "@/components/game/svg-country-flag";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getNationsCupOverview } from "@/services/nations-cup";

export const metadata: Metadata = {
  title: "Classement Nations Cup",
  description:
    "Classement général, divisions, groupes et résultats des cinq épreuves de la Nations Cup.",
};

const numberFormatter = new Intl.NumberFormat("fr-FR");

export default async function NationsCupPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getNationsCupOverview(),
  ]);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />
      <section className="mx-auto max-w-[1500px] px-5 py-9 sm:px-8 sm:py-12">
        <BackToOfficeLink />
        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F2C94C]">
              {overview?.seasonName ?? "Saison active"} · rendez-vous J24
            </p>
            <h1 className="mt-3 text-3xl font-black sm:text-5xl">
              Nations Cup professionnelle
            </h1>
            <p className="mt-4 max-w-4xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
              Cinq coureurs différents par nation, cinq terrains et un seul
              classement cumulé. Les places donnent de 50 à 1 point au top 16.
            </p>
          </div>
        </header>

        {!overview || overview.gameYear < 3 ? (
          <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-8 shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
            <h2 className="text-2xl font-black text-[#183F37]">Première édition en Saison 3</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
              La page publiera automatiquement les divisions, groupes et résultats dès l’ouverture de la S3, puis se mettra à jour après chaque arrivée.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-7 grid gap-3 sm:grid-cols-5">
              {overview.events.map((event) => (
                <Link
                  key={event.id}
                  href={`/jeu/courses/${event.slug}`}
                  className="rounded-2xl border border-[#315B3E]/12 bg-white p-4 shadow-[0_10px_25px_rgba(19,60,46,0.06)] transition hover:-translate-y-0.5 hover:border-[#278B70]/40"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#278B70]">
                    {formatProfile(event.profileType)}
                  </p>
                  <p className="mt-2 font-black text-[#183F37]">{event.name}</p>
                  <p className="mt-2 text-xs font-bold text-[#789087]">
                    {event.status === "completed" ? "Résultats officiels" : "Départ J24 à 18 h"} →
                  </p>
                </Link>
              ))}
            </section>

            <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
              <div className="border-b border-[#315B3E]/10 px-6 py-5 sm:px-8">
                <h2 className="text-2xl font-black text-[#183F37]">Classement général</h2>
                <p className="mt-2 text-sm font-semibold text-[#60756E]">
                  Classement global et rang réel dans la division et le groupe attribués en début de saison.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full border-collapse text-sm">
                  <thead className="bg-[#F2F8F5] text-[10px] font-black uppercase tracking-[0.11em] text-[#60756E]">
                    <tr>
                      <th className="px-4 py-3 text-center">#</th>
                      <th className="px-4 py-3 text-left">Nation</th>
                      <th className="px-4 py-3 text-center">Div./groupe</th>
                      {overview.events.map((event) => (
                        <th key={event.id} className="px-3 py-3 text-center">{event.name}</th>
                      ))}
                      <th className="px-4 py-3 text-center">Points</th>
                      <th className="px-4 py-3 text-center">Rang div.</th>
                      <th className="px-4 py-3 text-center">Rang groupe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#315B3E]/10">
                    {overview.standings.map((standing) => (
                      <tr key={standing.countryId} className="hover:bg-[#F8FBF9]">
                        <td className="px-4 py-3 text-center text-lg font-black text-[#183F37]">{standing.overallRank}</td>
                        <td className="px-4 py-3">
                          <Link href={`/jeu/federations/${standing.countryCode.toLowerCase()}`} className="flex items-center gap-3 font-black text-[#183F37] hover:text-[#176951]">
                            <span className="grid h-8 w-11 place-items-center overflow-hidden rounded-md border border-[#315B3E]/12 bg-white">
                              <svg viewBox="0 0 44 32" className="h-full w-full" aria-hidden="true">
                                <SvgCountryFlag countryCode={standing.countryCode} x={0} y={0} width={44} height={32} />
                              </svg>
                            </span>
                            <span>{standing.countryName}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center font-black text-[#60756E]">
                          D{standing.division}{standing.groupCode ? standing.groupCode : ""}
                        </td>
                        {overview.events.map((event) => {
                          const rank = standing.eventRanks[event.slug];
                          return (
                            <td key={event.id} className="px-3 py-3 text-center font-bold text-[#183F37]">
                              {rank == null ? "—" : `#${rank}`}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center text-lg font-black text-[#176951]">{numberFormatter.format(standing.points)}</td>
                        <td className="px-4 py-3 text-center font-black">#{standing.divisionRank}</td>
                        <td className="px-4 py-3 text-center font-black">{standing.groupCode ? `#${standing.groupRank}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function formatProfile(profileType: string): string {
  const labels: Record<string, string> = {
    mountain: "Montagne",
    hilly: "Vallons",
    sprint: "Sprint",
    cobbles: "Pavés",
    time_trial: "Contre-la-montre",
  };
  return labels[profileType] ?? "Profil mixte";
}
