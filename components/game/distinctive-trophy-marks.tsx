import type {
  ChampionshipTrophyVisualVariant,
  TrophyPalette,
} from "@/lib/game/trophy-gallery";

type TrophyMarkProps = {
  palette: TrophyPalette;
  className?: string;
};

export function ChampionshipTrophyMark({
  variant,
  palette,
  className = "h-40 w-40",
}: TrophyMarkProps & { variant: ChampionshipTrophyVisualVariant }) {
  const isWorld = variant.startsWith("world");
  const isTimeTrial = variant.endsWith("time-trial");
  const gradientId = `championship-${variant}`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 190"
      className={className}
      fill="none"
      data-championship-trophy={variant}
    >
      <defs>
        <linearGradient id={gradientId} x1="46" y1="25" x2="132" y2="165">
          <stop stopColor={palette.secondary} />
          <stop offset="0.48" stopColor={palette.primary} />
          <stop offset="1" stopColor={palette.accent} />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="166" rx="57" ry="12" fill={palette.primary} opacity="0.24" />

      {isWorld ? (
        <path
          d="M47 50 90 25l43 25-7 53c-4 23-18 35-36 43-18-8-32-20-36-43L47 50Z"
          fill="#F8FBFF"
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="m90 27 42 24v49l-42 25-42-25V51l42-24Z"
          fill={`url(#${gradientId})`}
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}

      {isWorld && !isTimeTrial ? <WorldRoadEmblem palette={palette} /> : null}
      {isWorld && isTimeTrial ? <WorldTimeTrialEmblem palette={palette} /> : null}
      {!isWorld && !isTimeTrial ? <ContinentalRoadEmblem palette={palette} /> : null}
      {!isWorld && isTimeTrial ? <ContinentalTimeTrialEmblem palette={palette} /> : null}

      <path d="M84 139h12v14H84z" fill={palette.primary} stroke={palette.secondary} strokeWidth="2" />
      <path
        d="M65 152h50l9 14H56l9-14Z"
        fill={`url(#${gradientId})`}
        stroke={palette.secondary}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="48" y="165" width="84" height="14" rx="5" fill="#102D28" stroke={palette.primary} strokeWidth="3" />
    </svg>
  );
}

