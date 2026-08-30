import { AchievementTrophyMark } from "@/components/game/achievement-trophy-mark";
import { AlphaTesterTrophyMark } from "@/components/game/alpha-tester-trophy-mark";
import { AssiduTrophyMark } from "@/components/game/assidu-trophy-mark";
import {
  ChampionshipTrophyMark,
  ReferralTrophyMark,
  UciTrophyMark,
} from "@/components/game/distinctive-trophy-marks";
import { MedicalTrophyMark } from "@/components/game/medical-trophy-mark";
import { PrestigeRaceTrophyMark } from "@/components/game/prestige-race-trophy-mark";
import { SponsorAmbassadorTrophyMark } from "@/components/game/sponsor-ambassador-trophy-mark";
import type {
  CareerTrophy,
  ChampionshipTrophyVisualVariant,
} from "@/lib/game/trophy-gallery";

export function CareerTrophyMark({
  trophy,
  className = "h-40 w-40",
}: {
  trophy: CareerTrophy;
  className?: string;
}) {
  if (
    (trophy.kind === "grand_tour" || trophy.kind === "monument") &&
    trophy.prestigeVisualVariant
  ) {
    return (
      <PrestigeRaceTrophyMark
        trophyId={trophy.id}
        variant={trophy.prestigeVisualVariant}
        palette={trophy.palette}
        className={className}
      />
    );
  }

  if (trophy.kind === "achievement" && trophy.visualVariant) {
    return (
      <AchievementTrophyMark
        variant={trophy.visualVariant}
        palette={trophy.palette}
        className={className}
      />
    );
  }

  if (trophy.kind === "special") {
    return <AlphaTesterTrophyMark className={className} />;
  }

  if (trophy.kind === "medical" && trophy.medicalVariant) {
    return (
      <MedicalTrophyMark
        variant={trophy.medicalVariant}
        palette={trophy.palette}
        className={className}
      />
    );
  }

  if (trophy.kind === "attendance") {
    return <AssiduTrophyMark trophyId={trophy.id} className={className} />;
  }

  if (trophy.kind === "sponsor") {
    return <SponsorAmbassadorTrophyMark className={className} />;
  }

  if (
    trophy.kind === "world_championship" ||
    trophy.kind === "continental_championship"
  ) {
    return (
      <ChampionshipTrophyMark
        variant={
          trophy.championshipVisualVariant ?? inferChampionshipVariant(trophy)
        }
        palette={trophy.palette}
        className={className}
      />
    );
  }

  if (trophy.kind === "uci_team" || trophy.kind === "uci_rider") {
    return (
      <UciTrophyMark
        variant={trophy.kind === "uci_team" ? "team" : "rider"}
        palette={trophy.palette}
        className={className}
      />
    );
  }

  if (trophy.kind === "referral") {
    return (
      <ReferralTrophyMark
        milestone={trophy.referralMilestone ?? inferReferralMilestone(trophy.id)}
        palette={trophy.palette}
        className={className}
      />
    );
  }

  return <LegendRaceTrophyMark trophy={trophy} className={className} />;
}

function inferChampionshipVariant(
  trophy: CareerTrophy,
): ChampionshipTrophyVisualVariant {
  const timeTrial = /contre-la-montre|\bclm\b|time-trial/i.test(
    `${trophy.id} ${trophy.title} ${trophy.competitionName}`,
  );
  if (trophy.kind === "world_championship") {
    return timeTrial ? "world-time-trial" : "world-road";
  }
  return timeTrial ? "continental-time-trial" : "continental-road";
}

function inferReferralMilestone(id: string) {
  const count = Number(id.match(/(?:referral:|milestone-)(\d+)/)?.[1] ?? 1);
  return Number.isFinite(count) ? count : 1;
}

function LegendRaceTrophyMark({
  trophy,
  className,
}: {
  trophy: CareerTrophy;
  className: string;
}) {
  const safeId = trophy.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const gradientId = `legend-race-${safeId}`;
  const isMonument = trophy.kind === "monument";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 190"
      className={className}
      fill="none"
      data-career-trophy-fallback={trophy.kind}
    >
      <defs>
        <linearGradient id={gradientId} x1="48" y1="25" x2="130" y2="165">
          <stop stopColor={trophy.palette.secondary} />
          <stop offset="0.5" stopColor={trophy.palette.primary} />
          <stop offset="1" stopColor={trophy.palette.accent} />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="166" rx="55" ry="12" fill={trophy.palette.primary} opacity="0.25" />
      <path d="M43 78C24 75 21 51 41 47h15M137 78c19-3 22-27 2-31h-15" stroke={trophy.palette.primary} strokeWidth="8" strokeLinecap="round" />
      <path d="M52 40h76l-7 46c-3 21-16 33-31 33S62 107 59 86l-7-46Z" fill={`url(#${gradientId})`} stroke={trophy.palette.secondary} strokeWidth="3" />
      <path d="M53 42h74" stroke={trophy.palette.secondary} strokeWidth="8" strokeLinecap="round" />
      {isMonument ? (
        <g data-legend-emblem="stone">
          <path d="m90 52 25 18-10 30H75L65 70l25-18Z" fill={trophy.palette.accent} stroke={trophy.palette.secondary} strokeWidth="3" />
          <path d="m76 75 14-10 14 10-5 14H81l-5-14Z" stroke={trophy.palette.primary} strokeWidth="4" />
        </g>
      ) : (
        <g data-legend-emblem="wheel">
          <circle cx="90" cy="75" r="25" fill={trophy.palette.accent} stroke={trophy.palette.secondary} strokeWidth="3" />
          <circle cx="90" cy="75" r="6" fill={trophy.palette.primary} />
          <path d="M90 50v50M65 75h50M72 57l36 36M108 57 72 93" stroke={trophy.palette.secondary} strokeWidth="2.5" />
        </g>
      )}
      <path d="M84 117h12v31H84z" fill={trophy.palette.primary} stroke={trophy.palette.secondary} strokeWidth="2" />
      <path d="M66 148h48l10 15H56l10-15Z" fill={`url(#${gradientId})`} stroke={trophy.palette.secondary} strokeWidth="3" strokeLinejoin="round" />
      <rect x="49" y="163" width="82" height="14" rx="5" fill={trophy.palette.accent} stroke={trophy.palette.primary} strokeWidth="3" />
    </svg>
  );
}
