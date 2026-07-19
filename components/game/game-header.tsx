import type { CSSProperties } from "react";
import Link from "next/link";

import type { Sponsor } from "@/types/sponsor";

import { logoutAccount } from "@/app/jeu/actions";
import { WheelLogo } from "@/components/ui/wheel-logo";

type GameHeaderProps = {
  displayName?: string;
  sponsor?: Sponsor | null;
  maxWidth?: "standard" | "wide";
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
        className={`mx-auto flex ${maxWidthClassName} items-center justify-between gap-5 px-5 pb-4 pt-5 sm:px-8`}
      >
        <Link
          href="/jeu"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
        >
          <span className="rounded-full ring-2 ring-[var(--game-header-primary-soft)] transition group-hover:ring-[var(--game-header-primary)]">
            <WheelLogo />
          </span>

          <span>
            <span className="block text-lg font-extrabold uppercase leading-none">
              Cyclo
            </span>

            <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.26em] text-[var(--game-header-accent)]">
              Stratège
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {sponsor ? (
            <span
              className="hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold lg:inline-flex"
              style={{
                borderColor: `${colors.primary}66`,
                backgroundColor: `${colors.primary}20`,
              }}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: colors.accent,
                }}
              />

              {sponsor.shortName}
            </span>
          ) : null}

          {displayName ? (
            <span className="hidden text-sm font-semibold text-[#D6DFD2] md:inline">
              {displayName}
            </span>
          ) : null}

          <form action={logoutAccount}>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--game-header-accent)] bg-[var(--game-header-accent-soft)] px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-[var(--game-header-accent)] transition hover:bg-[var(--game-header-accent)] hover:text-[#071A17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
