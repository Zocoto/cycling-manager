import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPublicTeam } from "@/services/public-directory";

export const metadata: Metadata = {
  title: "Fiche équipe",
  description:
    "Consultez la fiche publique d’une équipe dans Cyclostratège.",
};

type PublicTeamPageProps = {
  params: Promise<{
    identifiant: string;
  }>;
};

export default async function PublicTeamPage({
  params,
}: PublicTeamPageProps) {
  const { identifiant } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [team, headerData] = await Promise.all([
    getPublicTeam(supabase, identifiant),
    getGameHeaderData(supabase, user.id),
  ]);

  if (!team) {
    notFound();
  }

  const countryHref = `/jeu/nations/${team.country_code.toLowerCase()}`;
  const directorHref = team.sporting_director_username
    ? `/jeu/directeurs-sportifs/${encodeURIComponent(
        team.sporting_director_username
      )}`
    : null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={`/jeu/recherche?q=${encodeURIComponent(team.display_name)}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#176951] transition hover:text-[#278B70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
        >
          <span aria-hidden="true">←</span>
          Retour à la recherche
        </Link>

        <div className="mt-5 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.12)]">
          <div className="bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-9 text-[#FFFDF4] sm:px-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-3xl font-black shadow-xl">
                {getInitials(team.display_name)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#A8DEC6]">
                  Équipe cycliste
                </p>
                <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                  {team.display_name}
                </h1>
                <p className="mt-3 text-sm font-semibold text-[#D6DFD2]">
                  Identifiant : {team.public_identifier}
                </p>
              </div>

              <Link
                href={countryHref}
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
              >
                <CountryFlag
                  countryCode={team.country_code}
                  countryName={team.country_name}
                />
                <span>
                  <span className="block text-xs font-bold uppercase tracking-[0.14em] text-[#A8DEC6]">
                    Pays
                  </span>
                  <span className="mt-1 block font-black">
                    {team.country_name}
                  </span>
                </span>
              </Link>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-2">
            <InfoCard
              eyebrow="Sponsor principal"
              title={team.sponsor_name ?? "Aucun sponsor actif"}
              description={
                team.sponsor_name
                  ? "Partenaire commercial actuel de l’équipe."
                  : "Cette équipe évolue actuellement sans sponsor principal."
              }
            />

            {directorHref ? (
              <Link
                href={directorHref}
                className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5 shadow-[0_8px_24px_rgba(19,60,46,0.06)] transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-[0_14px_30px_rgba(19,60,46,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
              >
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
                  Directeur Sportif
                </p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#183F37]">
                      {team.sporting_director_name}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#278B70]">
                      @{team.sporting_director_username}
                    </p>
                  </div>
                  <span className="text-xl font-black text-[#278B70]" aria-hidden="true">
                    →
                  </span>
                </div>
              </Link>
            ) : (
              <InfoCard
                eyebrow="Directeur Sportif"
                title="Poste vacant"
                description="Aucun Directeur Sportif principal n’est actuellement affecté."
              />
            )}
          </div>
        </div>

        <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white/75 p-6 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            Prochainement
          </p>
          <h2 className="mt-2 text-xl font-black text-[#183F37]">
            Vie sportive de l’équipe
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {["Effectif public", "Résultats récents", "Palmarès et sponsors historiques"].map(
              (item) => (
                <div
                  key={item}
                  className="rounded-xl border border-dashed border-[#315B3E]/20 bg-[#EAF5F3]/55 px-4 py-5 text-sm font-bold text-[#60756E]"
                >
                  {item}
                </div>
              )
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function InfoCard({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
        {eyebrow}
      </p>
      <p className="mt-3 font-black text-[#183F37]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#60756E]">
        {description}
      </p>
    </div>
  );
}

function CountryFlag({
  countryCode,
  countryName,
}: {
  countryCode: string;
  countryName: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Drapeau : ${countryName}`}
      className={`fi fi-${countryCode.toLowerCase()} text-4xl shadow-sm`}
    />
  );
}

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
