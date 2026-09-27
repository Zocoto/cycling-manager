import { useId, type CSSProperties } from "react";

const DEFAULT_CROWD_COLORS = ["#F2C94C", "#FFFDF4", "#EF5B65", "#2457C5", "#43C892"];
const COUNTRY_FLAGS = ["FR", "BE", "IT", "ES", "NL", "CO"] as const;
const SPECTATOR_SKIN_TONES = ["#F0C4A4", "#DDA37F", "#B97856", "#855038", "#5D382B"] as const;

type SpectatorArmPose = "down" | "one-raised" | "both-raised";
type SpectatorJersey = "plain" | "polka-dot" | "yellow" | "striped";
type SpecialSupporter =
  | "devil"
  | "gaul-warrior"
  | "gaul-strongman"
  | "druid"
  | "horse-mask"
  | "runner"
  | "flag-runner";

export type RaceSupporterTeamPalette = {
  teamId: string;
  primaryColor: string;
  secondaryColor: string;
};

export type RaceFeaturedRunningSupporter = {
  x: number;
  side: "upper" | "lower";
  phase: number;
  primaryColor: string;
  secondaryColor: string;
  teamId?: string;
};

export function RaceRoadsideCrowd({
  show,
  isMoving,
  roadLeftY,
  roadRightY,
  roadDepthY,
  terrain,
  palette = DEFAULT_CROWD_COLORS,
  teamPalettes = [],
  featuredRunner = null,
}: {
  show: boolean;
  isMoving: boolean;
  roadLeftY: number;
  roadRightY: number;
  roadDepthY: number;
  terrain: "flat" | "climb" | "descent";
  palette?: readonly string[];
  teamPalettes?: readonly RaceSupporterTeamPalette[];
  featuredRunner?: RaceFeaturedRunningSupporter | null;
}) {
  const clipId = useId().replace(/:/g, "");
  if (!show) return null;

  const colors = palette.length ? palette : DEFAULT_CROWD_COLORS;
  const supporterPalettes = teamPalettes.length
    ? teamPalettes
    : colors.map((color, index) => ({
        teamId: `fallback-${index}`,
        primaryColor: color,
        secondaryColor: colors[(index + 2) % colors.length],
      }));
  const dense = terrain === "climb";
  const slopeTravelY = roadRightY - roadLeftY;
  const rearPositions = getClusteredSpectatorPositions(dense);
  const roadY = (x: number) => roadLeftY + (roadRightY - roadLeftY) * (x / 1000);
  const upperRoadInset = dense ? Math.min(12, roadDepthY * 0.12) : -2;
  const lowerRoadInset = dense ? Math.min(8, roadDepthY * 0.08) : -2;
  const upperSafeBoundary = (x: number) => roadY(x) + upperRoadInset;
  const lowerSafeBoundary = (x: number) => roadY(x) + roadDepthY - lowerRoadInset;
  const foregroundX = [30, 44, 61, 154, 171, 812, 829, 847, 941, 957].filter(
    (x) => roadY(x) + roadDepthY < 292,
  );

  const renderCrowd = (copy: "a" | "b") => (
    <g data-race-crowd-copy={copy}>
      <g
        data-race-crowd-layer="rear-verge"
        data-race-crowd-safe-lane="upper"
        clipPath={`url(#${clipId}-upper)`}
      >
        {rearPositions.map((x, index) => {
          const variant = getSpectatorVariant(index);
          const special = dense ? getClimbSupporter(index) : null;
          const runsAlongside = special === "runner" || special === "flag-runner";
          const supporterPalette =
            supporterPalettes[index % supporterPalettes.length];
          const teamJersey = teamPalettes.length > 0 && special === null;
          return (
            <Spectator
              key={`rear-${index}`}
              x={x}
              y={
                dense
                  ? upperSafeBoundary(x) - (runsAlongside ? 0.5 : 0.8)
                  : roadY(x) - 0.8
              }
              color={supporterPalette.primaryColor}
              accentColor={supporterPalette.secondaryColor}
              teamId={teamPalettes.length > 0 ? supporterPalette.teamId : undefined}
              scale={
                dense
                  ? 0.66 + (index % 4) * 0.024
                  : 0.56 + (index % 5) * 0.02
              }
              opacity={0.92}
              armPose={variant.armPose}
              jersey={teamJersey && variant.jersey !== "striped" ? "plain" : variant.jersey}
              skinTone={variant.skinTone}
              accessory={special === null ? variant.accessory : null}
              special={special}
              holdsFlag={
                special === "flag-runner" ||
                (special === null && index % (dense ? 8 : 7) === 1)
              }
              flagCountry={COUNTRY_FLAGS[index % COUNTRY_FLAGS.length]}
              smokeColor={dense && index === 31 ? "#E5484D" : null}
            />
          );
        })}
      </g>
      <g
        data-race-crowd-layer="foreground-grass"
        data-race-crowd-safe-lane="lower"
        clipPath={`url(#${clipId}-lower)`}
        opacity="0.86"
      >
        {foregroundX.map((x, index) => {
          const variant = getSpectatorVariant(index + 31);
          const special = null;
          const scale = dense ? 0.64 : 0.57;
          const holdsFlag = index === 1 || index === foregroundX.length - 2;
          const supporterPalette =
            supporterPalettes[(index + 1) % supporterPalettes.length];
          return (
            <Spectator
              key={`foreground-${x}`}
              x={x}
              y={
                Math.min(
                  318,
                  lowerSafeBoundary(x) + getLowerVergeBaseline(scale, holdsFlag),
                )
              }
              color={supporterPalette.primaryColor}
              accentColor={supporterPalette.secondaryColor}
              teamId={teamPalettes.length > 0 ? supporterPalette.teamId : undefined}
              scale={scale}
              opacity={0.84}
              armPose={variant.armPose}
              jersey={teamPalettes.length > 0 && variant.jersey !== "striped" ? "plain" : variant.jersey}
              skinTone={variant.skinTone}
              accessory={special === null ? variant.accessory : null}
              special={special}
              holdsFlag={holdsFlag}
              flagCountry={COUNTRY_FLAGS[(index + 2) % COUNTRY_FLAGS.length]}
            />
          );
        })}
      </g>
    </g>
  );

  const upperClipPath = buildUpperSafePath(upperSafeBoundary);
  const lowerClipPath = buildLowerSafePath(lowerSafeBoundary);

  const featuredRunnerX = featuredRunner
    ? Math.max(90, Math.min(910, featuredRunner.x))
    : 0;
  const featuredRunnerY = featuredRunner
    ? featuredRunner.side === "upper"
      ? upperSafeBoundary(featuredRunnerX) - 0.5
      : Math.min(318, lowerSafeBoundary(featuredRunnerX) + getLowerVergeBaseline(0.67))
    : 0;
  const featuredRunnerPhase = featuredRunner
    ? Math.max(0, Math.min(1, featuredRunner.phase))
    : 0;
  const featuredRunnerOpacity = getFeaturedRunnerOpacity(featuredRunnerPhase);

  return (
    <>
    <svg
      aria-hidden="true"
      viewBox="0 0 1000 320"
      preserveAspectRatio="none"
      data-race-roadside-crowd={dense ? "climb-dense" : "roadside"}
      data-race-crowd-spacing="clustered-irregular"
      data-race-crowd-track="right-to-left"
      data-race-crowd-slope-flow="slope-corrected"
      data-race-crowd-protected-corridor={dense ? "climb" : "full-road"}
      className="pointer-events-none absolute inset-0 z-[8] h-full w-full overflow-hidden"
    >
      <defs>
        <clipPath id={`${clipId}-upper`} clipPathUnits="userSpaceOnUse">
          <path d={upperClipPath} />
        </clipPath>
        <clipPath id={`${clipId}-lower`} clipPathUnits="userSpaceOnUse">
          <path d={lowerClipPath} />
        </clipPath>
      </defs>
      <g
        data-race-crowd-scroll-track="slope-corrected"
        className={isMoving ? "cm-race-crowd-scroll-slope" : undefined}
        style={
          {
            "--cm-race-crowd-travel-y": `${(-slopeTravelY / 320) * 100}%`,
          } as CSSProperties
        }
      >
        {renderCrowd("a")}
        <g transform={`translate(1000 ${slopeTravelY})`}>{renderCrowd("b")}</g>
      </g>
    </svg>
    {featuredRunner ? (
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 320"
        preserveAspectRatio="none"
        data-race-featured-supporter="sprinter-pacer"
        data-race-crowd-fixed-to-race="true"
        data-race-supporter-phase={featuredRunnerPhase.toFixed(3)}
        className="pointer-events-none absolute inset-0 z-[19] h-full w-full overflow-hidden"
      >
        <Spectator
          x={featuredRunnerX}
          y={featuredRunnerY}
          color={featuredRunner.primaryColor}
          accentColor={featuredRunner.secondaryColor}
          teamId={featuredRunner.teamId}
          scale={featuredRunner.side === "upper" ? 0.7 : 0.67}
          opacity={featuredRunnerOpacity}
          armPose="one-raised"
          jersey="plain"
          skinTone={featuredRunner.side === "upper" ? "#B97856" : "#DDA37F"}
          accessory={null}
          special="runner"
          holdsFlag={false}
          flagCountry="FR"
          paceAlongside
        />
      </svg>
    ) : null}
    </>
  );
}

