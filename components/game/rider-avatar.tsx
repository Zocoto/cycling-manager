import { useId, type ReactNode } from "react";

import {
  createRiderAvatarDesign,
  type RiderAvatarDesign,
} from "@/lib/rider-avatar";
import {
  FREE_AGENT_RIDER_JERSEY,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";

type RiderAvatarProps = {
  profileKey: string | null | undefined;
  seed: bigint | number | string | null | undefined;
  riderId?: string;
  age?: number;
  jersey?: RiderJerseyAppearance | null;
  label?: string;
  className?: string;
};

export function RiderAvatar({
  profileKey,
  seed,
  riderId = "rider",
  age = 25,
  jersey = FREE_AGENT_RIDER_JERSEY,
  label = "Portrait généré du coureur",
  className = "h-12 w-12",
}: RiderAvatarProps) {
  const rawId = useId();
  const svgId = rawId.replace(/:/g, "");
  const shoulderClipId = `rider-shoulders-${svgId}`;
  const design = createRiderAvatarDesign({
    profileKey,
    seed,
    fallbackKey: riderId,
    age,
  });
  const resolvedJersey = jersey ?? FREE_AGENT_RIDER_JERSEY;

  const centerX = 48;
  const faceTop = 20;
  const faceBottom = faceTop + design.faceHeight;
  const foreheadHalfWidth = design.foreheadWidth / 2;
  const cheekboneHalfWidth = design.cheekboneWidth / 2;
  const jawHalfWidth = design.jawWidth / 2;
  const chinHalfWidth = design.chinWidth / 2;
  const leftEyeX = centerX - design.eyeSpacing / 2;
  const rightEyeX = centerX + design.eyeSpacing / 2;
  const leftEyeY = design.eyeY - design.eyeAsymmetry;
  const rightEyeY = design.eyeY + design.eyeAsymmetry;
  const earY = design.eyeY + 5.5;
  const facePath = [
    `M ${centerX - foreheadHalfWidth} ${faceTop + 7}`,
    `C ${centerX - foreheadHalfWidth - 1.2} ${faceTop + 17}, ${centerX - cheekboneHalfWidth - 0.8} ${faceTop + 25}, ${centerX - cheekboneHalfWidth} ${faceTop + 30}`,
    `C ${centerX - cheekboneHalfWidth + 0.7} ${faceTop + 39}, ${centerX - jawHalfWidth - 1} ${faceBottom - 7}, ${centerX - chinHalfWidth} ${faceBottom - 1.5}`,
    `Q ${centerX} ${faceBottom + 3}, ${centerX + chinHalfWidth} ${faceBottom - 1.5}`,
    `C ${centerX + jawHalfWidth + 1} ${faceBottom - 7}, ${centerX + cheekboneHalfWidth - 0.7} ${faceTop + 39}, ${centerX + cheekboneHalfWidth} ${faceTop + 30}`,
    `C ${centerX + cheekboneHalfWidth + 0.8} ${faceTop + 25}, ${centerX + foreheadHalfWidth + 1.2} ${faceTop + 17}, ${centerX + foreheadHalfWidth} ${faceTop + 7}`,
    `Q ${centerX} ${faceTop - 3}, ${centerX - foreheadHalfWidth} ${faceTop + 7} Z`,
  ].join(" ");
  const shouldersPath =
    "M 1 96 C 3 82, 14 76, 34 71 L 39 69 H 57 L 62 71 C 82 76, 93 82, 95 96 Z";

  return (
    <svg
      aria-label={label}
      role="img"
      viewBox="0 0 96 96"
      className={[
        "shrink-0 overflow-hidden rounded-full border border-[#315B3E]/20 bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      <defs>
        <clipPath id={shoulderClipId}>
          <path d={shouldersPath} />
        </clipPath>
      </defs>

      <rect width="96" height="96" fill={design.backgroundColor} />
      <circle cx="18" cy="17" r="15" fill="#FFFFFF" opacity="0.18" />
      <circle cx="84" cy="36" r="21" fill="#315B3E" opacity="0.035" />

      <path d={shouldersPath} fill={resolvedJersey.primaryColor} />
      <JerseyPattern
        jersey={resolvedJersey}
        clipPathId={shoulderClipId}
      />

      <path
        d={`M ${centerX - design.neckWidth / 2} 60 L ${centerX - design.neckWidth / 2 - 0.8} 75 Q 48 82 ${centerX + design.neckWidth / 2 + 0.8} 75 L ${centerX + design.neckWidth / 2} 60 Z`}
        fill={design.skinShadow}
      />
      <path
        d={`M ${centerX - design.neckWidth / 2 + 1.5} 60 L ${centerX - design.neckWidth / 2 + 1.2} 73 Q 48 78 ${centerX + design.neckWidth / 2 - 1.2} 73 L ${centerX + design.neckWidth / 2 - 1.5} 60 Z`}
        fill={design.skinTone}
      />

      <path
        d="M 37 70 Q 48 79 59 70 L 62 73 Q 48 86 34 73 Z"
        fill={resolvedJersey.secondaryColor}
      />
      <path
        d="M 39 70 Q 48 77 57 70"
        fill="none"
        stroke={resolvedJersey.accentColor}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <ellipse
        cx={centerX - design.faceWidth / 2 - design.earWidth / 3}
        cy={earY}
        rx={design.earWidth}
        ry={design.earHeight / 2}
        fill={design.skinTone}
        stroke={design.skinShadow}
        strokeWidth="0.7"
      />
      <ellipse
        cx={centerX + design.faceWidth / 2 + design.earWidth / 3}
        cy={earY}
        rx={design.earWidth}
        ry={design.earHeight / 2}
        fill={design.skinTone}
        stroke={design.skinShadow}
        strokeWidth="0.7"
      />
      <path
        d={`M ${centerX - design.faceWidth / 2 - design.earWidth / 2} ${earY - 1} q ${design.earWidth * 0.8} -2 0 ${design.earHeight * 0.38}`}
        fill="none"
        stroke={design.skinShadow}
        strokeWidth="0.65"
        opacity="0.65"
      />
      <path
        d={`M ${centerX + design.faceWidth / 2 + design.earWidth / 2} ${earY - 1} q ${-design.earWidth * 0.8} -2 0 ${design.earHeight * 0.38}`}
        fill="none"
        stroke={design.skinShadow}
        strokeWidth="0.65"
        opacity="0.65"
      />

      <path
        d={facePath}
        fill={design.skinTone}
        stroke={design.skinShadow}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d={`M ${centerX - cheekboneHalfWidth + 1.5} ${faceTop + 31} Q ${centerX - jawHalfWidth} ${faceBottom - 5} ${centerX - chinHalfWidth} ${faceBottom - 1.2}`}
        fill="none"
        stroke={design.skinHighlight}
        strokeWidth="0.9"
        opacity="0.34"
      />
      <path
        d={`M ${centerX + cheekboneHalfWidth - 1.5} ${faceTop + 31} Q ${centerX + jawHalfWidth} ${faceBottom - 5} ${centerX + chinHalfWidth} ${faceBottom - 1.2}`}
        fill="none"
        stroke={design.skinShadow}
        strokeWidth="0.8"
        opacity="0.25"
      />

      <Hair design={design} faceTop={faceTop} />
      <Brows
        design={design}
        leftEyeX={leftEyeX}
        rightEyeX={rightEyeX}
      />
      <Eye
        design={design}
        x={leftEyeX}
        y={leftEyeY}
        direction={-1}
      />
      <Eye
        design={design}
        x={rightEyeX}
        y={rightEyeY}
        direction={1}
      />
      <Nose design={design} />
      <FaceMarks design={design} />
      <FacialHair design={design} faceBottom={faceBottom} />
      <Mouth design={design} faceBottom={faceBottom} />

      {design.ageLineOpacity > 0 ? (
        <g
          fill="none"
          stroke={design.skinShadow}
          strokeWidth="0.55"
          strokeLinecap="round"
          opacity={design.ageLineOpacity}
        >
          <path d="M 36 48 q 3 1 5 0" />
          <path d="M 55 48 q 3 1 5 0" />
          <path d="M 42 61 q 6 2 12 0" />
        </g>
      ) : null}
    </svg>
  );
}

function JerseyPattern({
  jersey,
  clipPathId,
}: {
  jersey: RiderJerseyAppearance;
  clipPathId: string;
}) {
  return (
    <g clipPath={`url(#${clipPathId})`}>
      {jersey.pattern === "center" ? (
        <>
          <rect x="40" y="67" width="16" height="31" fill={jersey.secondaryColor} />
          <rect x="46" y="67" width="4" height="31" fill={jersey.accentColor} />
        </>
      ) : null}

      {jersey.pattern === "diagonal" ? (
        <>
          <path d="M 4 97 L 37 68 H 55 L 22 97 Z" fill={jersey.secondaryColor} />
          <path d="M 21 97 L 55 68 H 62 L 29 97 Z" fill={jersey.accentColor} />
        </>
      ) : null}

      {jersey.pattern === "hoops" ? (
        <>
          <rect x="0" y="79" width="96" height="8" fill={jersey.secondaryColor} />
          <rect x="0" y="82" width="96" height="2" fill={jersey.accentColor} />
        </>
      ) : null}

      {jersey.pattern === "split" ? (
        <>
          <rect x="48" y="65" width="48" height="33" fill={jersey.secondaryColor} />
          <rect x="45.5" y="65" width="5" height="33" fill={jersey.accentColor} />
        </>
      ) : null}

      {jersey.pattern === "vertical" ? (
        <>
          <rect x="34" y="66" width="9" height="32" fill={jersey.secondaryColor} />
          <rect x="53" y="66" width="9" height="32" fill={jersey.secondaryColor} />
          <rect x="46" y="66" width="4" height="32" fill={jersey.accentColor} />
        </>
      ) : null}

      {jersey.pattern === "chevron" ? (
        <>
          <path d="M8 76 48 96 88 76v8L48 104 8 84Z" fill={jersey.secondaryColor} />
          <path d="M8 80 48 100 88 80" fill="none" stroke={jersey.accentColor} strokeWidth="3" />
        </>
      ) : null}

      {jersey.pattern === "quarters" ? (
        <>
          <rect x="0" y="64" width="48" height="17" fill={jersey.secondaryColor} />
          <rect x="48" y="81" width="48" height="17" fill={jersey.secondaryColor} />
          <path d="M48 64v34M0 81h96" stroke={jersey.accentColor} strokeWidth="3" />
        </>
      ) : null}

      {jersey.pattern === "cross" ? (
        <>
          <rect x="38" y="64" width="13" height="34" fill={jersey.secondaryColor} />
          <rect x="0" y="78" width="96" height="12" fill={jersey.secondaryColor} />
          <path d="M44.5 64v34M0 84h96" stroke={jersey.accentColor} strokeWidth="4" />
        </>
      ) : null}

      {jersey.pattern === "shoulders" ? (
        <>
          <path d="M0 64h96v17c-20 7-32 8-48 8s-28-1-48-8Z" fill={jersey.secondaryColor} />
          <path d="M0 80c20 7 32 8 48 8s28-1 48-8" fill="none" stroke={jersey.accentColor} strokeWidth="3" />
        </>
      ) : null}

      {jersey.pattern === "checkerboard" ? (
        <>
          {[0, 1, 2].flatMap((row) =>
            [0, 1, 2, 3].map((column) =>
              (row + column) % 2 === 0 ? (
                <rect
                  key={`${row}-${column}`}
                  x={24 + column * 12}
                  y={67 + row * 10}
                  width="12"
                  height="10"
                  fill={jersey.secondaryColor}
                />
              ) : null
            )
          )}
          <path d="M24 67h48v30H24Z" fill="none" stroke={jersey.accentColor} strokeWidth="2" />
        </>
      ) : null}

      {jersey.pattern === "wave" ? (
        <>
          <path d="M0 76c20-13 32 13 49 0s30 13 47 0v17c-17 13-30-13-47 0S20 80 0 93Z" fill={jersey.secondaryColor} />
          <path d="M0 84c20-13 32 13 49 0s30 13 47 0" fill="none" stroke={jersey.accentColor} strokeWidth="3" />
        </>
      ) : null}

      {jersey.pattern === "pinstripes" ? (
        <>
          {[24, 34, 44, 54, 64].map((x, index) => (
            <rect
              key={x}
              x={x}
              y="65"
              width="2.5"
              height="33"
              fill={index === 2 ? jersey.accentColor : jersey.secondaryColor}
            />
          ))}
        </>
      ) : null}

      {jersey.pattern === "solid" ? (
        <path
          d="M 7 91 Q 20 78 36 75 M 89 91 Q 76 78 60 75"
          fill="none"
          stroke={jersey.secondaryColor}
          strokeWidth="2.5"
          opacity="0.7"
        />
      ) : null}
    </g>
  );
}

function Hair({
  design,
  faceTop,
}: {
  design: RiderAvatarDesign;
  faceTop: number;
}) {
  const color = design.hairColor;
  const highlight = design.hairHighlight;

  const baseCap = (
    <path
      d={`M 33 ${faceTop + 8} Q 33 ${faceTop - 5} 48 ${faceTop - 7} Q 64 ${faceTop - 5} 63 ${faceTop + 9} Q 55 ${faceTop + 3} 48 ${faceTop + 5} Q 40 ${faceTop + 2} 33 ${faceTop + 8} Z`}
      fill={color}
    />
  );

  let detail: ReactNode = null;

  switch (design.hairStyle) {
    case "shaved":
      return (
        <path
          d={`M 34 ${faceTop + 8} Q 34 ${faceTop - 2} 48 ${faceTop - 4} Q 62 ${faceTop - 2} 62 ${faceTop + 8}`}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          opacity="0.58"
        />
      );
    case "buzz":
      detail = (
        <path
          d={`M 35 ${faceTop + 5} Q 48 ${faceTop - 1} 61 ${faceTop + 5}`}
          fill="none"
          stroke={highlight}
          strokeWidth="1.2"
          opacity="0.45"
        />
      );
      break;
    case "side-part":
      detail = (
        <>
          <path d={`M 39 ${faceTop - 1} Q 48 ${faceTop + 2} 60 ${faceTop - 2}`} fill="none" stroke={highlight} strokeWidth="1.4" />
          <path d={`M 40 ${faceTop - 3} L 38 ${faceTop + 6}`} stroke={design.backgroundColor} strokeWidth="0.9" />
        </>
      );
      break;
    case "quiff":
      detail = (
        <path
          d={`M 37 ${faceTop + 1} Q 39 ${faceTop - 11} 47 ${faceTop - 5} Q 53 ${faceTop - 13} 59 ${faceTop - 1}`}
          fill={color}
          stroke={highlight}
          strokeWidth="1"
        />
      );
      break;
    case "fringe":
      detail = (
        <path
          d={`M 34 ${faceTop + 6} L 38 ${faceTop + 12} L 43 ${faceTop + 6} L 48 ${faceTop + 11} L 53 ${faceTop + 5} L 58 ${faceTop + 10} L 63 ${faceTop + 5}`}
          fill={color}
          stroke={color}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      );
      break;
    case "messy":
      detail = (
        <path
          d={`M 35 ${faceTop + 2} L 38 ${faceTop - 8} L 42 ${faceTop - 3} L 46 ${faceTop - 11} L 50 ${faceTop - 4} L 55 ${faceTop - 10} L 58 ${faceTop - 2} L 63 ${faceTop - 6}`}
          fill="none"
          stroke={color}
          strokeWidth="4.2"
          strokeLinejoin="round"
        />
      );
      break;
    case "slicked":
      detail = (
        <>
          <path d={`M 37 ${faceTop + 1} Q 46 ${faceTop - 5} 60 ${faceTop - 2}`} fill="none" stroke={highlight} strokeWidth="1.1" />
          <path d={`M 39 ${faceTop + 3} Q 48 ${faceTop - 2} 61 ${faceTop}`} fill="none" stroke={highlight} strokeWidth="0.8" />
        </>
      );
      break;
    case "waves":
      detail = (
        <path
          d={`M 35 ${faceTop + 1} q 4 -4 8 0 t 8 0 t 8 0`}
          fill="none"
          stroke={highlight}
          strokeWidth="1.4"
        />
      );
      break;
    case "curly":
    case "coily": {
      const radius = design.hairStyle === "coily" ? 2.7 : 3.5;
      detail = (
        <g fill={color} stroke={highlight} strokeWidth="0.45">
          {[35, 40, 45, 50, 55, 60].map((x, index) => (
            <circle
              key={x}
              cx={x}
              cy={faceTop - 1 + (index % 2) * 1.4}
              r={radius}
            />
          ))}
          {[38, 44, 50, 56].map((x) => (
            <circle key={`lower-${x}`} cx={x} cy={faceTop + 3.5} r={radius} />
          ))}
        </g>
      );
      break;
    }
    case "short-locks":
      detail = (
        <g stroke={color} strokeWidth="3.2" strokeLinecap="round">
          {[36, 41, 46, 51, 56, 61].map((x, index) => (
            <path key={x} d={`M ${x} ${faceTop - 3} q ${index % 2 ? 1 : -1} 5 0 10`} />
          ))}
        </g>
      );
      break;
    case "crop":
    default:
      detail = (
        <path
          d={`M 37 ${faceTop + 1} L 39 ${faceTop - 4} L 43 ${faceTop} L 47 ${faceTop - 5} L 51 ${faceTop} L 55 ${faceTop - 4} L 59 ${faceTop + 1}`}
          fill="none"
          stroke={highlight}
          strokeWidth="1.2"
        />
      );
      break;
  }

  return (
    <g>
      {baseCap}
      {detail}
    </g>
  );
}

function Brows({
  design,
  leftEyeX,
  rightEyeX,
}: {
  design: RiderAvatarDesign;
  leftEyeX: number;
  rightEyeX: number;
}) {
  const browWidth = design.eyeWidth + 1.6;

  return (
    <g
      fill="none"
      stroke={design.hairColor}
      strokeWidth="1.65"
      strokeLinecap="round"
    >
      <path d={`M ${leftEyeX - browWidth / 2} ${design.browY + 0.5} Q ${leftEyeX} ${design.browY - 1.2} ${leftEyeX + browWidth / 2} ${design.browY}`} />
      <path d={`M ${rightEyeX - browWidth / 2} ${design.browY} Q ${rightEyeX} ${design.browY - 1.2} ${rightEyeX + browWidth / 2} ${design.browY + 0.5}`} />
    </g>
  );
}

function Eye({
  design,
  x,
  y,
  direction,
}: {
  design: RiderAvatarDesign;
  x: number;
  y: number;
  direction: -1 | 1;
}) {
  const heightByStyle: Record<RiderAvatarDesign["eyeStyle"], number> = {
    almond: 2.2,
    deep: 2.05,
    hooded: 1.8,
    narrow: 1.45,
    round: 2.75,
    soft: 2.3,
  };
  const eyeHeight = heightByStyle[design.eyeStyle];
  const tilt = design.eyeTilt * direction;
  const leftX = x - design.eyeWidth / 2;
  const rightX = x + design.eyeWidth / 2;
  const eyePath = `M ${leftX} ${y + tilt / 2} Q ${x} ${y - eyeHeight} ${rightX} ${y - tilt / 2} Q ${x} ${y + eyeHeight} ${leftX} ${y + tilt / 2} Z`;

  return (
    <g>
      {design.eyeStyle === "deep" || design.eyeStyle === "hooded" ? (
        <path
          d={`M ${leftX - 0.4} ${y - 2.2} Q ${x} ${y - 4} ${rightX + 0.4} ${y - 2.2}`}
          fill="none"
          stroke={design.skinShadow}
          strokeWidth="0.65"
          opacity="0.55"
        />
      ) : null}
      <path d={eyePath} fill="#F7F3EA" stroke={design.skinShadow} strokeWidth="0.65" />
      <circle cx={x} cy={y} r={eyeHeight * 0.72} fill={design.eyeColor} />
      <circle cx={x} cy={y} r={Math.max(0.75, eyeHeight * 0.34)} fill="#171513" />
      <circle cx={x - 0.45} cy={y - 0.55} r="0.38" fill="#FFFFFF" opacity="0.85" />
    </g>
  );
}

function Nose({ design }: { design: RiderAvatarDesign }) {
  const centerX = 48;
  const topY = design.eyeY + 2.5;
  const bottomY = topY + design.noseLength;
  const halfWidth = design.noseWidth / 2;
  const bridgeOffset =
    design.noseStyle === "angular"
      ? 1.15
      : design.noseStyle === "tapered"
        ? 0.45
        : 0.8;

  return (
    <g fill="none" stroke={design.skinShadow} strokeLinecap="round">
      <path
        d={`M ${centerX - bridgeOffset} ${topY} Q ${centerX - bridgeOffset - 0.6} ${topY + design.noseLength * 0.55} ${centerX - halfWidth} ${bottomY - 1}`}
        strokeWidth="0.75"
        opacity="0.7"
      />
      <path
        d={`M ${centerX - halfWidth} ${bottomY - 1} Q ${centerX - halfWidth - 1} ${bottomY + 0.5} ${centerX} ${bottomY + 1} Q ${centerX + halfWidth + 1} ${bottomY + 0.5} ${centerX + halfWidth} ${bottomY - 1}`}
        strokeWidth="0.85"
      />
      {design.noseStyle === "broad" || design.noseStyle === "rounded" ? (
        <>
          <circle cx={centerX - halfWidth + 0.1} cy={bottomY} r="0.55" fill={design.skinShadow} stroke="none" />
          <circle cx={centerX + halfWidth - 0.1} cy={bottomY} r="0.55" fill={design.skinShadow} stroke="none" />
        </>
      ) : null}
    </g>
  );
}

function Mouth({
  design,
  faceBottom,
}: {
  design: RiderAvatarDesign;
  faceBottom: number;
}) {
  const centerX = 48;
  const y = faceBottom - 10.5;
  const widthFactor: Record<RiderAvatarDesign["mouthStyle"], number> = {
    balanced: 1,
    defined: 0.94,
    full: 1.03,
    narrow: 0.82,
    soft: 0.95,
    wide: 1.15,
  };
  const halfWidth = (design.mouthWidth * widthFactor[design.mouthStyle]) / 2;
  const fullness =
    design.mouthStyle === "full"
      ? 2.1
      : design.mouthStyle === "soft"
        ? 1.55
        : 1.15;
  const lipColor = shiftForLip(design.skinShadow, design.mouthStyle === "full" ? 12 : 5);

  return (
    <g>
      <path
        d={`M ${centerX - halfWidth} ${y} Q ${centerX - halfWidth / 2} ${y - fullness + design.mouthCurve * 0.25} ${centerX} ${y - 0.2} Q ${centerX + halfWidth / 2} ${y - fullness + design.mouthCurve * 0.25} ${centerX + halfWidth} ${y}`}
        fill={lipColor}
        opacity="0.85"
      />
      <path
        d={`M ${centerX - halfWidth} ${y} Q ${centerX} ${y + fullness + design.mouthCurve * 0.4} ${centerX + halfWidth} ${y} Q ${centerX} ${y + 0.25} ${centerX - halfWidth} ${y} Z`}
        fill={lipColor}
      />
      <path
        d={`M ${centerX - halfWidth} ${y} Q ${centerX} ${y + design.mouthCurve * 0.35} ${centerX + halfWidth} ${y}`}
        fill="none"
        stroke={design.skinShadow}
        strokeWidth="0.65"
        strokeLinecap="round"
      />
    </g>
  );
}

function FacialHair({
  design,
  faceBottom,
}: {
  design: RiderAvatarDesign;
  faceBottom: number;
}) {
  const color = design.hairColor;
  const opacity = design.facialHairStyle === "stubble" ? 0.28 : 0.72;

  if (design.facialHairStyle === "clean") {
    return null;
  }

  if (design.facialHairStyle === "moustache") {
    return (
      <path
        d={`M 40 ${faceBottom - 12.5} Q 44 ${faceBottom - 15} 48 ${faceBottom - 12.8} Q 52 ${faceBottom - 15} 56 ${faceBottom - 12.5} Q 52 ${faceBottom - 10.5} 48 ${faceBottom - 12} Q 44 ${faceBottom - 10.5} 40 ${faceBottom - 12.5} Z`}
        fill={color}
        opacity="0.78"
      />
    );
  }

  if (design.facialHairStyle === "goatee") {
    return (
      <>
        <path d={`M 41 ${faceBottom - 12.6} Q 48 ${faceBottom - 15} 55 ${faceBottom - 12.6}`} fill="none" stroke={color} strokeWidth="1.8" opacity="0.75" />
        <path d={`M 44 ${faceBottom - 8} Q 48 ${faceBottom - 4} 52 ${faceBottom - 8} L 51 ${faceBottom - 2} Q 48 ${faceBottom} 45 ${faceBottom - 2} Z`} fill={color} opacity="0.68" />
      </>
    );
  }

  const beardTop =
    design.facialHairStyle === "short-beard"
      ? faceBottom - 19
      : faceBottom - 14;

  return (
    <path
      d={`M 33 ${beardTop} Q 35 ${faceBottom - 5} 43 ${faceBottom - 1} Q 48 ${faceBottom + 2} 53 ${faceBottom - 1} Q 61 ${faceBottom - 5} 63 ${beardTop} Q 58 ${faceBottom - 9} 55 ${faceBottom - 8} Q 48 ${faceBottom - 5} 41 ${faceBottom - 8} Q 38 ${faceBottom - 9} 33 ${beardTop} Z`}
      fill={color}
      opacity={opacity}
    />
  );
}

function FaceMarks({ design }: { design: RiderAvatarDesign }) {
  if (design.faceMark === "none") {
    return null;
  }

  if (design.faceMark === "left-scar" || design.faceMark === "right-scar") {
    const x = design.faceMark === "left-scar" ? 37 : 59;
    return (
      <path
        d={`M ${x} 44 l ${design.faceMark === "left-scar" ? 3 : -3} 6`}
        stroke={design.skinShadow}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.55"
      />
    );
  }

  const freckles =
    design.faceMark === "freckles"
      ? [
          [37, 43], [40, 44], [43, 43.5], [53, 43.5], [56, 44], [59, 43],
        ]
      : design.faceMark === "cheek-freckles"
        ? [[35, 48], [38, 49], [58, 49], [61, 48]]
        : [[38, 48], [41, 49], [55, 49], [58, 48], [48, 54]];

  return (
    <g fill={design.skinShadow} opacity={design.faceMark === "sun-kissed" ? 0.28 : 0.45}>
      {freckles.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.45" />
      ))}
    </g>
  );
}

function shiftForLip(color: string, amount: number): string {
  const normalized = color.replace("#", "");
  const red = Math.min(255, Number.parseInt(normalized.slice(0, 2), 16) + amount + 12);
  const green = Math.min(255, Number.parseInt(normalized.slice(2, 4), 16) + amount);
  const blue = Math.min(255, Number.parseInt(normalized.slice(4, 6), 16) + amount);

  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}
