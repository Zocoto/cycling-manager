"use client";

import { Suspense, type CSSProperties, type ReactNode } from "react";
import Link from "@/components/ui/app-link";

import type { Sponsor } from "@/types/sponsor";

import { logoutAccount } from "@/app/jeu/actions";
import { CyclogazetteShortcut } from "@/components/game/cyclogazette-shortcut";
import { DirectorMailboxShortcut } from "@/components/game/director-mailbox-shortcut";
import { GlobalChatShortcut } from "@/components/game/global-chat-shortcut";
import { GameNavigationMenu } from "@/components/game/game-navigation-menu";
import { MobileGameNavigation } from "@/components/game/mobile-game-navigation";
import { MobilePageRefreshControl } from "@/components/game/mobile-page-refresh-control";
import { PushNotificationControl } from "@/components/pwa/push-notification-control";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useLocale } from "@/components/i18n/locale-provider";
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
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const colors = sponsor?.colors ?? DEFAULT_HEADER_COLORS;
  const federationCountryCode =
    sponsor?.countryCode.trim().toUpperCase() === "BE" ? "BE" : null;

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
    <>
      <header
        data-game-header="true"
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
        className={`mx-auto flex ${maxWidthClassName} flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2 sm:gap-x-3 sm:gap-y-2 sm:px-8 sm:py-4 lg:flex-nowrap lg:gap-5`}
      >
        <Link
          href="/jeu"
          prefetchOnIntent
          aria-label={
            isEnglish ? "Back to the Cyclo Stratège dashboard" : "Retour à l’accueil de Cyclo Stratège"
          }
          className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] sm:gap-3"
        >
          <span className="rounded-full ring-2 ring-[var(--game-header-primary-soft)] transition group-hover:ring-[var(--game-header-primary)]">
            <WheelLogo colors={colors} className="h-8 w-8 sm:h-12 sm:w-12" />
          </span>

          <span
            data-mobile-app-name="true"
            className="flex min-w-0 flex-col justify-center leading-none sm:hidden"
          >
            <span className="text-[0.7rem] font-black uppercase tracking-[0.12em] text-[#FFFDF4]">
              Cyclo
            </span>
            <span className="mt-1 text-[0.52rem] font-extrabold uppercase tracking-[0.16em] text-[var(--game-header-accent)]">
              Stratège
            </span>
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

        <GameNavigationMenu
          viewerEmail={simulatorEmail}
          federationCountryCode={federationCountryCode}
        />

        <div
          data-global-header-search="true"
          className="order-2 w-full min-w-0 xl:order-none xl:flex-1"
        >
          <GameHeaderSearch
            id="game-global-search"
            searchQuery={searchQuery}
            className="flex"
            isEnglish={isEnglish}
          />
        </div>

        <div
          data-mobile-header-shortcuts="true"
          className="order-3 -mx-3 grid w-[calc(100%+1.5rem)] grid-cols-4 items-center justify-items-center gap-1 border-t border-white/10 pb-0.5 pl-3 pr-[4.35rem] pt-1.5 sm:mx-0 sm:ml-auto sm:flex sm:w-full sm:flex-wrap sm:justify-end sm:gap-2 sm:px-0 sm:pb-0 sm:pt-2 lg:order-none lg:w-auto lg:flex-nowrap lg:border-t-0 lg:pt-0"
        >
          <span className="hidden sm:contents">
            <HeaderMenuLink
              href="/jeu/equipe"
              label={sponsor?.shortName ?? (isEnglish ? "My team" : "Mon équipe")}
              description={isEnglish ? "Roster and identity" : "Effectif et identité"}
            >
              {sponsor ? (
                <SponsorLogoMark
                  src={sponsor.logoPath}
                  alt={isEnglish ? `${sponsor.name} logo` : `Logo de ${sponsor.name}`}
                  sponsorName={sponsor.name}
                  primaryColor={sponsor.colors.primary}
                  backgroundColor={sponsor.colors.background}
                  textColor={sponsor.colors.text}
                  className="h-6 w-7 rounded-md p-0.5"
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
          </span>

          {displayName ? (
            <span className="hidden sm:contents">
              <HeaderMenuLink
                href="/jeu/directeur-sportif"
                label={displayName}
                description={isEnglish ? "Sports director profile" : "Profil du DS"}
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
            </span>
          ) : null}

          <HeaderIconMenuItem
            label={isEnglish ? "Messages" : "Messages"}
            description={isEnglish ? "Sports director inbox" : "Boîte mail du DS"}
          >
            <DirectorMailboxShortcut mailboxIsOpen={mailboxIsOpen} />
          </HeaderIconMenuItem>

          <HeaderIconMenuItem
            label={isEnglish ? "Alerts" : "Alertes"}
            description={isEnglish ? "Push notifications" : "Notifications push"}
          >
            <PushNotificationControl />
          </HeaderIconMenuItem>

          <GlobalChatShortcut
            chatIsOpen={chatIsOpen}
            floatingOnMobile
          />

          {canAccessRaceSimulator(simulatorEmail) ? (
            <span className="hidden sm:contents">
              <RaceSimulatorShortcut isEnglish={isEnglish} />
            </span>
          ) : null}

          <HeaderIconMenuItem
            label={isEnglish ? "Gazette" : "Gazette"}
            description={isEnglish ? "Peloton news" : "Actualités du peloton"}
          >
            <CyclogazetteShortcut gazetteIsOpen={gazetteIsOpen} />
          </HeaderIconMenuItem>

          <span className="hidden sm:contents">
            <HeaderMenuLink
              href="/guide"
              label={isEnglish ? "Game guide" : "Guide du jeu"}
              description={isEnglish ? "Rules and tips" : "Règles et conseils"}
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
          </span>

          <span className="hidden sm:contents">
            <HeaderMenuLink
              href="/jeu/parrainage"
              label={isEnglish ? "Referral programme" : "Parrainage"}
              description={isEnglish ? "Level 5 to 7 items" : "Objets niv. 5 à 7"}
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
                <circle cx="6.5" cy="7" r="2.5" />
                <circle cx="14" cy="8" r="2" />
                <path d="M2 16c.4-3 2-4.5 4.5-4.5S10.6 13 11 16M11.5 12.5c2.8-.5 4.8.8 5.5 3.5" />
                <path d="m14.5 2 .7 1.3 1.5.2-1.1 1 .3 1.5-1.4-.7-1.3.7.2-1.5-1-1 1.5-.2Z" />
              </svg>
            </HeaderMenuLink>
          </span>
        </div>

        <div
          data-mobile-header-primary-actions="true"
          className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-2 lg:ml-0"
        >
          <MobilePageRefreshControl isEnglish={isEnglish} />
          <LanguageSwitcher compact />
          <LogoutButton isEnglish={isEnglish} />
        </div>
      </div>
      </header>
      <Suspense fallback={null}>
        <MobileGameNavigation
          viewerEmail={simulatorEmail}
          federationCountryCode={federationCountryCode}
        />
      </Suspense>
    </>
  );
}

