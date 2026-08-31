import Link from "@/components/ui/app-link";

import { RiderAvatar } from "@/components/game/rider-avatar";
import {
  buildRaceFavorites,
  buildTeamTimeTrialFavorites,
  type RaceFavorite,
  type RaceFavoriteTeam,
  type RaceTeamFavorite,
} from "@/lib/game/race-favorites";
import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "@/lib/game/race-calendar";
import type { RiderSimulationInput } from "@/lib/game/race-simulation";
import { getTeamKitPattern } from "@/lib/game/race-visuals";
import {
  createAmateurRiderJersey,
  createContinentalChampionRiderJersey,
  createWorldChampionRiderJersey,
  createNationalChampionRiderJersey,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";

type RaceFavoritesPanelProps = {
  edition: Pick<RaceCalendarEdition, "raceFormat" | "stages" | "engagedRiders">;
  riders?: RiderSimulationInput[];
  stage?: RaceCalendarStage;
  frozen?: boolean;
  tone?: "light" | "dark";
  className?: string;
};

export function RaceFavoritesPanel({
  edition,
  riders,
  stage,
  frozen = false,
  tone = "light",
  className = "",
}: RaceFavoritesPanelProps) {
  const favoriteEdition = stage
    ? {
        ...edition,
        raceFormat: "one_day" as const,
        stages: [stage],
      }
    : edition;
  const engagedRiders = riders ?? edition.engagedRiders ?? [];
  const isTeamTimeTrial = stage?.stageType === "team_time_trial";
  const favorites = isTeamTimeTrial
    ? []
    : buildRaceFavorites({
        edition: favoriteEdition,
        riders: engagedRiders,
      });
  const teamFavorites = isTeamTimeTrial
    ? buildTeamTimeTrialFavorites({ stage, riders: engagedRiders })
    : [];
  const podium = favorites.slice(0, 3);
  const twoStars = favorites.filter((favorite) => favorite.stars === 2);
  const oneStar = favorites.filter((favorite) => favorite.stars === 1);
  const teamPodium = teamFavorites.slice(0, 3);
  const twoStarTeams = teamFavorites.filter((favorite) => favorite.stars === 2);
  const oneStarTeams = teamFavorites.filter((favorite) => favorite.stars === 1);
  const isDark = tone === "dark";

  return (
    <section
      data-race-favorites
      className={[
        "overflow-hidden rounded-2xl border",
        isDark
          ? "border-white/10 bg-[#102C28] text-white"
          : "border-[#315B3E]/15 bg-[#F6FAF7] text-[#0B302B]",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4",
          isDark ? "border-white/10" : "border-[#315B3E]/10",
        ].join(" ")}
      >
        <div>
          <p
            className={[
              "text-[10px] font-black uppercase tracking-[0.2em]",
              isDark ? "text-[#9BE0BC]" : "text-[#176951]",
            ].join(" ")}
          >
            Pronostic d&apos;avant-course
          </p>
          <h3 className="mt-1 text-lg font-black">
            {isTeamTimeTrial
              ? "Équipes favorites du CLM"
              : stage
                ? "Favoris de l’étape"
                : "Favoris de la course"}
          </h3>
        </div>
        <span
          className={[
            "rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]",
            isDark
              ? "bg-white/10 text-[#DCECE5]"
              : "bg-[#D7EEE8] text-[#176951]",
          ].join(" ")}
        >
          {frozen ? "Startlist officielle" : "Mise à jour avec la startlist"}
        </span>
      </div>

      {isTeamTimeTrial && teamFavorites.length > 0 ? (
        <div className="p-5" data-team-time-trial-favorites>
          <div>
            <TierHeading label="Principales équipes" stars={3} tone={tone} />
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {teamPodium.map((favorite) => (
                <PodiumTeamFavorite
                  key={favorite.team.id}
                  favorite={favorite}
                  tone={tone}
                />
              ))}
            </div>
          </div>

          {twoStarTeams.length > 0 ? (
            <TeamFavoriteList
              className="mt-6"
              favorites={twoStarTeams}
              stars={2}
              tone={tone}
            />
          ) : null}

          {oneStarTeams.length > 0 ? (
            <TeamFavoriteList
              className="mt-5"
              favorites={oneStarTeams}
              stars={1}
              tone={tone}
            />
          ) : null}
        </div>
      ) : favorites.length > 0 ? (
        <div className="p-5">
          <div>
            <TierHeading label="Principaux favoris" stars={3} tone={tone} />
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {podium.map((favorite) => (
                <PodiumFavorite
                  key={favorite.rider.id}
                  favorite={favorite}
                  edition={favoriteEdition}
                  tone={tone}
                />
              ))}
            </div>
          </div>

          {twoStars.length > 0 ? (
            <FavoriteList
              className="mt-6"
              favorites={twoStars}
              stars={2}
              tone={tone}
            />
          ) : null}

          {oneStar.length > 0 ? (
            <FavoriteList
              className="mt-5"
              favorites={oneStar}
              stars={1}
              tone={tone}
            />
          ) : null}
        </div>
      ) : (
        <p
          className={[
            "px-5 py-6 text-sm font-semibold",
            isDark ? "text-[#B9CDC5]" : "text-[#688176]",
          ].join(" ")}
        >
          {isTeamTimeTrial
            ? "Les équipes favorites apparaîtront dès que des équipes seront engagées."
            : "Les favoris apparaîtront dès que des coureurs seront engagés."}
        </p>
      )}
    </section>
  );
}

function PodiumTeamFavorite({
  favorite,
  tone,
}: {
  favorite: RaceTeamFavorite;
  tone: NonNullable<RaceFavoritesPanelProps["tone"]>;
}) {
  const isDark = tone === "dark";
  const { team } = favorite;

  return (
    <Link
      href={`/jeu/equipes/${team.id}`}
      target="_blank"
      rel="noreferrer"
      data-favorite-entity="team"
      data-favorite-rank={favorite.rank}
      data-favorite-stars={favorite.stars}
      className={[
        "group relative flex min-w-0 items-center gap-3 rounded-xl border p-3 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]",
        isDark
          ? "border-white/10 bg-white/[0.055] hover:bg-white/[0.09]"
          : "border-[#315B3E]/15 bg-white hover:border-[#176951]/40",
      ].join(" ")}
    >
      <span className="absolute left-2 top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#F2C94C] px-1.5 text-[11px] font-black text-[#0B302B] shadow-sm">
        {favorite.rank}
      </span>
      <TeamFavoriteBadge team={team} className="h-16 w-16" />
      <span className="min-w-0">
        <span
          className={[
            "block text-sm font-black leading-tight group-hover:underline",
            isDark ? "text-white" : "text-[#0B302B]",
          ].join(" ")}
        >
          {team.name}
        </span>
        <span
          className={[
            "mt-1 block text-xs font-bold",
            isDark ? "text-[#AFC7BD]" : "text-[#60756E]",
          ].join(" ")}
        >
          {formatTeamRiderCount(team.riderCount)} · force collective
        </span>
        <span
          className="mt-1.5 block text-xs tracking-[0.12em] text-[#F2C94C]"
          aria-label="3 étoiles"
        >
          ★★★
        </span>
      </span>
    </Link>
  );
}

function TeamFavoriteList({
  favorites,
  stars,
  tone,
  className = "",
}: {
  favorites: RaceTeamFavorite[];
  stars: 1 | 2;
  tone: NonNullable<RaceFavoritesPanelProps["tone"]>;
  className?: string;
}) {
  const isDark = tone === "dark";

  return (
    <div className={className} data-favorite-stars={stars}>
      <TierHeading
        label={stars === 2 ? "Équipes solides" : "À surveiller"}
        stars={stars}
        tone={tone}
      />
      <ol
        className={[
          "mt-2 grid overflow-hidden rounded-xl border sm:grid-cols-2",
          isDark
            ? "border-white/10 bg-white/[0.035]"
            : "border-[#315B3E]/15 bg-white",
        ].join(" ")}
      >
        {favorites.map((favorite) => (
          <li
            key={favorite.team.id}
            data-favorite-entity="team"
            data-favorite-rank={favorite.rank}
            className={[
              "min-w-0 border-b px-3 py-2.5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0",
              isDark ? "border-white/10" : "border-[#315B3E]/10",
            ].join(" ")}
          >
            <Link
              href={`/jeu/equipes/${favorite.team.id}`}
              target="_blank"
              rel="noreferrer"
              className="group flex min-w-0 items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
            >
              <span
                className={[
                  "w-6 shrink-0 text-center text-xs font-black",
                  isDark ? "text-[#9BE0BC]" : "text-[#176951]",
                ].join(" ")}
              >
                {favorite.rank}
              </span>
              <TeamFavoriteBadge team={favorite.team} className="h-8 w-8" />
              <span className="min-w-0 flex-1">
                <span
                  className={[
                    "block truncate text-xs font-black group-hover:underline",
                    isDark ? "text-white" : "text-[#0B302B]",
                  ].join(" ")}
                >
                  {favorite.team.name}
                </span>
                <span
                  className={[
                    "block truncate text-[10px] font-bold",
                    isDark ? "text-[#98B2A8]" : "text-[#71857D]",
                  ].join(" ")}
                >
                  {formatTeamRiderCount(favorite.team.riderCount)}
                </span>
              </span>
              <span
                className="shrink-0 text-[10px] tracking-[0.08em] text-[#F2C94C]"
                aria-label={`${stars} ${stars === 1 ? "étoile" : "étoiles"}`}
              >
                {"★".repeat(stars)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TeamFavoriteBadge({
  team,
  className,
}: {
  team: RaceFavoriteTeam;
  className: string;
}) {
  return (
    <span
      data-team-favorite-badge
      aria-label={`Couleurs de ${team.name}`}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-[#F2C94C]/60 shadow-sm ${className}`}
      style={{
        background: `linear-gradient(145deg, ${team.primaryColor} 0 56%, ${team.secondaryColor} 56% 100%)`,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className="h-[72%] w-[72%] drop-shadow-[0_2px_2px_rgba(7,26,23,0.45)]"
        fill="none"
      >
        <path
          d="M12 41h40M15 47h34"
          stroke={team.accentColor}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="18" cy="27" r="6" fill="white" stroke="#0B302B" strokeWidth="2" />
        <circle cx="32" cy="23" r="6" fill="white" stroke="#0B302B" strokeWidth="2" />
        <circle cx="46" cy="27" r="6" fill="white" stroke="#0B302B" strokeWidth="2" />
        <path
          d="m18 33 5 8m9-12v12m14-8-5 8"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function formatTeamRiderCount(count: number) {
  return `${count} ${count === 1 ? "coureur engagé" : "coureurs engagés"}`;
}

function PodiumFavorite({
  favorite,
  edition,
  tone,
}: {
  favorite: RaceFavorite;
  edition: RaceFavoritesPanelProps["edition"];
  tone: NonNullable<RaceFavoritesPanelProps["tone"]>;
}) {
  const isDark = tone === "dark";
  const { rider } = favorite;

  return (
    <Link
      href={`/jeu/coureurs/${rider.id}`}
      target="_blank"
      rel="noreferrer"
      data-favorite-rank={favorite.rank}
      data-favorite-stars={favorite.stars}
      className={[
        "group relative flex min-w-0 items-center gap-3 rounded-xl border p-3 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]",
        isDark
          ? "border-white/10 bg-white/[0.055] hover:bg-white/[0.09]"
          : "border-[#315B3E]/15 bg-white hover:border-[#176951]/40",
      ].join(" ")}
    >
      <span className="absolute left-2 top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#F2C94C] px-1.5 text-[11px] font-black text-[#0B302B] shadow-sm">
        {favorite.rank}
      </span>
      <RiderAvatar
        profileKey={rider.avatarProfileKey}
        seed={rider.avatarSeed}
        riderId={rider.id}
        age={rider.age}
        jersey={getFavoriteJersey(rider, edition)}
        label={`Portrait de ${rider.name}`}
        className="h-16 w-16 border-2 border-[#F2C94C]/70"
      />
      <span className="min-w-0">
        <span
          className={[
            "block truncate text-sm font-black group-hover:underline",
            isDark ? "text-white" : "text-[#0B302B]",
          ].join(" ")}
        >
          {rider.name}
        </span>
        <span
          className={[
            "mt-1 block truncate text-xs font-bold",
            isDark ? "text-[#AFC7BD]" : "text-[#60756E]",
          ].join(" ")}
        >
          {rider.teamName}
        </span>
        <span
          className="mt-1.5 block text-xs tracking-[0.12em] text-[#F2C94C]"
          aria-label="3 étoiles"
        >
          ★★★
        </span>
      </span>
    </Link>
  );
}

function FavoriteList({
  favorites,
  stars,
  tone,
  className = "",
}: {
  favorites: RaceFavorite[];
  stars: 1 | 2;
  tone: NonNullable<RaceFavoritesPanelProps["tone"]>;
  className?: string;
}) {
  const isDark = tone === "dark";

  return (
    <div className={className} data-favorite-stars={stars}>
      <TierHeading
        label={stars === 2 ? "Favoris solides" : "À surveiller"}
        stars={stars}
        tone={tone}
      />
      <ol
        className={[
          "mt-2 grid overflow-hidden rounded-xl border sm:grid-cols-2",
          isDark
            ? "border-white/10 bg-white/[0.035]"
            : "border-[#315B3E]/15 bg-white",
        ].join(" ")}
      >
        {favorites.map((favorite) => (
          <li
            key={favorite.rider.id}
            data-favorite-rank={favorite.rank}
            className={[
              "min-w-0 border-b px-3 py-2.5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0",
              isDark ? "border-white/10" : "border-[#315B3E]/10",
            ].join(" ")}
          >
            <Link
              href={`/jeu/coureurs/${favorite.rider.id}`}
              target="_blank"
              rel="noreferrer"
              className="group flex min-w-0 items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
            >
              <span
                className={[
                  "w-6 shrink-0 text-center text-xs font-black",
                  isDark ? "text-[#9BE0BC]" : "text-[#176951]",
                ].join(" ")}
              >
                {favorite.rank}
              </span>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/30"
                style={{
                  background: `linear-gradient(135deg, ${favorite.rider.teamPrimaryColor} 0 55%, ${favorite.rider.teamSecondaryColor} 55% 100%)`,
                  borderColor: favorite.rider.teamSecondaryColor,
                }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={[
                    "block truncate text-xs font-black group-hover:underline",
                    isDark ? "text-white" : "text-[#0B302B]",
                  ].join(" ")}
                >
                  {favorite.rider.name}
                </span>
                <span
                  className={[
                    "block truncate text-[10px] font-bold",
                    isDark ? "text-[#98B2A8]" : "text-[#71857D]",
                  ].join(" ")}
                >
                  {favorite.rider.teamName}
                </span>
              </span>
              <span
                className="shrink-0 text-[10px] tracking-[0.08em] text-[#F2C94C]"
                aria-label={`${stars} ${stars === 1 ? "étoile" : "étoiles"}`}
              >
                {"★".repeat(stars)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TierHeading({
  label,
  stars,
  tone,
}: {
  label: string;
  stars: 1 | 2 | 3;
  tone: NonNullable<RaceFavoritesPanelProps["tone"]>;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h4
        className={[
          "text-xs font-black uppercase tracking-[0.13em]",
          tone === "dark" ? "text-[#DCECE5]" : "text-[#315B3E]",
        ].join(" ")}
      >
        {label}
      </h4>
      <span
        className="text-xs tracking-[0.08em] text-[#F2C94C]"
        aria-label={`${stars} ${stars === 1 ? "étoile" : "étoiles"}`}
      >
        {"★".repeat(stars)}
      </span>
    </div>
  );
}

function getFavoriteJersey(
  rider: RiderSimulationInput,
  edition: RaceFavoritesPanelProps["edition"],
): RiderJerseyAppearance {
  const firstStage = [...edition.stages].sort(
    (first, second) =>
      first.stageNumber - second.stageNumber ||
      first.id.localeCompare(second.id),
  )[0];
  const championshipType =
    firstStage?.stageType === "individual_time_trial" ||
    firstStage?.stageType === "team_time_trial" ||
    firstStage?.stageType === "prologue"
      ? "time_trial"
      : "road";
  const worldChampionship = rider.worldChampionships?.[championshipType];

  if (worldChampionship) {
    return createWorldChampionRiderJersey({ championshipType });
  }
  const continentalChampionship =
    rider.continentalChampionships?.[championshipType];

  if (continentalChampionship) {
    return createContinentalChampionRiderJersey({
      continentCode: continentalChampionship.continentCode,
      championshipType,
    });
  }

  const nationalChampionship = rider.nationalChampionships?.[championshipType];

  if (nationalChampionship) {
    return createNationalChampionRiderJersey({
      countryCode: nationalChampionship.countryCode,
      championshipType,
    });
  }

  if (rider.teamJersey) {
    return rider.teamJersey;
  }

  const teamPattern = getTeamKitPattern(rider.teamId);
  return createAmateurRiderJersey({
    primaryColor: rider.teamPrimaryColor,
    secondaryColor: rider.teamSecondaryColor,
    accentColor: "#F2C94C",
    pattern:
      teamPattern === "center_stripe"
        ? "classic"
        : teamPattern === "halves"
          ? "split"
          : teamPattern,
  });
}
