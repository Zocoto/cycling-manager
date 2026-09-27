import { useId, type CSSProperties } from "react";

import type { RaceSceneryKind } from "@/lib/game/race-visuals";

export function RaceSceneryBackdrop({
  kind,
  isMoving,
  showSpectators,
}: {
  kind: RaceSceneryKind;
  isMoving: boolean;
  showSpectators: boolean;
}) {
  const detailId = `race-scenery-detail-${useId().replace(/:/g, "")}`;

  return (
    <div
      aria-hidden="true"
      data-detailed-race-scenery={kind}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        data-race-scenery-parallax="far"
        className={`absolute inset-y-0 left-0 flex w-[200%] opacity-75 ${
          isMoving ? "cm-race-scenery-scroll-far" : ""
        }`}
      >
        <SceneryAtmospherePanel kind={kind} />
        <SceneryAtmospherePanel kind={kind} />
      </div>
      <div
        data-race-scenery-track="right-to-left"
        data-race-scenery-parallax="near"
        className={`absolute inset-y-0 left-0 flex w-[200%] ${
          isMoving ? "cm-race-scenery-scroll" : ""
        }`}
      >
        <DetailedSceneryPanel
          kind={kind}
          showSpectators={showSpectators}
          detailId={`${detailId}-a`}
        />
        <DetailedSceneryPanel
          kind={kind}
          showSpectators={showSpectators}
          detailId={`${detailId}-b`}
        />
      </div>
    </div>
  );
}

export function RaceBiotopeForeground({
  kind,
  roadLeftY,
  roadRightY,
  isMoving,
}: {
  kind: RaceSceneryKind;
  roadLeftY: number;
  roadRightY: number;
  isMoving: boolean;
}) {
  const foregroundId = `race-biotope-foreground-${useId().replace(/:/g, "")}`;
  const boundary = (x: number) =>
    roadLeftY + (roadRightY - roadLeftY) * (x / 1000);
  const slopeTravelY = roadRightY - roadLeftY;
  const tileBottomY = 324 + Math.abs(slopeTravelY);
  const clipPath = `M0 ${boundary(0)}L1000 ${boundary(1000)}V${tileBottomY}H0Z`;
  const foregroundColors: Record<RaceSceneryKind, string> = {
    forest: "#355B3D",
    fields: "#789655",
    meadow: "#6F9C5C",
    coast: "#BBA978",
    village: "#52684A",
    urban: "#7A8581",
  };

  const renderTile = (copy: "a" | "b", offsetX: number, offsetY: number) => (
    <g
      data-race-biotope-foreground-copy={copy}
      transform={`translate(${offsetX} ${offsetY})`}
    >
      <g clipPath={`url(#${foregroundId})`}>
        <path d={clipPath} fill={foregroundColors[kind]} />
        <path d={`M0 ${boundary(0) + 5}L1000 ${boundary(1000) + 5}`} stroke="#E1D3A8" strokeWidth="1.2" opacity="0.28" />
        <BiotopeForegroundDetails kind={kind} boundary={boundary} />
      </g>
    </g>
  );

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1000 320"
      preserveAspectRatio="none"
      data-race-biotope-foreground={kind}
      data-race-biotope-foreground-flow="slope-corrected"
      className="pointer-events-none absolute inset-0 z-[7] h-full w-full overflow-hidden"
    >
      <defs>
        <clipPath id={foregroundId} clipPathUnits="userSpaceOnUse">
          <path d={clipPath} />
        </clipPath>
      </defs>
      <g
        data-race-biotope-foreground-track="slope-corrected"
        className={isMoving ? "cm-race-biotope-foreground-scroll" : undefined}
        style={
          {
            "--cm-race-biotope-foreground-travel-y": `${(-slopeTravelY / 320) * 100}%`,
          } as CSSProperties
        }
      >
        {renderTile("a", 0, 0)}
        {renderTile("b", 1000, slopeTravelY)}
      </g>
    </svg>
  );
}

