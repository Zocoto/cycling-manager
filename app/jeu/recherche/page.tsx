import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import {
  GLOBAL_SEARCH_MIN_LENGTH,
  getGlobalSearchResultHref,
  groupGlobalSearchResults,
  normalizeGlobalSearchQuery,
  type GlobalSearchResult,
} from "@/lib/game/global-search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchGameDirectory } from "@/services/global-search";
import {
  getActiveTeamSponsorIdentityForAuthUser,
  type TeamSponsorIdentity,
} from "@/services/team-sponsor-identity";

export const metadata: Metadata = {
  title: "Recherche globale",
  description:
    "Recherchez un Directeur Sportif, une équipe ou une nation dans Cyclostratège.",
};

type GlobalSearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

type HeaderProfile = {
  display_name: string;
};

type SearchSectionProps = {
  title: string;
  eyebrow: string;
  results: GlobalSearchResult[];
  emptyLabel: string;
  renderResult: (result: GlobalSearchResult) => React.ReactNode;
};

const numberFormatter = new Intl.NumberFormat("fr-FR");

export default async function GlobalSearchPage({
  searchParams,
}: GlobalSearchPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = normalizeGlobalSearchQuery(
    resolvedSearchParams.q
  );
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const profilePromise = supabase
    .from("sporting_directors")
    .select("display_name")
    .eq("auth_user_id", user.id)
    .maybeSingle<HeaderProfile>();

  const sponsorPromise = getActiveTeamSponsorIdentityForAuthUser(
    user.id
  )
    .then((sponsor) => ({ sponsor, error: null }))
    .catch((error: unknown) => ({
      sponsor: null,
      error,
    }));

  const searchPromise =
    query.length >= GLOBAL_SEARCH_MIN_LENGTH
      ? searchGameDirectory(supabase, query)
          .then((results) => ({ results, error: null }))
          .catch((error: unknown) => ({
            results: [] as GlobalSearchResult[],
            error,
          }))
      : Promise.resolve({
          results: [] as GlobalSearchResult[],
          error: null,
        });

  const [profileResult, sponsorResult, searchResult] =
    await Promise.all([
      profilePromise,
      sponsorPromise,
      searchPromise,
    ]);

  if (profileResult.error) {
    console.error(
      "Impossible de charger le nom du Directeur Sportif dans la recherche :",
      profileResult.error
    );
  }

  if (sponsorResult.error) {
    console.error(
      "Impossible de charger l’identité visuelle du sponsor dans la recherche :",
      sponsorResult.error
    );
  }

  if (searchResult.error) {
    console.error(
      "Impossible d’effectuer la recherche globale :",
      searchResult.error
    );
  }

  const groupedResults = groupGlobalSearchResults(
    searchResult.results
  );
  const totalResults = searchResult.results.length;
  const teamSponsorIdentity =
    sponsorResult.sponsor as TeamSponsorIdentity | null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={profileResult.data?.display_name}
        sponsor={teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
        searchQuery={query}
      />

      <section className="mx-auto max-w-[1500px] px-5 py-10 sm:px-8 sm:py-14">
        <div className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white/85 shadow-[0_24px_70px_rgba(19,60,46,0.12)] backdrop-blur">
          <div className="border-b border-[#315B3E]/10 bg-[linear-gradient(135deg,#0B302B,#176951)] px-6 py-8 text-[#FFFDF4] sm:px-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#A8DEC6]">
              Annuaire du jeu
            </p>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Recherche globale
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#D6DFD2] sm:text-base">
                  Retrouvez les Directeurs Sportifs, les équipes et les nations déjà présentes dans votre partie.
                </p>
              </div>

              {query.length >= GLOBAL_SEARCH_MIN_LENGTH &&
              !searchResult.error ? (
                <p className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                  {numberFormatter.format(totalResults)} résultat
                  {totalResults > 1 ? "s" : ""}
                </p>
              ) : null}
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <SearchStatus
              query={query}
              totalResults={totalResults}
              hasError={Boolean(searchResult.error)}
            />

            {query.length >= GLOBAL_SEARCH_MIN_LENGTH &&
            !searchResult.error &&
            totalResults > 0 ? (
              <div className="grid gap-7 xl:grid-cols-3">
                <SearchSection
                  eyebrow="Personnes"
                  title="Directeurs Sportifs"
                  results={groupedResults.sportingDirectors}
                  emptyLabel="Aucun Directeur Sportif correspondant."
                  renderResult={(result) => (
                    <SportingDirectorResult result={result} />
                  )}
                />

                <SearchSection
                  eyebrow="Structures"
                  title="Équipes"
                  results={groupedResults.teams}
                  emptyLabel="Aucune équipe correspondante."
                  renderResult={(result) => (
                    <TeamResult result={result} />
                  )}
                />

                <SearchSection
                  eyebrow="Territoires"
                  title="Nations"
                  results={groupedResults.countries}
                  emptyLabel="Aucune nation correspondante."
                  renderResult={(result) => (
                    <CountryResult result={result} />
                  )}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function SearchStatus({
  query,
  totalResults,
  hasError,
}: {
  query: string;
  totalResults: number;
  hasError: boolean;
}) {
  if (!query) {
    return (
      <EmptyState
        title="Qui recherchez-vous ?"
        description="Saisissez un nom, un identifiant public, une équipe ou un pays dans le champ du header."
      />
    );
  }

  if (query.length < GLOBAL_SEARCH_MIN_LENGTH) {
    return (
      <EmptyState
        title="Précisez votre recherche"
        description={`Saisissez au moins ${GLOBAL_SEARCH_MIN_LENGTH} caractères pour lancer la recherche.`}
      />
    );
  }

  if (hasError) {
    return (
      <EmptyState
        title="Recherche momentanément indisponible"
        description="Les données n’ont pas pu être chargées. Vous pouvez réessayer dans quelques instants."
        tone="error"
      />
    );
  }

  if (totalResults === 0) {
    return (
      <EmptyState
        title={`Aucun résultat pour « ${query} »`}
        description="Essayez un nom plus court, un identifiant public ou le nom d’un pays."
      />
    );
  }

  return (
    <p className="mb-7 text-sm text-[#60756E]">
      Résultats regroupés pour{" "}
      <span className="font-extrabold text-[#183F37]">
        « {query} »
      </span>
    </p>
  );
}

function EmptyState({
  title,
  description,
  tone = "neutral",
}: {
  title: string;
  description: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      className={`rounded-2xl border px-6 py-10 text-center ${
        tone === "error"
          ? "border-[#DC6974]/30 bg-[#DC6974]/8"
          : "border-[#315B3E]/15 bg-[#EAF5F3]/70"
      }`}
    >
      <p className="text-lg font-black text-[#183F37]">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#60756E]">
        {description}
      </p>
    </div>
  );
}

function SearchSection({
  title,
  eyebrow,
  results,
  emptyLabel,
  renderResult,
}: SearchSectionProps) {
  return (
    <section aria-labelledby={`search-${eyebrow.toLowerCase()}`}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
            {eyebrow}
          </p>
          <h2
            id={`search-${eyebrow.toLowerCase()}`}
            className="mt-1 text-xl font-black text-[#183F37]"
          >
            {title}
          </h2>
        </div>

        <span className="rounded-full bg-[#D7EEE8] px-2.5 py-1 text-xs font-black text-[#176951]">
          {results.length}
        </span>
      </div>

      {results.length > 0 ? (
        <div className="space-y-3">
          {results.map((result) => renderResult(result))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[#315B3E]/20 px-4 py-7 text-center text-sm text-[#60756E]">
          {emptyLabel}
        </p>
      )}
    </section>
  );
}

function SportingDirectorResult({
  result,
}: {
  result: GlobalSearchResult;
}) {
  return (
    <ResultLink result={result}>
      <SportingDirectorAvatar
        avatarKey={result.avatar_key}
        size="small"
        label={`Avatar de ${result.display_name}`}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold text-[#183F37]">
          {result.display_name}
        </p>
        <p className="truncate text-xs font-semibold text-[#278B70]">
          @{result.public_identifier}
        </p>
        <p className="mt-1 truncate text-xs text-[#60756E]">
          {result.team_name ?? "Sans équipe actuelle"}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <CountryFlag
          countryCode={result.country_code}
          countryName={result.country_name}
        />
        <p className="mt-1 text-[0.7rem] font-bold text-[#60756E]">
          {numberFormatter.format(result.reputation_points ?? 0)} pts
        </p>
      </div>
    </ResultLink>
  );
}

function TeamResult({
  result,
}: {
  result: GlobalSearchResult;
}) {
  return (
    <ResultLink result={result}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#176951] text-sm font-black text-white shadow-sm">
        {getInitials(result.display_name)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold text-[#183F37]">
          {result.display_name}
        </p>
        <p className="mt-0.5 truncate text-xs text-[#60756E]">
          {result.sponsor_name
            ? `Sponsor : ${result.sponsor_name}`
            : "Équipe sans sponsor principal"}
        </p>
        <p className="mt-1 truncate text-xs font-semibold text-[#278B70]">
          {result.sporting_director_name ??
            "Directeur Sportif non attribué"}
        </p>
      </div>

      <CountryFlag
        countryCode={result.country_code}
        countryName={result.country_name}
      />
    </ResultLink>
  );
}

function CountryResult({
  result,
}: {
  result: GlobalSearchResult;
}) {
  return (
    <ResultLink result={result}>
      <CountryFlag
        countryCode={result.country_code}
        countryName={result.country_name}
        large
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold text-[#183F37]">
          {result.display_name}
        </p>
        <p className="mt-1 text-xs text-[#60756E]">
          {numberFormatter.format(
            result.sporting_director_count ?? 0
          )}{" "}
          DS · {numberFormatter.format(result.team_count ?? 0)} équipe
          {(result.team_count ?? 0) > 1 ? "s" : ""}
        </p>
      </div>

      <span className="text-lg font-black text-[#278B70]" aria-hidden="true">
        →
      </span>
    </ResultLink>
  );
}

function ResultLink({
  result,
  children,
}: {
  result: GlobalSearchResult;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={getGlobalSearchResultHref(result)}
      className="flex min-h-20 items-center gap-3 rounded-2xl border border-[#315B3E]/12 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(19,60,46,0.06)] transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-[0_14px_30px_rgba(19,60,46,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
    >
      {children}
    </Link>
  );
}

function CountryFlag({
  countryCode,
  countryName,
  large = false,
}: {
  countryCode: string;
  countryName: string;
  large?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={`Drapeau : ${countryName}`}
      title={countryName}
      className={`fi fi-${countryCode.toLowerCase()} shrink-0 rounded-sm shadow-sm ${
        large ? "text-3xl" : "text-xl"
      }`}
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
