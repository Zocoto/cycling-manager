type AlphaTesterTrophyMarkProps = {
  className?: string;
};

export function AlphaTesterTrophyMark({
  className = "h-36 w-36",
}: AlphaTesterTrophyMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 190"
      className={className}
      fill="none"
    >
      <ellipse cx="90" cy="166" rx="55" ry="12" fill="#48D9C0" opacity="0.2" />
      <path
        d="M48 40h84l-8 48c-4 24-18 38-34 38S60 112 56 88L48 40Z"
        fill="#163F3B"
        stroke="#D7FFF8"
        strokeWidth="3"
      />
      <path
        d="M48 42h84"
        stroke="#48D9C0"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M52 55H38c-18 0-18 28 1 31h20M128 55h14c18 0 18 28-1 31h-20"
        stroke="#48D9C0"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M84 126h12v24H84z" fill="#342A64" stroke="#D7FFF8" strokeWidth="2" />
      <path
        d="M65 150h50l11 16H54l11-16Z"
        fill="#342A64"
        stroke="#48D9C0"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="48" y="166" width="84" height="13" rx="5" fill="#102D28" stroke="#D7FFF8" strokeWidth="2" />

      <circle cx="90" cy="79" r="29" fill="#271F4B" stroke="#48D9C0" strokeWidth="2.5" />
      <path
        d="M74 95 90 57l16 38M80 82h20"
        stroke="#D7FFF8"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M62 68h11M107 68h11M64 91h10M106 91h10" stroke="#48D9C0" strokeWidth="2" />
      <circle cx="60" cy="68" r="3" fill="#D7FFF8" />
      <circle cx="120" cy="68" r="3" fill="#D7FFF8" />
      <circle cx="62" cy="91" r="3" fill="#48D9C0" />
      <circle cx="118" cy="91" r="3" fill="#48D9C0" />
      <path d="M90 50V43M77 54l-5-7M103 54l5-7" stroke="#48D9C0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="90" cy="40" r="3" fill="#D7FFF8" />
      <circle cx="70" cy="45" r="3" fill="#48D9C0" />
      <circle cx="110" cy="45" r="3" fill="#48D9C0" />
    </svg>
  );
}