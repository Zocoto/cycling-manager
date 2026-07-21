import type { AmateurJerseyConfig } from "@/lib/amateur-team";

type AmateurTeamJerseyProps = {
  jersey: AmateurJerseyConfig;
  teamName?: string | null;
  className?: string;
};

export function AmateurTeamJersey({
  jersey,
  teamName,
  className = "h-64 w-56 drop-shadow-xl",
}: AmateurTeamJerseyProps) {
  const clipPathId = `amateur-jersey-${toStableId(
    `${jersey.pattern}-${jersey.primaryColor}-${jersey.secondaryColor}-${jersey.accentColor}`
  )}`;

  return (
    <svg
      aria-label={`Maillot amateur${teamName ? ` de ${teamName}` : ""}`}
      role="img"
      viewBox="0 0 260 300"
      className={className}
    >
      <defs>
        <clipPath id={clipPathId}>
          <path d="M88 42 55 58 22 100 55 126 72 105 72 267 188 267 188 105 205 126 238 100 205 58 172 42 153 62 107 62Z" />
        </clipPath>
      </defs>

      <path
        d="M88 42 55 58 22 100 55 126 72 105 72 267 188 267 188 105 205 126 238 100 205 58 172 42 153 62 107 62Z"
        fill={jersey.primaryColor}
        stroke="#071A17"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M107 62 117 82H143L153 62"
        fill={jersey.secondaryColor}
        stroke="#071A17"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      <g clipPath={`url(#${clipPathId})`}>
        {jersey.pattern === "classic" ? (
          <>
            <rect x="104" y="70" width="52" height="210" fill={jersey.secondaryColor} />
            <rect x="119" y="70" width="22" height="210" fill={jersey.accentColor} />
          </>
        ) : null}

        {jersey.pattern === "diagonal" ? (
          <>
            <path d="M-25 245 210 15 285 85 45 320Z" fill={jersey.secondaryColor} />
            <path d="M2 270 237 40 259 61 24 292Z" fill={jersey.accentColor} />
          </>
        ) : null}

        {jersey.pattern === "hoops" ? (
          <>
            <rect x="0" y="110" width="260" height="40" fill={jersey.secondaryColor} />
            <rect x="0" y="150" width="260" height="24" fill={jersey.accentColor} />
            <rect x="0" y="174" width="260" height="40" fill={jersey.secondaryColor} />
          </>
        ) : null}

        {jersey.pattern === "split" ? (
          <>
            <rect x="130" y="0" width="150" height="320" fill={jersey.secondaryColor} />
            <rect x="118" y="0" width="24" height="320" fill={jersey.accentColor} />
          </>
        ) : null}

        {jersey.pattern === "vertical" ? (
          <>
            <rect x="88" y="0" width="28" height="320" fill={jersey.secondaryColor} />
            <rect x="144" y="0" width="28" height="320" fill={jersey.secondaryColor} />
            <rect x="124" y="0" width="12" height="320" fill={jersey.accentColor} />
          </>
        ) : null}

        {jersey.pattern === "chevron" ? (
          <>
            <path d="M30 105 130 195 230 105v38l-100 90-100-90Z" fill={jersey.secondaryColor} />
            <path d="M30 126 130 216 230 126v15l-100 90-100-90Z" fill={jersey.accentColor} />
          </>
        ) : null}

        {jersey.pattern === "quarters" ? (
          <>
            <rect x="0" y="0" width="130" height="160" fill={jersey.secondaryColor} />
            <rect x="130" y="160" width="130" height="160" fill={jersey.secondaryColor} />
            <rect x="122" y="0" width="16" height="320" fill={jersey.accentColor} />
            <rect x="0" y="152" width="260" height="16" fill={jersey.accentColor} />
          </>
        ) : null}

        {jersey.pattern === "cross" ? (
          <>
            <rect x="92" y="0" width="48" height="320" fill={jersey.secondaryColor} />
            <rect x="0" y="128" width="260" height="48" fill={jersey.secondaryColor} />
            <rect x="107" y="0" width="18" height="320" fill={jersey.accentColor} />
            <rect x="0" y="143" width="260" height="18" fill={jersey.accentColor} />
          </>
        ) : null}

        {jersey.pattern === "shoulders" ? (
          <>
            <path d="M0 0h260v112c-45 22-83 28-130 28S45 134 0 112Z" fill={jersey.secondaryColor} />
            <path d="M0 108c45 22 83 28 130 28s85-6 130-28v18c-45 22-83 28-130 28S45 148 0 126Z" fill={jersey.accentColor} />
          </>
        ) : null}

        {jersey.pattern === "checkerboard" ? (
          <>
            {Array.from({ length: 4 }, (_, row) =>
              Array.from({ length: 4 }, (_, column) =>
                (row + column) % 2 === 0 ? (
                  <rect
                    key={`${row}-${column}`}
                    x={50 + column * 40}
                    y={88 + row * 40}
                    width="40"
                    height="40"
                    fill={jersey.secondaryColor}
                  />
                ) : null
              )
            )}
            <path d="M50 88h160v160H50Z" fill="none" stroke={jersey.accentColor} strokeWidth="8" />
          </>
        ) : null}

        {jersey.pattern === "wave" ? (
          <>
            <path d="M-20 126c56-42 92 42 148 0s92 42 152 0v66c-60 42-96-42-152 0s-92-42-148 0Z" fill={jersey.secondaryColor} />
            <path d="M-20 154c56-42 92 42 148 0s92 42 152 0" fill="none" stroke={jersey.accentColor} strokeWidth="14" />
          </>
        ) : null}

        {jersey.pattern === "pinstripes" ? (
          <>
            {Array.from({ length: 7 }, (_, index) => (
              <rect
                key={index}
                x={51 + index * 26}
                y="55"
                width="7"
                height="230"
                fill={index === 3 ? jersey.accentColor : jersey.secondaryColor}
              />
            ))}
          </>
        ) : null}
      </g>

      <path
        d="M72 238H188M72 252H188"
        stroke={jersey.accentColor}
        strokeWidth="4"
        opacity="0.8"
      />
    </svg>
  );
}

function toStableId(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}
