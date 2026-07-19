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
