import { useId } from "react";

import { SvgCountryFlag } from "@/components/game/svg-country-flag";
import { ContinentalChampionPattern } from "@/components/game/continental-champion-pattern";
import {
  getTeamKitPattern,
  type TeamKitPattern,
} from "@/lib/game/race-visuals";
import type { RiderSimulationInput } from "@/lib/game/race-simulation";
import {
  getRaceCyclistJerseyVisual,
  getRaceCyclistSkinPalette,
} from "@/components/game/race-cyclist";
import type { RiderJerseyPattern } from "@/lib/rider-jersey";

export function SideRaceCyclist({
  rider,
  isMoving = true,
  className = "h-12 w-[5.25rem]",
  celebrating = false,
  timeTrial = false,
  rearDiscWheel = false,
}: {
  rider: RiderSimulationInput;
  isMoving?: boolean;
  className?: string;
  celebrating?: boolean;
  timeTrial?: boolean;
  rearDiscWheel?: boolean;
}) {
  const visual = getRaceCyclistJerseyVisual(rider);
  const helmet = getRaceCyclistTeamHelmetPalette(rider);
  const skin = getRaceCyclistSkinPalette(rider);
  const pattern = getRaceCyclistTeamKitPattern(rider);
  const clipId = `detailed-side-jersey-${useId().replace(/:/g, "")}`;
  const label = `${rider.name} · ${rider.teamName} · ${visual.label}`;
  const torsoPath = celebrating
    ? "M42 10 39 17 40 28 54 28 56 17 53 10Z"
    : "m42 12-8 7 3 11 13-1 10-11-6-6Z";
  const head = celebrating ? { cx: 48, cy: 4.5 } : { cx: 62, cy: 8.8 };

  return (
    <svg
      viewBox="0 0 90 56"
      role="img"
      aria-label={label}
      className={`${className} overflow-visible drop-shadow-md ${
        isMoving ? "cm-bike-bob" : ""
      }`}
    >
      <title>{label}</title>
      <defs>
        <clipPath id={clipId}>
          <path d={torsoPath} />
        </clipPath>
      </defs>

      <DetailedSideWheel cx={18} moving={isMoving} disc={rearDiscWheel} />
      <DetailedSideWheel cx={72} moving={isMoving} />

      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-detailed-race-bike="true"
      >
        <path
          d="M18 42 37 25l11 17H18l16-24 23 3 15 21"
          stroke="#DCE8E2"
          strokeWidth="1.45"
        />
        <path
          d="M37 25h12m8-4 7-7m-3 0h10"
          stroke="#17261E"
          strokeWidth="1.65"
        />
        <path
          d="m34 18 5-1m-7 0h8"
          stroke={visual.secondaryColor}
          strokeWidth="1.7"
        />
        <path
          d="M18 42 34 18 48 42 57 21"
          stroke={visual.primaryColor}
          strokeWidth="2.15"
        />
        <path d="M34 18 57 21" stroke={visual.accentColor} strokeWidth="1.1" />
        <path d="M48 42h-8" stroke="#82928B" strokeWidth="0.8" />
        <circle cx="48" cy="42" r="3.2" stroke="#D6DED9" strokeWidth="1" />
        <circle cx="72" cy="42" r="2.4" stroke="#A5B3AD" strokeWidth="0.8" />
        <path
          d="M48 42 72 42"
          stroke="#A5B3AD"
          strokeWidth="0.7"
          strokeDasharray="1 1"
        />
        <path
          d="M40 27h4v8h-4Z"
          fill="#E8EEE9"
          stroke="#64756D"
          strokeWidth="0.6"
        />
        <path d="m61 14 5-2 2 2" stroke="#DCE8E2" strokeWidth="0.9" />
      </g>

      <g
        className={isMoving ? "cm-bike-leg-back" : ""}
        style={{ transformOrigin: "45px 28px" }}
        opacity="0.82"
      >
        <path
          d="M45 27 38 35 42 44"
          fill="none"
          stroke="#17261E"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M38 35 42 44"
          fill="none"
          stroke={skin.skinTone}
          strokeWidth="2.35"
          strokeLinecap="round"
        />
        <path
          d="m40 44 7 1"
          stroke="#F5F7F6"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
      <g
        className={isMoving ? "cm-bike-leg-front" : ""}
        style={{ transformOrigin: "45px 28px" }}
      >
        <path
          d="M45 27 51 35 49 44"
          fill="none"
          stroke="#17261E"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M51 35 49 44"
          fill="none"
          stroke={skin.skinTone}
          strokeWidth="2.45"
          strokeLinecap="round"
        />
        <path
          d="m47 44 7 1"
          stroke="#F5F7F6"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </g>

      <g
        className={isMoving ? "cm-bike-pedal" : ""}
        style={{ transformOrigin: "48px 42px" }}
      >
        <path
          d="m42 39 6 3 6 3"
          fill="none"
          stroke="#17261E"
          strokeWidth="1.25"
        />
        <path
          d="M39 38h5m8 8h5"
          stroke="#E9EFEC"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>

      <path
        d={torsoPath}
        data-race-victory-torso={celebrating ? "upright" : undefined}
        fill={visual.primaryColor}
        stroke="#F4F7F5"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <RaceJerseyOverlay
        rider={rider}
        clipId={clipId}
        celebrating={celebrating}
        mode="side"
        pattern={pattern}
        visual={visual}
      />
      {!celebrating ? (
        <path
          d="m35 19-8 8"
          stroke={visual.secondaryColor}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      ) : null}
      {celebrating ? (
        <g
          data-race-victory-pose="arms-raised"
          data-race-victory-torso="upright"
          className="cm-victory-arms"
        >
          <path
            d="M43 14 37 4 34-6M53 14 59 4 62-6"
            fill="none"
            stroke={skin.skinTone}
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="34" cy="-6" r="1.65" fill={skin.skinTone} />
          <circle cx="62" cy="-6" r="1.65" fill={skin.skinTone} />
        </g>
      ) : (
        <>
          <path
            d="m57 17 8 7 7-3"
            fill="none"
            stroke={skin.skinTone}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m70 20 4-1"
            stroke="#17261E"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </>
      )}

      <circle
        cx={head.cx}
        cy={head.cy}
        r="4.4"
        fill={skin.skinTone}
        stroke={skin.skinShadow}
        strokeWidth="0.65"
      />
      <g
        data-race-helmet-team-colors="true"
        data-race-time-trial-helmet={timeTrial ? "aero" : undefined}
      >
        <path
          d={
            celebrating
              ? "M43.6 4.3c.2-4.1 3.2-5.8 6.5-4.9 2.5.7 3.8 2.4 3.8 4.3l-5.4-1Z"
              : timeTrial
                ? "M52 7.1 58 4.2c2.5-2 6.3-1.8 8.8.2 1.7 1.3 2.4 2.7 2.3 4.1l-6.2-1.2-5.3 1.5Z"
                : "M57.6 8.5c.2-4.3 3.4-6.2 6.9-5.2 2.7.8 4.2 2.7 4.2 4.7l-5.7-1.1Z"
          }
          fill={helmet.primary}
          stroke="#071A17"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
        <path
          d={celebrating ? "m46 0 2.8 2.5 2-1.9" : "m60.2 4.2 3.1 2.7 2.2-2.1"}
          fill={helmet.secondary}
        />
        <path
          d={
            celebrating
              ? "m46.1 0 .8 2m1.8-2.5.2 2.6m2-1.5-.5 2"
              : "m60.3 4.2.9 2.1m2-2.7.2 2.8m2.2-1.7-.5 2.1"
          }
          stroke={helmet.accent}
          strokeWidth="0.6"
          strokeLinecap="round"
        />
      </g>
      <path
        d={celebrating ? "m51.4 4.3-2 3.4" : "m66.4 8.6-2 3.4"}
        stroke="#263B32"
        strokeWidth="0.65"
      />
      <path
        d={celebrating ? "M49 4.8h4" : "M63 9.3h4"}
        stroke="#17261E"
        strokeWidth="0.55"
      />
    </svg>
  );
}

