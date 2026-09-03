import { useId } from "react";

import { SvgCountryFlag } from "@/components/game/svg-country-flag";
import { ContinentalChampionPattern } from "@/components/game/continental-champion-pattern";
import { NationalJerseyDesignPattern } from "@/components/game/national-jersey-design-artwork";
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
import type { RaceRiderVisualEffort } from "@/lib/game/race-visual-motion";

export function SideRaceCyclist({
  rider,
  isMoving = true,
  className = "h-12 w-[5.25rem]",
  celebrating = false,
  timeTrial = false,
  rearDiscWheel = false,
  effort = "steady",
  ridingPose = "seated",
}: {
  rider: RiderSimulationInput;
  isMoving?: boolean;
  className?: string;
  celebrating?: boolean;
  timeTrial?: boolean;
  rearDiscWheel?: boolean;
  effort?: RaceRiderVisualEffort;
  ridingPose?: "seated" | "standing";
}) {
  const visual = getRaceCyclistJerseyVisual(rider);
  const helmet = getRaceCyclistTeamHelmetPalette(rider);
  const skin = getRaceCyclistSkinPalette(rider);
  const pattern = getRaceCyclistTeamKitPattern(rider);
  const visualId = `detailed-side-${useId().replace(/:/g, "")}`;
  const clipId = `${visualId}-jersey`;
  const label = `${rider.name} · ${rider.teamName} · ${visual.label}`;
  const standing = ridingPose === "standing" && !celebrating;
  const torsoPath = celebrating
    ? "M42 10C39.8 12.3 39.2 16.1 39.8 20.7L40.8 27.7C44.1 29.2 49.9 29.2 53.2 27.8L55.6 20C56.7 15.7 55 11.9 52.6 10C49.5 8.7 45.1 8.7 42 10Z"
    : standing
      ? "M39.2 23.5C38.8 19.2 39.6 14.4 42.4 10.9C44.7 8.1 48.4 7.5 51.5 9.1L56 12.2C57.7 13.2 58.1 15.1 56.9 16.7L49.1 24.3C46.4 26 42.1 25.7 39.2 23.5Z"
      : "M39.6 26.8C40.1 22.4 40.6 17.4 43.2 13.4C45.3 10.3 49.1 9.8 52.3 11.5L57.2 14.6C59 15.5 59.5 17.4 58.3 19.1L50 27.5C47.4 29.4 43.2 29.1 39.6 26.8Z";
  const head = celebrating
    ? { cx: 48, cy: 4.5 }
    : standing
      ? { cx: 59, cy: 5.8 }
      : { cx: 62, cy: 8.8 };

  return (
    <svg
      viewBox="0 0 90 56"
      role="img"
      aria-label={label}
      data-race-cyclist-effort={effort}
      data-race-cyclist-direction="finish-right"
      data-race-cyclist-pose={standing ? "standing-climb" : "seated"}
      className={`${className} overflow-visible drop-shadow-md ${
        isMoving ? (standing ? "cm-bike-standing" : "cm-bike-bob") : ""
      } cm-race-cyclist-effort-${effort}`}
    >
      <title>{label}</title>
      <defs>
        <clipPath id={clipId}>
          <path d={torsoPath} />
        </clipPath>
        <linearGradient id={`${visualId}-frame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={visual.accentColor} stopOpacity="0.88" />
          <stop offset="0.28" stopColor={visual.primaryColor} />
          <stop offset="0.72" stopColor={visual.primaryColor} />
          <stop offset="1" stopColor="#071A17" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id={`${visualId}-jersey-light`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.34" />
          <stop offset="0.32" stopColor={visual.primaryColor} />
          <stop offset="1" stopColor="#071A17" stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id={`${visualId}-tire`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#33423C" />
          <stop offset="0.45" stopColor="#090E0C" />
          <stop offset="0.78" stopColor="#1C2924" />
          <stop offset="1" stopColor="#050807" />
        </linearGradient>
        <linearGradient id={`${visualId}-helmet-shell`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.46" />
          <stop offset="0.3" stopColor={helmet.primary} />
          <stop offset="1" stopColor={helmet.secondary} />
        </linearGradient>
        <pattern id={`${visualId}-fabric`} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
          <path d="M0 .4h2.4M.4 0v2.4" stroke="#FFFFFF" strokeWidth="0.16" opacity="0.28" />
          <path d="m0 2.4 2.4-2.4" stroke="#071A17" strokeWidth="0.12" opacity="0.2" />
        </pattern>
      </defs>

      {isMoving && (effort === "relay" || effort === "chase") ? (
        <g
          aria-hidden="true"
          data-race-cyclist-airflow={effort}
          className="cm-race-cyclist-airflow"
          fill="none"
          stroke="#EAF7F3"
          strokeLinecap="round"
        >
          <path d="M1 18h18" strokeWidth="0.65" opacity="0.38" />
          <path d="M-4 24h15" strokeWidth="0.5" opacity="0.26" />
          <path d="M2 31h12" strokeWidth="0.42" opacity="0.2" />
        </g>
      ) : null}

      <DetailedSideWheel
        cx={18}
        moving={isMoving}
        disc={rearDiscWheel}
        tireGradientId={`${visualId}-tire`}
      />
      <DetailedSideWheel
        cx={72}
        moving={isMoving}
        tireGradientId={`${visualId}-tire`}
      />

      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-detailed-race-bike="true"
        data-race-bike-texture="carbon-metal"
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
          stroke={`url(#${visualId}-frame)`}
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
        <path d="M54 22 70 39" stroke="#26342E" strokeWidth="1.1" />
        <circle cx="72" cy="42" r="3.6" stroke="#B8C4BE" strokeWidth="0.45" strokeDasharray="1 0.7" />
        <path d="M49 40h6l2 3-5 2" stroke="#AAB7B0" strokeWidth="0.6" />
        <path d="M63 14h8" stroke="#2B3933" strokeWidth="2.1" />
      </g>

      <g
        className={isMoving ? "cm-bike-leg-back" : ""}
        style={{ transformOrigin: standing ? "43px 23px" : "45px 28px" }}
        opacity="0.82"
        data-race-cyclist-anatomy="rear-leg"
      >
        <path
          d={standing
            ? "M39.9 21.7C37.6 24.1 35.5 27.8 35.1 31C36 32.5 38 33 39.4 32C40.4 28.9 42.4 26 44.8 23.8Z"
            : "M40.8 25.7C39.2 27.8 37.5 31.3 37.2 34.2C38 35.4 40 36 41.3 35.2C42 32.4 44.2 29.6 46.2 28.1Z"}
          fill="#17261E"
          stroke="#F4F7F5"
          strokeWidth="0.45"
        />
        <path
          d={standing
            ? "M35.3 30.2C36.1 35 38.5 40.4 41.2 44.4L44 44.1C42 39.5 40.5 34.9 39.1 30.7Z"
            : "M37.5 33.3C38.1 37 39.7 41 41.5 44.2L44.2 44.2C43 40 42.2 36.1 41 33.7Z"}
          fill={skin.skinTone}
          stroke={skin.skinShadow}
          strokeWidth="0.42"
        />
        <path
          d="M41 43.5 47.5 44.4 47 46.1 40.5 45.4Z"
          fill="#F5F7F6"
          stroke="#17261E"
          strokeWidth="0.42"
        />
      </g>
      <g
        className={isMoving ? "cm-bike-leg-front" : ""}
        style={{ transformOrigin: standing ? "43px 23px" : "45px 28px" }}
        data-race-cyclist-anatomy="front-leg"
      >
        <path
          d={standing
            ? "M42 21.8C45.7 23.7 49.4 27.2 51.2 31C50.7 32.6 48.8 33.4 47.5 32.2C45.6 28.9 43.1 26.4 40.5 24.5Z"
            : "M44.3 26.2C47.8 27.6 51.2 30.1 53 33.5C52.7 35.1 51 36.2 49.6 35.2C47.5 32.2 45.1 30.5 42.2 29.4Z"}
          fill="#17261E"
          stroke="#F4F7F5"
          strokeWidth="0.48"
        />
        <path
          d={standing
            ? "M47.6 31.2C48.7 35 48.6 39.6 47.5 44L50.2 45C51.9 40.6 52.2 35.5 51 31.1Z"
            : "M49.5 34C50.2 37 49.3 40.7 47.8 44L50.4 45C52.2 41.2 53.2 37.2 52.8 34.2Z"}
          fill={skin.skinTone}
          stroke={skin.skinShadow}
          strokeWidth="0.44"
        />
        <path
          d="M47.4 43.4 54.5 44.2 54 46.1 47 45.4Z"
          fill="#F5F7F6"
          stroke="#17261E"
          strokeWidth="0.44"
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
        data-race-cyclist-anatomy="torso"
        data-race-victory-torso={celebrating ? "upright" : undefined}
        fill={`url(#${visualId}-jersey-light)`}
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
      <rect
        x="31"
        y="8"
        width="29"
        height="24"
        clipPath={`url(#${clipId})`}
        fill={`url(#${visualId}-fabric)`}
        opacity="0.28"
        data-race-jersey-texture="technical-fabric"
      />
      {!celebrating ? (
        <>
          <path
            d={standing
              ? "M39 21.7C41.9 21 46.9 21.3 49.8 22.8L49.1 25.1C46.3 26.1 42.1 25.7 39.3 23.6Z"
              : "M40 25.1C42.7 24.4 47.7 24.8 50.9 26.2L49.7 29.2C46.8 30.3 42.6 30 40.5 28Z"}
            fill="#17261E"
            stroke="#F4F7F5"
            strokeWidth="0.45"
            data-race-cyclist-anatomy="pelvis"
          />
          <path
            d={standing
              ? "M48.7 10.2C52.5 10.8 55.2 12.7 57.4 16"
              : "M49.4 12.6C53.5 13.4 56.7 15.3 59.2 18.5"}
            fill="none"
            stroke={visual.secondaryColor}
            strokeWidth="3.8"
            strokeLinecap="round"
            data-race-cyclist-anatomy="rear-upper-arm"
          />
          <path
            d={standing
              ? "M57.2 15.8C59.1 18.8 61.9 19.3 64.1 18.3L70.6 14.3"
              : "M59 18.3C61 20.8 63.2 21.4 65.3 20.2L70.7 14.4"}
            fill="none"
            stroke={skin.skinTone}
            strokeWidth="2.45"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-race-cyclist-anatomy="rear-forearm"
          />
          <circle cx={standing ? 57.3 : 59.1} cy={standing ? 15.9 : 18.4} r="1.35" fill={skin.skinTone} />
        </>
      ) : null}
      {celebrating ? (
        <path
          d="M45.4 8.9 45.8 6.5M51.1 8.9 52.3 6.6"
          stroke={skin.skinTone}
          strokeWidth="2.6"
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
            d="M43 14C41 11 39.2 7.3 37 4C35 1 34-2.2 34-6M53 14C55 11 56.8 7.3 59 4C61 1 62-2.2 62-6"
            fill="none"
            stroke={skin.skinTone}
            strokeWidth="3.15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="37" cy="4" r="1.75" fill={skin.skinTone} />
          <circle cx="59" cy="4" r="1.75" fill={skin.skinTone} />
          <circle cx="34" cy="-6" r="1.85" fill={skin.skinTone} />
          <circle cx="62" cy="-6" r="1.85" fill={skin.skinTone} />
        </g>
      ) : (
        <>
          <path
            d={standing
              ? "M51.4 11C54.8 11.7 57.5 13.4 59.8 16.8"
              : "M53.2 14.3C56.5 14.8 59.2 16.3 61.5 19.2"}
            fill="none"
            stroke={visual.secondaryColor}
            strokeWidth="4.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-race-cyclist-anatomy="front-upper-arm"
          />
          <path
            d={standing
              ? "M59.6 16.6C61.1 19.2 63.2 20 65.3 19C67.3 17.3 69.2 15.6 71.2 14.2"
              : "M61.2 19C62.7 21.2 64.4 22 66.3 20.8C68.3 18.6 70 16.2 71.4 14.3"}
            fill="none"
            stroke={skin.skinTone}
            strokeWidth="2.65"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-race-cyclist-anatomy="front-forearm"
          />
          <circle cx={standing ? 59.7 : 61.4} cy={standing ? 16.7 : 19.2} r="1.45" fill={skin.skinTone} />
          <circle cx={standing ? 70.9 : 71.2} cy="14.3" r="1.25" fill={skin.skinTone} />
          <path
            d="m69.8 14.1 4 .1"
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
        data-race-cyclist-anatomy="head"
      />
      {!celebrating ? (
        <>
          <path d={standing ? "M53.7 10.4 56.6 7.5" : "M56.2 12.2 59.1 10.4"} stroke={skin.skinTone} strokeWidth="2.8" strokeLinecap="round" />
          <path d={standing ? "m62.8 4.5 2 1.25-2.1 1" : "m65.8 7.4 2 1.25-2.1 1"} fill={skin.skinTone} stroke={skin.skinShadow} strokeWidth="0.45" strokeLinejoin="round" />
          <circle cx={standing ? 62.1 : 65.1} cy={standing ? 5.1 : 8} r="0.45" fill="#17261E" />
          <path d={standing ? "M62.2 7.5c-1 .65-2 .72-2.8.22" : "M65.2 10.4c-1 .65-2 .72-2.8.22"} fill="none" stroke={skin.skinShadow} strokeWidth="0.42" strokeLinecap="round" />
        </>
      ) : null}
      <g
        data-race-helmet-team-colors="true"
        data-race-time-trial-helmet={timeTrial ? "aero" : undefined}
      >
        <path
          d={
            celebrating
              ? "M43.6 4.3c.2-4.1 3.2-5.8 6.5-4.9 2.5.7 3.8 2.4 3.8 4.3l-5.4-1Z"
              : standing
                ? "M54.6 5.5c.2-4.3 3.4-6.2 6.9-5.2 2.7.8 4.2 2.7 4.2 4.7L59 3.9Z"
              : timeTrial
                ? "M52 7.1 58 4.2c2.5-2 6.3-1.8 8.8.2 1.7 1.3 2.4 2.7 2.3 4.1l-6.2-1.2-5.3 1.5Z"
                : "M57.6 8.5c.2-4.3 3.4-6.2 6.9-5.2 2.7.8 4.2 2.7 4.2 4.7l-5.7-1.1Z"
          }
          fill={`url(#${visualId}-helmet-shell)`}
          stroke="#071A17"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
        <path
          d={celebrating
            ? "m46 0 2.8 2.5 2-1.9"
            : standing
              ? "m57.2 1.2 3.1 2.7 2.2-2.1"
              : "m60.2 4.2 3.1 2.7 2.2-2.1"}
          fill={helmet.secondary}
        />
        <path
          d={
            celebrating
              ? "m46.1 0 .8 2m1.8-2.5.2 2.6m2-1.5-.5 2"
              : standing
                ? "m57.3 1.2.9 2.1m2-2.7.2 2.8m2.2-1.7-.5 2.1"
                : "m60.3 4.2.9 2.1m2-2.7.2 2.8m2.2-1.7-.5 2.1"
          }
          stroke={helmet.accent}
          strokeWidth="0.6"
          strokeLinecap="round"
        />
        <path
          d={celebrating
            ? "M45.5 2.1q3-2.2 6.1.2"
            : standing
              ? "M56.3 3.1q3.7-2.4 7.4.2"
              : "M59.3 6.1q3.7-2.4 7.4.2"}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="0.45"
          strokeLinecap="round"
          opacity="0.6"
          data-race-helmet-texture="vented-shell"
        />
      </g>
      <path
        d={celebrating
          ? "m51.4 4.3-2 3.4"
          : standing
            ? "m63.4 5.6-2 3.4"
            : "m66.4 8.6-2 3.4"}
        stroke="#263B32"
        strokeWidth="0.65"
      />
      <path
        d={celebrating
          ? "M49 4.8h4"
          : standing
            ? "M60 6.3h4"
            : "M63 9.3h4"}
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
  tireGradientId,
}: {
  cx: number;
  moving: boolean;
  disc?: boolean;
  tireGradientId: string;
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
        stroke={`url(#${tireGradientId})`}
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
    if (visual.status === "national-team" && visual.nationalDesign) {
      return (
        <NationalJerseyDesignPattern
          countryCode={visual.countryCode}
          design={visual.nationalDesign}
          idPrefix={`${clipId}-design`}
          clipPathId={clipId}
          width={90}
          height={mode === "side" ? 56 : 42}
        />
      );
    }
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
