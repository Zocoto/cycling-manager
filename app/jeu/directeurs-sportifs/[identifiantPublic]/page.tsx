import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPublicSportingDirector } from "@/services/public-directory";
import { getActiveTeamSponsorIdentity } from "@/services/team-sponsor-identity";

export const metadata: Metadata = {
  title: "Fiche Directeur Sportif",
  description:
    "Consultez la fiche publique d’un Directeur Sportif dans Cyclostratège.",
};

type PublicSportingDirectorPageProps = {
  params: Promise<{
    identifiantPublic: string;
  }>;
};

const numberFormatter = new Intl.NumberFormat("fr-FR");

export default async function PublicSportingDirectorPage({
  params,
}: PublicSportingDirectorPageProps) {
  const { identifiantPublic } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [profile, headerData] = await Promise.all([
    getPublicSportingDirector(identifiantPublic),
    getGameHeaderData(supabase, user.id),
  ]);

  if (!profile) {
    notFound();
  }

  const teamSponsorIdentity = profile.team_id
    ? await getActiveTeamSponsorIdentity(profile.team_id)
    : null;

  const countryHref = `/jeu/nations/${profile.country_code.toLowerCase()}`;
  const teamHref = profile.team_id
    ? `/jeu/equipes/${profile.team_id}`
    : null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={`/jeu/recherche?q=${encodeURIComponent(profile.public_identifier)}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#176951] transition hover:text-[#278B70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
        >
          <span aria-hidden="true">←</span>
          Retour à la recherche
        </Link>

        <div className="mt-5 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.12)]">
          <div className="bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-9 text-[#FFFDF4] sm:px-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <SportingDirectorAvatar
                avatarKey={profile.avatar_key}
                size="large"
                label={`Avatar de ${profile.display_name}`}
                className="ring-4 ring-white/10"
              />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#A8DEC6]">
                  Directeur Sportif
                </p>
                <h1 className="mt-2 truncate text-3xl font-black sm:text-4xl">
                  {profile.display_name}
                </h1>
                <p className="mt-2 font-semibold text-[#F2C94C]">
                  @{profile.public_identifier}
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-left sm:text-right">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A8DEC6]">
                  Réputation
                </p>
                <p className="mt-1 text-2xl font-black">
                  {numberFormatter.format(profile.reputation_points ?? 0)} pts
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-2">
            <PublicLinkCard
              href={countryHref}
              eyebrow="Nationalité"
              title={profile.country_name}
              description="Ouvrir la fiche de la nation"
              leading={
                <CountryFlag
                  countryCode={profile.country_code}
                  countryName={profile.country_name}
                />
              }
            />

            {teamHref ? (
              <PublicLinkCard
                href={teamHref}
                eyebrow="Équipe actuelle"
                title={profile.team_name ?? "Équipe actuelle"}
                description={`${teamSponsorIdentity ? "Équipe Pro" : "Équipe amateur"} · Ouvrir la fiche de l’équipe`}
                leading={
                  teamSponsorIdentity ? (
                    <SponsorLogoMark
                      src={teamSponsorIdentity.sponsor.logoPath}
                      alt={`Logo de ${teamSponsorIdentity.sponsor.name}`}
                      sponsorName={teamSponsorIdentity.sponsor.name}
                      primaryColor={teamSponsorIdentity.sponsor.colors.primary}
                      backgroundColor={teamSponsorIdentity.sponsor.colors.background}
                      textColor={teamSponsorIdentity.sponsor.colors.text}
                      className="h-12 w-20 rounded-xl p-1.5"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#176951] text-lg font-black text-white">
                      {getInitials(profile.team_name ?? "Équipe")}
                    </span>
                  )
                }
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#EAF5F3]/55 p-5">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
                  Équipe actuelle
                </p>
                <p className="mt-2 font-black text-[#183F37]">
                  Sans équipe
                </p>
                <p className="mt-1 text-sm text-[#60756E]">
                  Aucune affectation active pour le moment.
                </p>
              </div>
            )}
          </div>
        </div>

        <FutureSections
          items={[
            "Historique des équipes",
            "Résultats récents",
            "Palmarès et statistiques",
          ]}
        />
      </section>
    </main>
  );
}

function PublicLinkCard({
  href,
  eyebrow,
  title,
  description,
  leading,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  leading: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5 shadow-[0_8px_24px_rgba(19,60,46,0.06)] transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-[0_14px_30px_rgba(19,60,46,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
          {eyebrow}
        </span>
        <span className="mt-1 block truncate font-black text-[#183F37]">
          {title}
        </span>
        <span className="mt-1 block text-sm text-[#60756E]">
          {description}
        </span>
      </span>
      <span className="text-xl font-black text-[#278B70]" aria-hidden="true">
        →
      </span>
    </Link>
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
      aria-label={`Drapeau : ${countryName}`}
      className={`fi fi-${countryCode.toLowerCase()} text-4xl shadow-sm`}
    />
  );
}

function FutureSections({ items }: { items: string[] }) {
  return (
    <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white/75 p-6 sm:p-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
        Prochainement
      </p>
      <h2 className="mt-2 text-xl font-black text-[#183F37]">
        Données sportives préparées
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-xl border border-dashed border-[#315B3E]/20 bg-[#EAF5F3]/55 px-4 py-5 text-sm font-bold text-[#60756E]"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
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
