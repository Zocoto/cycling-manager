import { useId, type CSSProperties } from "react";

type RaceMediaMode = "side" | "top";
type RaceMediaContext = "race" | "finish";

type RoadGeometry = {
  leftPct: number;
  rightPct: number;
  depthPct: number;
};

export type RaceCameraMotoPlacement = {
  position: "ahead" | "behind";
  leftPct: number;
  topPct: number;
  cameraFacing: "left" | "right";
  animationDelayMs: number;
};

export function RaceMediaConvoy({
  isMoving,
  showHelicopter,
  mode = "side",
  visualSeed = "race-media",
  groupPositions = [],
  roadGeometry,
  context = "race",
}: {
  isMoving: boolean;
  showHelicopter: boolean;
  mode?: RaceMediaMode;
  visualSeed?: string;
  groupPositions?: readonly number[];
  roadGeometry?: RoadGeometry;
  context?: RaceMediaContext;
}) {
  const visualId = `race-media-${useId().replace(/:/g, "")}`;
  const placements = getRaceCameraMotoPlacements({
    visualSeed,
    groupPositions,
    roadGeometry,
    context,
    mode,
  });

  return (
    <div
      aria-hidden="true"
      data-race-media-convoy={mode}
      data-race-media-motorcycles={placements.length}
      className="pointer-events-none absolute inset-0 z-[17] overflow-hidden"
    >
      {showHelicopter ? (
        <RaceBroadcastHelicopter
          visualId={visualId}
          isMoving={isMoving}
        />
      ) : null}

      {placements.map((placement, index) => (
        <div
          key={`${placement.position}-${index}`}
          data-race-camera-motorcycle-placement={placement.position}
          data-race-camera-motorcycle-position={`${placement.leftPct.toFixed(1)},${placement.topPct.toFixed(1)}`}
          className="absolute -translate-x-1/2 -translate-y-[82%]"
          style={{
            left: `${placement.leftPct}%`,
            top: `${placement.topPct}%`,
            zIndex: placement.position === "ahead" ? 19 : 16,
          }}
        >
          {mode === "top" ? (
            <TopCameraMotorcycle
              visualId={`${visualId}-${index}`}
              isMoving={isMoving}
              cameraFacing={placement.cameraFacing}
              animationDelayMs={placement.animationDelayMs}
            />
          ) : (
            <SideCameraMotorcycle
              visualId={`${visualId}-${index}`}
              isMoving={isMoving}
              cameraFacing={placement.cameraFacing}
              animationDelayMs={placement.animationDelayMs}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function getRaceCameraMotoPlacements({
  visualSeed,
  groupPositions,
  roadGeometry,
  context,
  mode,
}: {
  visualSeed: string;
  groupPositions: readonly number[];
  roadGeometry?: RoadGeometry;
  context: RaceMediaContext;
  mode: RaceMediaMode;
}): RaceCameraMotoPlacement[] {
  const seed = stableVisualHash(visualSeed);
  const positions = groupPositions.filter(Number.isFinite);
  const frontOfRace = positions.length > 0 ? Math.max(...positions) : 67;
  const backOfRace = positions.length > 0 ? Math.min(...positions) : 43;
  const aheadLeft = clamp(frontOfRace + 12 + (seed % 7), 78, 94);
  const behindLeft = clamp(backOfRace - 14 - ((seed >>> 4) % 8), 6, 35);
  const shouldShowTwo = context === "race" && seed % 4 !== 1;
  const order: Array<"ahead" | "behind"> = shouldShowTwo
    ? seed % 2 === 0
      ? ["ahead", "behind"]
      : ["behind", "ahead"]
    : seed % 2 === 0
      ? ["ahead"]
      : ["behind"];

  return order.map((position, index) => {
    const leftPct = position === "ahead" ? aheadLeft : behindLeft;
    const laneRatio = mode === "top"
      ? position === "ahead"
        ? 0.72
        : 0.28
      : position === "ahead"
        ? 0.66
        : 0.38;
    const baseTop = roadGeometry
      ? roadGeometry.leftPct +
        (roadGeometry.rightPct - roadGeometry.leftPct) * (leftPct / 100) +
        roadGeometry.depthPct * laneRatio
      : mode === "top"
        ? 50 + (laneRatio - 0.5) * 34
        : 66 + (laneRatio - 0.5) * 24;

    return {
      position,
      leftPct,
      topPct: clamp(baseTop + (((seed >>> (index + 2)) % 5) - 2) * 0.45, 18, 88),
      cameraFacing: position === "ahead" ? "left" : "right",
      animationDelayMs: -((seed + index * 431) % 1200),
    };
  });
}

function SideCameraMotorcycle({
  visualId,
  isMoving,
  cameraFacing,
  animationDelayMs,
}: {
  visualId: string;
  isMoving: boolean;
  cameraFacing: "left" | "right";
  animationDelayMs: number;
}) {
  const motionStyle = {
    animationDelay: `${animationDelayMs}ms`,
    "--cm-camera-moto-drift": cameraFacing === "left" ? "7px" : "-6px",
  } as CSSProperties;

  return (
    <svg
      viewBox="0 0 170 70"
      data-race-camera-motorcycle="side"
      data-race-camera-facing={cameraFacing}
      className={`h-12 w-28 overflow-visible drop-shadow-xl md:h-14 md:w-32 ${
        isMoving ? "cm-camera-moto" : ""
      }`}
      style={motionStyle}
    >
      <defs>
        <linearGradient id={`${visualId}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6FBF9" />
          <stop offset="0.32" stopColor="#2B806B" />
          <stop offset="0.74" stopColor="#0D4B3D" />
          <stop offset="1" stopColor="#082E27" />
        </linearGradient>
        <linearGradient id={`${visualId}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8FAF7" stopOpacity="0.94" />
          <stop offset="1" stopColor="#5F8F86" stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id={`${visualId}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F0F5F2" />
          <stop offset="0.35" stopColor="#85968F" />
          <stop offset="0.7" stopColor="#31433C" />
          <stop offset="1" stopColor="#B7C4BE" />
        </linearGradient>
        <radialGradient id={`${visualId}-lamp`} cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="#FFF9D7" />
          <stop offset="0.58" stopColor="#F2D26E" />
          <stop offset="1" stopColor="#9F7A2A" />
        </radialGradient>
      </defs>
      <ellipse cx="85" cy="66" rx="72" ry="3.2" fill="rgba(7,26,23,0.22)" />

      {[35, 132].map((wheelX) => (
        <g key={wheelX} data-race-camera-moto-wheel="detailed">
          <circle cx={wheelX} cy="55" r="12.4" fill="#101714" stroke="#283A34" strokeWidth="1.6" />
          <path d={`M${wheelX - 9.4} 47.7q9.4-6.2 18.8 0M${wheelX - 11.3} 55q11.3 3.8 22.6 0`} fill="none" stroke="#53645D" strokeWidth="0.55" strokeDasharray="1.5 1.2" opacity="0.78" data-race-camera-moto-detail="tire-tread" />
          <circle cx={wheelX} cy="55" r="8.9" fill="#A7B5AF" stroke="#EDF3F0" strokeWidth="1" />
          <circle cx={wheelX} cy="55" r="6.2" fill="#52655E" stroke="#D5DFDB" strokeWidth="0.58" data-race-camera-moto-detail="ventilated-brake-disc" />
          <circle cx={wheelX} cy="55" r="4.8" fill="none" stroke="#E1E8E4" strokeWidth="0.45" strokeDasharray="1.2 1.6" />
          <g className={isMoving ? "cm-camera-moto-wheel" : ""}>
            <path d={`M${wheelX - 7.5} 55h15M${wheelX} 47.5v15M${wheelX - 5.4} 49.6l10.8 10.8M${wheelX + 5.4} 49.6l-10.8 10.8`} stroke="#536861" strokeWidth="0.75" />
          </g>
          <circle cx={wheelX} cy="55" r="1.9" fill="#24352F" />
        </g>
      ))}

      <g data-race-camera-motorcycle-body="touring">
        <path d="M35 55 63 34h38l31 21M58 55l17-26 24 26H35" fill="none" stroke="#DDE9E4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M52 48c9-13 20-20 34-20h25c11 0 19 7 25 20l-7 8H99L85 43H57Z" fill={`url(#${visualId}-body)`} stroke="#E8F1ED" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M106 32c7-10 15-15 25-15h8l-3 7-15 4-7 13Z" fill={`url(#${visualId}-glass)`} stroke="#D8E8E2" strokeWidth="1" />
        <path d="M123 27 134 55" stroke="#DDE9E4" strokeWidth="2" />
        <path d="M56 30h42c4 0 6 2 7 5H62Z" fill="#17261E" stroke="#C5D3CE" strokeWidth="0.8" />
        <path d="M51 47 35 55m75-11 22 11M63 34 78 55" fill="none" stroke="#17362E" strokeWidth="1.2" />
        <path d="M116 31 126 50M120 32 132 52" fill="none" stroke={`url(#${visualId}-metal)`} strokeWidth="1.2" data-race-camera-moto-detail="front-suspension" />
        <path d="M57 50 43 37M58 52 39 49" fill="none" stroke="#8FA39A" strokeWidth="0.85" data-race-camera-moto-detail="rear-swingarm" />
        <g data-race-camera-moto-detail="engine">
          <path d="M69 38h27l8 14H68Z" fill={`url(#${visualId}-metal)`} stroke="#162721" strokeWidth="0.9" />
          <circle cx="82" cy="45" r="6.3" fill="#253A33" stroke="#D4DFDA" strokeWidth="0.65" />
          <path d="M77 42h11m-12 3h13m-11 3h9" stroke="#8FA199" strokeWidth="0.58" />
          <path d="M94 49q12 5 24 3" fill="none" stroke="#AFC0B8" strokeWidth="2.1" />
          <path d="M112 51h20" stroke="#3A4D46" strokeWidth="3" strokeLinecap="round" />
        </g>
        <path d="M49 51 25 56" stroke="#647A73" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M23 56h25" stroke="#17261E" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M136 40h8l4 5-11 3" fill="#F6D66A" stroke="#E7EEE9" strokeWidth="0.8" />
        <circle cx="143" cy="44" r="3.2" fill={`url(#${visualId}-lamp)`} stroke="#F7FAF8" strokeWidth="0.65" data-race-camera-moto-detail="projector-headlamp" />
        <path d="M108 27q7-8 15-10m-3 2 8-5" fill="none" stroke="#2E443D" strokeWidth="0.8" data-race-camera-moto-detail="mirrors" />
        <ellipse cx="129" cy="13" rx="3.4" ry="1.8" fill="#263D36" stroke="#D7E2DD" strokeWidth="0.55" />
        <g data-race-camera-moto-detail="broadcast-panniers">
          <path d="M43 36h24l4 17H42Z" fill="#173D34" stroke="#EDF5F1" strokeWidth="1.25" />
          <path d="M101 37h22l4 16h-25Z" fill="#173D34" stroke="#EDF5F1" strokeWidth="1.25" />
          <rect x="47" y="40" width="17" height="8" rx="2" fill="#F2C94C" />
          <text x="55.5" y="46" textAnchor="middle" fontSize="5.2" fontWeight="900" fill="#17261E">TV</text>
        </g>
        <rect x="84" y="37" width="29" height="11" rx="3.2" fill="#F2C94C" stroke="#FFF5C7" strokeWidth="1.05" />
        <text x="98.5" y="44.9" textAnchor="middle" fontSize="5.9" fontWeight="900" fill="#17261E">TV COURSE</text>
      </g>

      <g data-race-camera-driver="articulated" data-race-person-scale="cyclist">
        <path d="M91 19C94 15 100 14 105 17l8 8-7 15H91l-7-10Z" fill="#1C4F70" stroke="#E7F0EC" strokeWidth="0.9" />
        <path d="M108 23 116 30 126 28" fill="none" stroke="#D39B75" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="116" cy="30" r="1.5" fill="#D39B75" />
        <path d="M95 39 83 48 77 55M103 39l9 8 8 7" fill="none" stroke="#17261E" strokeWidth="4.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M77 55h9m32-1h8" stroke="#E9EFEC" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M78 53h9l2 3H76Z" fill="#202D29" stroke="#E9EFEC" strokeWidth="0.55" data-race-camera-moto-detail="driver-boots" />
        <path d="M98 16 99 12" stroke="#D39B75" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="101" cy="10" r="4.7" fill="#D39B75" stroke="#6D4837" strokeWidth="0.75" />
        <path d="M96.7 9.4c.2-5 4.2-7.3 8.5-5.8 3.1 1 4.7 3 4.6 5.6l-6.4-1.3Z" fill="#176951" stroke="#102C25" strokeWidth="0.9" />
        <path d="M105.5 9.2h5" stroke="#BDE4DA" strokeWidth="0.7" />
        <path d="M98.3 6.4q4.1-2.1 8.7.2" fill="none" stroke="#D8F0EA" strokeWidth="0.55" strokeDasharray="1.4 1" />
        <path d="M101 14.7q2.4.7 4.5-.4" fill="none" stroke="#8B5D45" strokeWidth="0.42" />
      </g>

      <g data-race-camera-operator="stabilized" data-race-person-scale="cyclist">
        <path d="M57 21C60 17 66 16 71 19l9 10-5 13H58L49 30Z" fill="#263C52" stroke="#E7F0EC" strokeWidth="0.9" />
        <path d="M62 41 52 49 49 55M71 41l10 8 7 6" fill="none" stroke="#17261E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M47 55h9m30 0h9" stroke="#E9EFEC" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M47 53h9l2 3H45Z" fill="#202D29" stroke="#E9EFEC" strokeWidth="0.55" data-race-camera-moto-detail="operator-boots" />
        <path d="M63 18 64 14" stroke="#C78D69" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="64" cy="12" r="4.7" fill="#C78D69" stroke="#6D4837" strokeWidth="0.75" />
        <path d="M59.5 11.3c.5-4.8 4.3-7 8.5-5.5 2.9 1 4.3 3 4.2 5.3l-6.1-1.2Z" fill="#17261E" stroke="#071A17" strokeWidth="0.8" />
        <path d={cameraFacing === "left" ? "M59 21 50 15 43 14" : "M69 21 76 14 82 13"} fill="none" stroke="#C78D69" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        <g className={isMoving ? "cm-camera-stabilizer" : ""} data-race-camera-rig="shoulder-broadcast">
          {cameraFacing === "left" ? (
            <>
              <path d="M58 12 53 6" stroke="#26342E" strokeWidth="1.65" />
              <rect x="29" y="1" width="27" height="15" rx="2.5" fill="#17261E" stroke="#D5E1DC" strokeWidth="1.2" />
              <circle cx="32.5" cy="8.5" r="5.2" fill="#52746C" stroke="#071A17" strokeWidth="1.05" />
              <circle cx="31" cy="8.5" r="2.7" fill="#080E0C" stroke="#A8C4BB" strokeWidth="0.75" />
              <path d="M55 4h10l4 6-14 3Z" fill="#2F4740" stroke="#9EB1AA" strokeWidth="0.65" />
              <path d="M36 1v-6m8 6v-4m7 4v-7" stroke="#9BB1A8" strokeWidth="0.95" data-race-camera-moto-detail="broadcast-aerials" />
              <path d="M28 3h-7l-3 3 10 2" fill="#263D36" stroke="#C9D8D2" strokeWidth="0.7" data-race-camera-moto-detail="shotgun-mic" />
            </>
          ) : (
            <>
              <path d="M69 12 74 6" stroke="#26342E" strokeWidth="1.65" />
              <rect x="73" y="1" width="27" height="15" rx="2.5" fill="#17261E" stroke="#D5E1DC" strokeWidth="1.2" />
              <circle cx="96.5" cy="8.5" r="5.2" fill="#52746C" stroke="#071A17" strokeWidth="1.05" />
              <circle cx="98" cy="8.5" r="2.7" fill="#080E0C" stroke="#A8C4BB" strokeWidth="0.75" />
              <path d="M74 4H64l-4 6 14 3Z" fill="#2F4740" stroke="#9EB1AA" strokeWidth="0.65" />
              <path d="M79 1v-6m8 6v-4m7 4v-7" stroke="#9BB1A8" strokeWidth="0.95" data-race-camera-moto-detail="broadcast-aerials" />
              <path d="M101 3h7l3 3-10 2" fill="#263D36" stroke="#C9D8D2" strokeWidth="0.7" data-race-camera-moto-detail="shotgun-mic" />
            </>
          )}
        </g>
      </g>
    </svg>
  );
}

function TopCameraMotorcycle({
  visualId,
  isMoving,
  cameraFacing,
  animationDelayMs,
}: {
  visualId: string;
  isMoving: boolean;
  cameraFacing: "left" | "right";
  animationDelayMs: number;
}) {
  return (
    <svg
      viewBox="0 0 150 60"
      data-race-camera-motorcycle="top"
      data-race-camera-facing={cameraFacing}
      className={`h-8 w-20 overflow-visible opacity-95 drop-shadow-lg ${isMoving ? "cm-camera-moto" : ""}`}
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <defs>
        <linearGradient id={`${visualId}-top-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9F5F1" />
          <stop offset="0.35" stopColor="#2B806B" />
          <stop offset="1" stopColor="#0B3E34" />
        </linearGradient>
      </defs>
      <ellipse cx="75" cy="31" rx="63" ry="14" fill="rgba(7,26,23,0.18)" />
      <ellipse cx="20" cy="30" rx="11" ry="5" fill="#111815" stroke="#D9E5E0" strokeWidth="1" data-race-camera-moto-wheel="detailed" />
      <ellipse cx="132" cy="30" rx="11" ry="5" fill="#111815" stroke="#D9E5E0" strokeWidth="1" data-race-camera-moto-wheel="detailed" />
      <ellipse cx="20" cy="30" rx="7.5" ry="3" fill="#63776F" stroke="#EFF4F1" strokeWidth="0.55" data-race-camera-moto-detail="brake-disc-top" />
      <ellipse cx="132" cy="30" rx="7.5" ry="3" fill="#63776F" stroke="#EFF4F1" strokeWidth="0.55" data-race-camera-moto-detail="brake-disc-top" />
      <path d="M21 30 54 18h54l24 12-24 12H54Z" fill={`url(#${visualId}-top-body)`} stroke="#E7F0EC" strokeWidth="1.2" />
      <path d="M31 30 61 22h39l20 8-20 8H61Z" fill="none" stroke="#D9EBE5" strokeWidth="0.55" opacity="0.7" data-race-camera-moto-detail="fairing-panels-top" />
      <path d="M98 19 118 25v10l-20 6Z" fill="#B7DDD5" stroke="#315E54" strokeWidth="0.8" />
      <path d="M107 21q8 9 0 18" fill="none" stroke="#F2FAF7" strokeWidth="0.55" opacity="0.7" />
      <ellipse cx="91" cy="30" rx="8" ry="10" fill="#1C4F70" stroke="#E7F0EC" strokeWidth="0.8" data-race-camera-driver="articulated" />
      <circle cx="103" cy="30" r="5.1" fill="#176951" stroke="#102C25" strokeWidth="0.9" />
      <ellipse cx="65" cy="30" rx="8" ry="10" fill="#263C52" stroke="#E7F0EC" strokeWidth="0.8" data-race-camera-operator="stabilized" />
      <circle cx="76" cy="30" r="5.1" fill="#17261E" stroke="#071A17" strokeWidth="0.9" />
      <g className={isMoving ? "cm-camera-stabilizer" : ""} data-race-camera-rig="shoulder-broadcast">
        <rect x={cameraFacing === "left" ? 43 : 72} y="23" width="18" height="14" rx="2" fill="#17261E" stroke="#D7E3DE" strokeWidth="0.8" />
        <circle cx={cameraFacing === "left" ? 45 : 88} cy="30" r="4" fill="#53766D" stroke="#071A17" strokeWidth="0.8" />
        <circle cx={cameraFacing === "left" ? 44 : 89} cy="30" r="2.1" fill="#111A17" stroke="#A7C3BA" strokeWidth="0.45" />
        <path d={cameraFacing === "left" ? "M48 23v-6m6 6v-4" : "M78 23v-6m6 6v-4"} stroke="#9EB5AC" strokeWidth="0.65" data-race-camera-moto-detail="broadcast-aerials-top" />
      </g>
      <rect x="78" y="23" width="7" height="14" rx="2" fill="#F2C94C" />
    </svg>
  );
}

function RaceBroadcastHelicopter({
  visualId,
  isMoving,
}: {
  visualId: string;
  isMoving: boolean;
}) {
  return (
    <svg
      viewBox="0 0 240 104"
      data-race-helicopter="occasional"
      data-race-helicopter-detail="broadcast-airframe"
      className={`absolute right-[18%] top-[5%] h-16 w-40 overflow-visible drop-shadow-xl md:h-[4.5rem] md:w-44 ${
        isMoving ? "cm-race-helicopter" : ""
      }`}
    >
      <defs>
        <linearGradient id={`${visualId}-helicopter`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FAFDFC" />
          <stop offset="0.28" stopColor="#C9DDD7" />
          <stop offset="0.62" stopColor="#72978E" />
          <stop offset="1" stopColor="#294A42" />
        </linearGradient>
        <linearGradient id={`${visualId}-helicopter-belly`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#64877E" />
          <stop offset="1" stopColor="#17352E" />
        </linearGradient>
        <linearGradient id={`${visualId}-helicopter-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E9FBFC" stopOpacity="0.97" />
          <stop offset="0.38" stopColor="#7EB4BC" stopOpacity="0.9" />
          <stop offset="1" stopColor="#213E48" stopOpacity="0.96" />
        </linearGradient>
        <linearGradient id={`${visualId}-helicopter-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3F7F5" />
          <stop offset="0.5" stopColor="#81948D" />
          <stop offset="1" stopColor="#263C35" />
        </linearGradient>
        <radialGradient id={`${visualId}-helicopter-lens`} cx="38%" cy="32%" r="68%">
          <stop offset="0" stopColor="#BDE8E0" />
          <stop offset="0.42" stopColor="#396B66" />
          <stop offset="1" stopColor="#071A17" />
        </radialGradient>
      </defs>

      <g data-race-helicopter-detail="main-rotor-blur" className={isMoving ? "cm-helicopter-rotor" : ""}>
        <ellipse cx="94" cy="17" rx="86" ry="3.2" fill="#193A33" opacity="0.18" />
        <path d="M7 17h174M94 15 30 5m64 10 67 9" stroke="#1A332C" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <path d="M88 17v14h13V17" fill={`url(#${visualId}-helicopter-metal)`} stroke="#233E37" strokeWidth="1.3" data-race-helicopter-detail="rotor-mast" />
      <path d="M83 31h23l6 7H77Z" fill="#294940" stroke="#D8E5E0" strokeWidth="1" data-race-helicopter-detail="gearbox-fairing" />

      <g data-race-helicopter-detail="fuselage-volumes">
        <path d="M22 58c0-20 17-34 43-36h38c20 1 34 11 43 29l-3 15c-10 14-27 21-51 22H57c-22-1-36-10-35-30Z" fill={`url(#${visualId}-helicopter)`} stroke="#17352E" strokeWidth="1.8" />
        <path d="M30 65c20 8 76 11 111-4l2 8c-12 12-29 18-52 19H56c-15-1-25-6-26-23Z" fill={`url(#${visualId}-helicopter-belly)`} opacity="0.9" />
        <path d="M136 48 207 35l9 7-79 24Z" fill="#55786F" stroke="#203E36" strokeWidth="1.55" data-race-helicopter-detail="tapered-tail-boom" />
        <path d="M142 52 203 42" stroke="#E5EFEB" strokeWidth="1.1" opacity="0.7" />
        <path d="m199 37 11-25 10 3-3 29Z" fill="#73978E" stroke="#203E36" strokeWidth="1.45" data-race-helicopter-detail="tail-fin" />
        <path d="m199 37 12-11 7 18" fill="#DCEAE5" opacity="0.52" />
      </g>

      <g data-race-helicopter-detail="cockpit-glazing">
        <path d="M29 55c3-15 15-24 33-26h12v27Z" fill={`url(#${visualId}-helicopter-glass)`} stroke="#385E59" strokeWidth="1.25" />
        <path d="M76 29h17c14 1 25 9 32 25H76Z" fill={`url(#${visualId}-helicopter-glass)`} stroke="#385E59" strokeWidth="1.25" />
        <path d="M75 29v27M49 34l9 21M93 30l-5 25" fill="none" stroke="#D8EEEB" strokeWidth="1" opacity="0.84" />
        <path d="M34 48q19-15 36-13M82 34q20-3 33 13" fill="none" stroke="#FFFFFF" strokeWidth="1.4" opacity="0.48" />
        <circle cx="61" cy="47" r="5.3" fill="#30453F" opacity="0.86" data-race-helicopter-detail="pilot-silhouette" />
        <path d="M55 55q6-9 12 0" fill="#243A34" opacity="0.88" />
        <circle cx="96" cy="45" r="5" fill="#30453F" opacity="0.78" data-race-helicopter-detail="pilot-silhouette" />
      </g>

      <g data-race-helicopter-detail="panel-lines" fill="none" stroke="#31574E" strokeWidth="0.75" opacity="0.86">
        <path d="M76 57v25M109 31v49M35 66q42 9 102-2" />
        <path d="M116 39h15m-14 5h17m-10 28h11" strokeDasharray="2.2 1.6" />
        <circle cx="120" cy="59" r="1.2" fill="#D7E4DF" />
        <circle cx="128" cy="58" r="1.2" fill="#D7E4DF" />
      </g>
      <path d="M84 67h31" stroke="#F2C94C" strokeWidth="4" opacity="0.86" data-race-helicopter-detail="broadcast-livery" />
      <text x="99" y="65.2" textAnchor="middle" fontSize="5.4" fontWeight="900" letterSpacing="0.9" fill="#F7FBF9">LIVE</text>
      <text x="151" y="49" fontSize="4.6" fontWeight="800" letterSpacing="0.55" fill="#EDF5F2" transform="rotate(-10 151 49)">F-CS35</text>

      <g data-race-helicopter-detail="fenestron">
        <circle cx="211" cy="36" r="10.2" fill="#23433B" stroke="#E3ECE8" strokeWidth="1.25" />
        <circle cx="211" cy="36" r="7.2" fill="#77978E" stroke="#142C26" strokeWidth="0.8" />
        <g className={isMoving ? "cm-helicopter-tail-rotor" : ""}>
          <path d="M211 29v14M204 36h14M206 31l10 10m0-10-10 10" stroke="#EAF2EF" strokeWidth="1.05" />
        </g>
        <circle cx="211" cy="36" r="1.5" fill="#17261E" />
      </g>

      <g data-race-helicopter-detail="dual-skids" fill="none" stroke={`url(#${visualId}-helicopter-metal)`} strokeLinecap="round" strokeLinejoin="round">
        <path d="M52 84 45 98m69-14 10 14M38 98h95" strokeWidth="2.5" />
        <path d="M64 82 59 93m45-10 7 10M53 93h65" strokeWidth="1.55" opacity="0.78" />
      </g>

      <g data-race-helicopter-detail="broadcast-gimbal">
        <path d="M43 76v7" stroke="#26473F" strokeWidth="2" />
        <circle cx="43" cy="88" r="9" fill={`url(#${visualId}-helicopter-metal)`} stroke="#17352E" strokeWidth="1.25" />
        <circle cx="40" cy="88" r="4.4" fill={`url(#${visualId}-helicopter-lens)`} stroke="#DDE9E4" strokeWidth="0.8" />
        <circle cx="38.7" cy="86.7" r="1.1" fill="#EAFBF8" opacity="0.82" />
      </g>

      <g data-race-helicopter-detail="aerials" fill="none" stroke="#1D3932" strokeLinecap="round">
        <path d="M128 29 139 17M151 51l18-15M72 84 66 94" strokeWidth="1.15" />
        <circle cx="139" cy="17" r="1.2" fill="#F2C94C" />
      </g>
    </svg>
  );
}

function stableVisualHash(value: string) {
  return [...value].reduce(
    (total, character) =>
      (total * 31 + character.charCodeAt(0)) >>> 0,
    17,
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
