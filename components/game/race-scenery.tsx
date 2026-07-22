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
        {Array.from({ length: 18 }, (_, index) => {
          const x = 18 + index * 58;
          const y = barrierY(x) - 20 - (index % 3) * 2;
          return <Spectator key={x} x={x} y={y} color={CROWD_COLORS[index % CROWD_COLORS.length]} />;
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
  return (
    <>
      <path d="M0 165Q160 91 320 159T640 153T1000 145V227H0Z" fill="#7EA96F" />
      {Array.from({ length: 9 }, (_, index) => {
        const x = 38 + index * 113;
        const y = 153 + (index % 3) * 10;
        const width = 62 + (index % 2) * 10;
        return (
          <g key={x} transform={`translate(${x} ${y})`}>
            <rect width={width} height="53" rx="2" fill={index % 3 === 0 ? "#E1C599" : index % 3 === 1 ? "#F3E7CD" : "#C9D7C2"} stroke="#6D735F" strokeWidth="1.4" />
            <path d={`M-7 1 ${width / 2} -29 ${width + 7} 1Z`} fill={index % 2 ? "#A94735" : "#805E4C"} stroke="#5A463B" strokeWidth="1.4" />
            <rect x="9" y="17" width="12" height="13" fill="#75A8B7" stroke="#FFFDF4" strokeWidth="2" />
            <rect x={width - 22} y="17" width="12" height="13" fill="#75A8B7" stroke="#FFFDF4" strokeWidth="2" />
          </g>
        );
      })}
      <g transform="translate(492 104)">
        <rect x="0" y="30" width="52" height="85" fill="#EADBBE" stroke="#665C4C" strokeWidth="1.5" />
        <path d="M-7 31 26 0l34 31Z" fill="#7C5A45" />
        <rect x="20" y="50" width="13" height="25" fill="#7195A0" />
        <circle cx="26" cy="18" r="6" fill="#FFFDF4" stroke="#63594B" strokeWidth="1.5" />
      </g>
    </>
  );
}

function UrbanScenery() {
  return (
    <>
      <path d="M0 181 34 181V89h74v92h26V55h93v126h29v-78h82v78h34V72h102v109h26v-59h88v59h36V43h112v138h25V93h76v88h36v-66h91v66h66v48H0Z" fill="#536B67" opacity="0.9" />
      <path d="M0 196h1000v38H0Z" fill="#728E81" />
      {Array.from({ length: 17 }, (_, index) => <rect key={index} x={18 + index * 61} y={104 + index % 3 * 18} width="18" height="7" rx="1" fill="#D8E8D9" opacity="0.68" />)}
      {Array.from({ length: 8 }, (_, index) => {
        const x = 65 + index * 128;
        return <g key={x}><path d={`M${x} 149v58`} stroke="#243B35" strokeWidth="3" /><path d={`M${x} 150h13`} stroke="#243B35" strokeWidth="3" /><circle cx={x + 15} cy="151" r="4" fill="#FFF2B5" /></g>;
      })}
    </>
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
      {Array.from({ length: 14 }, (_, index) => (
        <Spectator key={index} x={105 + index * 64} y={181 + (index % 4) * 4} color={CROWD_COLORS[index % CROWD_COLORS.length]} />
      ))}
    </g>
  );
}

function Spectator({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="-17" r="5.5" fill="#DDA37F" stroke="#5F4133" strokeWidth="0.7" />
      <path d="M-6-11h12l4 18h-20Z" fill={color} stroke="#31423A" strokeWidth="0.8" />
      <path d="m-5-8-8 10m18-10L14 0" stroke="#DDA37F" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function TopCrowd({ y, flip }: { y: number; flip: boolean }) {
  return (
    <g transform={flip ? `translate(0 ${y * 2}) scale(1 -1)` : undefined}>
      {Array.from({ length: 22 }, (_, index) => {
        const x = 15 + index * 47;
        return (
          <g key={x} transform={`translate(${x} ${y + (index % 3) * 2})`}>
            <circle cx="0" cy="0" r="5" fill="#DDA37F" />
            <rect x="-7" y="5" width="14" height="8" rx="3" fill={CROWD_COLORS[index % CROWD_COLORS.length]} />
          </g>
        );
      })}
    </g>
  );
}
