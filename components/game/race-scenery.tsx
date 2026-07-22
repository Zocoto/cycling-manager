import type { RaceSceneryKind } from "@/lib/game/race-visuals";

const CROWD_COLORS = ["#F2C94C", "#FFFDF4", "#EF5B65", "#2457C5", "#43C892"];

export function RaceSceneryBackdrop({
  kind,
  isMoving,
  showSpectators,
}: {
  kind: RaceSceneryKind;
  isMoving: boolean;
  showSpectators: boolean;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 1000 320"
        preserveAspectRatio="none"
        className={`absolute -left-[8%] top-0 h-full w-[116%] ${isMoving ? "cm-race-scenery" : ""}`}
      >
        {kind === "forest" ? <ForestScenery /> : null}
        {kind === "fields" ? <FieldsScenery /> : null}
        {kind === "meadow" ? <MeadowScenery /> : null}
        {kind === "coast" ? <CoastScenery /> : null}
        {kind === "village" ? <VillageScenery /> : null}
        {kind === "urban" ? <UrbanScenery /> : null}
        {showSpectators ? <ScenerySpectators /> : null}
      </svg>
    </div>
  );
}

export function FinishRoadsideInfrastructure({
  mode,
  roadLeftY = 224,
  roadRightY = 224,
}: {
  mode: "side" | "top";
  roadLeftY?: number;
  roadRightY?: number;
}) {
  if (mode === "top") {
    return (
      <svg aria-hidden="true" viewBox="0 0 1000 320" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-10 h-full w-full">
        <g className="cm-crowd-wave">
          <TopCrowd y={11} flip={false} />
          <TopCrowd y={309} flip />
        </g>
        <g fill="none" stroke="#E8ECEA" strokeWidth="3">
          <path d="M0 27H1000M0 293H1000" />
          <path d="M0 34H1000M0 286H1000" stroke="#AAB7B1" strokeWidth="1.5" />
        </g>
        {Array.from({ length: 16 }, (_, index) => {
          const x = 22 + index * 66;
          return <path key={x} d={`M${x} 22v18M${x} 280v18`} stroke="#D5DDD9" strokeWidth="2" />;
        })}
        {Array.from({ length: 7 }, (_, index) => {
          const x = 50 + index * 145;
          return (
            <g key={x}>
              <rect x={x} y="27" width="86" height="11" rx="2" fill={index % 2 ? "#FFFDF4" : "#176951"} />
              <rect x={x} y="282" width="86" height="11" rx="2" fill={index % 2 ? "#176951" : "#FFFDF4"} />
            </g>
          );
        })}
      </svg>
    );
  }

  const barrierY = (x: number) =>
    roadLeftY + (roadRightY - roadLeftY) * (x / 1000) - 10;

  return (
    <svg aria-hidden="true" viewBox="0 0 1000 320" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-10 h-full w-full">
      <g className="cm-crowd-wave">
        {Array.from({ length: 14 }, (_, index) => {
          const x = 28 + index * 75;
          const y = barrierY(x) - 5 - (index % 3) * 1.5;
          return <Spectator key={x} x={x} y={y} color={CROWD_COLORS[index % CROWD_COLORS.length]} scale={0.62} opacity={0.82} />;
        })}
      </g>
      <path d={`M0 ${barrierY(0)} 1000 ${barrierY(1000)}`} fill="none" stroke="#EEF2F0" strokeWidth="4" />
      <path d={`M0 ${barrierY(0) + 8} 1000 ${barrierY(1000) + 8}`} fill="none" stroke="#AAB7B1" strokeWidth="2" />
      {Array.from({ length: 18 }, (_, index) => {
        const x = index * 62;
        const y = barrierY(x);
        return <path key={x} d={`M${x} ${y - 5}v20`} stroke="#DDE4E1" strokeWidth="2.5" />;
      })}
      {Array.from({ length: 7 }, (_, index) => {
        const x = 28 + index * 148;
        const y = barrierY(x);
        return <rect key={x} x={x} y={y - 1} width="92" height="11" rx="2" fill={index % 2 ? "#FFFDF4" : "#176951"} opacity="0.95" />;
      })}
    </svg>
  );
}

function ForestScenery() {
  return (
    <>
      <path d="M0 168 120 78l92 48 98-75 116 106 111-86 95 69 110-78 105 76 153-79v156H0Z" fill="#47785D" opacity="0.62" />
      <path d="M0 187 138 112l120 70 102-85 118 87 118-76 112 71 118-88 174 91v52H0Z" fill="#315D47" opacity="0.82" />
      {Array.from({ length: 18 }, (_, index) => {
        const x = index * 62 - 20;
        const scale = 0.72 + (index % 4) * 0.12;
        return <Tree key={x} x={x} y={194 + (index % 3) * 5} scale={scale} />;
      })}
    </>
  );
}