export function TopRaceCyclist({
  rider,
  isMoving = true,
  celebrating = false,
}: {
  rider: RiderSimulationInput;
  isMoving?: boolean;
  celebrating?: boolean;
}) {
  const visual = getRaceCyclistJerseyVisual(rider);
  const helmet = getRaceCyclistTeamHelmetPalette(rider);
  const skin = getRaceCyclistSkinPalette(rider);
  const pattern = getRaceCyclistTeamKitPattern(rider);
  const clipId = `detailed-top-jersey-${useId().replace(/:/g, "")}`;
  const label = `${rider.name} · ${rider.teamName} · ${visual.label}`;

  return (
    <svg
      viewBox="0 0 90 42"
      role="img"
      aria-label={label}
      className={`h-9 w-[5.25rem] overflow-visible drop-shadow-lg ${
        isMoving ? "cm-bike-top-sway" : ""
      }`}
    >
      <title>{label}</title>
      <defs>
        <clipPath id={clipId}>
          <ellipse cx="47" cy="21" rx="14" ry="8.7" />
        </clipPath>
      </defs>
      <g fill="none" data-detailed-race-bike="true">
        <ellipse
          className={isMoving ? "cm-bike-wheel" : ""}
          cx="11"
          cy="21"
          rx="9"
          ry="3.7"
          stroke="#0E1814"
          strokeWidth="2"
        />
        <ellipse
          cx="11"
          cy="21"
          rx="8"
          ry="2.8"
          stroke="#DCE8E2"
          strokeWidth="0.65"
          strokeDasharray="2 1.5"
        />
        <ellipse
          className={isMoving ? "cm-bike-wheel" : ""}
          cx="79"
          cy="21"
          rx="9"
          ry="3.7"
          stroke="#0E1814"
          strokeWidth="2"
        />
        <ellipse
          cx="79"
          cy="21"
          rx="8"
          ry="2.8"
          stroke="#DCE8E2"
          strokeWidth="0.65"
          strokeDasharray="2 1.5"
        />
        <path
          d="M11 21 36 14l17 7H11l25 7 17-7h26"
          stroke={visual.primaryColor}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="m53 21 13-9m-3 0h9"
          stroke="#DCE8E2"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path d="M36 14 36 28" stroke={visual.accentColor} strokeWidth="0.9" />
      </g>
      <g className={isMoving ? "cm-bike-leg-top-back" : ""}>
        <path
          d="m40 14-11-5m11 19-11 5"
          stroke={skin.skinTone}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g className={isMoving ? "cm-bike-leg-top-front" : ""}>
        <path
          d="m51 13 13 3m-13 13 13-3"
          stroke={skin.skinTone}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </g>
      <ellipse
        cx="47"
        cy="21"
        rx="14"
        ry="8.7"
        fill={visual.primaryColor}
        stroke="#F4F7F5"
        strokeWidth="0.8"
      />
      {celebrating ? (
        <g
          data-race-victory-pose="arms-raised"
          data-race-victory-torso="upright"
          className="cm-victory-arms"
        >
          <path
            d="M41 17 31 7 20 1M52 17 62 7 73 1"
            fill="none"
            stroke={skin.skinTone}
            strokeWidth="2.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="1" r="1.65" fill={skin.skinTone} />
          <circle cx="73" cy="1" r="1.65" fill={skin.skinTone} />
        </g>
      ) : null}
      <RaceJerseyOverlay
        rider={rider}
        clipId={clipId}
        mode="top"
        pattern={pattern}
        visual={visual}
      />
      <ellipse
        cx="66"
        cy="21"
        rx="4.9"
        ry="4.1"
        fill={skin.skinTone}
        stroke={skin.skinShadow}
        strokeWidth="0.6"
      />
      <g data-race-helmet-team-colors="true">
        <path
          d="M62.4 17.3c4.1-1.7 7.8 0 8.4 3.4l-8.2.2Z"
          fill={helmet.primary}
          stroke="#071A17"
          strokeWidth="0.75"
        />
        <path d="m64.2 17.1 2.1 3.6 2-3" fill={helmet.secondary} />
        <path
          d="m65 17.2.2 2.3m2-2.1-.2 2.3m2-.9-.5 1.2"
          stroke={helmet.accent}
          strokeWidth="0.55"
        />
      </g>
    </svg>
  );
}

