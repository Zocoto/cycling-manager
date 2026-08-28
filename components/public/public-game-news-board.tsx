"use client";

import Image from "next/image";
import Link from "next/link";

import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import {
  formatPublicGameNewsTotal,
  type PublicGameNewsItem,
  type PublicGameNewsKind,
  type PublicGameNewsPersonVisual,
  type PublicGameNewsSnapshot,
  type PublicGameNewsTeamVisual,
} from "@/lib/game/public-game-news";
import { STAFF_ROLE_DEFINITIONS } from "@/lib/game/staff";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import { useLocale } from "@/components/i18n/locale-provider";
import { localizePublicGameNewsItem } from "@/lib/i18n/cyclogazette-en";

const emptyNews = [
  {
    kind: "victory" as const,
    title: "Les premiers exploits se préparent",
    detail: "Chaque victoire officielle sera célébrée ici.",
  },
  {
    kind: "gazette" as const,
    title: "La rédaction prépare son prochain numéro",
    detail: "La Cyclogazette est publiée chaque soir à 20 h.",
  },
];

const emptyNewsEn = [
  { kind: "victory" as const, title: "The first achievements are taking shape", detail: "Every official victory will be celebrated here." },
  { kind: "gazette" as const, title: "The newsroom is preparing its next issue", detail: "The Cyclogazette is published every evening at 8 pm." },
];