function FieldsScenery() {
  return (
    <>
      <path d="M0 142Q190 91 374 143T730 137T1000 123V226H0Z" fill="#7FAE68" />
      <path d="M0 164Q210 121 420 171T760 160T1000 149V229H0Z" fill="#D2BD62" opacity="0.9" />
      <path d="M0 188Q190 142 390 190T720 180T1000 170V234H0Z" fill="#9DBF69" />
      {Array.from({ length: 11 }, (_, index) => (
        <path key={index} d={`M${index * 105 - 120} 232Q${index * 105 - 30} 175 ${index * 105 + 100} 150`} fill="none" stroke={index % 2 ? "#F5E09B" : "#6F9C59"} strokeWidth="4" opacity="0.62" />
      ))}
      {[140, 430, 760].map((x, index) => (
        <g key={x} transform={`translate(${x} ${190 - index * 7})`}>
          <ellipse cx="0" cy="5" rx="20" ry="8" fill="#AA7B3D" opacity="0.35" />
          <circle cx="0" cy="0" r="13" fill="#C99D50" stroke="#8A642F" strokeWidth="2" />
          <path d="M-8-4Q0-10 8-4M-9 3Q0-3 9 3" fill="none" stroke="#E6C477" strokeWidth="2" />
        </g>
      ))}
    </>
  );
}

function MeadowScenery() {
  return (
    <>
      <path d="M0 164Q140 98 290 155T575 151T820 132T1000 153V235H0Z" fill="#78AE6B" />
      <path d="M0 194Q170 143 340 190T690 186T1000 176V237H0Z" fill="#9DC77E" />
      <g stroke="#F3EEE0" strokeWidth="2.2" opacity="0.82">
        <path d="M20 194 980 184M20 205 980 195" />
        {Array.from({ length: 14 }, (_, index) => <path key={index} d={`M${35 + index * 74} 185v29`} />)}
      </g>
      {Array.from({ length: 26 }, (_, index) => (
        <circle key={index} cx={25 + index * 41} cy={215 + (index % 4) * 4} r={index % 3 === 0 ? 2.2 : 1.5} fill={CROWD_COLORS[index % CROWD_COLORS.length]} opacity="0.85" />
      ))}
    </>
  );
}

function CoastScenery() {
  return (
    <>
      <path d="M0 142Q150 128 300 144T605 141T1000 136V228H0Z" fill="#4C9FB1" opacity="0.88" />
      {Array.from({ length: 5 }, (_, index) => <path key={index} d={`M${index * 230 - 30} ${164 + index % 2 * 17}q65-13 132 0t132 0`} fill="none" stroke="#D7F0F1" strokeWidth="2.2" opacity="0.6" />)}
      <path d="M0 201 120 164l97 31 105-19 93 48H0Zm1000-20-126-47-89 38-93 52h308Z" fill="#C5B27E" />
      <g transform="translate(92 102)">
        <path d="M-7 62 0 0l9 62Z" fill="#F7F3E7" stroke="#6F746F" strokeWidth="1.5" />
        <path d="M-1 13h5v12h-6Z" fill="#EF5B65" />
        <path d="m-5 0 5-8 6 8Z" fill="#A94735" />
        <path d="M-13-7h27" stroke="#FFF5C5" strokeWidth="2" opacity="0.9" />
      </g>
      {Array.from({ length: 7 }, (_, index) => <path key={index} d={`m${310 + index * 91} ${106 + index % 3 * 12} 7-3 7 3`} fill="none" stroke="#F7FAF8" strokeWidth="1.4" strokeLinecap="round" />)}
    </>
  );
}