export function getRaceCyclistTeamHelmetPalette(
  rider: Pick<
    RiderSimulationInput,
    "teamPrimaryColor" | "teamSecondaryColor" | "teamJersey"
  >,
) {
  return {
    primary: rider.teamJersey?.primaryColor ?? rider.teamPrimaryColor,
    secondary: rider.teamJersey?.secondaryColor ?? rider.teamSecondaryColor,
    accent: rider.teamJersey?.accentColor ?? "#FFFFFF",
  };
}

function DetailedSideWheel({
  cx,
  moving,
  disc = false,
}: {
  cx: number;
  moving: boolean;
  disc?: boolean;
}) {
  const spokes = Array.from({ length: 10 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 10;
    return {
      x: cx + Math.cos(angle) * 10,
      y: 42 + Math.sin(angle) * 10,
    };
  });

  return (
    <g data-race-wheel={disc ? "rear-disc" : "spoked"}>
      <circle
        cx={cx}
        cy="42"
        r="11.7"
        fill="rgba(7,26,23,0.12)"
        stroke="#0E1814"
        strokeWidth="2.3"
      />
      <circle
        className={moving ? "cm-bike-wheel" : ""}
        cx={cx}
        cy="42"
        r="10.4"
        fill={disc ? "#26322D" : "none"}
        stroke="#DCE8E2"
        strokeWidth="0.8"
        strokeDasharray={disc ? undefined : "2.4 1.6"}
      />
      <circle
        cx={cx}
        cy="42"
        r="1.35"
        fill="#EEF3F0"
        stroke="#65766E"
        strokeWidth="0.5"
      />
      {disc ? (
        <path
          d={`M${cx} 42 ${cx + 8.8} 36.7`}
          stroke="#65766E"
          strokeWidth="0.7"
        />
      ) : (
        spokes.map(({ x, y }, index) => (
          <path
            key={index}
            d={`M${cx} 42 ${x} ${y}`}
            stroke="#C8D4CE"
            strokeOpacity="0.68"
            strokeWidth="0.38"
          />
        ))
      )}
      <path
        d={`M${cx - 2.8} 32.3h5.6M${cx - 2.8} 51.7h5.6`}
        stroke="#9BAAA3"
        strokeWidth="0.55"
      />
    </g>
  );
}