export function PublicGameNewsBoard({
  snapshot,
}: {
  snapshot: PublicGameNewsSnapshot;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const featured =
    snapshot.items.find((item) => item.kind === "victory") ??
    snapshot.items[0] ??
    null;
  const timeline = snapshot.items
    .filter((item) => item.id !== featured?.id)
    .slice(0, 5);

  return (
    <section className="relative z-10 overflow-hidden bg-[#F7FAF7] px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-8 h-64 w-64 -translate-x-1/2 rounded-full bg-[#42CDA8]/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
              <span className="relative flex h-2.5 w-2.5">
                {snapshot.isLive ? (
                  <span className="motion-safe:absolute motion-safe:inline-flex motion-safe:h-full motion-safe:w-full motion-safe:animate-ping motion-safe:rounded-full motion-safe:bg-[#42B99A] motion-safe:opacity-60" />
                ) : null}
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#42B99A]" />
              </span>
              {isEnglish ? "Live results" : "Résultats en direct"}
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-[-0.035em] text-[#082A2A] sm:text-5xl">
              {isEnglish ? "The race unfolds" : "La course s’écrit"}
              <span className="text-[#42A884]"> {isEnglish ? "before your eyes." : "sous vos yeux."}</span>
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-7 text-[#536B64] sm:text-lg">
              {isEnglish
                ? "Follow official race winners and the daily Cyclogazette, with a clear focus on results."
                : "Retrouvez les vainqueurs des courses officielles et la publication quotidienne de La Cyclogazette, sans bruit autour des résultats."}
            </p>
          </div>

          <Link
            href="/inscription"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[#315B3E]/20 bg-white px-5 py-3 text-sm font-extrabold !text-[#173C2E] shadow-sm transition hover:-translate-y-0.5 hover:border-[#42B99A] hover:!text-[#278B70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315B3E]"
          >
            {isEnglish ? "Join the start line" : "Prendre le départ"}
            <ArrowIcon />
          </Link>
        </div>

        <article className="relative overflow-hidden rounded-3xl border border-[#153F38] bg-[#082A2A] text-[#FFFDF4] shadow-[0_30px_90px_rgba(7,26,23,0.24)]">
          <BoardDecoration />

          <div className="relative flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F2C94C] text-[#082A2A] shadow-[0_8px_24px_rgba(242,201,76,0.2)]">
                <PulseIcon />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F2C94C]">
                  {isEnglish ? "Results and editions" : "Résultats et éditions"}
                </p>
                <p className="mt-0.5 text-sm text-[#BFD1C6]">
                  {isEnglish ? "Cyclo Stratège sporting essentials" : "L’essentiel sportif de Cyclo Stratège"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#8DCFB8]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#42CDA8]" />
              {snapshot.isLive
                ? isEnglish ? "Updated regularly" : "Actualisé régulièrement"
                : isEnglish ? "The feed is getting ready" : "Le fil se prépare"}
            </div>
          </div>

          <div className="relative grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <FeaturedNews item={featured} />

            <div className="border-t border-white/10 lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 sm:px-8">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8DCFB8]">
                  {isEnglish ? "News feed" : "Fil d’actualité"}
                </p>
                <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold text-[#BFD1C6]">
                  {isEnglish ? "Latest events" : "Derniers événements"}
                </span>
              </div>

              {timeline.length > 0 ? (
                <ol aria-label={isEnglish ? "Latest game news" : "Dernières actualités du jeu"} className="divide-y divide-white/10">
                  {timeline.map((item) => (
                    <NewsRow key={item.id} item={item} />
                  ))}
                </ol>
              ) : (
                <ol aria-label={isEnglish ? "Upcoming news" : "Actualités à venir"} className="divide-y divide-white/10">
                  {(isEnglish ? emptyNewsEn : emptyNews).map((item) => (
                    <EmptyNewsRow key={item.kind} {...item} />
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="relative grid border-t border-white/10 sm:grid-cols-3">
            <NewsStat
              value={formatPublicGameNewsTotal(snapshot.totals.directors)}
              label={isEnglish ? "Active Sports Directors" : "Directeurs actifs"}
              detail={isEnglish ? "on the start line" : "sur la ligne de départ"}
            />
            <NewsStat
              value={formatPublicGameNewsTotal(snapshot.totals.victories)}
              label={isEnglish ? "Official victories" : "Victoires officielles"}
              detail={isEnglish ? "already in the record books" : "déjà inscrites au palmarès"}
            />
            <NewsStat
              value={formatPublicGameNewsTotal(snapshot.totals.gazettes)}
              label={isEnglish ? "Gazettes published" : "Gazettes publiées"}
              detail={isEnglish ? "a new edition every evening" : "une nouvelle édition chaque soir"}
              isLast
            />
          </div>
        </article>
      </div>
    </section>
  );
}

function FeaturedNews({ item }: { item: PublicGameNewsItem | null }) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  if (!item) {
    return (
      <div className="relative flex min-h-88 flex-col justify-end overflow-hidden p-6 sm:p-8 lg:min-h-105">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(66,205,168,0.22),transparent_38%),linear-gradient(145deg,rgba(49,91,62,0.22),rgba(7,26,23,0.65))]"
        />
        <div className="relative">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2C94C] text-[#082A2A] shadow-[0_16px_40px_rgba(242,201,76,0.22)]">
            <FlagIcon />
          </span>
          <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-[#8DCFB8]">
            {isEnglish ? "Coming up on the road" : "Prochainement sur la route"}
          </p>
          <h3 className="mt-3 max-w-md text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            {isEnglish ? "The next great moment could be yours." : "Le prochain grand moment peut être le vôtre."}
          </h3>
          <p className="mt-4 max-w-md leading-7 text-[#BFD1C6]">
            {isEnglish
              ? "Start a career and write the first line on this race board."
              : "Lancez une carrière et écrivez la première ligne de ce tableau de course."}
          </p>
        </div>
      </div>
    );
  }

  const localizedItem = localizePublicGameNewsItem(item, locale);

  return (
    <div className="group relative flex min-h-88 flex-col justify-end overflow-hidden p-6 sm:p-8 lg:min-h-105">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(242,201,76,0.20),transparent_34%),radial-gradient(circle_at_20%_70%,rgba(66,205,168,0.2),transparent_38%),linear-gradient(145deg,rgba(49,91,62,0.18),rgba(7,26,23,0.72))]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 top-8 h-72 w-72 rounded-full border border-white/10 opacity-50 transition duration-700 group-hover:rotate-12"
        style={{
          background:
            "repeating-conic-gradient(transparent 0deg 14deg, rgba(124,207,156,0.13) 14deg 15deg)",
        }}
      />
      <FeaturedVisual item={localizedItem} />

      <div className="relative">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2C94C] text-[#082A2A] shadow-[0_16px_40px_rgba(242,201,76,0.22)]">
          <NewsIcon kind={localizedItem.kind} featured />
        </span>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <NewsBadge kind={localizedItem.kind} />
          <time
            dateTime={localizedItem.happenedAt}
            className="text-xs font-bold text-[#BFD1C6]"
          >
            {formatNewsDate(localizedItem.happenedAt, locale)}
          </time>
        </div>

        <h3 className="mt-3 max-w-lg text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          {localizedItem.title}
        </h3>
        <p className="mt-4 max-w-lg text-base leading-7 text-[#D6DFD2]">
          {localizedItem.detail}
        </p>
      </div>
    </div>
  );
}

function NewsRow({ item }: { item: PublicGameNewsItem }) {
  const { locale } = useLocale();
  const localizedItem = localizePublicGameNewsItem(item, locale);
  return (
    <li className="group grid grid-cols-[auto_1fr] gap-4 px-6 py-5 transition hover:bg-white/[0.035] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-8">
      <NewsVisual item={localizedItem} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <NewsBadge kind={localizedItem.kind} compact />
          <time
            dateTime={localizedItem.happenedAt}
            className="text-[11px] font-semibold text-[#78968C] sm:hidden"
          >
            {formatNewsDate(localizedItem.happenedAt, locale)}
          </time>
        </div>
        <p className="mt-1.5 font-extrabold leading-5 text-[#FFFDF4]">
          {localizedItem.title}
        </p>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#9FB8AE]">
          {localizedItem.detail}
        </p>
      </div>

      <time
        dateTime={localizedItem.happenedAt}
        className="hidden whitespace-nowrap text-xs font-semibold text-[#78968C] sm:block"
      >
        {formatNewsDate(localizedItem.happenedAt, locale)}
      </time>
    </li>
  );
}

function FeaturedVisual({ item }: { item: PublicGameNewsItem }) {
  const visual = item.visual;
  if (!visual) return null;

  const hasMovementFlow =
    (item.kind === "movement" || item.kind === "staff") && visual.team;

  return (
    <>
      {visual.raceProfile && visual.raceProfile.length > 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-16 scale-110 opacity-25 sm:top-20"
        >
          <RaceStageProfile
            segments={visual.raceProfile}
            compact
            tone="dark"
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-5 top-5 flex items-center gap-2 sm:right-8 sm:top-7 sm:gap-3">
        <PersonWithTeamJersey
          person={visual.person}
          team={visual.team}
          size="featured"
        />

        {hasMovementFlow ? <MovementArrow /> : null}

        {visual.team ? (
          <TeamMark
            team={visual.team}
            size={hasMovementFlow ? "featured" : "badge"}
          />
        ) : null}
      </div>
    </>
  );
}

function NewsVisual({ item }: { item: PublicGameNewsItem }) {
  const visual = item.visual;

  if (!visual) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#8DCFB8] transition group-hover:border-[#42CDA8]/35 group-hover:bg-[#42CDA8]/10 group-hover:text-[#F2C94C]">
        <NewsIcon kind={item.kind} />
      </span>
    );
  }

  const receivingTeam =
    item.kind === "movement" || item.kind === "staff" ? visual.team : null;

  return (
    <div className="flex min-w-12 items-center gap-1.5">
      <PersonWithTeamJersey
        person={visual.person}
        team={visual.team}
        size="row"
      />
      {receivingTeam ? (
        <>
          <MovementArrow compact />
          <TeamMark team={receivingTeam} size="row" />
        </>
      ) : null}
    </div>
  );
}

function PersonWithTeamJersey({
  person,
  team,
  size,
}: {
  person: PublicGameNewsPersonVisual;
  team?: PublicGameNewsTeamVisual | null;
  size: "featured" | "row";
}) {
  if (!team) {
    return <PersonPortrait person={person} team={team} size={size} />;
  }

  return (
    <span
      className={
        size === "featured"
          ? "relative flex h-32 w-40 shrink-0 items-end sm:h-36 sm:w-44"
          : "relative flex h-14 w-16 shrink-0 items-end"
      }
    >
      <TeamJerseyBackdrop team={team} size={size} />
      <span className="relative z-10 flex shrink-0">
        <PersonPortrait person={person} team={team} size={size} />
      </span>
    </span>
  );
}

function TeamJerseyBackdrop({
  team,
  size,
}: {
  team: PublicGameNewsTeamVisual;
  size: "featured" | "row";
}) {
  const className =
    size === "featured"
      ? "absolute right-0 top-0 h-28 w-24 rotate-6 object-contain opacity-70 drop-shadow-[0_14px_18px_rgba(0,0,0,0.38)] transition-transform duration-500 group-hover:rotate-10 group-hover:scale-105 sm:h-32 sm:w-28"
      : "absolute right-0 top-0 h-12 w-11 rotate-6 object-contain opacity-65 drop-shadow-[0_6px_8px_rgba(0,0,0,0.32)] transition-transform duration-300 group-hover:rotate-10 group-hover:scale-105";

  if (team.jerseyArtwork.kind === "sponsor") {
    return (
      <Image
        aria-hidden="true"
        src={team.jerseyArtwork.imagePath}
        alt=""
        width={600}
        height={750}
        sizes={size === "featured" ? "112px" : "44px"}
        className={className}
      />
    );
  }

  return (
    <span aria-hidden="true" className="contents">
      <AmateurTeamJersey
        jersey={team.jerseyArtwork.jersey}
        teamName={team.name}
        className={className}
      />
    </span>
  );
}

function PersonPortrait({
  person,
  team,
  size,
}: {
  person: PublicGameNewsPersonVisual;
  team?: PublicGameNewsTeamVisual | null;
  size: "featured" | "row";
}) {
  if (person.kind === "director") {
    return (
      <SportingDirectorAvatar
        avatarKey={person.avatarKey}
        frameKey={person.avatarFrameKey}
        size={size === "featured" ? "large" : "small"}
        label={person.label}
        className={
          size === "featured"
            ? "ring-4 ring-[#F2C94C]/35 shadow-2xl"
            : "ring-2 ring-white/10"
        }
      />
    );
  }

  return (
    <RiderAvatar
      profileKey={person.profileKey}
      seed={person.seed}
      riderId={person.seed}
      age={person.kind === "rider" ? person.age : 30}
      jersey={getPortraitJersey(person, team)}
      label={person.label}
      className={
        size === "featured"
          ? "h-28 w-28 border-4 border-white/80 shadow-2xl sm:h-32 sm:w-32"
          : "h-12 w-12 border-2 border-white/70 shadow-md"
      }
    />
  );
}

function TeamMark({
  team,
  size,
}: {
  team: PublicGameNewsTeamVisual;
  size: "featured" | "badge" | "row";
}) {
  const { locale } = useLocale();
  const className =
    size === "featured"
      ? "h-16 w-20 rounded-2xl p-2 sm:h-18 sm:w-24"
      : size === "badge"
        ? "h-11 w-14 rounded-xl p-1.5 sm:h-12 sm:w-16"
        : "h-10 w-12 rounded-xl p-1.5";

  if (team.logoPath && team.sponsorName) {
    return (
      <SponsorLogoMark
        src={team.logoPath}
        alt={locale === "en" ? `${team.name} logo` : `Logo de ${team.name}`}
        sponsorName={team.sponsorName}
        primaryColor={team.colors.primary}
        backgroundColor={team.colors.background}
        textColor={team.colors.text}
        className={className}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={locale === "en" ? `${team.name} emblem` : `Emblème de ${team.name}`}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border font-black shadow-sm ${className}`}
      style={{
        borderColor: `${team.colors.primary}66`,
        backgroundColor: team.colors.background,
        color: team.colors.text,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute -bottom-5 -right-5 h-12 w-12 rotate-45 opacity-20"
        style={{ backgroundColor: team.colors.primary }}
      />
      <span className="relative text-xs">{getTeamInitials(team.name)}</span>
    </span>
  );
}

function MovementArrow({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center text-[#F2C94C] ${compact ? "px-0" : "px-0.5"}`}
    >
      <svg
        viewBox="0 0 30 20"
        className={compact ? "h-5 w-5" : "h-7 w-8"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 6h19l-4-4" />
        <path d="m21 6-4 4" />
        <path d="M28 14H9l4 4" />
        <path d="m9 14 4-4" />
      </svg>
    </span>
  );
}

function getPortraitJersey(
  person: Exclude<PublicGameNewsPersonVisual, { kind: "director" }>,
  team?: PublicGameNewsTeamVisual | null
): RiderJerseyAppearance {
  if (person.kind === "staff") {
    const accent = STAFF_ROLE_DEFINITIONS[person.role].accent;
    return {
      primaryColor: "#173C36",
      secondaryColor: accent,
      accentColor: "#F2C94C",
      pattern: "solid",
      status: "free-agent",
    };
  }

  if (team) {
    return team.jersey;
  }

  return {
    primaryColor: "#315B3E",
    secondaryColor: "#8DCFB8",
    accentColor: "#F2C94C",
    pattern: "solid",
    status: "free-agent",
  };
}

function getTeamInitials(teamName: string): string {
  return (
    teamName
      .trim()
      .split(/[\s-]+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "EQ"
  );
}

function EmptyNewsRow({
  kind,
  title,
  detail,
}: {
  kind: PublicGameNewsKind;
  title: string;
  detail: string;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-4 px-6 py-5 sm:px-8">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.025] text-[#78968C]">
        <NewsIcon kind={kind} />
      </span>
      <div>
        <p className="font-extrabold text-[#D6DFD2]">{title}</p>
        <p className="mt-1 text-sm leading-5 text-[#78968C]">{detail}</p>
      </div>
    </li>
  );
}

function NewsBadge({
  kind,
  compact = false,
}: {
  kind: PublicGameNewsKind;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const label =
    kind === "race_recap"
      ? isEnglish ? "Post-race" : "Après-course"
      : kind === "victory"
        ? isEnglish ? "Victory" : "Victoire"
        : kind === "gazette"
          ? isEnglish ? "The Cyclogazette" : "La Cyclogazette"
          : kind === "arrival"
            ? isEnglish ? "New SD" : "Nouveau DS"
            : kind === "staff"
              ? isEnglish ? "Staff signing" : "Recrutement staff"
              : isEnglish ? "Transfer" : "Transfert";

  return (
    <span
      className={`rounded-full font-black uppercase tracking-[0.14em] ${
        compact ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[10px]"
      } ${
        kind === "race_recap"
          ? "bg-[#D94F4F] text-white"
          : kind === "victory"
            ? "bg-[#F2C94C] text-[#082A2A]"
            : kind === "gazette"
              ? "bg-[#EFE4C8] text-[#6B1F2A]"
              : kind === "arrival"
                ? "bg-[#42CDA8]/15 text-[#8DE3C9]"
                : kind === "staff"
                  ? "bg-[#D49BFF]/15 text-[#E1C2FA]"
                  : "bg-[#8AB8F8]/15 text-[#B9D4FA]"
      }`}
    >
      {label}
    </span>
  );
}

function NewsStat({
  value,
  label,
  detail,
  isLast = false,
}: {
  value: string;
  label: string;
  detail: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 px-6 py-5 sm:px-8 ${
        isLast ? "" : "border-b border-white/10 sm:border-b-0 sm:border-r"
      }`}
    >
      <span className="min-w-[4ch] shrink-0 whitespace-nowrap text-3xl font-black tabular-nums tracking-tight text-[#F2C94C]">
        {value}
      </span>
      <div>
        <p className="text-sm font-extrabold text-white">{label}</p>
        <p className="mt-0.5 text-xs text-[#78968C]">{detail}</p>
      </div>
    </div>
  );
}

function NewsIcon({
  kind,
  featured = false,
}: {
  kind: PublicGameNewsKind;
  featured?: boolean;
}) {
  const className = featured ? "h-7 w-7" : "h-5 w-5";

  if (kind === "race_recap") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 12h3l2-5 4 10 2-5h5" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    );
  }

  if (kind === "victory") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H4v1a5 5 0 0 0 5 5M16 6h4v1a5 5 0 0 1-5 5" />
        <path d="M12 13v5M8 21h8M9 18h6" />
      </svg>
    );
  }

  if (kind === "gazette") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" />
        <path d="M18 8h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1" />
        <path d="M8 8h7M8 12h7M8 16h4" />
      </svg>
    );
  }

  if (kind === "arrival") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.5-4 2.5-6 5.5-6 1.4 0 2.6.4 3.5 1.2" />
        <path d="M18 12v7M14.5 15.5h7" />
      </svg>
    );
  }

  if (kind === "staff") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M3 12h18M10 12v2h4v-2" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 7h11l-3-3M18 7l-3 3" />
      <path d="M17 17H6l3 3M6 17l3-3" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 21V4" />
      <path d="M6 5h11l-2.5 3L17 11H6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 10h13" />
      <path d="m11 5 5 5-5 5" />
    </svg>
  );
}

function formatNewsDate(value: string, locale: "fr" | "en") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function BoardDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#42CDA8]/70 to-transparent"
    />
  );
}