function buildUpperSafePath(boundary: (x: number) => number) {
  return `M0 0H1000V${boundary(1000)}L0 ${boundary(0)}Z`;
}

function buildLowerSafePath(boundary: (x: number) => number) {
  return `M0 ${boundary(0)}L1000 ${boundary(1000)}V320H0Z`;
}

function getClimbSupporter(index: number): SpecialSupporter | null {
  return ({
    3: "devil",
    8: "gaul-warrior",
    13: "gaul-strongman",
    18: "druid",
    23: "horse-mask",
  } as Record<number, SpecialSupporter>)[index] ?? null;
}

function getSpectatorVariant(index: number): {
  armPose: SpectatorArmPose;
  jersey: SpectatorJersey;
  skinTone: (typeof SPECTATOR_SKIN_TONES)[number];
  accessory: "phone" | "camera" | "cap" | null;
} {
  const armPoses: SpectatorArmPose[] = ["down", "one-raised", "both-raised", "one-raised"];
  const jerseys: SpectatorJersey[] = ["plain", "striped", "plain", "yellow", "plain", "polka-dot"];
  const accessories = [null, "phone", null, "cap", "camera", null] as const;
  return {
    armPose: armPoses[index % armPoses.length],
    jersey: jerseys[index % jerseys.length],
    skinTone: SPECTATOR_SKIN_TONES[index % SPECTATOR_SKIN_TONES.length],
    accessory: accessories[index % accessories.length],
  };
}

