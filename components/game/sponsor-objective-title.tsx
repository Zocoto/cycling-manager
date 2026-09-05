import type { CSSProperties, ReactNode } from "react";

import { RacePreviewLink } from "@/components/game/race-preview-link";
import Link from "@/components/ui/app-link";
import type { SponsorObjectiveTargetDetails } from "@/types/sponsor-objective";

type SponsorObjectiveTitleProps = {
  targetDetails: SponsorObjectiveTargetDetails;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function SponsorObjectiveTitle({
  targetDetails,
  children,
  className,
  style,
}: SponsorObjectiveTitleProps) {
  if (targetDetails.kind === "rider_recruitment") {
    return (
      <Link
        href={`/jeu/coureurs/${encodeURIComponent(targetDetails.riderId)}`}
        showPendingIndicator={false}
        prefetchOnIntent
        className={`group inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] focus-visible:ring-offset-2 ${className ?? ""}`}
        style={style}
        title={`Afficher l’aperçu et ouvrir la fiche de ${targetDetails.riderName}`}
        data-sponsor-rider-objective-link=""
      >
        <span>{children}</span>
        <span className="inline-flex shrink-0 items-center rounded-full border border-current/15 bg-white/75 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] opacity-80 transition group-hover:opacity-100">
          Aperçu · coureur ↗
        </span>
      </Link>
    );
  }

  if (targetDetails.kind !== "race_result") {
    return (
      <p className={className} style={style}>
        {children}
      </p>
    );
  }

  return (
    <RacePreviewLink
      href={`/jeu/courses/${encodeURIComponent(targetDetails.raceSlug)}`}
      previewTarget={{
        slug: targetDetails.raceSlug,
        stageNumber: null,
        raceEditionId: targetDetails.raceEditionId,
      }}
      className={`group inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] focus-visible:ring-offset-2 ${className ?? ""}`}
      style={style}
      title={`Afficher l’aperçu et ouvrir ${targetDetails.raceLabel}`}
      data-sponsor-race-objective-link=""
    >
      <span>{children}</span>
      <span className="inline-flex shrink-0 items-center rounded-full border border-current/15 bg-white/75 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] opacity-80 transition group-hover:opacity-100">
        Aperçu · course ↗
      </span>
    </RacePreviewLink>
  );
}
