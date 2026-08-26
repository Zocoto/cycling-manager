type SponsorAmbassadorTrophyMarkProps = {
  className?: string;
};

export function SponsorAmbassadorTrophyMark({
  className = "h-36 w-36",
}: SponsorAmbassadorTrophyMarkProps) {
  return (
    <svg
      data-sponsor-ambassador-trophy
      aria-hidden="true"
      viewBox="0 0 180 190"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="ambassador-cup" x1="52" y1="25" x2="126" y2="164">
          <stop stopColor="#FFF3B0" />
          <stop offset="0.48" stopColor="#D6AE3B" />
          <stop offset="1" stopColor="#8A6714" />
        </linearGradient>
        <filter id="ambassador-glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse
        cx="90"
        cy="165"
        rx="58"
        ry="13"
        fill="#D6AE3B"
        opacity="0.32"
        filter="url(#ambassador-glow)"
      />
      <path
        d="M50 107C30 93 25 68 35 45M130 107c20-14 25-39 15-62"
        stroke="#D6AE3B"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="m38 85-13-5m12-12-13-8m18-8-10-11m110 44 13-5m-12-12 13-8m-18-8 10-11"
        stroke="#FFF3B0"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M47 29h86l-7 53c-3 25-18 41-36 41S57 107 54 82l-7-53Z"
        fill="url(#ambassador-cup)"
        stroke="#FFF3B0"
        strokeWidth="3"
      />
      <path d="M48 31h84" stroke="#FFF3B0" strokeWidth="8" strokeLinecap="round" />
      <circle cx="90" cy="70" r="29" fill="#123B34" stroke="#FFF3B0" strokeWidth="2.5" />
      <text
        x="90"
        y="77"
        textAnchor="middle"
        fill="#FFF3B0"
        fontSize="21"
        fontWeight="900"
        fontFamily="Arial, sans-serif"
      >
        100
      </text>
      <path
        d="M76 88c-9 7-12 15-10 24 9-1 17-6 21-15-1 8 0 14 3 19"
        stroke="#78CBA8"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M84 119h12v29H84z" fill="#D6AE3B" stroke="#FFF3B0" strokeWidth="2" />
      <path d="m66 148-10 15h68l-10-15H66Z" fill="url(#ambassador-cup)" stroke="#FFF3B0" strokeWidth="3" />
      <rect x="47" y="163" width="86" height="14" rx="5" fill="#123B34" stroke="#D6AE3B" strokeWidth="3" />
    </svg>
  );
}
