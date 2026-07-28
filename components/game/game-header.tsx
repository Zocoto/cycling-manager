import type { CSSProperties } from "react";
import Link from "@/components/ui/app-link";

import type { Sponsor } from "@/types/sponsor";

import { logoutAccount } from "@/app/jeu/actions";
import { GlobalChatShortcut } from "@/components/game/global-chat-shortcut";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { TutorialCenterMenu } from "@/components/tutorial/tutorial-center-menu";
import { WheelLogo } from "@/components/ui/wheel-logo";
import {
  GLOBAL_SEARCH_MAX_LENGTH,
  GLOBAL_SEARCH_MIN_LENGTH,
} from "@/lib/game/global-search";
import { canAccessRaceSimulator } from "@/lib/game/race-simulator-access";

type GameHeaderProps = {
  displayName?: string;
  sponsor?: Sponsor | null;
  maxWidth?: "standard" | "wide";
  searchQuery?: string;
  simulatorEmail?: string | null;
  chatIsOpen?: boolean;
};

const DEFAULT_HEADER_COLORS = {
  primary: "#278B70",
  secondary: "#78947D",
  accent: "#F2C94C",
};

export function GameHeader({
  displayName,
  sponsor = null,
  maxWidth = "standard",
  searchQuery = "",
  simulatorEmail = null,
  chatIsOpen = false,
}: GameHeaderProps) {
  const colors = sponsor?.colors ??
    DEFAULT_HEADER_COLORS;

  const maxWidthClassName =
    maxWidth === "wide"
      ? "max-w-[1500px]"
      : "max-w-7xl";

  const headerStyle = {
    "--game-header-primary":
      colors.primary,
    "--game-header-secondary":
      colors.secondary,
    "--game-header-accent": colors.accent,
    "--game-header-primary-soft":
      `${colors.primary}22`,
    "--game-header-accent-soft":
      `${colors.accent}1A`,
  } as CSSProperties;

  return (
    <header
      className="relative z-20 border-b border-[#78947D]/25 bg-[#071A17] text-[#FFFDF4] shadow-lg shadow-black/15"
      style={headerStyle}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent}, ${colors.secondary})`,
        }}
      />

      <div
        className={`mx-auto flex ${maxWidthClassName} flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 pb-4 pt-5 sm:px-8 lg:flex-nowrap`}
      >
        <Link
          href="/jeu"
          aria-label="Retour à l’accueil de Cyclo Stratège"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
        >
          <span className="rounded-full ring-2 ring-[var(--game-header-primary-soft)] transition group-hover:ring-[var(--game-header-primary)]">
            <WheelLogo colors={colors} className="h-12 w-12" />
          </span>

          <span className="hidden h-11 -translate-y-[3px] flex-col justify-between leading-none sm:inline-flex">
            <span
              aria-hidden="true"
              className="-mt-[2px] flex justify-between text-2xl font-extrabold uppercase"
            >
              <span>C</span>
              <span>Y</span>
              <span>C</span>
              <span>L</span>
              <span>O</span>
            </span>

            <span className="-mb-[2px] block text-sm font-semibold uppercase tracking-[0.3em] text-[var(--game-header-accent)] -me-[0.3em]">
              Stratège
            </span>
          </span>
        </Link>

        <form
          action="/jeu/recherche"
          method="get"
          role="search"
          className="order-3 flex w-full min-w-0 items-center lg:order-none lg:max-w-xl lg:flex-1"
        >
          <label htmlFor="game-global-search" className="sr-only">
            Rechercher un Directeur Sportif, une équipe ou une nation
          </label>

          <div className="flex w-full items-center overflow-hidden rounded-xl border border-[#78947D]/55 bg-[#FFFDF4]/8 shadow-inner shadow-black/20 transition focus-within:border-[var(--game-header-accent)] focus-within:ring-2 focus-within:ring-[var(--game-header-accent-soft)]">
            <span
              aria-hidden="true"
              className="ml-3 text-[#D6DFD2]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="6.5"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="m16 16 4 4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
            </span>

            <input
              id="game-global-search"
              name="q"
              type="search"
              minLength={GLOBAL_SEARCH_MIN_LENGTH}
              maxLength={GLOBAL_SEARCH_MAX_LENGTH}
              defaultValue={searchQuery}
              placeholder="Rechercher un DS, une équipe, une nation…"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-medium text-[#FFFDF4] outline-none placeholder:text-[#D6DFD2]/65"
            />

            <button
              type="submit"
              aria-label="Lancer la recherche"
              className="m-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--game-header-accent)] text-xs font-extrabold uppercase tracking-wide text-[#071A17] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto sm:px-3"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4 sm:hidden"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="6.5"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="m16 16 4 4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
              <span className="hidden sm:inline">Rechercher</span>
            </button>
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href="/jeu/equipe"
            title="Ouvrir la fiche de mon équipe"
            aria-label={
              sponsor
                ? `Ouvrir la fiche de mon équipe ${sponsor.shortName}`
                : "Ouvrir la fiche de mon équipe"
            }
            className="hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] lg:inline-flex"
            style={{
              borderColor: `${colors.primary}66`,
              backgroundColor: `${colors.primary}20`,
            }}
          >
            {sponsor ? (
              <SponsorLogoMark
                src={sponsor.logoPath}
                alt={`Logo de ${sponsor.name}`}
                sponsorName={sponsor.name}
                primaryColor={sponsor.colors.primary}
                backgroundColor={sponsor.colors.background}
                textColor={sponsor.colors.text}
                className="h-7 w-10 rounded-lg p-0.5"
              />
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="7" cy="7" r="2.5" />
                <circle cx="14" cy="8" r="2" />
                <path d="M2.5 16c.4-3 2-4.5 4.5-4.5s4.1 1.5 4.5 4.5M11.5 12c2.8-.4 4.8.9 5.5 3.5" />
              </svg>
            )}

            {sponsor?.shortName ?? "Mon équipe"}
          </Link>

          {displayName ? (
            <Link
              href="/jeu/directeur-sportif"
              title="Ouvrir ma fiche de Directeur Sportif"
              className="hidden rounded-md text-sm font-semibold text-[#D6DFD2] transition hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] md:inline"
            >
              {displayName}
            </Link>
          ) : null}

          {canAccessRaceSimulator(simulatorEmail) ? (
            <RaceSimulatorShortcut />
          ) : null}

          <GlobalChatShortcut chatIsOpen={chatIsOpen} />

          <TutorialCenterMenu />


          <Link
            href="/guide"
            title="Ouvrir le guide du jeu"
            aria-label="Ouvrir le guide du jeu"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D6DFD2]/25 bg-white/5 text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 3.5h8.5A2.5 2.5 0 0 1 15 6v10H6.5A2.5 2.5 0 0 1 4 13.5v-10Z" />
              <path d="M4 13.5A2.5 2.5 0 0 1 6.5 11H15M8 6.5h3.5" />
            </svg>
          </Link>

          <form action={logoutAccount} className="shrink-0">
            <button
              type="submit"
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#D6DFD2]/25 bg-white/5 text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.5 6.5V4.5A1.5 1.5 0 0 0 11 3H5.5A1.5 1.5 0 0 0 4 4.5v11A1.5 1.5 0 0 0 5.5 17H11a1.5 1.5 0 0 0 1.5-1.5v-2" />
                <path d="M8.5 10h8m0 0-2.5-2.5M16.5 10 14 12.5" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function RaceSimulatorShortcut() {
  return (
    <Link
      href="/jeu/simulateur-course"
      title="Ouvrir le simulateur de course"
      aria-label="Ouvrir le simulateur de course"
      className="group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#72D4B7]/40 bg-[#72D4B7]/10 text-xs font-extrabold uppercase tracking-widest text-[#9BE0CA] transition hover:border-[#72D4B7] hover:bg-[#72D4B7] hover:text-[#071A17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72D4B7] xl:w-auto xl:gap-2 xl:px-3"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="h-4 w-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 16h12M6 16l1-9h6l1 9" />
        <path d="M8 7V4h4v3M8 11h4" />
      </svg>
      <span className="hidden xl:inline">Simulateur</span>
    </Link>
  );
}
