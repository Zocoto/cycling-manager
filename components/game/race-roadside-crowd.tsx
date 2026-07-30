const DEFAULT_CROWD_COLORS = ["#F2C94C", "#FFFDF4", "#EF5B65", "#2457C5", "#43C892"];

type SpectatorArmPose = "down" | "one-raised" | "both-raised";
type SpectatorJersey = "plain" | "polka-dot" | "yellow" | "striped";

export function RaceRoadsideCrowd({
  show,
  roadLeftY,
  roadRightY,
  roadDepthY,
  terrain,
  palette = DEFAULT_CROWD_COLORS,
}: {
  show: boolean;
  roadLeftY: number;
  roadRightY: number;
  roadDepthY: number;
  terrain: "flat" | "climb" | "descent";
  palette?: readonly string[];
}) {
  if (!show) return null;

  const colors = palette.length ? palette : DEFAULT_CROWD_COLORS;
  const dense = terrain === "climb";
  const rearCount = dense ? 30 : 19;
  const roadY = (x: number) => roadLeftY + (roadRightY - roadLeftY) * (x / 1000);
  const foregroundX = [38, 106, 178, 822, 894, 962].filter(
    (x) => roadY(x) + roadDepthY < 292,
  );

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1000 320"
      preserveAspectRatio="none"
      data-race-roadside-crowd={dense ? "climb-dense" : "roadside"}
      className="pointer-events-none absolute inset-0 z-[8] h-full w-full overflow-hidden"
    >
      <g data-race-crowd-layer="rear-verge" className="cm-crowd-wave">
        {Array.from({ length: rearCount }, (_, index) => {
          const x = 18 + (index * 964) / Math.max(1, rearCount - 1);
          const variant = getSpectatorVariant(index);
          return (
            <Spectator
              key={`rear-${index}`}
              x={x}
              y={roadY(x) - 2 - (index % 3) * 1.2}
              color={colors[index % colors.length]}
              accentColor={colors[(index + 2) % colors.length]}
              scale={dense ? 0.63 : 0.58}
              opacity={0.9}
              armPose={variant.armPose}
              jersey={variant.jersey}
              holdsFlag={index % (dense ? 5 : 7) === 1}
              smokeColor={dense && index % 10 === 4 ? (index % 20 === 4 ? "#E5484D" : "#F1F2EA") : null}
            />
          );
        })}
      </g>
      <g data-race-crowd-layer="foreground-grass" opacity="0.82">
        {foregroundX.map((x, index) => {
          const variant = getSpectatorVariant(index + 31);
          return (
            <Spectator
              key={`foreground-${x}`}
              x={x}
              y={318 - (index % 2) * 2}
              color={colors[(index + 1) % colors.length]}
              accentColor={colors[(index + 3) % colors.length]}
              scale={0.54}
              opacity={0.82}
              armPose={variant.armPose}
              jersey={variant.jersey}
              holdsFlag={index === 1 || index === foregroundX.length - 2}
            />
          );
        })}
      </g>
    </svg>
  );
}

function getSpectatorVariant(index: number): { armPose: SpectatorArmPose; jersey: SpectatorJersey } {
  const armPoses: SpectatorArmPose[] = ["down", "one-raised", "both-raised", "one-raised"];
  const jerseys: SpectatorJersey[] = ["plain", "striped", "plain", "yellow", "plain", "polka-dot"];
  return { armPose: armPoses[index % armPoses.length], jersey: jerseys[index % jerseys.length] };
}

function Spectator({
  x,
  y,
  color,
  accentColor,
  scale,
  opacity,
  armPose,
  jersey,
  holdsFlag,
  smokeColor = null,
}: {
  x: number;
  y: number;
  color: string;
  accentColor: string;
  scale: number;
  opacity: number;
  armPose: SpectatorArmPose;
  jersey: SpectatorJersey;
  holdsFlag: boolean;
  smokeColor?: string | null;
}) {
  const jerseyColor = jersey === "yellow" ? "#F2C94C" : color;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity} data-race-spectator={armPose} data-race-spectator-jersey={jersey}>
      {holdsFlag ? (
        <g data-race-supporter-prop="flag">
          <path d="M12-15v-38" stroke="#E9E3D5" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M13-52h21v12H13Z" fill="#FFFDF4" stroke="#20362E" strokeWidth="0.65" />
          <path d="M13-52h7v12h-7Zm14 0h7v12h-7Z" fill={color} />
          <path d="M27-52h7v12h-7Z" fill={accentColor} opacity="0.95" />
        </g>
      ) : null}
      {smokeColor ? (
        <g data-race-supporter-prop="smoke-flare">
          <path d="M-12-17-17-7" stroke="#4A3E37" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="-17" cy="-7" r="2.2" fill={smokeColor} />
          <path d="M-18-10c-6-8 5-10 0-17s8-10 3-18" fill="none" stroke={smokeColor} strokeWidth="5.4" strokeLinecap="round" opacity="0.42" />
          <path d="M-16-12c-3-7 6-9 1-15s7-8 4-13" fill="none" stroke={smokeColor} strokeWidth="2.2" strokeLinecap="round" opacity="0.82" />
        </g>
      ) : null}
      <path d="M-5-8-7 1M5-8 8 1" stroke="#27352F" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M-8 1h5M5 1h6" stroke="#18221E" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M-7-26h14l2 18H-9Z" fill={jerseyColor} stroke="#31423A" strokeWidth="0.85" strokeLinejoin="round" />
      <path d="M-8-12h16l1 4H-9Z" fill="#25342E" opacity="0.82" />
      {jersey === "striped" ? <path d="M-3-26h5l1 14h-5Z" fill={accentColor} opacity="0.92" /> : null}
      {jersey === "polka-dot" ? (
        <g fill="#D62F3D">
          <circle cx="-3.8" cy="-21" r="1.35" /><circle cx="2.8" cy="-22.5" r="1.35" />
          <circle cx="0" cy="-16" r="1.35" /><circle cx="5.2" cy="-14" r="1.15" />
        </g>
      ) : null}
      {armPose === "both-raised" ? (
        <path d="M-6-23-14-34-17-45M6-23 14-34 17-45" fill="none" stroke="#DDA37F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ) : armPose === "one-raised" ? (
        <path d="M-6-23-13-14M6-23 14-34 17-44" fill="none" stroke="#DDA37F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M-6-23-13-13M6-23 13-13" fill="none" stroke="#DDA37F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      )}
      <path d="M-2-28v3h4v-3" fill="#DDA37F" />
      <circle cx="0" cy="-34" r="5.7" fill="#DDA37F" stroke="#5F4133" strokeWidth="0.75" />
      <path d="M-5-35q5-7 10 0" fill="#4A3429" />
    </g>
  );
}
