import type { CSSProperties } from "react";

import { DEFAULT_AMATEUR_JERSEY } from "@/lib/amateur-team";
import type { SponsorObjectiveSummary } from "@/lib/game/sponsor-objective-summary";
import type { Sponsor } from "@/types/sponsor";

import Link from "../ui/app-link";
import { SponsorLogoMark } from "./sponsor-logo";
import { TeamJerseyPreview } from "./team-jersey-preview";

type DashboardSponsorCardProps = {
  sponsor: Sponsor;
  jersey: Sponsor["jerseys"][number];
  budgetLabel: string;
  objectiveSummary?: SponsorObjectiveSummary | null;
};

export function DashboardSponsorCard({
  sponsor,
  jersey,
  budgetLabel,
  objectiveSummary = null,
}: DashboardSponsorCardProps) {
  const theme = {
    "--dashboard-sponsor-primary": sponsor.colors.primary,
    "--dashboard-sponsor-secondary": sponsor.colors.secondary,
    "--dashboard-sponsor-accent": sponsor.colors.accent,
  } as CSSProperties;

  return (
    <Link
      href="/jeu/sponsoring"
      data-tutorial-id="dashboard-sponsoring"
      aria-label={`Ouvrir le sponsoring de ${sponsor.name}`}
      className="group relative isolate block min-h-[17rem] overflow-hidden rounded-2xl border border-white/15 bg-[var(--dashboard-sponsor-primary)] p-5 text-[#FFFDF4] shadow-[0_20px_48px_rgba(7,26,23,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(7,26,23,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dashboard-sponsor-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EAF5F3] sm:p-6"
      style={theme}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(118deg,rgba(7,26,23,0.18)_0%,rgba(7,26,23,0.66)_58%,rgba(7,26,23,0.94)_100%)]"
      />
      <span
        aria-hidden="true"
        className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-[var(--dashboard-sponsor-secondary)] opacity-35 blur-3xl transition duration-500 group-hover:scale-110"
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--dashboard-sponsor-accent),var(--dashboard-sponsor-secondary),transparent)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-16 right-12 h-40 w-40 rounded-full border border-white/10"
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <SponsorLogoMark
          src={sponsor.logoPath}
          alt={`Logo de ${sponsor.name}`}
          sponsorName={sponsor.name}
          primaryColor={sponsor.colors.primary}
          backgroundColor={sponsor.colors.background}
          textColor={sponsor.colors.text}
          className="h-14 w-28 rounded-xl bg-white/95 p-2 sm:h-16 sm:w-32"
        />

        <span className="max-w-[8.5rem] truncate rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs font-bold text-white/85 backdrop-blur-sm">
          {sponsor.shortName}
        </span>
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-[minmax(0,1fr)_6.25rem] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-4">
        <div className="min-w-0 pb-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/65">
            <SponsorCaseIcon />
            Partenaire principal
          </div>

          <h2 className="mt-2 text-xl font-black text-white">Sponsoring</h2>
          <p className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-white/85 sm:text-base">
            {sponsor.name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-white/65 sm:text-sm">
              Budget annuel&nbsp;: {budgetLabel}
            </span>
            {objectiveSummary && objectiveSummary.total > 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white/80 backdrop-blur-sm"
                aria-label={`${objectiveSummary.completed} objectifs accomplis sur ${objectiveSummary.total}`}
              >
                <span aria-hidden="true" className="text-[var(--dashboard-sponsor-accent)]">
                  ✓
                </span>
                Objectifs {objectiveSummary.completed}/{objectiveSummary.total}
              </span>
            ) : null}
          </div>

          <span className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-[var(--dashboard-sponsor-accent)] drop-shadow-sm">
            Ouvrir
            <ArrowRightIcon />
          </span>
        </div>

        <div className="relative flex min-w-0 flex-col items-center justify-end self-stretch">
          <span className="absolute bottom-3 h-5 w-20 rounded-[50%] bg-black/35 blur-md sm:w-24" />
          <TeamJerseyPreview
            amateurJersey={DEFAULT_AMATEUR_JERSEY}
            sponsor={sponsor}
            sponsorJersey={jersey}
            className="relative h-32 w-24 shrink-0 drop-shadow-[0_16px_18px_rgba(0,0,0,0.3)] transition duration-300 group-hover:-translate-y-1 group-hover:scale-[1.03] sm:h-40 sm:w-32"
          />
          <span className="relative -mt-1 rounded-full border border-white/15 bg-black/25 px-2 py-1 text-center text-[8px] font-black uppercase tracking-[0.12em] text-white/70 backdrop-blur-sm sm:text-[9px]">
            Maillot officiel
          </span>
        </div>
      </div>
    </Link>
  );
}

function SponsorCaseIcon() {
  return (
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
      <path d="M3 6.5h14v10H3z" />
      <path d="M7 6.5V4h6v2.5M3 10h14M8 10v2h4v-2" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10h12" />
      <path d="m11 5 5 5-5 5" />
    </svg>
  );
}
