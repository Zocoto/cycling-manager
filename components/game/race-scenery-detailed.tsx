import { useId } from "react";

import { RaceSceneryBackdrop as BaseRaceSceneryBackdrop } from "@/components/game/race-scenery";
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
            ? "M0 164Q90 132 180 158T360 151T540 158T720 149T900 158T1080 151V225H0Z"
            : urban
              ? "M0 170 80 132 150 157 245 111 335 151 440 122 535 158 650 105 760 148 875 118 1000 160V224H0Z"
              : "M0 171Q95 82 190 159T380 150T570 157T760 143T950 157T1140 146V224H0Z"
        }
        fill={coastal ? "#6EAEB0" : urban ? "#78958E" : "#729478"}
        opacity="0.5"
      />
      <path
        d="M0 190Q120 143 240 184T480 178T720 185T960 176T1200 182V230H0Z"
        fill={coastal ? "#4E8F91" : "#4F7658"}
        opacity="0.46"
      />
      {[105, 312, 548, 764, 925].map((x, index) => (
        <g key={x} transform={`translate(${x} ${48 + (index % 2) * 28})`} opacity="0.6">
          <path d="M0 8q17-14 34 0 18-14 36 1-4 12-18 12H18Q4 21 0 8Z" fill="#E8F4F0" />
          <path d="M12 9q12-8 24 0" fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.65" />
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
      className="relative h-full w-1/2 shrink-0 overflow-hidden"
    >
      <BaseRaceSceneryBackdrop
        kind={kind}
        isMoving={false}
        showSpectators={showSpectators}
      />
      <svg
        viewBox="0 0 1000 320"
        preserveAspectRatio="none"
        className="absolute -left-[8%] top-0 h-full w-[116%]"
      >
        <defs>
          <pattern
            id={`${detailId}-grain`}
            width="3.2"
            height="3.2"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0.55" cy="0.7" r="0.16" fill="#FFFDF4" opacity="0.28" />
            <circle cx="2.45" cy="1.35" r="0.12" fill="#071A17" opacity="0.2" />
            <circle cx="1.5" cy="2.7" r="0.1" fill="#FFFDF4" opacity="0.2" />
          </pattern>
          <pattern
            id={`${detailId}-micro-lines`}
            width="13"
            height="11"
            patternUnits="userSpaceOnUse"
          >
            <path d="M1 3h3.4M8 8h2.1" stroke="#FFFDF4" strokeWidth="0.16" opacity="0.22" />
            <path d="M5 10h1.8" stroke="#071A17" strokeWidth="0.13" opacity="0.16" />
          </pattern>
          <pattern
            id={`${detailId}-tiles`}
            width="12"
            height="7"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 1h12M0 6h12M6 1v5M0 6v1" stroke="#F4C4A9" strokeWidth="0.7" opacity="0.62" />
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
            width="11"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <path d="M1 8 3 2m2 6 1-4m3 4-2-3" stroke="#274F35" strokeWidth="0.7" opacity="0.52" />
            <path d="m3 7 4-1m1-4 2-1" stroke="#D9E5C5" strokeWidth="0.35" opacity="0.42" />
          </pattern>
          <linearGradient id={`${detailId}-atmosphere`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E8F6F3" stopOpacity="0.26" />
            <stop offset="0.52" stopColor="#D7ECE4" stopOpacity="0.08" />
            <stop offset="1" stopColor="#18382D" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {kind === "forest" ? <ForestDetails /> : null}
        {kind === "fields" ? <FieldDetails /> : null}
        {kind === "meadow" ? <MeadowDetails /> : null}
        {kind === "coast" ? <CoastDetails /> : null}
        {kind === "village" ? (
          <VillageDetails tilesId={`${detailId}-tiles`} />
        ) : null}
        {kind === "urban" ? (
          <UrbanDetails windowsId={`${detailId}-windows`} />
        ) : null}

        <path
          d="M0 202q85-11 170 2t170-1 170 2 170-2 170 2 140-1v41H0Z"
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
      </svg>
    </div>
  );
}
function ForestDetails() {
  return (
    <>
      <g opacity="0.72">
        {Array.from({ length: 26 }, (_, index) => {
          const x = 12 + index * 40;
          const y = 176 + (index % 4) * 5;
          const scale = 0.28 + (index % 5) * 0.045;
          return index % 3 === 0 ? (
            <FineDeciduousTree key={x} x={x} y={y} scale={scale} />
          ) : (
            <FineConifer key={x} x={x} y={y} scale={scale} />
          );
        })}
      </g>
      <path
        d="M0 207q35-19 70 0t70 0 70 0 70 0 70 0 70 0 70 0 70 0 70 0 70 0 70 0 70 0 70 0 70 0 70 0"
        fill="none"
        stroke="#193E2D"
        strokeWidth="9"
        opacity="0.7"
      />
      {Array.from({ length: 34 }, (_, index) => (
        <path
          key={index}
          d={`M${index * 31} ${211 + (index % 3)}q5-13 10 0q5-17 11 0`}
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
      <g fill="none" strokeLinecap="round" opacity="0.68">
        {Array.from({ length: 17 }, (_, index) => (
          <path
            key={index}
            d={`M${index * 68 - 80} 232Q${index * 68 - 10} 190 ${index * 68 + 122} 160`}
            stroke={index % 3 === 0 ? "#F2D683" : "#5D8E4F"}
            strokeWidth={index % 3 === 0 ? 2.4 : 1.25}
          />
        ))}
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
      <g opacity="0.78">
        {Array.from({ length: 18 }, (_, index) => (
          <FineDeciduousTree
            key={index}
            x={15 + index * 58}
            y={204 + (index % 3) * 3}
            scale={0.22 + (index % 4) * 0.025}
          />
        ))}
      </g>
      {Array.from({ length: 36 }, (_, index) => {
        const x = 10 + index * 29;
        return (
          <g key={x} transform={`translate(${x} ${220 + (index % 5)})`}>
            <path d="M0 8V0m0 3-4-4m4 6 4-5" stroke="#416E43" strokeWidth="0.9" />
            <circle cx={index % 2 ? 4 : -4} cy="0" r="1.7" fill={index % 3 === 0 ? "#F2C94C" : "#FFFDF4"} />
          </g>
        );
      })}
      <path d="M0 214h1000" stroke="#E8E2CF" strokeWidth="1.2" strokeDasharray="16 7" opacity="0.7" />
    </>
  );
}

function CoastDetails() {
  return (
    <>
      <g fill="none" stroke="#E7F6F5" strokeLinecap="round">
        {Array.from({ length: 12 }, (_, index) => (
          <path
            key={index}
            d={`M${index * 92 - 30} ${152 + (index % 3) * 14}q22-7 45 0t45 0`}
            strokeWidth={index % 2 ? 1.1 : 1.8}
            opacity={0.45 + (index % 3) * 0.12}
          />
        ))}
      </g>
      <g transform="translate(615 148)">
        <path d="M0 35h64L53 42H10Z" fill="#F7F0DE" stroke="#4D6866" strokeWidth="1.2" />
        <path d="M31 35V-5l27 34H34Z" fill="#FFFDF4" stroke="#537B7B" strokeWidth="1.1" />
        <path d="M29 2 8 30h21Z" fill="#E76F51" stroke="#765047" strokeWidth="1" />
        <path d="M31-5v42" stroke="#3B5551" strokeWidth="1.4" />
      </g>
      <path d="M785 213q41-52 82 0t83 0 82 0v23H785Z" fill="#9A865F" opacity="0.68" />
      {Array.from({ length: 11 }, (_, index) => (
        <path key={index} d={`m${800 + index * 21} 209 5-15 6 15`} fill="none" stroke="#4E744A" strokeWidth="2" />
      ))}
    </>
  );
}

function VillageDetails({ tilesId }: { tilesId: string }) {
  const facades = [
    { x: 36, y: 142, width: 76, height: 66, color: "#EBD5AD" },
    { x: 245, y: 151, width: 82, height: 58, color: "#D2DFCF" },
    { x: 675, y: 148, width: 78, height: 61, color: "#F0DEC0" },
    { x: 878, y: 140, width: 85, height: 69, color: "#DCC39B" },
  ];
  return (
    <>
      {facades.map((facade, index) => (
        <g key={facade.x}>
          <rect {...facade} rx="1.5" fill={facade.color} stroke="#625847" strokeWidth="1.1" />
          <path
            d={`M${facade.x - 5} ${facade.y + 1} ${facade.x + facade.width / 2} ${facade.y - 24} ${facade.x + facade.width + 5} ${facade.y + 1}Z`}
            fill={`url(#${tilesId})`}
            stroke="#68483C"
            strokeWidth="1.2"
          />
          {[0, 1].map((column) =>
            [0, 1].map((row) => {
              const wx = facade.x + 12 + column * (facade.width - 35);
              const wy = facade.y + 12 + row * 23;
              return (
                <g key={`${column}-${row}`}>
                  <rect x={wx} y={wy} width="13" height="13" fill="#78A9B3" stroke="#FFFDF4" strokeWidth="1.4" />
                  <path d={`M${wx - 4} ${wy}v13m21-13v13`} stroke={index % 2 ? "#397150" : "#9B4E42"} strokeWidth="2.5" />
                  <path d={`M${wx} ${wy + 6.5}h13M${wx + 6.5} ${wy}v13`} stroke="#E6F0ED" strokeWidth="0.7" />
                </g>
              );
            }),
          )}
          <path d={`M${facade.x + 4} ${facade.y + facade.height - 5}h${facade.width - 8}`} stroke="#A38B64" strokeWidth="2" />
        </g>
      ))}
      {Array.from({ length: 13 }, (_, index) => (
        <g key={index} transform={`translate(${18 + index * 80} 211)`}>
          <circle r="7" fill={index % 2 ? "#366D4A" : "#4D8058"} />
          <circle cx="-4" cy="-3" r="2" fill="#F1E39A" opacity="0.75" />
        </g>
      ))}
    </>
  );
}

function UrbanDetails({ windowsId }: { windowsId: string }) {
  const silhouettes = [
    { x: 22, y: 82, width: 96, height: 112 },
    { x: 142, y: 58, width: 72, height: 136 },
    { x: 353, y: 75, width: 105, height: 119 },
    { x: 585, y: 43, width: 122, height: 151 },
    { x: 825, y: 71, width: 102, height: 123 },
  ];
  return (
    <>
      {silhouettes.map((building, index) => (
        <g key={building.x}>
          <rect
            {...building}
            fill={`url(#${windowsId})`}
            stroke="#344C47"
            strokeWidth="1.1"
            opacity="0.62"
          />
          {Array.from({ length: 3 }, (_, balcony) => (
            <g key={balcony}>
              <path
                d={`M${building.x + 5} ${building.y + 33 + balcony * 27}h${building.width - 10}`}
                stroke="#D3DDD8"
                strokeWidth="1.4"
                opacity="0.56"
              />
              <path
                d={`M${building.x + 9} ${building.y + 34 + balcony * 27}v5m${building.width - 18} -5v5`}
                stroke="#8EA39A"
                strokeWidth="0.8"
              />
            </g>
          ))}
          {index % 2 === 0 ? (
            <path
              d={`M${building.x + building.width / 2} ${building.y}v-20m-8 20h16`}
              stroke="#263C37"
              strokeWidth="1.4"
            />
          ) : null}
        </g>
      ))}
      <path d="M0 199h1000" stroke="#E2E7E4" strokeWidth="2.2" opacity="0.75" />
      {Array.from({ length: 14 }, (_, index) => (
        <g key={index} transform={`translate(${38 + index * 74} 193)`}>
          <path d="M0 0v23" stroke="#2A433D" strokeWidth="1.5" />
          <rect x="-7" y="-8" width="14" height="9" rx="1.5" fill={index % 2 ? "#2B6F5A" : "#B54840"} stroke="#FFFDF4" strokeWidth="0.8" />
        </g>
      ))}
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
