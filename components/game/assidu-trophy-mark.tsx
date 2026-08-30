type AssiduTrophyMarkProps = {
  trophyId: string;
  className?: string;
};

export function AssiduTrophyMark({
  trophyId,
  className = "h-40 w-40",
}: AssiduTrophyMarkProps) {
  const safeId = trophyId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const gradientId = `assidu-gradient-${safeId}`;
  const glowId = `assidu-glow-${safeId}`;

  return (
    <svg
      data-assidu-trophy
      aria-hidden="true"
      viewBox="0 0 180 190"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="45" y1="24" x2="132" y2="164">
          <stop stopColor="#FFF2B8" />
          <stop offset="0.46" stopColor="#D7A928" />
          <stop offset="1" stopColor="#80640C" />
        </linearGradient>
        <filter id={glowId} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse
        cx="90"
        cy="165"
        rx="58"
        ry="13"
        fill="#D7A928"
        opacity="0.3"
        filter={`url(#${glowId})`}
      />
      <path
        d="M49 108C31 94 26 70 35 49M131 108c18-14 23-38 14-59"
        stroke="#D7A928"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M39 89 27 84M38 73 25 67M42 57 32 48M141 89l12-5M142 73l13-6M138 57l10-9"
        stroke="#FFF2B8"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M90 20 128 34v43c0 29-15 48-38 59-23-11-38-30-38-59V34l38-14Z"
        fill={`url(#${gradientId})`}
        stroke="#FFF2B8"
        strokeWidth="3"
      />
      <path
        d="M90 31 117 41v35c0 21-10 36-27 46-17-10-27-25-27-46V41l27-10Z"
        fill="#173F37"
        stroke="#D7A928"
        strokeWidth="2.5"
      />
      <g data-assidu-emblem>
        <path
          d="M69 59h17l-2 16H73c-4-3-5-8-4-16ZM111 59H94l2 16h11c4-3 5-8 4-16Z"
          fill="#DDF5F0"
          fillOpacity="0.2"
          stroke="#FFF2B8"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path d="M85 65h10" stroke="#D7A928" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M69 63l-8-5M111 63l8-5" stroke="#FFF2B8" strokeWidth="3" strokeLinecap="round" />
        <path
          d="m82 91 8-8 8 8"
          stroke="#D7A928"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M61 120c12-3 22 0 29 7 7-7 17-10 29-7v25c-12-3-22 0-29 7-7-7-17-10-29-7v-25Z"
        fill="#FFF8D8"
        stroke="#D7A928"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M90 127v25" stroke="#D7A928" strokeWidth="2.5" />
      <path
        d="M69 132c6-1 11 0 16 3M111 132c-6-1-11 0-16 3"
        stroke="#80640C"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.65"
      />
      <rect x="48" y="157" width="84" height="16" rx="5" fill="#173F37" stroke="#D7A928" strokeWidth="3" />
      <path
        d="M61 157h58l-7-11H68l-7 11Z"
        fill={`url(#${gradientId})`}
        stroke="#FFF2B8"
        strokeWidth="2"
      />
    </svg>
  );
}
