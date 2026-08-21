import { useId } from "react";

export function RaceMediaConvoy({
  isMoving,
  showHelicopter,
  mode = "side",
}: {
  isMoving: boolean;
  showHelicopter: boolean;
  mode?: "side" | "top";
}) {
  const visualId = `race-media-${useId().replace(/:/g, "")}`;

  return (
    <div
      aria-hidden="true"
      data-race-media-convoy={mode}
      className="pointer-events-none absolute inset-0 z-[17] overflow-hidden"
    >
      {showHelicopter ? (
        <svg
          viewBox="0 0 190 78"
          data-race-helicopter="occasional"
          className={`absolute right-[20%] top-[7%] h-12 w-28 overflow-visible drop-shadow-lg ${
            isMoving ? "cm-race-helicopter" : ""
          }`}
        >
          <defs>
            <linearGradient id={`${visualId}-helicopter`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F2F7F5" />
              <stop offset="0.55" stopColor="#86AFA5" />
              <stop offset="1" stopColor="#2D5148" />
            </linearGradient>
          </defs>
          <ellipse cx="75" cy="68" rx="58" ry="5" fill="rgba(7,26,23,0.2)" />
          <path
            d="M28 45c3-18 18-30 41-30h21c17 0 29 8 35 22l50 1v6l-52 7c-8 10-21 15-39 15H58c-20 0-33-8-30-21Z"
            fill={`url(#${visualId}-helicopter)`}
            stroke="#17352E"
            strokeWidth="2"
          />
          <path d="M42 43c4-13 15-20 31-20h17l17 20Z" fill="#BFE3E1" stroke="#486C65" strokeWidth="1.3" />
          <path d="M75 23v20M41 43h67" stroke="#567A72" strokeWidth="1" />
          <path d="M123 39 172 22l4 5-34 14" fill="#587A72" stroke="#24443C" strokeWidth="1.4" />
          <path d="m168 23 12-12 2 18" fill="#D9E8E3" stroke="#24443C" strokeWidth="1.2" />
          <g className={isMoving ? "cm-helicopter-rotor" : ""}>
            <path d="M13 13h124" stroke="#1A332C" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M75 13v8" stroke="#1A332C" strokeWidth="2" />
          </g>
          <path d="M50 65 42 74m62-9 9 9M37 74h82" fill="none" stroke="#1E3932" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="112" cy="48" r="6" fill="#17261E" stroke="#F2C94C" strokeWidth="1.2" />
          <path d="M109 48h6M112 45v6" stroke="#D7E9E3" strokeWidth="0.8" />
        </svg>
      ) : null}

      <svg
        viewBox="0 0 180 96"
        data-race-camera-motorcycle={mode}
        className={`absolute bottom-[20%] left-[6%] h-14 w-28 overflow-visible drop-shadow-xl ${
          isMoving ? "cm-camera-moto" : ""
        } ${mode === "top" ? "rotate-[-4deg] opacity-85" : ""}`}
      >
        <defs>
          <linearGradient id={`${visualId}-moto`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F4FAF7" />
            <stop offset="0.34" stopColor="#176951" />
            <stop offset="1" stopColor="#0C3028" />
          </linearGradient>
          <linearGradient id={`${visualId}-camera-glass`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D7EEEA" />
            <stop offset="1" stopColor="#456B63" />
          </linearGradient>
        </defs>
        <ellipse cx="91" cy="86" rx="75" ry="5" fill="rgba(7,26,23,0.22)" />
        {[40, 139].map((wheelX) => (
          <g key={wheelX} data-race-camera-moto-wheel="detailed">
            <circle cx={wheelX} cy="73" r="20" fill="#111815" stroke="#31443D" strokeWidth="2" />
            <circle cx={wheelX} cy="73" r="14" fill="#AAB8B2" stroke="#E7EEEA" strokeWidth="1.3" />
            <g className={isMoving ? "cm-camera-moto-wheel" : ""}>
              <path d={`M${wheelX - 12} 73h24M${wheelX} 61v24M${wheelX - 8.5} 64.5l17 17M${wheelX + 8.5} 64.5l-17 17`} stroke="#536861" strokeWidth="1" />
            </g>
            <circle cx={wheelX} cy="73" r="3" fill="#24352F" />
          </g>
        ))}
        <path d="M40 73 76 39l27 34H40l39-49 42 8 18 41" fill="none" stroke="#DDE9E4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M76 39h29l17 15H91Z" fill={`url(#${visualId}-moto)`} stroke="#EAF2EE" strokeWidth="1.4" />
        <path d="M105 39 125 22h19l-3 8-17 3" fill={`url(#${visualId}-camera-glass)`} stroke="#D8E6E1" strokeWidth="1.2" />
        <rect x="83" y="45" width="28" height="9" rx="4" fill="#F2C94C" opacity="0.92" />
        <text x="97" y="52" textAnchor="middle" fontSize="6" fontWeight="900" fill="#17261E">TV</text>
        <path d="M82 24c4-8 15-11 24-5l10 9-11 21H85L73 36Z" fill="#264F77" stroke="#E7F0EC" strokeWidth="1.2" />
        <path d="M87 19c0-7 5-12 12-12 8 0 13 5 13 12l-13-2Z" fill="#176951" stroke="#102C25" strokeWidth="1.3" />
        <path d="M80 27 69 42M105 27l15 3" fill="none" stroke="#D39B75" strokeWidth="5" strokeLinecap="round" />
        <path d="M84 47 76 62M101 47l10 17" fill="none" stroke="#1B2D3B" strokeWidth="6" strokeLinecap="round" />
        <g data-race-camera-operator="stabilized">
          <path d="M52 27c3-8 14-12 23-8l10 9-8 20H56l-12-10Z" fill="#213B50" stroke="#DCE8E2" strokeWidth="1.2" />
          <circle cx="62" cy="15" r="9" fill="#C78D69" stroke="#6D4837" strokeWidth="1" />
          <path d="M52 14c2-8 9-11 17-7 3 2 5 4 5 7l-12-2Z" fill="#17261E" />
          <path d="M56 27 43 38" stroke="#C78D69" strokeWidth="5" strokeLinecap="round" />
          <g className={isMoving ? "cm-camera-stabilizer" : ""}>
            <rect x="29" y="28" width="21" height="14" rx="2" fill="#17261E" stroke="#C8D5D0" strokeWidth="1.2" />
            <circle cx="33" cy="35" r="5" fill="#54756E" stroke="#071A17" strokeWidth="1" />
            <path d="M49 31h9l3 5-12 2Z" fill="#243C35" />
          </g>
        </g>
      </svg>
    </div>
  );
}