function BiotopeForegroundDetails({
  kind,
  boundary,
}: {
  kind: RaceSceneryKind;
  boundary: (x: number) => number;
}) {
  const anchor = (x: number, offset: number) =>
    Math.min(318, boundary(x) + offset);

  if (kind === "forest") {
    return (
      <g data-race-biotope-foreground-detail="forest-ferns">
        {Array.from({ length: 10 }, (_, index) => {
          const x = 50 + index * 100;
          const y = anchor(x, 30);
          return (
            <g key={x} transform={`translate(${x} ${y})`}>
              <path d="M0 0Q-3-14-14-22M0 0Q3-18 15-26M0 0Q8-10 22-13M0 0Q-9-8-23-10" fill="none" stroke={index % 2 ? "#7DA064" : "#557F55"} strokeWidth="2.2" strokeLinecap="round" />
              <path d="m18 1 8-9 15 1 7 8Z" fill="#6F7B72" stroke="#35443D" strokeWidth="1" />
            </g>
          );
        })}
      </g>
    );
  }

  if (kind === "fields") {
    return (
      <g data-race-biotope-foreground-detail="field-crop-edge">
        {Array.from({ length: 16 }, (_, index) => {
          const x = 31.25 + index * 62.5;
          const y = anchor(x, 27);
          return (
            <g key={x} transform={`translate(${x} ${y})`} stroke="#E0C56D" strokeLinecap="round">
              <path d="M0 0V-20m0 5-7-5m7 9 8-6" strokeWidth="1.5" />
              <path d="M-3-18 0-24l3 6M5-14l4-6 2 5" fill="#D5B454" strokeWidth="1" />
            </g>
          );
        })}
      </g>
    );
  }

  if (kind === "meadow") {
    return (
      <g data-race-biotope-foreground-detail="meadow-flower-verge">
        {Array.from({ length: 20 }, (_, index) => {
          const x = 25 + index * 50;
          const y = anchor(x, 24);
          return (
            <g key={x} transform={`translate(${x} ${y})`}>
              <path d="M0 0V-17m0 8-7-5m7 1 7-6" stroke="#315F3E" strokeWidth="1.4" />
              <circle cy="-18" r="3" fill={index % 3 === 0 ? "#F2C94C" : index % 3 === 1 ? "#FFF5E6" : "#C985B8"} />
            </g>
          );
        })}
      </g>
    );
  }

  if (kind === "coast") {
    return (
      <g data-race-biotope-foreground-detail="coastal-verge">
        {Array.from({ length: 12 }, (_, index) => {
          const x = 40 + index * 84;
          const y = anchor(x, 22);
          return (
            <g key={x} transform={`translate(${x} ${y})`}>
              <ellipse cx="0" cy="0" rx={8 + (index % 3) * 2} ry="4" fill={index % 2 ? "#8D8066" : "#D2C39A"} stroke="#6F695B" strokeWidth="0.7" />
              <path d="M10 1q3-14 7-20m-4 10 8-7" fill="none" stroke="#547152" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          );
        })}
      </g>
    );
  }

  if (kind === "village") {
    return (
      <g data-race-biotope-foreground-detail="village-verge">
        {Array.from({ length: 8 }, (_, index) => {
          const x = 62.5 + index * 125;
          const y = anchor(x, 27);
          return (
            <g key={x} transform={`translate(${x} ${y})`}>
              <path d="M-15 0h30l-4 13h-22Z" fill="#89715D" stroke="#D7C7AC" strokeWidth="1" />
              <path d="M0 0v-18m0 9-11-8m11 4 12-10" stroke="#376143" strokeWidth="2.3" strokeLinecap="round" />
              <circle cx="-10" cy="-16" r="5.5" fill="#5B8857" />
              <circle cx="10" cy="-20" r="6.5" fill="#47764F" />
              <circle cx={index % 2 ? 7 : -7} cy="-22" r="1.8" fill="#E7BE55" />
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <g data-race-biotope-foreground-detail="urban-pavement">
      <path d={`M0 ${boundary(0) + 14}L1000 ${boundary(1000) + 14}`} stroke="#CFD4D0" strokeWidth="2.4" opacity="0.7" />
      {Array.from({ length: 20 }, (_, index) => {
        const x = 25 + index * 50;
        const y = anchor(x, 28);
        return <path key={x} d={`M${x - 18} ${y}h36m-28 8h30`} stroke="#596762" strokeWidth="1" opacity="0.62" />;
      })}
      {[170, 505, 835].map((x) => {
        const y = anchor(x, 29);
        return (
          <g key={x} transform={`translate(${x} ${y})`}>
            <rect x="-6" y="-19" width="12" height="19" rx="2" fill="#334944" stroke="#AAB8B2" strokeWidth="1" />
            <path d="M-3-14h6M-3-9h6" stroke="#D2DCD7" strokeWidth="1" />
          </g>
        );
      })}
    </g>
  );
}

function SceneryAtmospherePanel({ kind }: { kind: RaceSceneryKind }) {
  const coastal = kind === "coast";
  const urban = kind === "urban";
  return (
    <svg
      viewBox="0 0 1000 320"
      preserveAspectRatio="none"
      data-race-scenery-atmosphere="continuous"
      className="h-full w-1/2 shrink-0"
    >
      <path
        d={
          coastal
            ? "M0 164C90 132 160 132 250 164S410 196 500 164 660 132 750 164 910 196 1000 164V225H0Z"
            : urban
              ? "M0 170 85 132 165 158 250 112 340 153 445 123 545 159 655 108 760 151 875 121 950 155 1000 170V224H0Z"
              : "M0 171C95 83 160 83 250 171S410 259 500 171 660 83 750 171 910 259 1000 171V224H0Z"
        }
        fill={coastal ? "#6EAEB0" : urban ? "#78958E" : "#729478"}
        opacity="0.5"
      />
      <path
        d="M0 190C120 146 215 146 330 190S545 234 665 190 880 146 1000 190V230H0Z"
        fill={coastal ? "#4E8F91" : urban ? "#65736F" : "#4F7658"}
        opacity="0.46"
      />
      {[105, 312, 548, 764, 872].map((x, index) => (
        <g key={x} transform={`translate(${x} ${48 + (index % 2) * 28})`} opacity="0.42">
          <path d="M-8 13C5 7 14 7 26 10c10-8 27-7 37 1 12-3 24-1 34 6-21 3-73 4-105-4Z" fill="#F2FAF7" opacity="0.74" />
          <path d="M4 12c13-9 28-9 40-2 9-3 19-2 27 3" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.48" />
          <path d="M13 18h61" stroke="#8FB2AA" strokeWidth="0.8" opacity="0.22" />
        </g>
      ))}
      {[215, 684].map((x) => (
        <path key={x} d={`M${x} 92q8-7 16 0 8-7 16 0`} fill="none" stroke="#28443D" strokeWidth="1.3" opacity="0.52" />
      ))}
    </svg>
  );
}

function DetailedSceneryPanel({
  kind,
  showSpectators,
  detailId,
}: {
  kind: RaceSceneryKind;
  showSpectators: boolean;
  detailId: string;
}) {
  return (
    <div
      data-race-scenery-copy="seamless"
      data-race-scenery-tile="near"
      data-race-biotope-fidelity="enhanced"
      className="relative h-full w-1/2 shrink-0 overflow-hidden"
    >
      <svg
        viewBox="0 0 1000 320"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <pattern
            id={`${detailId}-grain`}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0.55" cy="0.7" r="0.16" fill="#FFFDF4" opacity="0.28" />
            <circle cx="3.15" cy="1.55" r="0.12" fill="#071A17" opacity="0.2" />
            <circle cx="1.8" cy="3.35" r="0.1" fill="#FFFDF4" opacity="0.2" />
          </pattern>
          <pattern
            id={`${detailId}-micro-lines`}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path d="M2 4h4.2M13 14h3.1" stroke="#FFFDF4" strokeWidth="0.16" opacity="0.22" />
            <path d="M7 18h2.6" stroke="#071A17" strokeWidth="0.13" opacity="0.16" />
          </pattern>
          <pattern
            id={`${detailId}-tiles`}
            width="12"
            height="7"
            patternUnits="userSpaceOnUse"
          >
            <rect width="12" height="7" fill="#765043" />
            <path d="M0 1h12M0 6h12M6 1v5M0 6v1" stroke="#D99D7E" strokeWidth="0.7" opacity="0.72" />
            <path d="M1 2h4m2 2h4" stroke="#4E352E" strokeWidth="0.35" opacity="0.55" />
          </pattern>
          <pattern
            id={`${detailId}-windows`}
            width="18"
            height="17"
            patternUnits="userSpaceOnUse"
          >
            <rect x="4" y="4" width="7" height="6" rx="1" fill="#CFE4E2" opacity="0.7" />
            <path d="M7.5 4v6" stroke="#617A73" strokeWidth="0.6" />
          </pattern>
          <pattern
            id={`${detailId}-ground-fibers`}
            width="20"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path d="M2 10 5 2m4 8 2-5m6 5-3-4" stroke="#274F35" strokeWidth="0.7" opacity="0.52" />
            <path d="m5 8 7-1m2-4 4-1" stroke="#D9E5C5" strokeWidth="0.35" opacity="0.42" />
          </pattern>
          <pattern
            id={`${detailId}-stonework`}
            width="25"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <rect width="25" height="10" fill="#8F8878" />
            <path d="M0 5h25M8 0v5m10 0v5M4 5v5" stroke="#D6CEBC" strokeWidth="0.75" opacity="0.72" />
            <path d="M2 2h5m7 1h8M6 8h7" stroke="#655F53" strokeWidth="0.38" opacity="0.55" />
          </pattern>
          <pattern
            id={`${detailId}-stucco`}
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2.5" r="0.34" fill="#FFFFFF" opacity="0.34" />
            <circle cx="7" cy="5" r="0.28" fill="#534A3D" opacity="0.2" />
            <path d="M1 7q2-1 4 0" fill="none" stroke="#FFFFFF" strokeWidth="0.22" opacity="0.28" />
          </pattern>
          <linearGradient id={`${detailId}-atmosphere`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E8F6F3" stopOpacity="0.26" />
            <stop offset="0.52" stopColor="#D7ECE4" stopOpacity="0.08" />
            <stop offset="1" stopColor="#18382D" stopOpacity="0.16" />
          </linearGradient>
          <filter
            id={`${detailId}-material-noise`}
            x="0"
            y="0"
            width="100%"
            height="100%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves="3"
              seed="17"
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.12 0 0 0 0 0.2 0 0 0 0 0.16 0 0 0 .32 0"
            />
          </filter>
        </defs>

        {kind === "forest" ? <ForestDetails /> : null}
        {kind === "fields" ? <FieldDetails /> : null}
        {kind === "meadow" ? <MeadowDetails /> : null}
        {kind === "coast" ? <CoastDetails /> : null}
        {kind === "village" ? (
          <VillageDetails
            tilesId={`${detailId}-tiles`}
            stoneworkId={`${detailId}-stonework`}
            stuccoId={`${detailId}-stucco`}
          />
        ) : null}
        {kind === "urban" ? (
          <UrbanDetails windowsId={`${detailId}-windows`} />
        ) : null}
        <AmbientRoadsideDetails
          kind={kind}
          stoneworkId={`${detailId}-stonework`}
        />
        {showSpectators && (kind === "village" || kind === "urban") ? (
          <DetailedRoadsideSpectators />
        ) : null}

        <path
          d="M0 202C125 190 210 190 330 202S545 214 665 202 880 190 1000 202V243H0Z"
          fill={`url(#${detailId}-ground-fibers)`}
          opacity={kind === "urban" ? 0.16 : 0.48}
          data-race-scenery-texture="ground-fibers"
        />
        <rect
          width="1000"
          height="235"
          fill={`url(#${detailId}-atmosphere)`}
          data-race-scenery-depth="atmosphere"
        />

        <rect
          width="1000"
          height="235"
          fill={`url(#${detailId}-grain)`}
          opacity="0.13"
        />
        <rect
          width="1000"
          height="235"
          fill={`url(#${detailId}-micro-lines)`}
          opacity="0.11"
        />
        <rect
          width="1000"
          height="235"
          fill="#9DB4AA"
          filter={`url(#${detailId}-material-noise)`}
          opacity="0.1"
          data-race-scenery-texture="material-noise"
        />
      </svg>
    </div>
  );
}
function ForestDetails() {
  return (
    <>
      <path d="M0 164C95 108 160 108 250 164S410 220 500 164 660 108 750 164 910 220 1000 164V224H0Z" fill="#47785D" opacity="0.68" />
      <path d="M0 187C120 151 215 151 330 187S545 223 665 187 880 151 1000 187V229H0Z" fill="#315D47" opacity="0.86" />
      <g data-race-biotope-detail="forest-light-shafts" opacity="0.16" fill="#F0E8B3">
        <path d="m128 41 72 166h46L171 41Z" />
        <path d="m574 30 59 181h52L621 30Z" />
        <path d="m835 52 41 158h39L870 52Z" />
      </g>
      <g
        data-race-biotope-detail="forest-canopy-depth"
        data-race-biotope-grounding="understory-baseline-207"
        opacity="0.72"
      >
        {Array.from({ length: 25 }, (_, index) => {
          const x = 20 + index * 40;
          const y = 207 + (index % 3) * 2;
          const scale = 0.28 + (index % 5) * 0.045;
          return index % 3 === 0 ? (
            <FineDeciduousTree key={x} x={x} y={y} scale={scale} />
          ) : (
            <FineConifer key={x} x={x} y={y} scale={scale} />
          );
        })}
      </g>
      <path
        d="M0 207q25-19 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0"
        fill="none"
        stroke="#193E2D"
        strokeWidth="9"
        opacity="0.7"
        data-race-biotope-detail="forest-undergrowth"
      />
      <g data-race-biotope-detail="forest-rocks" stroke="#34443B" strokeWidth="1">
        <path d="m96 210 9-13 18-3 15 16Z" fill="#748077" />
        <path d="m102 204 9-5 9 1" fill="none" stroke="#A8B0A7" opacity="0.7" />
        <path d="m456 212 7-10 14-4 17 14Z" fill="#68776D" />
        <path d="m746 211 10-15 20-2 13 17Z" fill="#78867B" />
        <path d="m755 204 10-5 11 1" fill="none" stroke="#B1B8AE" opacity="0.65" />
      </g>
      {Array.from({ length: 40 }, (_, index) => (
        <path
          key={index}
          d={`M${12.5 + index * 25} ${211 + (index % 3)}q5-13 10 0q5-17 11 0`}
          fill="none"
          stroke={index % 2 ? "#3D7753" : "#2C6546"}
          strokeWidth="2"
          opacity="0.8"
        />
      ))}
    </>
  );
}

function FieldDetails() {
  return (
    <>
      <path d="M0 151C125 117 215 117 335 151S545 185 665 151 880 117 1000 151V226H0Z" fill="#79A866" />
      <path d="M0 180C125 153 215 153 335 180S545 207 665 180 880 153 1000 180V231H0Z" fill="#D0BA60" opacity="0.88" />
      <path d="M0 201C125 182 215 182 335 201S545 220 665 201 880 182 1000 201V235H0Z" fill="#91B866" />
      <g data-race-biotope-detail="crop-furrows" fill="none" strokeLinecap="round" opacity="0.68">
        {Array.from({ length: 10 }, (_, index) => (
          <path
            key={index}
            d={`M${index * 100 + 10} 232Q${index * 100 + 45} 190 ${index * 100 + 85} 160`}
            stroke={index % 3 === 0 ? "#F2D683" : "#5D8E4F"}
            strokeWidth={index % 3 === 0 ? 2.4 : 1.25}
          />
        ))}
      </g>
      <g data-race-biotope-detail="hay-bales" stroke="#806837" strokeWidth="0.8">
        {[148, 284, 653].map((x, index) => (
          <g key={x} transform={`translate(${x} ${190 + index * 5})`}>
            <ellipse cx="0" cy="12" rx="18" ry="5" fill="#6B5A31" opacity="0.28" />
            <circle cx="0" cy="0" r={index === 1 ? 9 : 12} fill="#D4B45B" />
            <circle cx="0" cy="0" r={index === 1 ? 5 : 7} fill="none" stroke="#9D803C" strokeWidth="1.2" />
            <path d="M-8-7q9 8 15 2M-10 5q8-4 18 1" fill="none" stroke="#E7CE7A" />
          </g>
        ))}
      </g>
      <g transform="translate(493 181)" data-race-biotope-detail="farm-machinery">
        <ellipse cx="20" cy="22" rx="34" ry="4" fill="#273D31" opacity="0.2" />
        <circle cx="0" cy="15" r="11" fill="#252C29" stroke="#A8B1AA" strokeWidth="1.5" />
        <circle cx="36" cy="17" r="7" fill="#252C29" stroke="#A8B1AA" strokeWidth="1.2" />
        <circle cx="0" cy="15" r="4" fill="#C8A73D" />
        <circle cx="36" cy="17" r="2.8" fill="#C8A73D" />
        <path d="M-1 3h29l9 14H7Z" fill="#397D4E" stroke="#214D34" strokeWidth="1.2" />
        <path d="M8 3V-9h15l8 12" fill="#9CC9C1" stroke="#214D34" strokeWidth="1.2" />
        <path d="M11-6h9v8h-9Z" fill="#CDE4DE" opacity="0.75" />
        <path d="M-8 4h11M25-11h8" stroke="#E4C653" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g transform="translate(735 122)">
        <path d="M0 89V9" stroke="#EEE8D7" strokeWidth="4" />
        <circle cx="0" cy="9" r="5" fill="#EEE8D7" />
        <g stroke="#F8F6EF" strokeWidth="2.2" strokeLinecap="round">
          <path d="M0 9 38-4M0 9-31-15M0 9-7 48" />
        </g>
      </g>
      <g transform="translate(860 159)">
        <rect width="82" height="49" fill="#D8C59E" stroke="#665A43" strokeWidth="1.3" />
        <path d="M-7 1 41-25 89 1Z" fill="#875545" stroke="#5B3C32" strokeWidth="1.3" />
        <path d="M11 48V24h21v24m19 0V18h18v30" fill="#73503F" stroke="#50372D" />
        <path d="M3 5h76M7 10h68" stroke="#B7986C" strokeWidth="0.8" />
      </g>
    </>
  );
}

function MeadowDetails() {
  return (
    <>
      <path d="M0 166C120 126 220 126 335 166S550 206 665 166 880 126 1000 166V232H0Z" fill="#70A568" />
      <path d="M0 196C130 166 215 166 335 196S545 226 665 196 870 166 1000 196V237H0Z" fill="#93BD78" />
      <g data-race-biotope-detail="meadow-tree-line" opacity="0.78">
        {Array.from({ length: 20 }, (_, index) => (
          <FineDeciduousTree
            key={index}
            x={25 + index * 50}
            y={204 + (index % 3) * 3}
            scale={0.22 + (index % 4) * 0.025}
          />
        ))}
      </g>
      <g data-race-biotope-detail="wildflower-banks">
        {Array.from({ length: 40 }, (_, index) => {
          const x = 12.5 + index * 25;
          return (
            <g key={x} transform={`translate(${x} ${220 + (index % 5)})`}>
              <path d="M0 8V0m0 3-4-4m4 6 4-5" stroke="#416E43" strokeWidth="0.9" />
              <circle
                cx={index % 2 ? 4 : -4}
                cy="0"
                r="1.7"
                fill={index % 3 === 0 ? "#F2C94C" : index % 4 === 0 ? "#C581B8" : "#FFFDF4"}
              />
            </g>
          );
        })}
      </g>
      <g data-race-biotope-detail="grazing-animals" fill="#EEE8D8" stroke="#4B5148" strokeWidth="0.8">
        <g transform="translate(286 200)">
          <ellipse cx="0" cy="0" rx="13" ry="7" />
          <circle cx="13" cy="-2" r="4" />
          <path d="M-8 5v10m9-9v10m8-11v9M15-2l5-3" fill="none" strokeWidth="1.8" />
          <path d="M-7-4q5 4 10 0" fill="#695548" opacity="0.62" />
        </g>
        <g transform="translate(702 207) scale(.78)">
          <ellipse cx="0" cy="0" rx="13" ry="7" />
          <circle cx="13" cy="-2" r="4" />
          <path d="M-8 5v10m9-9v10m8-11v9M15-2l5-3" fill="none" strokeWidth="1.8" />
        </g>
      </g>
      <path d="M0 214h1000" stroke="#E8E2CF" strokeWidth="1.2" strokeDasharray="15 5" opacity="0.7" data-race-biotope-detail="meadow-fence" />
    </>
  );
}

function CoastDetails() {
  return (
    <>
      <path d="M0 143C140 132 215 132 335 143S545 154 665 143 880 132 1000 143V230H0Z" fill="#4B9DAF" opacity="0.9" data-race-biotope-detail="coastal-water-depth" />
      <path d="M0 188C130 178 220 178 335 188S545 198 665 188 870 178 1000 188" fill="none" stroke="#9BD3D5" strokeWidth="2" opacity="0.62" />
      <g data-race-biotope-detail="coastal-foam" fill="none" stroke="#E7F6F5" strokeLinecap="round">
        {Array.from({ length: 10 }, (_, index) => (
          <path
            key={index}
            d={`M${index * 100 + 5} ${152 + (index % 3) * 14}q22-7 45 0t45 0`}
            strokeWidth={index % 2 ? 1.1 : 1.8}
            opacity={0.45 + (index % 3) * 0.12}
          />
        ))}
      </g>
      <g data-race-biotope-detail="coastal-birds" fill="none" stroke="#324A48" strokeWidth="1.15" opacity="0.78">
        <path d="M142 104q7-7 14 0 7-7 14 0M327 86q6-6 12 0 6-6 12 0M770 111q8-8 16 0 8-8 16 0" />
      </g>
      <g transform="translate(615 148)" data-race-biotope-detail="coastal-sailboat">
        <path d="M0 35h64L53 42H10Z" fill="#F7F0DE" stroke="#4D6866" strokeWidth="1.2" />
        <path d="M31 35V-5l27 34H34Z" fill="#FFFDF4" stroke="#537B7B" strokeWidth="1.1" />
        <path d="M29 2 8 30h21Z" fill="#E76F51" stroke="#765047" strokeWidth="1" />
        <path d="M31-5v42" stroke="#3B5551" strokeWidth="1.4" />
      </g>
      <g data-race-biotope-detail="rocky-headland">
        <path d="M790 213q38-48 76 0t76 0v23H790Z" fill="#9A865F" opacity="0.68" />
        <path d="m813 208 20-19 18 21m22 1 17-18 18 20" fill="none" stroke="#C7B58C" strokeWidth="2" opacity="0.64" />
      </g>
      <g transform="translate(872 135)" data-race-biotope-detail="coastal-lighthouse">
        <path d="m-12 76 5-58H7l5 58Z" fill="#F4F0E4" stroke="#485D59" strokeWidth="1.2" />
        <path d="M-8 37H8l2 12h-19Z" fill="#C64B49" />
        <path d="M-9 18h18v9H-9Z" fill="#294B50" stroke="#E8E4D6" strokeWidth="1" />
        <path d="m-12 18 12-10 12 10Z" fill="#C64B49" stroke="#6F3432" strokeWidth="1" />
        <path d="M0 8V1" stroke="#384B48" strokeWidth="1.2" />
        <path d="M8 22 56 9" stroke="#FFF1B5" strokeWidth="7" opacity="0.16" />
      </g>
      <g data-race-biotope-detail="coastal-dune-grass">
        {Array.from({ length: 8 }, (_, index) => (
          <path key={index} d={`m${805 + index * 18} 209 5-15 6 15`} fill="none" stroke="#4E744A" strokeWidth="2" />
        ))}
      </g>
    </>
  );
}

function VillageDetails({
  tilesId,
  stoneworkId,
  stuccoId,
}: {
  tilesId: string;
  stoneworkId: string;
  stuccoId: string;
}) {
  return (
    <>
      <path d="M0 198C135 189 205 191 320 198S535 205 665 198 865 190 1000 198V219H0Z" fill="#456948" opacity="0.42" />
      <StoneBourgHouse tilesId={tilesId} stoneworkId={stoneworkId} />
      <TallVillageHouse tilesId={tilesId} stuccoId={stuccoId} />
      <VillageCafe tilesId={tilesId} stuccoId={stuccoId} />
      <WideFarmHouse tilesId={tilesId} stoneworkId={stoneworkId} stuccoId={stuccoId} />
      <MansardVillageHouse tilesId={tilesId} stuccoId={stuccoId} />
      <VillageSeamTree x={0} />
      <VillageSeamTree x={1000} />
      <path d="M0 210C120 205 210 206 330 210S545 214 665 210 880 206 1000 210" fill="none" stroke="#294D35" strokeWidth="8" opacity="0.92" data-race-scenery-seam-zone="neutral" />
      {[80, 235, 392, 605, 795, 925].map((x, index) => (
        <g key={x} transform={`translate(${x} 211)`}>
          <circle r={index % 2 ? 8 : 6.5} fill={index % 2 ? "#315F43" : "#477650"} />
          <path d="M-5 1q5-9 10 0" fill="none" stroke="#8BB06F" strokeWidth="1.1" opacity="0.72" />
          <circle cx="-3" cy="-3" r="1.7" fill="#D8C56F" opacity="0.72" />
        </g>
      ))}
    </>
  );
}

function StoneBourgHouse({
  tilesId,
  stoneworkId,
}: {
  tilesId: string;
  stoneworkId: string;
}) {
  return (
    <g
      data-race-building-archetype="stone-bourg-house"
      data-race-building-proportion="widened-facade"
      transform="translate(-4 0) scale(1.06 1)"
    >
      <path d="M70 111h154l16 10v89H70Z" fill="#17261E" opacity="0.16" />
      <path d="M70 109h154v101H70Z" fill="#AAA18D" stroke="#574F42" strokeWidth="1" />
      <path d="M70 109h154v101H70Z" fill={`url(#${stoneworkId})`} opacity="0.76" data-race-building-texture="exposed-stone" />
      <path d="m224 109 16 10v91h-16Z" fill="#746C5D" stroke="#514B41" strokeWidth="0.8" data-race-building-detail="side-wall-depth" />
      <path d="M55 110 92 88l132 7 16 24-16-10H70Z" fill={`url(#${tilesId})`} stroke="#563E35" strokeWidth="1.15" data-race-building-detail="roof-depth" />
      <path d="M56 110 92 88l132 7" fill="none" stroke="#E5B99B" strokeWidth="1.5" opacity="0.7" />
      <rect x="169" y="82" width="13" height="24" fill="#796557" stroke="#4B3D35" strokeWidth="0.9" />
      <path d="M166 83h19" stroke="#4B3D35" strokeWidth="2.4" />
      <g data-race-building-detail="slate-dormer">
        <path d="M117 99v-17h31v19" fill="#817363" stroke="#51463B" strokeWidth="0.9" />
        <path d="m112 84 21-15 20 15Z" fill="#5A4841" stroke="#E3B397" strokeWidth="0.9" />
        <rect x="124" y="82" width="15" height="14" fill="#71969B" stroke="#EEE7D7" strokeWidth="1" />
      </g>
      <FacadePatina x={70} y={109} width={154} height={101} />
      <DetailedVillageWindow x={86} y={126} shutter="#4C665D" />
      <DetailedVillageWindow x={143} y={122} width={21} height={24} />
      <DetailedVillageWindow x={190} y={127} shutter="#4C665D" />
      <DetailedVillageWindow x={88} y={168} height={22} />
      <DetailedVillageWindow x={186} y={169} height={21} />
      <path d="M132 210v-31q0-13 14-13t14 13v31Z" fill="#5A4437" stroke="#E1CDA8" strokeWidth="1.1" />
      <path d="M146 167v43M134 182h24" stroke="#2D2823" strokeWidth="0.8" opacity="0.7" />
      <path d="M68 108h158" stroke="#263A33" strokeWidth="2.4" data-race-building-detail="rain-gutter" />
      <path d="M69 108v99" stroke="#41544D" strokeWidth="1.8" />
      <path d="M76 201h140" stroke="#D7C8AD" strokeWidth="2.4" opacity="0.72" />
    </g>
  );
}

function TallVillageHouse({
  tilesId,
  stuccoId,
}: {
  tilesId: string;
  stuccoId: string;
}) {
  return (
    <g
      data-race-building-archetype="tall-town-house"
      data-race-building-proportion="widened-facade"
      transform="translate(-39 0) scale(1.15 1)"
    >
      <path d="M255 91h129l12 8v111H255Z" fill="#17261E" opacity="0.15" />
      <path d="M255 89h129v121H255Z" fill="#C9C1A8" stroke="#5C594F" strokeWidth="0.9" />
      <path d="M255 89h129v121H255Z" fill={`url(#${stuccoId})`} opacity="0.52" data-race-building-texture="weathered-stucco" />
      <path d="m384 89 13 9v112h-13Z" fill="#8C8776" stroke="#5B554A" strokeWidth="0.75" />
      <path d="M246 91 271 67h99l22 24Z" fill={`url(#${tilesId})`} stroke="#5A4037" strokeWidth="1.1" />
      <path d="M253 91h134" stroke="#2E3D38" strokeWidth="2.2" />
      <path d="M269 68h101" stroke="#E6B69B" strokeWidth="1.3" />
      <FacadePatina x={255} y={89} width={129} height={121} />
      <DetailedVillageWindow x={270} y={105} height={25} shutter="#4F655A" />
      <DetailedVillageWindow x={319} y={101} height={27} />
      <DetailedVillageWindow x={355} y={107} width={19} height={23} />
      <DetailedVillageWindow x={269} y={153} width={20} height={25} />
      <DetailedVillageWindow x={349} y={153} width={20} height={24} shutter="#4F655A" />
      <g data-race-building-detail="wrought-iron-balcony">
        <path d="M301 146h45l4 5h-53Z" fill="#6A6257" stroke="#303B36" strokeWidth="0.9" />
        <path d="M301 132v14h45v-14M307 133v13m7-13v13m7-13v13m7-13v13m7-13v13m6-13v13" fill="none" stroke="#263B35" strokeWidth="0.8" />
        <rect x="310" y="142" width="16" height="4" rx="1" fill="#5B4738" />
        <circle cx="315" cy="141" r="2.2" fill="#B84D4D" />
        <circle cx="322" cy="141" r="2" fill="#D8B248" />
      </g>
      <path d="M303 210v-29h35v29Z" fill="#4A3B34" stroke="#E7DAC2" strokeWidth="1" />
      <path d="M320.5 182v28" stroke="#1D2824" strokeWidth="0.8" />
      <path d="M382 90v117" stroke="#40534C" strokeWidth="1.7" data-race-building-detail="rain-gutter" />
    </g>
  );
}

function VillageCafe({
  tilesId,
  stuccoId,
}: {
  tilesId: string;
  stuccoId: string;
}) {
  return (
    <g data-race-building-detail="village-cafe" data-race-building-archetype="street-cafe" data-race-building-proportion="wide-commercial-frontage">
      <path d="M410 139h181l12 7v64H410Z" fill="#17261E" opacity="0.16" />
      <path d="M410 137h181v73H410Z" fill="#BFA77E" stroke="#574A3D" strokeWidth="0.95" />
      <path d="M410 137h181v73H410Z" fill={`url(#${stuccoId})`} opacity="0.46" data-race-building-texture="weathered-stucco" />
      <path d="M401 139 438 116h136l27 23Z" fill={`url(#${tilesId})`} stroke="#5E4237" strokeWidth="1.05" />
      <path d="M411 137h180" stroke="#2E3E38" strokeWidth="2.3" />
      <FacadePatina x={410} y={137} width={181} height={73} />
      <rect x="449" y="125" width="103" height="15" rx="2" fill="#173B31" stroke="#E9DAB9" strokeWidth="1" />
      <text x="500.5" y="135.4" textAnchor="middle" fontSize="8" fontWeight="900" letterSpacing="1.4" fill="#F2D986">CAFÉ DU COL</text>
      <path d="M421 151h158v17H421Z" fill="#A8463F" stroke="#F3E7CF" strokeWidth="0.9" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((stripe) => (
        <path key={stripe} d={`M${426 + stripe * 20} 151v17`} stroke="#FFF4DF" strokeWidth="8" opacity="0.9" />
      ))}
      <path d="M421 168q10 8 20 0 10 8 20 0 10 8 20 0 10 8 20 0 10 8 20 0 10 8 20 0 10 8 20 0 9 7 18 0" fill="none" stroke="#7E312D" strokeWidth="1.2" />
      <rect x="425" y="174" width="47" height="34" fill="#638B8F" stroke="#F4EDDD" strokeWidth="1.35" />
      <path d="M428 177 467 202M429 191h40" stroke="#C7E2DF" strokeWidth="1.1" opacity="0.72" />
      <rect x="531" y="174" width="46" height="34" fill="#638B8F" stroke="#F4EDDD" strokeWidth="1.35" />
      <path d="M534 177 572 202M534 191h40" stroke="#C7E2DF" strokeWidth="1.1" opacity="0.72" />
      <path d="M485 210v-37h32v37Z" fill="#3C342E" stroke="#E9DDC7" strokeWidth="1" />
      <rect x="490" y="178" width="22" height="13" fill="#6C9294" stroke="#DCE8E3" strokeWidth="0.7" />
      <g transform="translate(433 209)" data-race-building-detail="cafe-terrace">
        <path d="M0 0v-15m-11 4h22M-8-11l-4-8h24l-4 8Z" fill="#D7C28D" stroke="#51473C" strokeWidth="0.8" />
        <path d="M-8 0-5-9M8 0 5-9" stroke="#39433E" strokeWidth="1.2" />
      </g>
      <g transform="translate(564 209)" data-race-building-detail="cafe-terrace">
        <path d="M0 0v-14m-10 4h20M-7-10l-4-8h22l-4 8Z" fill="#D7C28D" stroke="#51473C" strokeWidth="0.8" />
        <path d="M-7 0-4-8M7 0 4-8" stroke="#39433E" strokeWidth="1.2" />
      </g>
    </g>
  );
}

function WideFarmHouse({
  tilesId,
  stoneworkId,
  stuccoId,
}: {
  tilesId: string;
  stoneworkId: string;
  stuccoId: string;
}) {
  return (
    <g data-race-building-archetype="wide-farm-house" data-race-building-proportion="wide-farmstead">
      <path d="M620 111h185l14 9v90H620Z" fill="#17261E" opacity="0.17" />
      <path d="M620 109h185v101H620Z" fill="#CFBE9D" stroke="#5E5447" strokeWidth="0.95" />
      <path d="M620 109h185v101H620Z" fill={`url(#${stuccoId})`} opacity="0.55" data-race-building-texture="weathered-stucco" />
      <path d="M609 111 650 85h133l32 26Z" fill={`url(#${tilesId})`} stroke="#614438" strokeWidth="1.1" />
      <path d="M615 111h197" stroke="#263C35" strokeWidth="2.4" />
      <FacadePatina x={620} y={109} width={185} height={101} />
      <rect x="735" y="82" width="14" height="24" fill="#856B58" stroke="#4F3F34" strokeWidth="0.9" />
      <path d="M732 83h20" stroke="#4F3F34" strokeWidth="2.3" />
      <DetailedVillageWindow x={640} y={126} width={18} height={24} shutter="#526B5B" />
      <DetailedVillageWindow x={692} y={121} width={19} height={27} />
      <DetailedVillageWindow x={762} y={127} width={17} height={23} shutter="#526B5B" />
      <path d="M640 210v-42h51v42Z" fill="#594738" stroke="#E5D3B1" strokeWidth="1.1" />
      <path d="M665.5 168v42M640 182h51" stroke="#2C2823" strokeWidth="1" />
      <path d="M718 210v-39h28v39Z" fill="#5A4438" stroke="#E5D3B1" strokeWidth="1" />
      <path d="M732 172v38" stroke="#2C2823" strokeWidth="0.8" />
      <path d="M786 210v-48h44v48Z" fill={`url(#${stoneworkId})`} stroke="#5F584C" strokeWidth="0.9" data-race-building-detail="stone-annex" />
      <path d="m780 163 29-19 28 19Z" fill="#675048" stroke="#E2B89D" strokeWidth="0.9" />
      <path d="M796 210v-28h25v28Z" fill="#493B32" />
      <path d="M622 153h161" stroke="#8E806C" strokeWidth="1" opacity="0.72" />
      <path d="M620 109v98" stroke="#3D5149" strokeWidth="1.7" data-race-building-detail="rain-gutter" />
    </g>
  );
}

function MansardVillageHouse({
  tilesId,
  stuccoId,
}: {
  tilesId: string;
  stuccoId: string;
}) {
  return (
    <g
      data-race-building-archetype="mansard-house"
      data-race-building-proportion="widened-facade"
      transform="translate(-142 0) scale(1.17 1)"
    >
      <path d="M842 120h98l8 7v83H842Z" fill="#17261E" opacity="0.16" />
      <path d="M842 118h98v92H842Z" fill="#B9B7A8" stroke="#575950" strokeWidth="0.9" />
      <path d="M842 118h98v92H842Z" fill={`url(#${stuccoId})`} opacity="0.5" data-race-building-texture="weathered-stucco" />
      <path d="M833 120 852 92h77l20 28Z" fill={`url(#${tilesId})`} stroke="#56423D" strokeWidth="1.1" />
      <path d="M850 93h80" stroke="#D6A88F" strokeWidth="1.3" />
      <g data-race-building-detail="mansard-dormer">
        <path d="M876 107V88h31v20" fill="#6A5D55" stroke="#463A35" strokeWidth="0.9" />
        <path d="m871 90 20-14 21 14Z" fill="#4F4541" stroke="#DDB097" strokeWidth="0.85" />
        <rect x="884" y="91" width="14" height="13" fill="#719A9F" stroke="#F0EBDD" strokeWidth="0.9" />
      </g>
      <FacadePatina x={842} y={118} width={98} height={92} />
      <DetailedVillageWindow x={855} y={132} width={20} height={24} />
      <DetailedVillageWindow x={908} y={132} width={20} height={24} shutter="#5D665D" />
      <DetailedVillageWindow x={855} y={171} width={19} height={21} shutter="#5D665D" />
      <path d="M894 210v-32h28v32Z" fill="#493D37" stroke="#DCD4C3" strokeWidth="0.9" />
      <path d="M908 179v31" stroke="#252824" strokeWidth="0.7" />
      <path d="M940 119v88" stroke="#3E514B" strokeWidth="1.6" data-race-building-detail="rain-gutter" />
    </g>
  );
}

function DetailedVillageWindow({
  x,
  y,
  width = 20,
  height = 23,
  shutter,
}: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  shutter?: string;
}) {
  return (
    <g data-race-building-detail="deep-window" data-race-building-window-proportion="residential">
      <path d={`M${x - 3} ${y - 3}h${width + 6}l-2-2h${-(width + 2)}Z`} fill="#E1D5BE" stroke="#665F53" strokeWidth="0.65" data-race-building-detail="window-lintel" />
      <rect x={x - 2} y={y - 2} width={width + 4} height={height + 4} fill="#665F53" opacity="0.32" />
      <rect x={x} y={y} width={width} height={height} fill="#6C969A" stroke="#F0E9D9" strokeWidth="1.15" />
      <path d={`M${x + 2} ${y + 2}  ${x + width - 2} ${y + height - 3}M${x + width / 2} ${y}v${height}M${x} ${y + height / 2}h${width}`} stroke="#CAE2DF" strokeWidth="0.75" opacity="0.78" />
      <path d={`M${x + 2} ${y + 3}q${width * 0.28} ${height * 0.18} ${width - 4} 0M${x + 2} ${y + height - 4}q${width * 0.3} ${-height * 0.12} ${width - 4} 0`} fill="none" stroke="#F5FBF8" strokeWidth="0.7" opacity="0.48" data-race-building-detail="window-reflection" />
      <path d={`M${x + 1.5} ${y + 2}v${height - 4}M${x + width - 1.5} ${y + 2}v${height - 4}`} stroke="#E7CFC0" strokeWidth="1.2" opacity="0.58" data-race-building-detail="curtains" />
      <path d={`M${x - 2} ${y + height + 2}h${width + 4}`} stroke="#DED3BE" strokeWidth="2" />
      {shutter ? (
        <>
          <rect x={x - 7} y={y} width="5" height={height} fill={shutter} stroke="#3C443F" strokeWidth="0.55" />
          <rect x={x + width + 2} y={y} width="5" height={height} fill={shutter} stroke="#3C443F" strokeWidth="0.55" />
          <path d={`M${x - 6} ${y + 5}h3m-3 5h3m-3 5h3m${width + 8}-10h3m-3 5h3m-3 5h3`} stroke="#DAD5C6" strokeWidth="0.42" opacity="0.62" />
        </>
      ) : null}
    </g>
  );
}

function FacadePatina({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <g data-race-building-texture="facade-patina" opacity="0.42">
      <path
        d={`M${x + width * 0.11} ${y + 8}q${width * 0.04} ${height * 0.22} 0 ${height * 0.46}M${x + width * 0.7} ${y + 3}q${-width * 0.035} ${height * 0.2} ${width * 0.01} ${height * 0.42}M${x + width * 0.43} ${y + height * 0.72}l${width * 0.05} ${height * 0.05}-${width * 0.03} ${height * 0.08}`}
        fill="none"
        stroke="#514A3F"
        strokeWidth="0.72"
        strokeLinecap="round"
        opacity="0.62"
      />
      <path
        d={`M${x + 4} ${y + height - 8}q${width * 0.18} -5 ${width * 0.34} 0t${width * 0.34} 0t${width * 0.28} 0`}
        fill="none"
        stroke="#F3E8D2"
        strokeWidth="1.1"
        opacity="0.5"
      />
      <circle cx={x + width * 0.28} cy={y + height * 0.22} r="1.5" fill="#6D685B" opacity="0.38" />
      <circle cx={x + width * 0.82} cy={y + height * 0.58} r="1.2" fill="#FFF7E4" opacity="0.4" />
    </g>
  );
}

function VillageSeamTree({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 199)`} data-race-scenery-seam-zone="neutral">
      <path d="M-3 15C-1 1-4-10 0-28 4-10 1 1 3 15Z" fill="#5A4635" stroke="#3B392F" strokeWidth="0.8" />
      <circle cx="0" cy="-31" r="27" fill="#315E43" />
      <circle cx="-18" cy="-24" r="15" fill="#426F4D" />
      <circle cx="18" cy="-23" r="16" fill="#3A6948" />
      <path d="M-22-35q22-19 44 0M-20-23q20-13 40 0" fill="none" stroke="#84A66D" strokeWidth="1.3" opacity="0.5" />
    </g>
  );
}

function AmbientRoadsideDetails({
  kind,
  stoneworkId,
}: {
  kind: RaceSceneryKind;
  stoneworkId: string;
}) {
  if (kind === "coast") {
    return (
      <g data-race-scenery-detail="coastal-guardrail">
        <path d="M0 218h1000" stroke="#E7ECE9" strokeWidth="3.2" />
        <path d="M0 221h1000" stroke="#4C5E59" strokeWidth="0.8" opacity="0.75" />
        {Array.from({ length: 20 }, (_, index) => (
          <path key={index} d={`M${index * 50 + 25} 216v18`} stroke="#6B7C75" strokeWidth="2.2" />
        ))}
      </g>
    );
  }

  if (kind === "urban") {
    return (
      <g data-race-scenery-detail="urban-street-furniture">
        {Array.from({ length: 8 }, (_, index) => {
          const x = 62.5 + index * 125;
          return (
            <g key={x} transform={`translate(${x} 191)`}>
              <path d="M0 28V-8" stroke="#263C37" strokeWidth="2.2" />
              <path d="M0-8q8-8 16 0" fill="none" stroke="#263C37" strokeWidth="2" />
              <ellipse cx="16" cy="-7" rx="4.5" ry="2.8" fill="#FFE9A6" stroke="#D7DED9" strokeWidth="0.7" />
              <rect x="-5" y="21" width="10" height="7" rx="1.5" fill="#3F5550" />
            </g>
          );
        })}
        <path d="M0 219h1000" stroke="#ECE9E0" strokeWidth="5" />
        <path d="M0 217h1000" stroke="#596A65" strokeWidth="1.1" />
      </g>
    );
  }

  if (kind === "fields") {
    return (
      <g data-race-scenery-detail="field-hedgerow">
        <path d="M0 220h1000" stroke="#5D4632" strokeWidth="1.8" />
        {Array.from({ length: 20 }, (_, index) => (
          <path key={index} d={`M${index * 50 + 25} 207v29`} stroke="#684E34" strokeWidth="2.4" />
        ))}
        <path d="M0 218q25-18 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0" fill="none" stroke="#426941" strokeWidth="8" opacity="0.9" />
      </g>
    );
  }

  if (kind === "meadow") {
    return (
      <g data-race-scenery-detail="pasture-verge" opacity="0.86">
        {Array.from({ length: 40 }, (_, index) => (
          <path key={index} d={`M${index * 25 + 7} 233q4-18 8 0m-5 0q7-11 12 0`} fill="none" stroke={index % 3 === 0 ? "#6E994F" : "#477A46"} strokeWidth="1.2" />
        ))}
      </g>
    );
  }

  if (kind === "village") {
    return (
      <g data-race-scenery-detail="masonry-boundary">
        <path d="M0 219h1000v17H0Z" fill={`url(#${stoneworkId})`} opacity="0.78" />
        <path d="M0 218q45-4 90 0t90 0 90 0 90 0 90 0 90 0 90 0 90 0 90 0 90 0 100 0" fill="none" stroke="#E2D9C4" strokeWidth="2.5" />
        {Array.from({ length: 8 }, (_, index) => (
          <g key={index} transform={`translate(${62.5 + index * 125} 201)`}>
            <path d="M0 18v-28" stroke="#4E574F" strokeWidth="1.8" />
            <path d="M-5-10h10l-1.5-4h-7Z" fill="#243B35" stroke="#D9E2DD" strokeWidth="0.55" />
            <circle cx="0" cy="-9" r="2.2" fill="#FFE7A3" opacity="0.86" />
          </g>
        ))}
      </g>
    );
  }

  return (
    <g data-race-scenery-detail="woodland-fence" opacity="0.82">
      <path d="M0 218h1000" stroke="#745940" strokeWidth="2.3" />
      <path d="M0 227h1000" stroke="#5D4938" strokeWidth="1.7" />
      {Array.from({ length: 20 }, (_, index) => (
        <path key={index} d={`M${index * 50 + 25} 205v33`} stroke="#624B38" strokeWidth="3" />
      ))}
    </g>
  );
}

function DetailedRoadsideSpectators() {
  const colors = ["#F2C94C", "#F5F0E2", "#D34E56", "#285EA8", "#3B9B6B"];
  return (
    <g data-race-scenery-detail="scaled-spectators">
      {Array.from({ length: 12 }, (_, index) => {
        const x = 65 + index * 78;
        const y = 208 + (index % 3) * 2;
        const skin = index % 4 === 0 ? "#6F4432" : index % 3 === 0 ? "#A86E50" : "#D5A17D";
        return (
          <g key={x} transform={`translate(${x} ${y}) scale(${0.48 + (index % 2) * 0.06})`}>
            <ellipse cy="-17" rx="5" ry="5.8" fill={skin} stroke="#4B342B" strokeWidth="0.7" />
            <path d="M-6-11h12l4 19h-20Z" fill={colors[index % colors.length]} stroke="#203A32" strokeWidth="0.8" />
            <path d={index % 2 ? "M-5-8-14-18m19 10 11-11" : "M-5-8-14 1m19-9 13 5"} stroke={skin} strokeWidth="3" strokeLinecap="round" />
            <path d="M-5 8-7 21M5 8 7 21" stroke="#23352F" strokeWidth="3.2" strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}

function UrbanDetails({ windowsId }: { windowsId: string }) {
  const silhouettes = [
    { x: 55, y: 82, width: 96, height: 112, facade: "#A77F67", trim: "#E7D4B8" },
    { x: 142, y: 58, width: 72, height: 136, facade: "#7E9692", trim: "#DCE7E1" },
    { x: 353, y: 75, width: 105, height: 119, facade: "#B69769", trim: "#F1DFC0" },
    { x: 585, y: 43, width: 122, height: 151, facade: "#778B87", trim: "#D6E1DC" },
    { x: 825, y: 71, width: 102, height: 123, facade: "#9E7265", trim: "#E9D2C8" },
  ];
  return (
    <>
      <g data-race-biotope-detail="urban-facade-depth">
        {silhouettes.map((building, index) => {
          const storefrontY = building.y + building.height - 25;
          return (
            <g key={building.x} data-race-urban-building={index + 1}>
              <rect
                x={building.x}
                y={building.y}
                width={building.width}
                height={building.height}
                fill={building.facade}
                stroke="#344C47"
                strokeWidth="1.25"
              />
              <rect
                x={building.x + 2}
                y={building.y + 5}
                width={building.width - 4}
                height={building.height - 31}
                fill={`url(#${windowsId})`}
                opacity="0.88"
              />
              <path
                d={`M${building.x - 3} ${building.y + 2}h${building.width + 6}M${building.x + 2} ${building.y + 8}h${building.width - 4}`}
                stroke={building.trim}
                strokeWidth="2"
                opacity="0.82"
              />
              {Array.from({ length: 3 }, (_, balcony) => (
                <g key={balcony}>
                  <path
                    d={`M${building.x + 5} ${building.y + 33 + balcony * 27}h${building.width - 10}`}
                    stroke={building.trim}
                    strokeWidth="1.6"
                    opacity="0.82"
                  />
                  <path
                    d={`M${building.x + 9} ${building.y + 34 + balcony * 27}v5m${building.width - 18} -5v5`}
                    stroke="#415A54"
                    strokeWidth="0.9"
                  />
                </g>
              ))}
              <g data-race-biotope-detail="urban-shopfronts">
                <rect x={building.x + 4} y={storefrontY} width={building.width - 8} height="23" rx="1" fill="#273C38" opacity="0.94" />
                <rect x={building.x + 8} y={storefrontY + 6} width={(building.width - 25) / 2} height="13" fill="#9DC4C1" stroke="#E6EEE9" strokeWidth="0.7" />
                <rect x={building.x + building.width / 2 + 4} y={storefrontY + 6} width={(building.width - 25) / 2} height="13" fill="#B9D2CE" stroke="#E6EEE9" strokeWidth="0.7" />
                <path d={`M${building.x + 5} ${storefrontY + 4}h${building.width - 10}`} stroke={index % 2 ? "#E8C760" : "#D9675C"} strokeWidth="4" strokeDasharray="8 4" />
              </g>
              {index % 2 === 0 ? (
                <g data-race-biotope-detail="urban-rooftop-equipment">
                  <path d={`M${building.x + building.width / 2} ${building.y}v-20m-8 20h16`} stroke="#263C37" strokeWidth="1.4" />
                  <rect x={building.x + 12} y={building.y - 7} width="17" height="7" rx="1" fill="#526761" stroke="#D2DBD6" strokeWidth="0.7" />
                  <path d={`M${building.x + 15} ${building.y - 7}v-4m10 4v-4`} stroke="#354A44" strokeWidth="1" />
                </g>
              ) : (
                <g data-race-biotope-detail="urban-rooftop-equipment">
                  <path d={`M${building.x + 14} ${building.y}v-10h20v10`} fill="#536B65" stroke="#2E4540" strokeWidth="1" />
                  <circle cx={building.x + building.width - 15} cy={building.y - 6} r="6" fill="none" stroke="#D4DED8" strokeWidth="1.2" />
                </g>
              )}
            </g>
          );
        })}
      </g>
      <path d="M0 199h1000" stroke="#E2E7E4" strokeWidth="2.2" opacity="0.75" />
      <g data-race-biotope-detail="urban-street-signage">
      {Array.from({ length: 10 }, (_, index) => (
        <g key={index} transform={`translate(${50 + index * 100} 193)`}>
          <path d="M0 0v23" stroke="#2A433D" strokeWidth="1.5" />
          <rect x="-7" y="-8" width="14" height="9" rx="1.5" fill={index % 2 ? "#2B6F5A" : "#B54840"} stroke="#FFFDF4" strokeWidth="0.8" />
        </g>
      ))}
      </g>
      <g data-race-biotope-detail="urban-planters">
        {[268, 508, 757].map((x, index) => (
          <g key={x} transform={`translate(${x} 202)`}>
            <path d="M-10 4h20l-3 13H-7Z" fill="#73584A" stroke="#C5B7A5" strokeWidth="0.8" />
            <path d="M0 3v-18m0 8-9-8m9 3 10-9" stroke="#4F6F4C" strokeWidth="2" strokeLinecap="round" />
            <circle cx="-8" cy="-15" r={index === 1 ? 7 : 6} fill="#5D8B5A" />
            <circle cx="7" cy="-18" r={index === 1 ? 8 : 6.5} fill="#4E7C52" />
          </g>
        ))}
      </g>
    </>
  );
}

function FineConifer({
  x,
  y,
  scale,
}: {
  x: number;
  y: number;
  scale: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0v-82" stroke="#604934" strokeWidth="5" />
      <path d="M0-105-30-60h17l-25 34h76L13-60h18Z" fill="#1C4934" stroke="#153626" strokeWidth="1.5" />
      <path d="m0-96-17 35h11l-17 25h44L7-61h12Z" fill="#397054" opacity="0.65" />
      <path d="m-27-45 15-6m22-16 15-5M-9-79 5-84" stroke="#76A17F" strokeWidth="1.7" opacity="0.58" />
    </g>
  );
}

function FineDeciduousTree({
  x,
  y,
  scale,
}: {
  x: number;
  y: number;
  scale: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0v-64m0 24-19-18m19 7 23-22" stroke="#654A34" strokeWidth="5" strokeLinecap="round" />
      <circle cx="-18" cy="-70" r="24" fill="#356D4B" stroke="#234D36" strokeWidth="2" />
      <circle cx="10" cy="-82" r="29" fill="#2D6246" stroke="#214A35" strokeWidth="2" />
      <circle cx="31" cy="-65" r="21" fill="#447B56" stroke="#29573F" strokeWidth="2" />
      <g fill="#83AA7A" opacity="0.5">
        <circle cx="-25" cy="-78" r="5" />
        <circle cx="3" cy="-91" r="6" />
        <circle cx="27" cy="-72" r="4.5" />
      </g>
    </g>
  );
}