function LogoutButton({ isEnglish }: { isEnglish: boolean }) {
  return (
    <form action={logoutAccount} className="shrink-0">
      <button
        type="submit"
        title={isEnglish ? "Log out" : "Se déconnecter"}
        aria-label={isEnglish ? "Log out" : "Se déconnecter"}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#EF5B65]/30 bg-[#EF5B65]/8 text-[#F6C2C6] transition hover:border-[#EF5B65] hover:bg-[#EF5B65]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF5B65] sm:h-10 sm:w-10"
      >
        <span className="contents">
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
      </button>
    </form>
  );
}

function GameHeaderSearch({
  id,
  searchQuery,
  className,
  isEnglish,
}: {
  id: string;
  searchQuery: string;
  className: string;
  isEnglish: boolean;
}) {
  return (
    <form
      action="/jeu/recherche"
      method="get"
      role="search"
      className={`w-full items-center ${className}`}
    >
      <label htmlFor={id} className="sr-only">
        {isEnglish
          ? "Search for a player, a team or a rider"
          : "Rechercher un joueur, une équipe ou un coureur"}
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
          placeholder={
            isEnglish
              ? "Search player / team / rider"
              : "Rechercher joueur / équipe / coureur"
          }
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm font-medium text-[#FFFDF4] outline-none placeholder:text-xs placeholder:text-[#D6DFD2]/65 sm:px-3 sm:py-2 sm:placeholder:text-sm xl:py-2.5"
        />

        <button
          type="submit"
          aria-label={isEnglish ? "Start search" : "Lancer la recherche"}
          title={isEnglish ? "Search" : "Rechercher"}
          className="m-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--game-header-accent)] text-xs font-extrabold uppercase tracking-wide text-[#071A17] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:h-9 sm:w-9"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
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
      prefetchOnIntent
      title={`${label} · ${description}`}
      aria-label={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#D6DFD2]/25 bg-white/5 text-[var(--game-header-accent)] transition hover:border-[var(--game-header-accent)] hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] sm:h-10 sm:w-10"
    >
      {children}
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
    <div
      title={`${label} · ${description}`}
      data-mobile-header-shortcut={label}
      className="flex min-w-0 flex-col items-center justify-center gap-0.5 sm:contents"
    >
      {children}
      <span
        aria-hidden="true"
        className="max-w-full truncate text-[0.52rem] font-extrabold leading-none tracking-[0.02em] text-[#B9CBC4] sm:hidden"
      >
        {label}
      </span>
    </div>
  );
}

function RaceSimulatorShortcut({ isEnglish }: { isEnglish: boolean }) {
  return (
    <HeaderMenuLink
      href="/jeu/simulateur-course"
      label={isEnglish ? "Simulator" : "Simulateur"}
      description={isEnglish ? "Test a race" : "Tester une course"}
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