function WorldRoadEmblem({ palette }: { palette: TrophyPalette }) {
  return (
    <g data-championship-emblem="rainbow-road">
      <path
        d="M66 50 78 43l12 8 12-8 12 7-5 18v42c-12 12-26 12-38 0V68l-5-18Z"
        fill="#FFFFFF"
        stroke={palette.accent}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M70 71h40" stroke="#2B75BB" strokeWidth="5" />
      <path d="M70 77h40" stroke="#D9303E" strokeWidth="5" />
      <path d="M70 83h40" stroke="#171717" strokeWidth="5" />
      <path d="M70 89h40" stroke="#E8C62D" strokeWidth="5" />
      <path d="M70 95h40" stroke="#2E9E59" strokeWidth="5" />
      <path d="M82 113c4-9 12-9 16 0" stroke={palette.primary} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function WorldTimeTrialEmblem({ palette }: { palette: TrophyPalette }) {
  return (
    <g data-championship-emblem="rainbow-chrono">
      <path d="M82 48h16M86 42h8" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />
      <circle cx="90" cy="82" r="31" fill="#FFFFFF" stroke={palette.accent} strokeWidth="4" />
      <path d="M90 56v7M109 63l-5 6M117 82h-8M71 63l5 6M63 82h8" stroke={palette.primary} strokeWidth="4" strokeLinecap="round" />
      <path d="M90 82 104 68M90 82v19" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />
      <circle cx="90" cy="82" r="5" fill={palette.primary} />
      <path d="M66 113h48" stroke="#2B75BB" strokeWidth="3" />
      <path d="M70 118h40" stroke="#D9303E" strokeWidth="3" />
      <path d="M75 123h30" stroke="#2E9E59" strokeWidth="3" />
    </g>
  );
}

function ContinentalRoadEmblem({ palette }: { palette: TrophyPalette }) {
  return (
    <g data-championship-emblem="continental-road">
      <path
        d="M54 93c-13-18-8-39 9-52M126 93c13-18 8-39-9-52"
        stroke={palette.secondary}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M58 78 47 73M60 62l-9-8M122 78l11-5M120 62l9-8" stroke={palette.primary} strokeWidth="4" strokeLinecap="round" />
      <path
        d="M90 43c20 0 31 16 31 34 0 22-15 35-31 43-16-8-31-21-31-43 0-18 11-34 31-34Z"
        fill="#123E52"
        fillOpacity="0.78"
        stroke={palette.secondary}
        strokeWidth="3"
      />
      <path d="M74 99c9-10 12-22 10-38M106 99c-9-10-12-22-10-38" stroke={palette.primary} strokeWidth="6" strokeLinecap="round" />
      <path d="M90 60v49" stroke={palette.secondary} strokeWidth="3" strokeDasharray="6 6" />
    </g>
  );
}

function ContinentalTimeTrialEmblem({ palette }: { palette: TrophyPalette }) {
  return (
    <g data-championship-emblem="continental-chrono">
      <path d="M82 43h16M86 37h8" stroke={palette.secondary} strokeWidth="5" strokeLinecap="round" />
      <path
        d="m90 50 28 16v32l-28 17-28-17V66l28-16Z"
        fill="#123E52"
        fillOpacity="0.82"
        stroke={palette.secondary}
        strokeWidth="3"
      />
      <circle cx="90" cy="82" r="21" stroke={palette.primary} strokeWidth="5" />
      <path d="M90 82 103 69M90 82V65" stroke={palette.secondary} strokeWidth="4" strokeLinecap="round" />
      <circle cx="90" cy="82" r="4" fill={palette.primary} />
      <path d="m65 110 10-6M115 104l10 6M58 97l10-2M112 95l10 2" stroke={palette.secondary} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

export function UciTrophyMark({
  variant,
  palette,
  className = "h-40 w-40",
}: TrophyMarkProps & { variant: "team" | "rider" }) {
  const gradientId = `uci-${variant}`;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 190"
      className={className}
      fill="none"
      data-uci-trophy={variant}
    >
      <defs>
        <linearGradient id={gradientId} x1="50" y1="25" x2="128" y2="165">
          <stop stopColor={palette.secondary} />
          <stop offset="0.5" stopColor={palette.primary} />
          <stop offset="1" stopColor={palette.accent} />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="166" rx="60" ry="13" fill={palette.primary} opacity="0.28" />
      <path d="M38 77C17 72 18 44 39 42h15M142 77c21-5 20-33-1-35h-15" stroke={palette.primary} strokeWidth="8" strokeLinecap="round" />
      <path d="M47 34h86l-8 52c-3 24-18 38-35 38S58 110 55 86l-8-52Z" fill={`url(#${gradientId})`} stroke={palette.secondary} strokeWidth="3" />
      <path d="M48 36h84" stroke={palette.secondary} strokeWidth="7" strokeLinecap="round" />
      {variant === "team" ? (
        <g data-uci-emblem="team-peloton">
          <circle cx="90" cy="71" r="29" fill={palette.accent} opacity="0.84" />
          <circle cx="72" cy="70" r="8" fill={palette.secondary} />
          <circle cx="90" cy="61" r="9" fill={palette.secondary} />
          <circle cx="108" cy="70" r="8" fill={palette.secondary} />
          <path d="M61 92c3-12 17-16 26-8M119 92c-3-12-17-16-26-8M75 92c4-14 26-14 30 0" stroke={palette.primary} strokeWidth="5" strokeLinecap="round" />
        </g>
      ) : (
        <g data-uci-emblem="rider-crown">
          <circle cx="90" cy="72" r="28" fill={palette.accent} opacity="0.86" />
          <path d="m66 61 12 10 12-20 12 20 12-10-5 31H71l-5-31Z" fill={palette.secondary} stroke={palette.primary} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="90" cy="83" r="6" fill={palette.primary} />
        </g>
      )}
      <path d="M84 121h12v27H84z" fill={palette.primary} stroke={palette.secondary} strokeWidth="2" />
      <path d="M66 148h48l10 15H56l10-15Z" fill={`url(#${gradientId})`} stroke={palette.secondary} strokeWidth="3" strokeLinejoin="round" />
      <rect x="47" y="163" width="86" height="14" rx="5" fill={palette.accent} stroke={palette.primary} strokeWidth="3" />
    </svg>
  );
}

export function ReferralTrophyMark({
  milestone,
  palette,
  className = "h-40 w-40",
}: TrophyMarkProps & { milestone: number }) {
  const normalizedMilestone = milestone >= 25 ? 25 : milestone >= 10 ? 10 : milestone >= 5 ? 5 : 1;
  const gradientId = `referral-${normalizedMilestone}`;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 190"
      className={className}
      fill="none"
      data-referral-trophy={`milestone-${normalizedMilestone}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="48" y1="25" x2="130" y2="164">
          <stop stopColor={palette.secondary} />
          <stop offset="0.5" stopColor={palette.primary} />
          <stop offset="1" stopColor={palette.accent} />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="166" rx="55" ry="12" fill={palette.primary} opacity="0.25" />
      <path d="M90 25 130 48v47l-40 24-40-24V48l40-23Z" fill={`url(#${gradientId})`} stroke={palette.secondary} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="90" cy="73" r="32" fill="#102D28" fillOpacity="0.88" stroke={palette.secondary} strokeWidth="3" />
      {normalizedMilestone === 1 ? <ReferralLinkEmblem palette={palette} /> : null}
      {normalizedMilestone === 5 ? <ReferralPatronEmblem palette={palette} /> : null}
      {normalizedMilestone === 10 ? <ReferralSignalEmblem palette={palette} /> : null}
      {normalizedMilestone === 25 ? <ReferralLegacyEmblem palette={palette} /> : null}
      <path d="M84 118h12v32H84z" fill={palette.primary} stroke={palette.secondary} strokeWidth="2" />
      <path d="M65 149h50l10 16H55l10-16Z" fill={`url(#${gradientId})`} stroke={palette.secondary} strokeWidth="3" strokeLinejoin="round" />
      <rect x="48" y="164" width="84" height="14" rx="5" fill={palette.accent} stroke={palette.primary} strokeWidth="3" />
      <text x="90" y="174" textAnchor="middle" fontSize="9" fontWeight="900" fill={palette.secondary}>{normalizedMilestone}</text>
    </svg>
  );
}

function ReferralLinkEmblem({ palette }: { palette: TrophyPalette }) {
  return (
    <g data-referral-emblem="link">
      <path d="M69 77 61 69a13 13 0 0 1 18-18l9 9M111 69l8 8a13 13 0 0 1-18 18l-9-9" stroke={palette.secondary} strokeWidth="7" strokeLinecap="round" />
      <path d="m78 82 24-18" stroke={palette.primary} strokeWidth="7" strokeLinecap="round" />
    </g>
  );
}

function ReferralPatronEmblem({ palette }: { palette: TrophyPalette }) {
  return (
    <g data-referral-emblem="patron">
      <path d="M63 55h54l-7 13H70l-7-13Z" fill={palette.secondary} stroke={palette.primary} strokeWidth="3" strokeLinejoin="round" />
      <path d="M74 54c2-12 8-19 16-19s14 7 16 19" fill={palette.accent} stroke={palette.secondary} strokeWidth="3" />
      <path d="M68 78c8-6 15-9 22-9s14 3 22 9l-8 20H76l-8-20Z" fill={palette.primary} stroke={palette.secondary} strokeWidth="3" />
      <path d="m84 76 6 9 6-9" stroke={palette.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function ReferralSignalEmblem({ palette }: { palette: TrophyPalette }) {
  return (
    <g data-referral-emblem="signal">
      <path d="m65 68 34-15v37L65 77v-9Z" fill={palette.secondary} stroke={palette.primary} strokeWidth="3" strokeLinejoin="round" />
      <path d="m69 78 5 19h12l-8-16" fill={palette.accent} stroke={palette.secondary} strokeWidth="3" strokeLinejoin="round" />
      <path d="M108 59c8 7 8 18 0 25M116 51c14 12 14 31 0 43" stroke={palette.secondary} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function ReferralLegacyEmblem({ palette }: { palette: TrophyPalette }) {
  return (
    <g data-referral-emblem="legacy">
      <path d="M58 88C48 76 49 60 58 49M122 88c10-12 9-28 0-39" stroke={palette.primary} strokeWidth="5" strokeLinecap="round" />
      <path d="M61 78 52 74M60 65l-8-6M119 78l9-4M120 65l8-6" stroke={palette.secondary} strokeWidth="4" strokeLinecap="round" />
      <path d="M62 63h56l-8 15H70l-8-15Z" fill={palette.secondary} stroke={palette.primary} strokeWidth="3" strokeLinejoin="round" />
      <path d="M74 62c2-15 8-23 16-23s14 8 16 23" fill={palette.accent} stroke={palette.secondary} strokeWidth="3" />
      <path d="M76 91h28" stroke={palette.secondary} strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}