function VillageScenery() {
  const houses = [
    { x: 24, y: 145, width: 82, floors: 2, tone: "#E1C599", roof: "#805E4C" },
    { x: 132, y: 158, width: 72, floors: 1, tone: "#F3E7CD", roof: "#A94735" },
    { x: 232, y: 148, width: 88, floors: 2, tone: "#C9D7C2", roof: "#705145" },
    { x: 350, y: 161, width: 74, floors: 1, tone: "#E7D0AA", roof: "#A94735" },
    { x: 578, y: 153, width: 86, floors: 2, tone: "#F1E5CD", roof: "#775547" },
    { x: 696, y: 161, width: 76, floors: 1, tone: "#CBD9C5", roof: "#9A493A" },
    { x: 800, y: 146, width: 91, floors: 2, tone: "#DFC298", roof: "#775547" },
    { x: 918, y: 159, width: 70, floors: 1, tone: "#F1E5CD", roof: "#A94735" },
  ] as const;

  return (
    <>
      <path d="M0 165Q160 91 320 159T640 153T1000 145V227H0Z" fill="#7EA96F" />
      {houses.map((house, index) => (
        <VillageHouse key={house.x} {...house} index={index} />
      ))}
      <g transform="translate(492 104)">
        <rect x="0" y="30" width="52" height="85" fill="#EADBBE" stroke="#665C4C" strokeWidth="1.5" />
        <path d="M-7 31 26 0l34 31Z" fill="#7C5A45" />
        <path d="M4 38h44M4 43h44" stroke="#C8B99B" strokeWidth="1" opacity="0.7" />
        <rect x="20" y="50" width="13" height="25" fill="#7195A0" />
        <path d="M26.5 50v25M20 62.5h13" stroke="#E7F0EC" strokeWidth="1.2" />
        <circle cx="26" cy="18" r="6" fill="#FFFDF4" stroke="#63594B" strokeWidth="1.5" />
        <path d="M26 12v12M20 18h12" stroke="#63594B" strokeWidth="1" />
      </g>
    </>
  );
}

function UrbanScenery() {
  const buildings = [
    { x: 8, width: 102, height: 104, tone: "#58716C", rows: 4 },
    { x: 126, width: 88, height: 140, tone: "#4D6662", rows: 6 },
    { x: 230, width: 112, height: 91, tone: "#657C77", rows: 3 },
    { x: 360, width: 104, height: 124, tone: "#516B66", rows: 5 },
    { x: 482, width: 91, height: 78, tone: "#6B817A", rows: 3 },
    { x: 591, width: 119, height: 151, tone: "#49615E", rows: 6 },
    { x: 728, width: 87, height: 107, tone: "#617A73", rows: 4 },
    { x: 833, width: 104, height: 84, tone: "#566F69", rows: 3 },
    { x: 951, width: 72, height: 119, tone: "#4F6863", rows: 5 },
  ] as const;

  return (
    <>
      <path d="M0 173Q230 143 470 166T1000 151V229H0Z" fill="#678878" opacity="0.48" />
      {buildings.map((building, index) => (
        <UrbanBuilding key={building.x} {...building} index={index} />
      ))}
      <path d="M0 196h1000v38H0Z" fill="#728E81" />
      <path d="M0 197h1000" stroke="#C1CEC8" strokeWidth="3" opacity="0.72" />
      {Array.from({ length: 8 }, (_, index) => {
        const x = 65 + index * 128;
        return <g key={x}><path d={`M${x} 149v58`} stroke="#243B35" strokeWidth="3" /><path d={`M${x} 150h13`} stroke="#243B35" strokeWidth="3" /><circle cx={x + 15} cy="151" r="4" fill="#FFF2B5" /></g>;
      })}
    </>
  );
}

function VillageHouse({
  x,
  y,
  width,
  floors,
  tone,
  roof,
  index,
}: {
  x: number;
  y: number;
  width: number;
  floors: number;
  tone: string;
  roof: string;
  index: number;
}) {
  const height = floors === 2 ? 66 : 52;
  const windowRows = floors === 2 ? [15, 36] : [17];

  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height={height} rx="2" fill={tone} stroke="#626A58" strokeWidth="1.3" />
      <path d={`M-7 1 ${width / 2} -27 ${width + 7} 1Z`} fill={roof} stroke="#5A463B" strokeWidth="1.4" />
      <path d={`M2 -2 ${width / 2} -23 ${width - 2} -2`} fill="none" stroke="#D68B70" strokeWidth="1.2" opacity="0.65" />
      {index % 2 === 0 ? (
        <g>
          <rect x={width - 18} y="-23" width="9" height="18" fill="#75594A" stroke="#554035" strokeWidth="1" />
          <path d={`M${width - 20} -23h13`} stroke="#3F302A" strokeWidth="2" />
        </g>
      ) : null}
      {windowRows.flatMap((windowY) => [10, width - 25].map((windowX) => (
        <g key={`${windowX}-${windowY}`}>
          <rect x={windowX} y={windowY} width="14" height="14" rx="1" fill="#77A7B1" stroke="#FFFDF4" strokeWidth="1.8" />
          <path d={`M${windowX + 7} ${windowY + 1}v12M${windowX + 1} ${windowY + 7}h12`} stroke="#E8F2EE" strokeWidth="0.9" />
        </g>
      )))}
      <rect x={width / 2 - 7} y={height - 25} width="14" height="25" rx="1.5" fill="#765746" stroke="#4F3B31" strokeWidth="1" />
      <circle cx={width / 2 + 4} cy={height - 12} r="1" fill="#E5C56D" />
      <path d={`M2 ${height - 2}h${width - 4}`} stroke="#B69D72" strokeWidth="2" opacity="0.7" />
    </g>
  );
}

