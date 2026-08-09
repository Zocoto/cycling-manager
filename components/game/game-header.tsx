import type { CSSProperties, ReactNode } from "react";
import Link from "@/components/ui/app-link";

import type { Sponsor } from "@/types/sponsor";

import { logoutAccount } from "@/app/jeu/actions";
import { GameHeaderActionsMenu } from "@/components/game/game-header-actions-menu";
import { CyclogazetteShortcut } from "@/components/game/cyclogazette-shortcut";
import { DirectorMailboxShortcut } from "@/components/game/director-mailbox-shortcut";
import { GlobalChatShortcut } from "@/components/game/global-chat-shortcut";
import { GameNavigationMenu } from "@/components/game/game-navigation-menu";
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
  gazetteIsOpen?: boolean;
  mailboxIsOpen?: boolean;
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
  gazetteIsOpen = false,
  mailboxIsOpen = false,
}: GameHeaderProps) {
  const colors = sponsor?.colors ?? DEFAULT_HEADER_COLORS;

  const maxWidthClassName =
    maxWidth === "wide" ? "max-w-[1500px]" : "max-w-7xl";

  const headerStyle = {
    "--game-header-primary": colors.primary,
    "--game-header-secondary": colors.secondary,
    "--game-header-accent": colors.accent,
    "--game-header-primary-soft": `${colors.primary}22`,
    "--game-header-accent-soft": `${colors.accent}1A`,
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
        className={`mx-auto flex ${maxWidthClassName} items-center gap-3 px-3 py-3 sm:px-8 sm:py-4 lg:gap-5`}
      >
        <Link
          href="/jeu"
          aria-label="Retour à l’accueil de Cyclo Stratège"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
        >
          <span className="rounded-full ring-2 ring-[var(--game-header-primary-soft)] transition group-hover:ring-[var(--game-header-primary)]">
            <WheelLogo colors={colors} className="h-10 w-10 sm:h-12 sm:w-12" />
          </span>

          <span className="hidden h-11 -translate-y-[3px] flex-col justify-between leading-none lg:inline-flex">
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

        <GameNavigationMenu />

        <GameHeaderSearch
          id="game-global-search-desktop"
          searchQuery={searchQuery}
          className="hidden min-w-0 max-w-xl flex-1 md:flex"
        />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <DirectorMailboxShortcut mailboxIsOpen={mailboxIsOpen} />

          <GlobalChatShortcut chatIsOpen={chatIsOpen} />

          <GameHeaderActionsMenu>
            <GameHeaderSearch
              id="game-global-search-mobile"
              searchQuery={searchQuery}
              className="mb-4 flex md:hidden"
            />

            <div className="grid grid-cols-2 gap-2">
              <HeaderMenuLink
                href="/jeu/equipe"
                label={sponsor?.shortName ?? "Mon équipe"}
                description="Effectif et identité"
              >
                {sponsor ? (
                  <SponsorLogoMark
                    src={sponsor.logoPath}
                    alt={`Logo de ${sponsor.name}`}
                    sponsorName={sponsor.name}
                    primaryColor={sponsor.colors.primary}
                    backgroundColor={sponsor.colors.background}
                    textColor={sponsor.colors.text}
                    className="h-8 w-11 rounded-lg p-0.5"
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
              </HeaderMenuLink>

              {displayName ? (
                <HeaderMenuLink
                  href="/jeu/directeur-sportif"
                  label={displayName}
                  description="Profil du DS"
                >
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
                    <circle cx="10" cy="6.5" r="3" />
                    <path d="M4.5 16c.5-3.3 2.3-5 5.5-5s5 1.7 5.5 5" />
                  </svg>
                </HeaderMenuLink>
              ) : null}

              {canAccessRaceSimulator(simulatorEmail) ? (
                <RaceSimulatorShortcut />
              ) : null}

              <HeaderIconMenuItem
                label="Cyclogazette"
                description="Actualités du peloton"
              >
                <CyclogazetteShortcut gazetteIsOpen={gazetteIsOpen} />
              </HeaderIconMenuItem>

              <HeaderIconMenuItem
                label="Didacticiels"
                description="Aide interactive"
              >
                <TutorialCenterMenu />
              </HeaderIconMenuItem>

              <HeaderMenuLink
                href="/guide"
                label="Guide du jeu"
                description="Règles et conseils"
              >
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
                  <path d="M4 3.5h8.5A2.5 2.5 0 0 1 15 6v10H6.5A2.5 2.5 0 0 1 4 13.5v-10Z" />
                  <path d="M4 13.5A2.5 2.5 0 0 1 6.5 11H15M8 6.5h3.5" />
                </svg>
              </HeaderMenuLink>

              <form action={logoutAccount} className="min-w-0">
                <button
                  type="submit"
                  className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl border border-[#EF5B65]/25 bg-[#EF5B65]/8 p-3 text-left text-[#F6C2C6] transition hover:border-[#EF5B65]/60 hover:bg-[#EF5B65]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF5B65]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/15">
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
                      <path d="M12.5 6.5V4.5A1.5 1.5 0 0 0 11 3H5.5A1.5 1.5 0 0 0 4 4.5v11A1.5 1.5 0 0 0 5.5 17H11a1.5 1.5 0 0 0 1.5-1.5v-2" />
                      <path d="M8.5 10h8m0 0-2.5-2.5M16.5 10 14 12.5" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-extrabold">
                      Déconnexion
                    </span>
                    <span className="mt-0.5 block text-[10px] font-semibold text-[#F6C2C6]/65">
                      Quitter la partie
                    </span>
                  </span>
                </button>
              </form>
            </div>
          </GameHeaderActionsMenu>
        </div>
      </div>
    </header>
  );
}

function GameHeaderSearch({
  id,
  searchQuery,
  className,
}: {
  id: string;
  searchQuery: string;
  className: string;
}) {
  return (
    <form
      action="/jeu/recherche"
      method="get"
      role="search"
      className={`w-full items-center ${className}`}
    >
      <label htmlFor={id} className="sr-only">
        Rechercher un Directeur Sportif, une équipe ou une nation
      </label>

      <div className="flex w-full items-center overflow-hidden rounded-xl border border-[#78947D]/55 bg-[#FFFDF4]/8 shadow-inner shadow-black/20 transition focus-within:border-[var(--game-header-accent)] focus-within:ring-2 focus-within:ring-[var(--game-header-accent-soft)]">
        <span aria-hidden="true" className="ml-3 text-[#D6DFD2]">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
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
          id={id}
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
  );
}

function HeaderMenuLink({
  href,
  label,
  description,
  children,
}: {
  href: string;
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-[var(--game-header-accent)] hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/15 text-[var(--game-header-accent)]">
        {children}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-extrabold">{label}</span>
        <span className="mt-0.5 block text-[10px] font-semibold text-[#D6DFD2]/60">
          {description}
        </span>
      </span>
    </Link>
  );
}

function HeaderIconMenuItem({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      {children}
      <span className="min-w-0">
        <span className="block truncate text-xs font-extrabold">{label}</span>
        <span className="mt-0.5 block text-[10px] font-semibold text-[#D6DFD2]/60">
          {description}
        </span>
      </span>
    </div>
  );
}

function RaceSimulatorShortcut() {
  return (
    <HeaderMenuLink
      href="/jeu/simulateur-course"
      label="Simulateur"
      description="Tester une course"
    >
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
        <path d="M4 16h12M6 16l1-9h6l1 9" />
        <path d="M8 7V4h4v3M8 11h4" />
      </svg>
    </HeaderMenuLink>
  );
}