function RaceJerseyOverlay({
  rider,
  clipId,
  mode,
  pattern,
  visual,
  celebrating = false,
}: {
  rider: RiderSimulationInput;
  clipId: string;
  mode: "side" | "top";
  pattern: TeamKitPattern;
  visual: ReturnType<typeof getRaceCyclistJerseyVisual>;
  celebrating?: boolean;
}) {
  if (visual.status === "world-champion") {
    const colors = ["#2166B1", "#E32636", "#111111", "#F2C94C", "#16834A"];
    return (
      <g clipPath={`url(#${clipId})`}>
        {colors.map((color, index) => (
          <rect
            key={color}
            x="0"
            y={(mode === "side" ? 11 : 9) + index * 3.4}
            width="90"
            height="3.4"
            fill={color}
          />
        ))}
      </g>
    );
  }
  if (visual.status === "continental-champion") {
    return (
      <ContinentalChampionPattern
        continentCode={visual.continentCode}
        clipPathId={clipId}
        width={90}
        height={mode === "side" ? 56 : 42}
      />
    );
  }

  if (
    visual.status === "national-champion" ||
    visual.status === "national-team"
  ) {
    return (
      <SvgCountryFlag
        countryCode={visual.countryCode!}
        x="0"
        y="0"
        width={90}
        height={mode === "side" ? 56 : 42}
        clipPathId={clipId}
        preserveAspectRatio="xMidYMid slice"
      />
    );
  }

  if (visual.status === "classification-leader") {
    if (rider.classificationJersey === "mountain") {
      const dots =
        mode === "side"
          ? celebrating
            ? [
                [43, 14],
                [49, 12],
                [53, 17],
                [44, 22],
                [50, 24],
              ]
            : [
                [38, 17],
                [45, 14],
                [52, 17],
                [42, 23],
                [50, 24],
              ]
          : [
              [36, 18],
              [44, 15],
              [53, 16],
              [41, 23],
              [50, 25],
              [58, 22],
            ];
      return (
        <g clipPath={`url(#${clipId})`}>
          {dots.map(([cx, cy]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={mode === "side" ? 1.7 : 2}
              fill={visual.accentColor}
            />
          ))}
        </g>
      );
    }
    return null;
  }

  return mode === "side" ? (
    <SidePattern
      pattern={pattern}
      color={visual.secondaryColor}
      upright={celebrating}
    />
  ) : (
    <TopPattern pattern={pattern} color={visual.secondaryColor} />
  );
}