function UrbanBuilding({
  x,
  width,
  height,
  tone,
  rows,
  index,
}: {
  x: number;
  width: number;
  height: number;
  tone: string;
  rows: number;
  index: number;
}) {
  const top = 196 - height;
  const columns = width > 100 ? 4 : 3;
  const windowWidth = 11;
  const horizontalGap = (width - columns * windowWidth) / (columns + 1);

  return (
    <g>
      <rect x={x} y={top} width={width} height={height} fill={tone} stroke="#344C47" strokeWidth="1.5" />
      <path d={`M${x - 3} ${top}h${width + 6}`} stroke="#B6C5BF" strokeWidth="3" opacity="0.65" />
      {index % 3 === 1 ? (
        <g>
          <rect x={x + width * 0.36} y={top - 10} width={width * 0.28} height="10" fill="#3C5550" />
          <path d={`M${x + width * 0.5} ${top - 10}v-17`} stroke="#314741" strokeWidth="2" />
        </g>
      ) : null}
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: columns }, (_, column) => {
          const windowX = x + horizontalGap + column * (windowWidth + horizontalGap);
          const windowY = top + 15 + row * 19;
          return (
            <g key={`${row}-${column}`}>
              <rect x={windowX} y={windowY} width={windowWidth} height="8" rx="1" fill={(row + column + index) % 5 === 0 ? "#FFF0AE" : "#B7D1D1"} opacity="0.78" />
              <path d={`M${windowX + windowWidth / 2} ${windowY}v8`} stroke="#5B7775" strokeWidth="0.7" />
            </g>
          );
        })
      )}
      {index % 2 === 0 ? (
        <path d={`M${x + 8} ${top + height * 0.58}h${width - 16}m-${width - 21} 5h${width - 26}`} stroke="#CAD4CF" strokeWidth="1.5" opacity="0.58" />
      ) : null}
    </g>
  );
}

function Tree({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-4" y="-31" width="8" height="34" rx="2" fill="#5E4833" />
      <path d="M0-98-31-43h18l-23 38h72L13-43h19Z" fill="#1E4935" stroke="#163829" strokeWidth="1.5" />
      <path d="M0-84-20-43h12l-15 25h46L8-43h13Z" fill="#2D6247" opacity="0.7" />
    </g>
  );
}

function ScenerySpectators() {
  return (
    <g className="cm-crowd-wave">
      {Array.from({ length: 10 }, (_, index) => (
        <Spectator key={index} x={90 + index * 94} y={190 + (index % 4) * 3} color={CROWD_COLORS[index % CROWD_COLORS.length]} scale={0.56} opacity={0.74} />
      ))}
    </g>
  );
}

function Spectator({
  x,
  y,
  color,
  scale = 1,
  opacity = 1,
}: {
  x: number;
  y: number;
  color: string;
  scale?: number;
  opacity?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <circle cx="0" cy="-17" r="5.5" fill="#DDA37F" stroke="#5F4133" strokeWidth="0.7" />
      <path d="M-6-11h12l4 18h-20Z" fill={color} stroke="#31423A" strokeWidth="0.8" />
      <path d="m-5-8-8 10m18-10L14 0" stroke="#DDA37F" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function TopCrowd({ y, flip }: { y: number; flip: boolean }) {
  return (
    <g transform={flip ? `translate(0 ${y * 2}) scale(1 -1)` : undefined} opacity="0.8">
      {Array.from({ length: 17 }, (_, index) => {
        const x = 20 + index * 60;
        return (
          <g key={x} transform={`translate(${x} ${y + (index % 3) * 2})`}>
            <circle cx="0" cy="0" r="3.4" fill="#DDA37F" />
            <rect x="-5" y="3.5" width="10" height="5.5" rx="2" fill={CROWD_COLORS[index % CROWD_COLORS.length]} />
          </g>
        );
      })}
    </g>
  );
}
