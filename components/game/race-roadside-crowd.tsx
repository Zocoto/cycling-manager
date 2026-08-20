import { useId } from "react";

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

export function RaceRoadsideCrowd({
  show,
  isMoving,
  roadLeftY,
  roadRightY,
  roadDepthY,
  terrain,
  palette = DEFAULT_CROWD_COLORS,
  teamPalettes = [],
}: {
  show: boolean;
  isMoving: boolean;
  roadLeftY: number;
  roadRightY: number;
  roadDepthY: number;
  terrain: "flat" | "climb" | "descent";
  palette?: readonly string[];
  teamPalettes?: readonly RaceSupporterTeamPalette[];
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
  const rearCount = dense ? 36 : 19;
  const roadY = (x: number) => roadLeftY + (roadRightY - roadLeftY) * (x / 1000);
  const upperRoadInset = dense ? Math.min(12, roadDepthY * 0.12) : -2;
  const lowerRoadInset = dense ? Math.min(8, roadDepthY * 0.08) : -2;
  const upperSafeBoundary = (x: number) => roadY(x) + upperRoadInset;
  const lowerSafeBoundary = (x: number) => roadY(x) + roadDepthY - lowerRoadInset;
  const foregroundX = [38, 106, 178, 822, 894, 962].filter(
    (x) => roadY(x) + roadDepthY < 292,
  );

  const renderCrowd = (copy: "a" | "b") => (
    <g data-race-crowd-copy={copy}>
      <g
        data-race-crowd-layer="rear-verge"
        data-race-crowd-safe-lane="upper"
        clipPath={`url(#${clipId}-upper)`}
        className="cm-crowd-wave"
      >
        {Array.from({ length: rearCount }, (_, index) => {
          const x = 18 + (index * 964) / Math.max(1, rearCount - 1);
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
                  ? upperSafeBoundary(x) - (runsAlongside ? 0.5 : 1.5)
                  : roadY(x) - 3 - (index % 3) * 1.2
              }
              color={supporterPalette.primaryColor}
              accentColor={supporterPalette.secondaryColor}
              teamId={teamPalettes.length > 0 ? supporterPalette.teamId : undefined}
              scale={dense ? 0.65 : 0.58}
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
          const special = dense && index === 2 ? "runner" : null;
          const supporterPalette =
            supporterPalettes[(index + 1) % supporterPalettes.length];
          return (
            <Spectator
              key={`foreground-${x}`}
              x={x}
              y={dense ? lowerSafeBoundary(x) + 43 : 318 - (index % 2) * 2}
              color={supporterPalette.primaryColor}
              accentColor={supporterPalette.secondaryColor}
              teamId={teamPalettes.length > 0 ? supporterPalette.teamId : undefined}
              scale={dense ? 0.58 : 0.54}
              opacity={0.84}
              armPose={variant.armPose}
              jersey={teamPalettes.length > 0 && variant.jersey !== "striped" ? "plain" : variant.jersey}
              skinTone={variant.skinTone}
              accessory={special === null ? variant.accessory : null}
              special={special}
              holdsFlag={index === 1 || index === foregroundX.length - 2}
              flagCountry={COUNTRY_FLAGS[(index + 2) % COUNTRY_FLAGS.length]}
            />
          );
        })}
      </g>
    </g>
  );

  const upperClipPath = buildUpperSafePath(upperSafeBoundary);
  const lowerClipPath = buildLowerSafePath(lowerSafeBoundary);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 2000 320"
      preserveAspectRatio="none"
      data-race-roadside-crowd={dense ? "climb-dense" : "roadside"}
      data-race-crowd-track="right-to-left"
      data-race-crowd-protected-corridor={dense ? "climb" : "full-road"}
      className={`pointer-events-none absolute inset-y-0 left-0 z-[8] h-full w-[200%] max-w-none overflow-hidden ${
        isMoving ? "cm-race-scenery-scroll" : ""
      }`}
    >
      <defs>
        <clipPath id={`${clipId}-upper`} clipPathUnits="userSpaceOnUse">
          <path d={upperClipPath} />
        </clipPath>
        <clipPath id={`${clipId}-lower`} clipPathUnits="userSpaceOnUse">
          <path d={lowerClipPath} />
        </clipPath>
      </defs>
      {renderCrowd("a")}
      <g transform="translate(1000 0)">{renderCrowd("b")}</g>
    </svg>
  );
}

function buildUpperSafePath(boundary: (x: number) => number) {
  return [0, 1000]
    .map(
      (offset) =>
        `M${offset} 0H${offset + 1000}V${boundary(1000)}L${offset} ${boundary(0)}Z`,
    )
    .join(" ");
}

function buildLowerSafePath(boundary: (x: number) => number) {
  return [0, 1000]
    .map(
      (offset) =>
        `M${offset} ${boundary(0)}L${offset + 1000} ${boundary(1000)}V320H${offset}Z`,
    )
    .join(" ");
}

function getClimbSupporter(index: number): SpecialSupporter | null {
  return ({
    3: "devil",
    8: "gaul-warrior",
    13: "gaul-strongman",
    18: "druid",
    23: "horse-mask",
    27: "runner",
    34: "flag-runner",
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
      transform={`translate(${x} ${y}) scale(${scale})`}
      opacity={opacity}
      data-race-spectator={armPose}
      data-race-spectator-jersey={jersey}
      data-race-supporter-team={teamId}
      data-race-supporter-special={special ?? "regular"}
      data-race-supporter-motion={running ? "running" : "stationary"}
      data-race-supporter-accessory={accessory ?? "none"}
    >
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
        <path d={running ? "M-13 0h6M10-2h7" : "M-8 1h5M5 1h6"} stroke="#18221E" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M-7-26h14l2 18H-9Z" fill={jerseyColor} stroke="#31423A" strokeWidth="0.85" strokeLinejoin="round" />
        <path d="M-8-12h16l1 4H-9Z" fill={special === "gaul-strongman" ? "#F2C94C" : "#25342E"} opacity="0.82" />
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
        <path d="M-2-28v3h4v-3" fill={skinTone} />
        {special !== "horse-mask" ? <circle cx="0" cy="-34" r="5.7" fill={skinTone} stroke="#5F4133" strokeWidth="0.75" /> : null}
        {special === "druid" ? null : special !== "horse-mask" ? <path d="M-5-35q5-7 10 0" fill={special === "gaul-warrior" ? "#F2C94C" : "#4A3429"} /> : null}
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
