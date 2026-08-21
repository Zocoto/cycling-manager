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
      className={`h-10 w-24 overflow-visible drop-shadow-xl md:h-11 md:w-28 ${
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
      </defs>
      <ellipse cx="85" cy="66" rx="72" ry="3.2" fill="rgba(7,26,23,0.22)" />

      {[35, 132].map((wheelX) => (
        <g key={wheelX} data-race-camera-moto-wheel="detailed">
          <circle cx={wheelX} cy="55" r="12.4" fill="#101714" stroke="#283A34" strokeWidth="1.6" />
          <circle cx={wheelX} cy="55" r="8.9" fill="#A7B5AF" stroke="#EDF3F0" strokeWidth="1" />
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
        <path d="M49 51 25 56" stroke="#647A73" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M23 56h25" stroke="#17261E" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M136 40h8l4 5-11 3" fill="#F6D66A" stroke="#E7EEE9" strokeWidth="0.8" />
        <rect x="87" y="38" width="24" height="9" rx="3.2" fill="#F2C94C" stroke="#FFF5C7" strokeWidth="0.7" />
        <text x="99" y="44.6" textAnchor="middle" fontSize="5.5" fontWeight="900" fill="#17261E">TV COURSE</text>
      </g>

      <g data-race-camera-driver="articulated" data-race-person-scale="cyclist">
        <path d="M91 19C94 15 100 14 105 17l8 8-7 15H91l-7-10Z" fill="#1C4F70" stroke="#E7F0EC" strokeWidth="0.9" />
        <path d="M108 23 116 30 126 28" fill="none" stroke="#D39B75" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="116" cy="30" r="1.5" fill="#D39B75" />
        <path d="M95 39 83 48 77 55M103 39l9 8 8 7" fill="none" stroke="#17261E" strokeWidth="4.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M77 55h9m32-1h8" stroke="#E9EFEC" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M98 16 99 12" stroke="#D39B75" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="101" cy="10" r="4.7" fill="#D39B75" stroke="#6D4837" strokeWidth="0.75" />
        <path d="M96.7 9.4c.2-5 4.2-7.3 8.5-5.8 3.1 1 4.7 3 4.6 5.6l-6.4-1.3Z" fill="#176951" stroke="#102C25" strokeWidth="0.9" />
        <path d="M105.5 9.2h5" stroke="#BDE4DA" strokeWidth="0.7" />
      </g>

      <g data-race-camera-operator="stabilized" data-race-person-scale="cyclist">
        <path d="M57 21C60 17 66 16 71 19l9 10-5 13H58L49 30Z" fill="#263C52" stroke="#E7F0EC" strokeWidth="0.9" />
        <path d="M62 41 52 49 49 55M71 41l10 8 7 6" fill="none" stroke="#17261E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M47 55h9m30 0h9" stroke="#E9EFEC" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M63 18 64 14" stroke="#C78D69" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="64" cy="12" r="4.7" fill="#C78D69" stroke="#6D4837" strokeWidth="0.75" />
        <path d="M59.5 11.3c.5-4.8 4.3-7 8.5-5.5 2.9 1 4.3 3 4.2 5.3l-6.1-1.2Z" fill="#17261E" stroke="#071A17" strokeWidth="0.8" />
        <path d={cameraFacing === "left" ? "M59 21 50 15 43 14" : "M69 21 76 14 82 13"} fill="none" stroke="#C78D69" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        <g className={isMoving ? "cm-camera-stabilizer" : ""} data-race-camera-rig="shoulder-broadcast">
          {cameraFacing === "left" ? (
            <>
              <path d="M58 12 52 7" stroke="#26342E" strokeWidth="1.3" />
              <rect x="36" y="5" width="19" height="10" rx="2" fill="#17261E" stroke="#D5E1DC" strokeWidth="0.8" />
              <circle cx="38.5" cy="10" r="3.4" fill="#52746C" stroke="#071A17" strokeWidth="0.8" />
              <path d="M54 7h8l3 4-11 2Z" fill="#2F4740" />
            </>
          ) : (
            <>
              <path d="M69 12 74 7" stroke="#26342E" strokeWidth="1.3" />
              <rect x="73" y="5" width="19" height="10" rx="2" fill="#17261E" stroke="#D5E1DC" strokeWidth="0.8" />
              <circle cx="89.5" cy="10" r="3.4" fill="#52746C" stroke="#071A17" strokeWidth="0.8" />
              <path d="M74 7h-8l-3 4 11 2Z" fill="#2F4740" />
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
      <path d="M21 30 54 18h54l24 12-24 12H54Z" fill={`url(#${visualId}-top-body)`} stroke="#E7F0EC" strokeWidth="1.2" />
      <path d="M98 19 118 25v10l-20 6Z" fill="#B7DDD5" stroke="#315E54" strokeWidth="0.8" />
      <ellipse cx="91" cy="30" rx="8" ry="10" fill="#1C4F70" stroke="#E7F0EC" strokeWidth="0.8" data-race-camera-driver="articulated" />
      <circle cx="103" cy="30" r="5.1" fill="#176951" stroke="#102C25" strokeWidth="0.9" />
      <ellipse cx="65" cy="30" rx="8" ry="10" fill="#263C52" stroke="#E7F0EC" strokeWidth="0.8" data-race-camera-operator="stabilized" />
      <circle cx="76" cy="30" r="5.1" fill="#17261E" stroke="#071A17" strokeWidth="0.9" />
      <g className={isMoving ? "cm-camera-stabilizer" : ""} data-race-camera-rig="shoulder-broadcast">
        <rect x={cameraFacing === "left" ? 43 : 72} y="23" width="18" height="14" rx="2" fill="#17261E" stroke="#D7E3DE" strokeWidth="0.8" />
        <circle cx={cameraFacing === "left" ? 45 : 88} cy="30" r="4" fill="#53766D" stroke="#071A17" strokeWidth="0.8" />
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
      viewBox="0 0 190 78"
      data-race-helicopter="occasional"
      className={`absolute right-[20%] top-[7%] h-12 w-28 overflow-visible drop-shadow-lg ${
        isMoving ? "cm-race-helicopter" : ""
      }`}
    >
      <defs>
        <linearGradient id={`${visualId}-helicopter`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2F7F5" />
          <stop offset="0.55" stopColor="#86AFA5" />
          <stop offset="1" stopColor="#2D5148" />
        </linearGradient>
      </defs>
      <ellipse cx="75" cy="68" rx="58" ry="5" fill="rgba(7,26,23,0.2)" />
      <path d="M28 45c3-18 18-30 41-30h21c17 0 29 8 35 22l50 1v6l-52 7c-8 10-21 15-39 15H58c-20 0-33-8-30-21Z" fill={`url(#${visualId}-helicopter)`} stroke="#17352E" strokeWidth="2" />
      <path d="M42 43c4-13 15-20 31-20h17l17 20Z" fill="#BFE3E1" stroke="#486C65" strokeWidth="1.3" />
      <path d="M75 23v20M41 43h67" stroke="#567A72" strokeWidth="1" />
      <path d="M123 39 172 22l4 5-34 14" fill="#587A72" stroke="#24443C" strokeWidth="1.4" />
      <path d="m168 23 12-12 2 18" fill="#D9E8E3" stroke="#24443C" strokeWidth="1.2" />
      <g className={isMoving ? "cm-helicopter-rotor" : ""}>
        <path d="M13 13h124" stroke="#1A332C" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M75 13v8" stroke="#1A332C" strokeWidth="2" />
      </g>
      <path d="M50 65 42 74m62-9 9 9M37 74h82" fill="none" stroke="#1E3932" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="112" cy="48" r="6" fill="#17261E" stroke="#F2C94C" strokeWidth="1.2" />
      <path d="M109 48h6M112 45v6" stroke="#D7E9E3" strokeWidth="0.8" />
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
