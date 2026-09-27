import { useId, type CSSProperties } from "react";

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
  const morphology = getRaceCyclistMorphology(rider);
  const pattern = getRaceCyclistTeamKitPattern(rider);
  const wearsGlasses = stableRaceVisualHash(rider.id) % 3 !== 0;
  const visualId = `detailed-side-${useId().replace(/:/g, "")}`;
  const clipId = `${visualId}-jersey`;
  const label = `${rider.name} · ${rider.teamName} · ${visual.label}`;
  const standing = ridingPose === "standing" && !celebrating;
  const pedalCycleDuration = getRacePedalCycleDuration(effort);
  const torsoPath = celebrating
    ? "M42 10C39.8 12.3 39.2 16.1 39.8 20.7L40.8 27.7C44.1 29.2 49.9 29.2 53.2 27.8L55.6 20C56.7 15.7 55 11.9 52.6 10C49.5 8.7 45.1 8.7 42 10Z"
    : standing
      ? "M39.2 23.5C38.8 19.2 39.6 14.4 42.4 10.9C44.7 8.1 48.4 7.5 51.5 9.1L56 12.2C57.7 13.2 58.1 15.1 56.9 16.7L49.1 24.3C46.4 26 42.1 25.7 39.2 23.5Z"
      : "M39 23.2C39.4 18.2 41.5 13.1 45.2 10.8C48.4 8.7 51.8 9.1 54.8 11.2L59.2 14C60.7 15 60.6 16.8 58.8 18.3L51.3 24C47.1 25.7 42.4 25.5 39 23.2Z";
  const head = celebrating
    ? { cx: 48, cy: 4.5 }
    : standing
      ? { cx: 59, cy: 5.8 }
      : { cx: 63, cy: 8.5 };
  const bodyTransform = getVisualScaleMatrix({
    scaleX: morphology.breadthScale,
    scaleY: morphology.heightScale,
    originX: 41,
    originY: 24,
  });
  const riderMotionStyle = {
    "--cm-rider-bob-y": `${morphology.bobAmplitudePx}px`,
    "--cm-pedal-cycle-duration": pedalCycleDuration,
  } as CSSProperties;

  return (
    <svg
      viewBox="0 0 90 56"
      role="img"
      aria-label={label}
      data-race-cyclist-effort={effort}
      data-race-cyclist-direction="finish-right"
      data-race-cyclist-pose={standing ? "standing-climb" : "seated"}
      data-race-rider-morphology={morphology.profile}
      data-race-rider-height-cm={rider.physiology?.heightCm}
      data-race-rider-weight-kg={rider.physiology?.weightKg}
      data-race-pedal-cycle-duration={pedalCycleDuration}
      style={riderMotionStyle}
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
        <linearGradient id={`${visualId}-shorts`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#26342F" />
          <stop offset="0.42" stopColor="#101916" />
          <stop offset="0.72" stopColor="#25352F" />
          <stop offset="1" stopColor="#070B0A" />
        </linearGradient>
        <linearGradient id={`${visualId}-skin-light`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF8F0" stopOpacity="0.42" />
          <stop offset="0.38" stopColor={skin.skinTone} stopOpacity="0" />
          <stop offset="1" stopColor={skin.skinShadow} stopOpacity="0.34" />
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
        data-race-bike-detail="competition-road"
      >
        <g data-race-bike-component="carbon-frame">
          <path
            d="M18 42 38.5 25.2 48 42 18 42M38.5 25.2 58 22.5 48 42Z"
            stroke="#14241E"
            strokeWidth="3.35"
          />
          <path
            d="M18 42 38.5 25.2 48 42 18 42M38.5 25.2 58 22.5 48 42Z"
            stroke={`url(#${visualId}-frame)`}
            strokeWidth="2.25"
          />
          <path d="M39 25.7 57.6 23M19 41.4 38.4 25.8M48.4 41.1 57.7 23.7" stroke="#F4FAF7" strokeWidth="0.62" opacity="0.7" data-race-bike-detail="carbon-highlights" />
          <path d="M38.5 25.2 36.8 22.1" stroke="#82968D" strokeWidth="1.3" data-race-bike-detail="aero-seatpost" />
          <path d="M45.6 33.2 51.5 34.8" stroke={visual.accentColor} strokeWidth="1.2" opacity="0.9" data-race-bike-detail="team-frame-livery" />
          <text x="46.7" y="32.6" fontSize="2.3" fontWeight="900" letterSpacing="0.35" fill="#F7FBF9" transform="rotate(59 46.7 32.6)">CS</text>
        </g>

        <g data-race-bike-component="anatomic-saddle">
          <path d="M31.8 22.5C35.5 20.8 39.6 21.1 42.1 22.2l-1.1 1.7c-3.2-.6-6.5-.5-9.2.3Z" fill="#17261E" stroke="#D4DED9" strokeWidth="0.55" data-race-bike-detail="anatomic-saddle" />
          <path d="M34 22.1q3.4-.8 6.1.2" stroke="#83958D" strokeWidth="0.5" opacity="0.82" />
        </g>

        <g data-race-bike-component="cockpit">
          <path d="M58 22.5 60.5 25.7 72 42" stroke="#193029" strokeWidth="2.25" data-race-bike-detail="tapered-fork" />
          <path d="M58.2 22.8 60 25.8 71.5 41.4" stroke="#E2ECE7" strokeWidth="0.62" opacity="0.82" />
          <path d="M58 22.5 63.1 14.1 67.6 12.6" stroke="#233A33" strokeWidth="1.55" />
          <path d="M62.4 14.2h8.2c1.2 0 1.8.8 1.2 1.8l-2.4 3.2c-.8 1.1-.3 2.5 1.2 2.9" stroke="#17261E" strokeWidth="1.65" data-race-bike-detail="professional-drop-bars" />
          <path d="M63.2 13.5h7.4" stroke="#DCE8E2" strokeWidth="0.68" opacity="0.9" />
          <path d="M69.9 14.9v3.2M68.6 18.8l2.2.9" stroke={visual.accentColor} strokeWidth="0.7" data-race-bike-detail="integrated-hoods" />
        </g>

        <g data-race-bike-component="disc-brakes">
          {[18, 72].map((wheelX) => (
            <g key={wheelX}>
              <circle cx={wheelX} cy="42" r="3.35" stroke="#D8E2DD" strokeWidth="0.56" strokeDasharray="1.35 0.78" />
              <circle cx={wheelX} cy="42" r="2.1" stroke="#75877F" strokeWidth="0.46" />
            </g>
          ))}
          <path d="M20.2 39.8h2.7v3.6M68.6 37.8l2.8 1.4-1.1 3" stroke="#263C35" strokeWidth="1.15" data-race-bike-detail="hydraulic-calipers" />
        </g>

        <g data-race-bike-component="drivetrain">
          <circle cx="48" cy="42" r="3.55" stroke="#E1E8E4" strokeWidth="0.85" strokeDasharray="1.2 0.72" data-race-bike-detail="toothed-chainring" />
          <circle cx="48" cy="42" r="1.15" fill="#263A33" stroke="#F1F5F3" strokeWidth="0.48" />
          <path d="M48.5 38.8 20.2 39.7M48.3 45.1 20.2 43.2" stroke="#B9C7C0" strokeWidth="0.58" data-race-bike-detail="chain" />
          <g data-race-bike-detail="electronic-cassette">
            <circle cx="19.2" cy="41.5" r="2.2" stroke="#D3DDD8" strokeWidth="0.62" />
            <circle cx="19.2" cy="41.5" r="1.45" stroke="#778981" strokeWidth="0.48" />
            <circle cx="19.2" cy="41.5" r="0.72" fill="#4C5E56" />
          </g>
          <path d="M20 43.3 23.1 45.6 25.1 44.6m-2 1 1.2 2.1" stroke="#61736A" strokeWidth="0.72" data-race-bike-detail="electronic-derailleur" />
        </g>

        <g data-race-bike-component="hydration">
          <path d="M42.3 27.8h4.4l1 1.3-2.2 8.2-5-.1-1-1.2 2.1-7.4Z" fill="#E9F0EC" stroke="#4E655C" strokeWidth="0.62" data-race-bike-detail="aero-bottle" />
          <path d="M41.5 30.1 46.7 34M41 35.2h4.9" stroke={visual.accentColor} strokeWidth="0.65" opacity="0.92" />
          <path d="M39.3 28.2q4.4-2.1 8.7.2" stroke="#74867D" strokeWidth="0.62" data-race-bike-detail="bottle-cage" />
        </g>

        <g data-race-bike-component="cables" opacity="0.86">
          <path d="M67.4 13.1Q52 10.2 36.8 22.2M70.2 15.1Q68 28 70.4 39.3" stroke="#334C43" strokeWidth="0.58" data-race-bike-detail="integrated-cables" />
          <path d="M69.7 14.8Q57.5 17.4 48.4 40" stroke="#91A59C" strokeWidth="0.38" />
        </g>
      </g>

      <SynchronizedPedalingRig
        isMoving={isMoving}
        duration={pedalCycleDuration}
        standing={standing}
        shortsGradientId={`${visualId}-shorts`}
        skinTone={skin.skinTone}
        skinShadow={skin.skinShadow}
        shoeAccent={visual.accentColor}
        thighScale={morphology.breadthScale}
      />

      <g
        transform={bodyTransform}
        data-race-rider-proportions="physiology-scaled"
      >
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
        <path
          d={celebrating ? "M48 10.2v17" : standing ? "M49.2 9.2 45.7 24" : "M50.1 11.1 45.6 27.5"}
          clipPath={`url(#${clipId})`}
          stroke="#EAF1ED"
          strokeWidth="0.34"
          opacity="0.58"
          data-race-jersey-detail="zipper"
        />
        <path
          d={celebrating ? "M44 10q4 3 8 0" : standing ? "M42.4 11q3.8 2.6 7.4.2" : "M45.2 10.8q3.4 2.6 7.2.6"}
          fill="none"
          stroke="#17261E"
          strokeWidth="0.65"
          opacity="0.8"
          data-race-jersey-detail="technical-collar"
        />
        {!celebrating ? (
          <>
            <path
              d={standing ? "M40.1 21.3q4.5 1.5 9.1.6" : "M39.2 22.4q5.3 2 10.6.9"}
              fill="none"
              stroke={visual.accentColor}
              strokeWidth="0.72"
              opacity="0.88"
              data-race-jersey-detail="rear-pocket"
            />
            <path
              d={standing ? "M41.1 12.3q-2 5.4-.8 10.1" : "M43.2 12.3q-3.5 5.8-3.2 11.6"}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.58"
              opacity="0.46"
              data-race-jersey-detail="side-panel-seam"
            />
            <path
              d={standing ? "M43 10.6q5-2.4 9 .7" : "M46 10.3q5-1.7 8.5 1.7"}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.72"
              opacity="0.5"
              data-race-jersey-detail="shoulder-highlight"
            />
          </>
        ) : null}
      {!celebrating ? (
        <>
          <path
            d={standing
              ? "M39 21.7C41.9 21 46.9 21.3 49.8 22.8L49.1 25.1C46.3 26.1 42.1 25.7 39.3 23.6Z"
              : "M37.2 20.6C40.8 19.8 46.6 21.1 50 23.6L49 27.5C45.8 28.9 41.3 27.7 39.1 25.6C37.9 24.1 37.2 22.4 37.2 20.6Z"}
            fill={`url(#${visualId}-shorts)`}
            stroke="#394B44"
            strokeWidth="0.45"
            data-race-cyclist-anatomy="pelvis"
          />
          <path
            d={standing ? "M39.7 22.2q4.6 1.9 9.3.6M43.3 23.7l1.5 1.8" : "M38.4 22.2q5.4 3.3 10.9 2M42.2 24.2l1.4 2.8"}
            fill="none"
            stroke="#70847A"
            strokeWidth="0.62"
            opacity="0.86"
            data-race-shorts-detail="compression-panels"
          />
          <g
            className={isMoving ? "cm-bike-arm-rear" : ""}
            style={{ transformOrigin: standing ? "49px 11px" : "53px 14px" }}
            data-race-cyclist-joint="rear-shoulder"
          >
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
            d={standing ? "M52.1 11.3 54.6 13.1" : "M53 13.6 55.7 15"}
            stroke={visual.accentColor}
            strokeWidth="1.05"
            strokeLinecap="round"
            data-race-jersey-detail="rear-sleeve-gripper"
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
          </g>
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
          <g
            className={isMoving ? "cm-bike-arm-front" : ""}
            style={{ transformOrigin: standing ? "51px 11px" : "53px 14px" }}
            data-race-cyclist-joint="front-shoulder"
          >
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
            d={standing ? "M54.4 12 57 14" : "M56.1 15.1 58.7 16.9"}
            stroke={visual.accentColor}
            strokeWidth="1.12"
            strokeLinecap="round"
            data-race-jersey-detail="front-sleeve-gripper"
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
          <circle cx={standing ? 70.9 : 71.2} cy="14.3" r="1.45" fill="#17261E" stroke={visual.accentColor} strokeWidth="0.55" data-race-rider-equipment="glove" />
          <path
            d="m69.8 14.1 4 .1"
            stroke="#E5ECE8"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          </g>
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
      <circle
        cx={head.cx - 0.4}
        cy={head.cy - 0.45}
        r="3.7"
        fill={`url(#${visualId}-skin-light)`}
        opacity="0.58"
        data-race-face-detail="skin-volume"
      />
      {!celebrating ? (
        <>
          <path d={standing ? "M53.7 10.4 56.6 7.5" : "M56.2 12.2 59.1 10.4"} stroke={skin.skinTone} strokeWidth="2.8" strokeLinecap="round" />
          <circle cx={standing ? 55.8 : 58.8} cy={standing ? 6.2 : 9.2} r="1.05" fill={skin.skinTone} stroke={skin.skinShadow} strokeWidth="0.36" data-race-face-detail="ear" />
          <path d={standing ? "m62.8 4.5 2 1.25-2.1 1" : "m65.8 7.4 2 1.25-2.1 1"} fill={skin.skinTone} stroke={skin.skinShadow} strokeWidth="0.45" strokeLinejoin="round" />
          <circle cx={standing ? 62.1 : 65.1} cy={standing ? 5.1 : 8} r="0.45" fill="#17261E" />
          <path d={standing ? "M62.2 7.5c-1 .65-2 .72-2.8.22" : "M65.2 10.4c-1 .65-2 .72-2.8.22"} fill="none" stroke={skin.skinShadow} strokeWidth="0.42" strokeLinecap="round" />
          <path d={standing ? "M59.2 8.8q2.3 1.5 4.3-.1" : "M62.2 11.8q2.3 1.5 4.3-.1"} fill="none" stroke={skin.skinShadow} strokeWidth="0.34" opacity="0.72" data-race-face-detail="jaw" />
          {wearsGlasses ? (
            <g data-race-face-equipment="wraparound-glasses">
              <path d={standing ? "M59.1 4.6q3-1.4 5.7.5l-1.4 1.6-3.8-.4Z" : "M62.1 7.6q3-1.4 5.7.5l-1.4 1.6-3.8-.4Z"} fill="#193E42" fillOpacity="0.86" stroke="#B9D7D0" strokeWidth="0.34" />
              <path d={standing ? "M59.2 4.9 56.4 5.8" : "M62.2 7.9 59.4 8.8"} stroke="#1A2C28" strokeWidth="0.48" />
            </g>
          ) : null}
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
        <path
          d={celebrating
            ? "M45.2 3.6q2.8-1.5 6.8-.1"
            : standing
              ? "M56.1 5q3.6-1.8 7.8-.2"
              : "M59.1 8q3.6-1.8 7.8-.2"}
          fill="none"
          stroke="#071A17"
          strokeWidth="0.42"
          strokeDasharray="1.1 0.9"
          opacity="0.74"
          data-race-helmet-detail="aero-vents"
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
        data-race-rider-equipment="helmet-y-strap"
      />
      {!celebrating ? (
        <path
          d={standing ? "M59.3 6.8 61.2 9.1 63.4 5.6" : "M62.3 9.8 64.2 12.1 66.4 8.6"}
          fill="none"
          stroke="#354D44"
          strokeWidth="0.5"
          strokeLinecap="round"
          data-race-helmet-detail="retention-system"
        />
      ) : null}
      <path
        d={celebrating
          ? "M49 4.8h4"
          : standing
            ? "M60 6.3h4"
            : "M63 9.3h4"}
        stroke="#17261E"
        strokeWidth="0.55"
      />
      </g>
    </svg>
  );
}

type PedalPoint = { x: number; y: number };

const PEDAL_KEY_TIMES = "0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1";
const FRONT_PEDAL_POINTS: PedalPoint[] = [
  { x: 54, y: 42 },
  { x: 52.24, y: 46.24 },
  { x: 48, y: 48 },
  { x: 43.76, y: 46.24 },
  { x: 42, y: 42 },
  { x: 43.76, y: 37.76 },
  { x: 48, y: 36 },
  { x: 52.24, y: 37.76 },
  { x: 54, y: 42 },
];
const REAR_PEDAL_POINTS: PedalPoint[] = [
  { x: 42, y: 42 },
  { x: 43.76, y: 37.76 },
  { x: 48, y: 36 },
  { x: 52.24, y: 37.76 },
  { x: 54, y: 42 },
  { x: 52.24, y: 46.24 },
  { x: 48, y: 48 },
  { x: 43.76, y: 46.24 },
  { x: 42, y: 42 },
];
const FRONT_KNEE_POINTS: PedalPoint[] = [
  { x: 54.94, y: 29.05 },
  { x: 52.7, y: 33.23 },
  { x: 50.55, y: 35.24 },
  { x: 50.62, y: 35.18 },
  { x: 52.11, y: 33.84 },
  { x: 54.47, y: 30.38 },
  { x: 55.51, y: 25.38 },
  { x: 55.49, y: 25.18 },
  { x: 54.94, y: 29.05 },
];
const REAR_KNEE_POINTS: PedalPoint[] = [
  { x: 50.78, y: 32.41 },
  { x: 52.89, y: 28.53 },
  { x: 53.5, y: 24.21 },
  { x: 53.49, y: 24.83 },
  { x: 52.71, y: 29.07 },
  { x: 49.73, y: 33.5 },
  { x: 47.8, y: 35.01 },
  { x: 48.86, y: 34.28 },
  { x: 50.78, y: 32.41 },
];

function SynchronizedPedalingRig({
  isMoving,
  duration,
  standing,
  shortsGradientId,
  skinTone,
  skinShadow,
  shoeAccent,
  thighScale,
}: {
  isMoving: boolean;
  duration: string;
  standing: boolean;
  shortsGradientId: string;
  skinTone: string;
  skinShadow: string;
  shoeAccent: string;
  thighScale: number;
}) {
  const frontHip = standing ? { x: 43.2, y: 23.1 } : { x: 43.5, y: 25.5 };
  const rearHip = standing ? { x: 41.4, y: 22.8 } : { x: 41.5, y: 24.8 };
  const boundedThighScale = Math.max(0.88, Math.min(1.12, thighScale));
  const frontThigh = buildCurvedPathValues(frontHip, FRONT_KNEE_POINTS, 0.55);
  const rearThigh = buildCurvedPathValues(rearHip, REAR_KNEE_POINTS, 0.38);
  const frontShorts = buildCurvedPathValues(
    frontHip,
    FRONT_KNEE_POINTS.map((point) => interpolatePoint(frontHip, point, 0.58)),
    0.42,
  );
  const rearShorts = buildCurvedPathValues(
    rearHip,
    REAR_KNEE_POINTS.map((point) => interpolatePoint(rearHip, point, 0.58)),
    0.3,
  );
  const frontCalf = buildMovingPathValues(FRONT_KNEE_POINTS, FRONT_PEDAL_POINTS, -0.34);
  const rearCalf = buildMovingPathValues(REAR_KNEE_POINTS, REAR_PEDAL_POINTS, -0.24);
  const crank = FRONT_PEDAL_POINTS.map((point, index) => {
    const rearPoint = REAR_PEDAL_POINTS[index];
    return `M48 42L${formatPedalPoint(point)}M48 42L${formatPedalPoint(rearPoint)}`;
  });

  return (
    <g
      data-race-pedal-rig="synchronized"
      data-race-pedaling={isMoving ? "active" : "still"}
      data-race-rider-proportions="bike-anchored"
      className="cm-bike-pedal-sync"
    >
      <g opacity="0.78" data-race-cyclist-anatomy="rear-leg">
        <AnimatedPedalPath
          values={rearThigh}
          duration={duration}
          isMoving={isMoving}
          stroke={skinShadow}
          strokeWidth={5.8 * boundedThighScale}
        />
        <AnimatedPedalPath
          values={rearThigh}
          duration={duration}
          isMoving={isMoving}
          stroke={skinTone}
          strokeWidth={4.9 * boundedThighScale}
        />
        <AnimatedPedalPath
          values={rearShorts}
          duration={duration}
          isMoving={isMoving}
          stroke={`url(#${shortsGradientId})`}
          strokeWidth={5.35 * boundedThighScale}
        />
        <g data-race-cyclist-joint="rear-knee">
          <AnimatedPedalPath
            values={rearCalf}
            duration={duration}
            isMoving={isMoving}
            stroke={skinShadow}
            strokeWidth={3.35}
          />
          <AnimatedPedalPath
            values={rearCalf}
            duration={duration}
            isMoving={isMoving}
            stroke={skinTone}
            strokeWidth={2.55}
          />
          <AnimatedKneeJoint
            points={REAR_KNEE_POINTS}
            duration={duration}
            isMoving={isMoving}
            fill={skinTone}
            stroke={skinShadow}
            radius={1.72}
          />
        </g>
      </g>

      <AnimatedPedalPath
        values={crank}
        duration={duration}
        isMoving={isMoving}
        stroke="#17261E"
        strokeWidth={1.25}
      />
      <circle cx="48" cy="42" r="1.75" fill="#D6DED9" stroke="#17261E" strokeWidth="0.7" />
      <PedalLockedShoe
        side="rear"
        points={REAR_PEDAL_POINTS}
        duration={duration}
        isMoving={isMoving}
        accent={shoeAccent}
        opacity={0.82}
      />

      <g data-race-cyclist-anatomy="front-leg">
        <AnimatedPedalPath
          values={frontThigh}
          duration={duration}
          isMoving={isMoving}
          stroke={skinShadow}
          strokeWidth={6.45 * boundedThighScale}
        />
        <AnimatedPedalPath
          values={frontThigh}
          duration={duration}
          isMoving={isMoving}
          stroke={skinTone}
          strokeWidth={5.55 * boundedThighScale}
        />
        <AnimatedPedalPath
          values={frontShorts}
          duration={duration}
          isMoving={isMoving}
          stroke={`url(#${shortsGradientId})`}
          strokeWidth={6.05 * boundedThighScale}
        />
        <g data-race-cyclist-joint="front-knee">
          <AnimatedPedalPath
            values={frontCalf}
            duration={duration}
            isMoving={isMoving}
            stroke={skinShadow}
            strokeWidth={3.75}
          />
          <AnimatedPedalPath
            values={frontCalf}
            duration={duration}
            isMoving={isMoving}
            stroke={skinTone}
            strokeWidth={2.9}
          />
          <AnimatedKneeJoint
            points={FRONT_KNEE_POINTS}
            duration={duration}
            isMoving={isMoving}
            fill={skinTone}
            stroke={skinShadow}
            radius={1.92}
          />
        </g>
      </g>
      <PedalLockedShoe
        side="front"
        points={FRONT_PEDAL_POINTS}
        duration={duration}
        isMoving={isMoving}
        accent={shoeAccent}
      />
    </g>
  );
}

function AnimatedKneeJoint({
  points,
  duration,
  isMoving,
  fill,
  stroke,
  radius,
}: {
  points: PedalPoint[];
  duration: string;
  isMoving: boolean;
  fill: string;
  stroke: string;
  radius: number;
}) {
  return (
    <circle
      cx={points[0].x}
      cy={points[0].y}
      r={radius}
      fill={fill}
      stroke={stroke}
      strokeWidth="0.48"
      data-race-cyclist-anatomy="articulated-kneecap"
    >
      {isMoving ? (
        <>
          <animate attributeName="cx" values={points.map((point) => point.x).join(";")} keyTimes={PEDAL_KEY_TIMES} dur={duration} calcMode="linear" repeatCount="indefinite" />
          <animate attributeName="cy" values={points.map((point) => point.y).join(";")} keyTimes={PEDAL_KEY_TIMES} dur={duration} calcMode="linear" repeatCount="indefinite" />
        </>
      ) : null}
    </circle>
  );
}

function AnimatedPedalPath({
  values,
  duration,
  isMoving,
  stroke,
  strokeWidth,
}: {
  values: string[];
  duration: string;
  isMoving: boolean;
  stroke: string;
  strokeWidth: number;
}) {
  return (
    <path
      d={values[0]}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isMoving ? (
        <animate
          attributeName="d"
          values={values.join(";")}
          keyTimes={PEDAL_KEY_TIMES}
          dur={duration}
          calcMode="linear"
          repeatCount="indefinite"
        />
      ) : null}
    </path>
  );
}

function PedalLockedShoe({
  side,
  points,
  duration,
  isMoving,
  accent,
  opacity = 1,
}: {
  side: "front" | "rear";
  points: PedalPoint[];
  duration: string;
  isMoving: boolean;
  accent: string;
  opacity?: number;
}) {
  const translations = points.map((point) => `${point.x} ${point.y}`).join(";");
  return (
    <g
      transform={`translate(${points[0].x} ${points[0].y})`}
      opacity={opacity}
      data-race-foot-contact={side}
      data-race-pedal-platform={side}
    >
      {isMoving ? (
        <animateTransform
          attributeName="transform"
          type="translate"
          values={translations}
          keyTimes={PEDAL_KEY_TIMES}
          dur={duration}
          calcMode="linear"
          repeatCount="indefinite"
        />
      ) : null}
      <path
        d="M-2.7-1.5 2.9-1.15 5.3.15 4.6 1.35-2.9.8Z"
        fill="#F5F7F6"
        stroke="#17261E"
        strokeWidth="0.56"
        data-race-cyclist-anatomy={`${side}-shoe`}
      />
      <path d="M-2.2-2.7 1.8-2.4 2.5-1.1-2.4-.9Z" fill="#F4F6F5" stroke="#263B34" strokeWidth="0.42" data-race-rider-equipment="aero-sock" />
      <path d="M-1.8-.55h4.6" stroke={accent} strokeWidth="0.42" opacity="0.92" />
      <path d="M-2.4 1.25h5.1" stroke="#E9EFEC" strokeWidth="1.05" strokeLinecap="round" />
      <circle r="0.62" fill="#17261E" stroke="#DCE6E1" strokeWidth="0.32" data-race-rider-equipment="pedal-cleat" />
    </g>
  );
}

function buildCurvedPathValues(
  start: PedalPoint,
  endpoints: PedalPoint[],
  curveBias: number,
) {
  return endpoints.map((end) => {
    const control = {
      x: start.x + (end.x - start.x) * 0.52 + curveBias,
      y: start.y + (end.y - start.y) * 0.48,
    };
    return `M${formatPedalPoint(start)}Q${formatPedalPoint(control)} ${formatPedalPoint(end)}`;
  });
}

function buildMovingPathValues(
  starts: PedalPoint[],
  endpoints: PedalPoint[],
  curveBias: number,
) {
  return endpoints.map((end, index) => {
    const start = starts[index];
    const control = {
      x: start.x + (end.x - start.x) * 0.5 + curveBias,
      y: start.y + (end.y - start.y) * 0.5,
    };
    return `M${formatPedalPoint(start)}Q${formatPedalPoint(control)} ${formatPedalPoint(end)}`;
  });
}

function interpolatePoint(start: PedalPoint, end: PedalPoint, ratio: number) {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

function formatPedalPoint(point: PedalPoint) {
  return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
}

function getRacePedalCycleDuration(effort: RaceRiderVisualEffort) {
  if (effort === "relay" || effort === "chase") return "0.38s";
  if (effort === "sheltered") return "0.62s";
  return "0.5s";
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
  const morphology = getRaceCyclistMorphology(rider);
  const pattern = getRaceCyclistTeamKitPattern(rider);
  const clipId = `detailed-top-jersey-${useId().replace(/:/g, "")}`;
  const label = `${rider.name} · ${rider.teamName} · ${visual.label}`;

  return (
    <svg
      viewBox="0 0 90 42"
      role="img"
      aria-label={label}
      data-race-rider-morphology={morphology.profile}
      data-race-rider-height-cm={rider.physiology?.heightCm}
      data-race-rider-weight-kg={rider.physiology?.weightKg}
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
        <path d="M12 21 36 15.3M12 21 36 26.7M53 21 78 21" stroke="#9EAEA7" strokeWidth="0.42" opacity="0.72" />
        <ellipse cx="11" cy="21" rx="3" ry="1.2" stroke="#BECAC4" strokeWidth="0.42" />
        <ellipse cx="79" cy="21" rx="3" ry="1.2" stroke="#BECAC4" strokeWidth="0.42" />
        <path d="M64 12q4-2.2 8.8-.3M64 30q4 2.2 8.8.3" stroke="#344840" strokeWidth="0.52" />
      </g>
      <g
        transform={getVisualScaleMatrix({
          scaleX: morphology.heightScale,
          scaleY: morphology.breadthScale,
          originX: 47,
          originY: 21,
        })}
        data-race-rider-proportions="physiology-scaled"
      >
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
      <path d="M34 21h26" stroke="#FFFFFF" strokeWidth="0.35" opacity="0.34" data-race-jersey-detail="zipper" />
      <ellipse cx="47" cy="21" rx="13.2" ry="7.8" fill="none" stroke="#071A17" strokeWidth="0.35" opacity="0.28" data-race-jersey-detail="panel-seams" />
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
        <path d="M63.8 18.2q2.8-1.3 5.5-.1" fill="none" stroke="#071A17" strokeWidth="0.36" strokeDasharray="1 .8" data-race-helmet-detail="aero-vents" />
      </g>
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

export function getRaceCyclistMorphology(
  rider: Pick<RiderSimulationInput, "id" | "physiology">,
) {
  const physiology = rider.physiology;
  if (
    !physiology ||
    !Number.isFinite(physiology.heightCm) ||
    !Number.isFinite(physiology.weightKg) ||
    physiology.heightCm < 145 ||
    physiology.weightKg < 40
  ) {
    return {
      heightScale: 1,
      breadthScale: 1,
      bobAmplitudePx: 1.5,
      profile: "neutral" as const,
    };
  }

  const bodyMassIndex =
    physiology.weightKg / (physiology.heightCm / 100) ** 2;
  const heightScale = roundVisualScale(
    clampVisual(1 + (physiology.heightCm - 177) * 0.004, 0.94, 1.06),
  );
  const breadthScale = roundVisualScale(
    clampVisual(1 + (bodyMassIndex - 21.7) * 0.018, 0.94, 1.08),
  );
  const profile =
    bodyMassIndex <= 20.5
      ? "slender"
      : bodyMassIndex >= 23
        ? "powerful"
        : physiology.heightCm >= 184
          ? "tall"
          : "balanced";

  return {
    heightScale,
    breadthScale,
    bobAmplitudePx: roundVisualScale(
      clampVisual(1.35 + (physiology.weightKg - 68) * 0.008, 1.15, 1.68),
    ),
    profile,
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
  const spokes = Array.from({ length: 12 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 12;
    return {
      hubX: cx + (index % 2 === 0 ? 0.72 : -0.72),
      hubY: 42 + (index % 3 === 0 ? 0.42 : -0.32),
      x: cx + Math.cos(angle) * 9.75,
      y: 42 + Math.sin(angle) * 9.75,
    };
  });

  return (
    <g data-race-wheel={disc ? "rear-disc" : "spoked"} data-race-wheel-detail="professional-road-wheel">
      <circle
        cx={cx}
        cy="42"
        r="11.7"
        fill="rgba(7,26,23,0.12)"
        stroke={`url(#${tireGradientId})`}
        strokeWidth="2.3"
      />
      <circle cx={cx} cy="42" r="10.65" fill="none" stroke="#202E29" strokeWidth="1.15" data-race-wheel-detail="carbon-rim" />
      <circle
        className={moving ? "cm-bike-wheel" : ""}
        cx={cx}
        cy="42"
        r="10.4"
        fill={disc ? "#26322D" : "none"}
        stroke="#BFCBC5"
        strokeWidth="0.72"
        strokeDasharray={disc ? undefined : "3.6 1.15"}
      />
      <circle cx={cx} cy="42" r="9.72" fill="none" stroke="#EEF3F0" strokeWidth="0.42" opacity="0.8" data-race-wheel-detail="machined-rim-edge" />
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
        spokes.map(({ hubX, hubY, x, y }, index) => (
          <path
            key={index}
            d={`M${hubX} ${hubY} ${x} ${y}`}
            stroke="#C8D4CE"
            strokeOpacity="0.78"
            strokeWidth="0.44"
          />
        ))
      )}
      <path d={`M${cx + 0.8} 31.7v2.4`} stroke="#E5EBE8" strokeWidth="0.65" strokeLinecap="round" data-race-wheel-detail="valve" />
      <path d={`M${cx - 7.8} 35.6q2.5-3 5.2-3.5M${cx + 5.5} 48.6q-2.2 2.1-5.1 2.8`} fill="none" stroke="#F4F8F6" strokeWidth="0.72" opacity="0.74" data-race-wheel-detail="rim-branding" />
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
  if (
    visual.status === "team" &&
    rider.teamJersey?.status === "sponsored" &&
    rider.teamJersey.imagePath
  ) {
    return (
      <SponsorRaceJerseyArtwork
        clipId={clipId}
        imagePath={rider.teamJersey.imagePath}
        mode={mode}
      />
    );
  }

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

function SponsorRaceJerseyArtwork({
  clipId,
  imagePath,
  mode,
}: {
  clipId: string;
  imagePath: string;
  mode: "side" | "top";
}) {
  const side = mode === "side";

  return (
    <g
      clipPath={`url(#${clipId})`}
      data-race-jersey-artwork="official-team-kit"
    >
      <svg
        x={side ? 30 : 27}
        y={side ? 6 : 6}
        width={side ? 38 : 42}
        height={side ? 28 : 30}
        viewBox={side ? "0 20 600 430" : "0 12 600 390"}
        preserveAspectRatio="xMidYMid slice"
        overflow="hidden"
      >
        <image
          href={imagePath}
          x="0"
          y="0"
          width="600"
          height="750"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
      <path
        d={side ? "M39 25q8 3 17-4" : "M34 21q13 7 27 0"}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="0.5"
        opacity="0.18"
      />
    </g>
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

function stableRaceVisualHash(value: string) {
  return [...value].reduce(
    (total, character) =>
      (total * 31 + character.charCodeAt(0)) >>> 0,
    17,
  );
}

function roundVisualScale(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clampVisual(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function getVisualScaleMatrix({
  scaleX,
  scaleY,
  originX,
  originY,
}: {
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
}) {
  const offsetX = roundVisualScale(originX * (1 - scaleX));
  const offsetY = roundVisualScale(originY * (1 - scaleY));
  return `matrix(${scaleX} 0 0 ${scaleY} ${offsetX} ${offsetY})`;
}