function getRaceCyclistTeamKitPattern(
  rider: Pick<RiderSimulationInput, "teamId" | "teamJersey">,
): TeamKitPattern {
  const pattern = rider.teamJersey?.pattern;
  if (!pattern) return getTeamKitPattern(rider.teamId);
  return mapRiderJerseyPattern(pattern);
}

function mapRiderJerseyPattern(pattern: RiderJerseyPattern): TeamKitPattern {
  if (pattern === "diagonal" || pattern === "chevron") return pattern;
  if (pattern === "split" || pattern === "quarters") return "halves";
  return "center_stripe";
}

function SidePattern({
  pattern,
  color,
  upright,
}: {
  pattern: TeamKitPattern;
  color: string;
  upright: boolean;
}) {
  if (upright) {
    if (pattern === "center_stripe")
      return <path d="M46 10h4l1 18h-5Z" fill={color} />;
    if (pattern === "halves")
      return <path d="M48 10h5l3 7-2 11h-6Z" fill={color} />;
    if (pattern === "chevron")
      return <path d="m40 16 8 5 8-5v4l-8 5-8-5Z" fill={color} />;
    return <path d="m41 14 3-3 11 13-3 3Z" fill={color} />;
  }
  if (pattern === "center_stripe")
    return <path d="m43 12 5 .1 1 17-6 .3Z" fill={color} />;
  if (pattern === "halves")
    return <path d="m47 12 7-.2 6 6-10 11-3 .2Z" fill={color} />;
  if (pattern === "chevron")
    return <path d="m35 19 10 5 13-8 2 2.7-15 9-11-6Z" fill={color} />;
  return <path d="m36 16 3-3 17 11-3 3Z" fill={color} />;
}

function TopPattern({
  pattern,
  color,
}: {
  pattern: TeamKitPattern;
  color: string;
}) {
  if (pattern === "center_stripe")
    return <rect x="44" y="12" width="6" height="18" rx="2" fill={color} />;
  if (pattern === "halves")
    return <path d="M47 12.3c8 0 14 3.8 14 8.7s-6 8.7-14 8.7Z" fill={color} />;
  if (pattern === "chevron")
    return <path d="m34 15 13 7 13-7 1.5 3.4L47 27 32.5 18.5Z" fill={color} />;
  return <path d="m36 13 4-1.4 17 16-4 1.4Z" fill={color} />;
}