function getClusteredSpectatorPositions(dense: boolean) {
  return dense
    ? [
        18, 31, 42, 55, 72, 88,
        142, 153, 166, 181,
        250, 262, 274, 291, 307,
        398, 411, 427,
        505, 517, 531, 548, 565, 579,
        664, 677, 691, 708,
        781, 794, 808, 825, 839,
        918, 931, 945, 962, 976,
      ]
    : [
        25, 39, 55,
        148, 163,
        287, 301, 318, 337,
        468, 483,
        618, 633, 649,
        787, 802, 820,
        932, 947, 964,
      ];
}

function getLowerVergeBaseline(scale: number, hasTallProp = false) {
  return (hasTallProp ? 58 : 45) * scale + 2;
}

function getFeaturedRunnerOpacity(phase: number) {
  const fadeInEnd = 0.12;
  const fadeOutStart = 0.82;
  const visibility =
    phase < fadeInEnd
      ? phase / fadeInEnd
      : phase > fadeOutStart
        ? (1 - phase) / (1 - fadeOutStart)
        : 1;
  return 0.98 * Math.max(0, Math.min(1, visibility));
}

function Spectator({
  x,
  y,
  teamId,
  color,
  accentColor,
  scale,
  opacity,
  armPose,
  jersey,
  skinTone,
  accessory,
  special,
  holdsFlag,
  flagCountry,
  smokeColor = null,
  paceAlongside = false,
}: {
  x: number;
  y: number;
  teamId?: string;
  color: string;
  accentColor: string;
  scale: number;
  opacity: number;
  armPose: SpectatorArmPose;
  jersey: SpectatorJersey;
  skinTone: (typeof SPECTATOR_SKIN_TONES)[number];
  accessory: "phone" | "camera" | "cap" | null;
  special: SpecialSupporter | null;
  holdsFlag: boolean;
  flagCountry: (typeof COUNTRY_FLAGS)[number];
  smokeColor?: string | null;
  paceAlongside?: boolean;
}) {
  const jerseyColor =
    special === "devil"
      ? "#D62F3D"
      : special === "gaul-warrior"
        ? "#111D49"
        : special === "gaul-strongman"
          ? "#68B9E8"
          : special === "druid"
            ? "#FFFDF4"
            : jersey === "yellow"
              ? "#F2C94C"
              : color;
  const running = special === "runner" || special === "flag-runner";

  return (
    <g
      transform={`translate(${x} ${y})`}
      opacity={opacity}
      data-race-spectator={armPose}
      data-race-spectator-jersey={jersey}
      data-race-supporter-team={teamId}
      data-race-supporter-special={special ?? "regular"}
      data-race-supporter-motion={running ? "running" : "stationary"}
      data-race-supporter-pace={paceAlongside ? "sprinter" : undefined}
      data-race-supporter-accessory={accessory ?? "none"}
    >
      <g transform={`scale(${scale})`}>
      <g className={paceAlongside ? "cm-supporter-pacer" : undefined}>
      <g className={running ? "cm-supporter-run" : undefined}>
        {holdsFlag ? <SupporterFlag country={flagCountry} /> : null}
        {smokeColor ? <SmokeFlare color={smokeColor} /> : null}
        {accessory ? <SupporterAccessory kind={accessory} /> : null}
        {special === "devil" ? <DevilAccessories /> : null}
        {special === "horse-mask" ? <HorseMask /> : null}
        {special === "gaul-warrior" ? <GaulHelmet kind="winged" /> : null}
        {special === "gaul-strongman" ? <GaulHelmet kind="braided" /> : null}
        {special === "druid" ? <DruidAccessories /> : null}
        <path
          d={running ? "M-5-8-11 0M5-8 12-2" : "M-5-8-7 1M5-8 8 1"}
          stroke="#27352F"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <circle cx={running ? -10.8 : -6.6} cy={running ? -0.2 : 0.6} r="1.55" fill="#26362F" data-race-supporter-detail="knees" />
        <circle cx={running ? 11.8 : 6.6} cy={running ? -2 : 0.6} r="1.55" fill="#26362F" data-race-supporter-detail="knees" />
        <path d={running ? "M-15 0h8M9-2h9" : "M-9 1h6M4 1h7"} stroke="#F5F7F4" strokeWidth="2.7" strokeLinecap="round" data-race-supporter-detail="running-shoes" />
        <path d="M-8-13h16L6-6 1-7 0-11-1-7-6-6Z" fill="#25342E" stroke="#D8E1DC" strokeWidth="0.65" data-race-supporter-detail="technical-shorts" />
        <path d="M-7-26h14l2 18H-9Z" fill={jerseyColor} stroke="#31423A" strokeWidth="0.85" strokeLinejoin="round" />
        <path d="M-8-12h16l1 4H-9Z" fill={special === "gaul-strongman" ? "#F2C94C" : "#25342E"} opacity="0.82" />
        <path d="M-5.5-25h11M0-25v15M-7.5-20h15" fill="none" stroke="#FFFDF4" strokeWidth="0.65" opacity="0.68" data-race-supporter-detail="jersey-tailoring" />
        <path d="M-3-26q3 4 6 0" fill="#1F342D" stroke="#E8EEE9" strokeWidth="0.55" data-race-supporter-detail="jersey-collar" />
        <path d="M-8-22h3M5-22h3" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" data-race-supporter-detail="sleeve-cuffs" />
        {jersey === "striped" && special === null ? <path d="M-3-26h5l1 14h-5Z" fill={accentColor} opacity="0.92" /> : null}
        {jersey === "polka-dot" && special === null ? (
          <g fill="#D62F3D">
            <circle cx="-3.8" cy="-21" r="1.35" /><circle cx="2.8" cy="-22.5" r="1.35" />
            <circle cx="0" cy="-16" r="1.35" /><circle cx="5.2" cy="-14" r="1.15" />
          </g>
        ) : null}
        {armPose === "both-raised" ? (
          <path d="M-6-23-14-34-17-45M6-23 14-34 17-45" fill="none" stroke={skinTone} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ) : armPose === "one-raised" ? (
          <path d="M-6-23-13-14M6-23 14-34 17-44" fill="none" stroke={skinTone} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d={running ? "M-6-23-15-29M6-23 15-17" : "M-6-23-13-13M6-23 13-13"} fill="none" stroke={skinTone} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}
        <path d="M-2-28v3h4v-3" fill={skinTone} data-race-supporter-detail="neck" />
        {special !== "horse-mask" ? <circle cx="0" cy="-34" r="5.7" fill={skinTone} stroke="#5F4133" strokeWidth="0.75" /> : null}
        {special === "druid" ? null : special !== "horse-mask" ? <path d="M-5-35q5-7 10 0" fill={special === "gaul-warrior" ? "#F2C94C" : "#4A3429"} /> : null}
        {special !== "horse-mask" ? (
          <g data-race-supporter-detail="face">
            <circle cx="2.2" cy="-34.4" r="0.58" fill="#17261E" />
            <path d="M4-33.4 5.7-32.6 4-31.8M1-30.8q2 .9 3.6-.2" fill="none" stroke="#6D4333" strokeWidth="0.62" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M-5.4-34.5q-1.8 1.8.2 3.4" fill={skinTone} stroke="#6D4333" strokeWidth="0.55" />
          </g>
        ) : null}
      </g>
      </g>
      </g>
    </g>
  );
}

function SupporterAccessory({
  kind,
}: {
  kind: "phone" | "camera" | "cap";
}) {
  if (kind === "phone") {
    return (
      <g data-race-supporter-prop="phone">
        <rect x="13" y="-43" width="4.5" height="8" rx="0.8" fill="#17261E" stroke="#D8E5DF" strokeWidth="0.55" />
        <circle cx="15.25" cy="-41.4" r="0.45" fill="#72D4B7" />
      </g>
    );
  }
  if (kind === "camera") {
    return (
      <g data-race-supporter-prop="camera">
        <path d="M-7-24 0-17 8-24" fill="none" stroke="#26342E" strokeWidth="0.9" />
        <rect x="-5.5" y="-24" width="11" height="7" rx="1.2" fill="#26342E" stroke="#D4DDD8" strokeWidth="0.6" />
        <circle cx="0" cy="-20.5" r="2" fill="#75908A" stroke="#0D1713" strokeWidth="0.65" />
      </g>
    );
  }
  return (
    <g data-race-supporter-prop="cap">
      <path d="M-5-38q5-5 10 0v2H-5Z" fill="#F2C94C" stroke="#4E4020" strokeWidth="0.6" />
      <path d="M3-36h6" stroke="#F2C94C" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

function SupporterFlag({ country }: { country: (typeof COUNTRY_FLAGS)[number] }) {
  const colors: Record<(typeof COUNTRY_FLAGS)[number], [string, string, string]> = {
    FR: ["#2457C5", "#FFFDF4", "#EF3340"],
    BE: ["#171717", "#F2C94C", "#EF3340"],
    IT: ["#2E9B61", "#FFFDF4", "#EF3340"],
    ES: ["#AA151B", "#F1BF00", "#AA151B"],
    NL: ["#AE1C28", "#FFFDF4", "#21468B"],
    CO: ["#FCD116", "#003893", "#CE1126"],
  };
  const [first, second, third] = colors[country];
  const horizontal = country === "ES" || country === "NL" || country === "CO";

  return (
    <g data-race-supporter-prop="flag" data-race-supporter-flag={country}>
      <path d="M12-15v-42" stroke="#E9E3D5" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13-56h24v14H13Z" fill={second} stroke="#20362E" strokeWidth="0.65" />
      {horizontal ? (
        <>
          <path d="M13-56h24v4.7H13Z" fill={first} />
          <path d="M13-46.7h24v4.7H13Z" fill={third} />
        </>
      ) : (
        <>
          <path d="M13-56h8v14h-8Z" fill={first} />
          <path d="M29-56h8v14h-8Z" fill={third} />
        </>
      )}
    </g>
  );
}
function SmokeFlare({ color }: { color: string }) {
  return (
    <g data-race-supporter-prop="smoke-flare">
      <path d="M-12-17-17-7" stroke="#4A3E37" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="-17" cy="-7" r="2.4" fill={color} />
      <g className="cm-supporter-smoke" fill={color} opacity="0.22">
        <circle cx="-19" cy="-20" r="7" />
        <circle cx="-13" cy="-31" r="9" />
        <circle cx="-22" cy="-43" r="11" />
        <circle cx="-10" cy="-53" r="12" />
      </g>
      <path d="M-18-10c-7-9 6-13 0-21s10-13 3-25" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" opacity="0.36" className="cm-supporter-smoke" />
      <path d="M-16-12c-3-7 6-9 1-15s7-8 4-13" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity="0.86" />
    </g>
  );
}

function DevilAccessories() {
  return (
    <g data-race-supporter-costume="devil">
      <path d="M-4-39-8-48-1-43M4-39 8-48 1-43" fill="#D62F3D" stroke="#6E1720" strokeWidth="0.8" />
      <path d="M-19-12v-44m0 0-5 9m5-9 5 9m-5-9v-8" stroke="#D62F3D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function GaulHelmet({ kind }: { kind: "winged" | "braided" }) {
  return kind === "winged" ? (
    <g data-race-supporter-costume="gaul-warrior">
      <path d="M-6-38q6-8 12 0v4H-6Z" fill="#B7BEC6" stroke="#434C52" strokeWidth="0.8" />
      <path d="M-5-39-14-45-11-35M5-39 14-45 11-35" fill="#FFFDF4" stroke="#687078" strokeWidth="0.7" />
    </g>
  ) : (
    <g data-race-supporter-costume="gaul-strongman">
      <path d="M-6-38q6-8 12 0v4H-6Z" fill="#B7BEC6" stroke="#434C52" strokeWidth="0.8" />
      <path d="M-6-33c-5 4-3 11-8 14M6-33c5 4 3 11 8 14" fill="none" stroke="#E96D27" strokeWidth="3.1" strokeLinecap="round" />
    </g>
  );
}

function DruidAccessories() {
  return (
    <g data-race-supporter-costume="druid">
      <path d="M-7-35q7-9 14 0" fill="#FFFDF4" />
      <path d="M-5-32q5 18 10 0v17q-5 5-10 0Z" fill="#FFFDF4" stroke="#C8C8C0" strokeWidth="0.6" />
      <path d="M17-5v-47m0 6c-5-7-8-2-8 2m8-2c5-7 8-2 8 2" fill="none" stroke="#79552E" strokeWidth="2.1" strokeLinecap="round" />
    </g>
  );
}

function HorseMask() {
  return (
    <g data-race-supporter-costume="horse-mask">
      <path d="M-6-43-9-51-3-47M6-43 9-51 3-47" fill="#7C5132" stroke="#3D291D" strokeWidth="0.8" />
      <path d="M-7-44q7-8 14 0l3 10-5 8H-5l-5-8Z" fill="#9A6844" stroke="#3D291D" strokeWidth="0.9" />
      <path d="M-3-30h6" stroke="#2B1A12" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="-4" cy="-38" r="1" fill="#101010" /><circle cx="4" cy="-38" r="1" fill="#101010" />
    </g>
  );
}
