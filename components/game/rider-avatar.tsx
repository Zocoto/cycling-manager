import { useId, type ReactNode } from "react";

import {
  createRiderAvatarDesign,
  getRiderAvatarFeatureLayout,
  type RiderAvatarDesign,
  type RiderAvatarFeatureLayout,
} from "@/lib/rider-avatar";
import {
  FREE_AGENT_RIDER_JERSEY,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import { SvgCountryFlag } from "./svg-country-flag";
import { ContinentalChampionPattern } from "./continental-champion-pattern";

type RiderAvatarProps = {
  profileKey: string | null | undefined;
  seed: bigint | number | string | null | undefined;
  riderId?: string;
  age?: number;
  jersey?: RiderJerseyAppearance | null;
  label?: string;
  className?: string;
  renderMode?: "detailed" | "compact";
};

export function RiderAvatar({
  profileKey,
  seed,
  riderId = "rider",
  age = 25,
  jersey = FREE_AGENT_RIDER_JERSEY,
  label = "Portrait généré du coureur",
  className = "h-12 w-12",
  renderMode = "detailed",
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

  if (renderMode === "compact") {
    return (
      <CompactRiderAvatar
        design={design}
        jersey={resolvedJersey}
        label={label}
        className={className}
      />
    );
  }

  const featureLayout = getRiderAvatarFeatureLayout(design);

  const centerX = 48;
  const faceTop = 20;
  const faceBottom = featureLayout.faceBottom;
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
    <span
      className={[
        "relative inline-flex shrink-0 overflow-hidden rounded-full border border-[#315B3E]/20 bg-white shadow-sm [contain:paint]",
        className,
      ].join(" ")}
    >
      <svg
        aria-label={label}
        role="img"
        viewBox="0 0 96 96"
        className="block h-full w-full overflow-hidden"
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
        {resolvedJersey.status === "world-champion" ? (
          <WorldChampionAvatarPattern clipPathId={shoulderClipId} />
        ) : resolvedJersey.status === "continental-champion" &&
          resolvedJersey.continentCode ? (
          <ContinentalChampionPattern
            continentCode={resolvedJersey.continentCode}
            clipPathId={shoulderClipId}
            width={96}
            height={96}
          />
        ) : (resolvedJersey.status === "national-champion" ||
            resolvedJersey.status === "national-team") &&
          resolvedJersey.countryCode ? (
          <NationalChampionFlagPattern
            countryCode={resolvedJersey.countryCode}
            clipPathId={shoulderClipId}
          />
        ) : (
          <>
            <JerseyPattern
              jersey={resolvedJersey}
              clipPathId={shoulderClipId}
            />
            {resolvedJersey.status === "sponsored" &&
            resolvedJersey.imagePath ? (
              <SponsorJerseyArtwork
                imagePath={resolvedJersey.imagePath}
                clipPathId={shoulderClipId}
              />
            ) : null}
          </>
        )}

        <path
          d={`M ${centerX - design.neckWidth / 2} 60 L ${centerX - design.neckWidth / 2 - 0.8} 75 Q 48 82 ${centerX + design.neckWidth / 2 + 0.8} 75 L ${centerX + design.neckWidth / 2} 60 Z`}
          fill={design.skinShadow}
        />
        <path
          d={`M ${centerX - design.neckWidth / 2 + 1.5} 60 L ${centerX - design.neckWidth / 2 + 1.2} 73 Q 48 78 ${centerX + design.neckWidth / 2 - 1.2} 73 L ${centerX + design.neckWidth / 2 - 1.5} 60 Z`}
          fill={design.skinTone}
        />

        {resolvedJersey.status !== "sponsored" || !resolvedJersey.imagePath ? (
          <>
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
          </>
        ) : null}

        <Ears design={design} centerX={centerX} y={earY} />

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
        <Brows design={design} leftEyeX={leftEyeX} rightEyeX={rightEyeX} />
        <Eye design={design} x={leftEyeX} y={leftEyeY} direction={-1} />
        <Eye design={design} x={rightEyeX} y={rightEyeY} direction={1} />
        <Nose design={design} layout={featureLayout} />
        <FaceMarks design={design} />
        <FacialHair design={design} faceBottom={faceBottom} />
        <Mouth design={design} layout={featureLayout} />
        <AgingDetails design={design} faceBottom={faceBottom} />
      </svg>
    </span>
  );
}

function CompactRiderAvatar({
  design,
  jersey,
  label,
  className,
}: {
  design: RiderAvatarDesign;
  jersey: RiderJerseyAppearance;
  label: string;
  className: string;
}) {
  const faceRadiusX = Math.max(18, Math.min(25, design.faceWidth / 2));
  const faceRadiusY = Math.max(23, Math.min(29, design.faceHeight / 2));
  const eyeDistance = Math.max(7, Math.min(11, design.eyeSpacing / 2));
  const hasVisibleHair = design.hairStyle !== "shaved";

  return (
    <span
      data-avatar-render-mode="compact"
      className={[
        "relative inline-flex shrink-0 overflow-hidden rounded-full border border-[#315B3E]/20 bg-white shadow-sm [contain:strict]",
        className,
      ].join(" ")}
    >
      <svg
        aria-label={label}
        role="img"
        viewBox="0 0 96 96"
        className="block h-full w-full overflow-hidden"
      >
        <rect width="96" height="96" fill={design.backgroundColor} />
        <circle cx="18" cy="17" r="15" fill="#FFFFFF" opacity="0.16" />
        <path
          d="M 1 96 C 4 81, 20 73, 39 70 H 57 C 76 73, 92 81, 95 96 Z"
          fill={jersey.primaryColor}
        />
        <path
          d="M 17 88 Q 48 78 79 88"
          fill="none"
          stroke={jersey.secondaryColor}
          strokeWidth="7"
        />
        <path
          d="M 29 91 Q 48 84 67 91"
          fill="none"
          stroke={jersey.accentColor}
          strokeWidth="2.5"
        />
        <path d="M 40 59 H 56 L 58 75 Q 48 81 38 75 Z" fill={design.skinShadow} />
        <ellipse cx="25" cy="46" rx="3.2" ry="7" fill={design.skinShadow} />
        <ellipse cx="71" cy="46" rx="3.2" ry="7" fill={design.skinShadow} />
        <ellipse
          cx="48"
          cy="43"
          rx={faceRadiusX}
          ry={faceRadiusY}
          fill={design.skinTone}
        />
        {hasVisibleHair ? (
          <path
            d={`M ${48 - faceRadiusX + 1} 35 Q 31 12 48 13 Q 66 12 ${48 + faceRadiusX - 1} 35 Q 61 25 48 25 Q 35 25 ${48 - faceRadiusX + 1} 35 Z`}
            fill={design.hairColor}
          />
        ) : null}
        <path
          d={`M ${48 - eyeDistance - 4} 41 Q ${48 - eyeDistance} 38 ${48 - eyeDistance + 4} 41 M ${48 + eyeDistance - 4} 41 Q ${48 + eyeDistance} 38 ${48 + eyeDistance + 4} 41`}
          fill="none"
          stroke={design.hairColor}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx={48 - eyeDistance} cy="45" r="1.8" fill={design.eyeColor} />
        <circle cx={48 + eyeDistance} cy="45" r="1.8" fill={design.rightEyeColor} />
        <path
          d="M 48 47 L 46.5 55 Q 48 56.5 50.5 55"
          fill="none"
          stroke={design.skinShadow}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d={`M ${48 - design.mouthWidth / 3} ${61 + design.mouthYOffset / 2} Q 48 ${63 + design.mouthCurve / 3} ${48 + design.mouthWidth / 3} ${61 + design.mouthYOffset / 2}`}
          fill="none"
          stroke="#6F3D36"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <CompactAgingDetails design={design} />
      </svg>
    </span>
  );
}

function AgingDetails({
  design,
  faceBottom,
}: {
  design: RiderAvatarDesign;
  faceBottom: number;
}) {
  if (design.agingStage === "adult") return null;

  const isWhite = design.agingStage === "white";
  const isLich = design.agingStage === "lich";
  const wrinkleStroke = isLich ? "#426C68" : design.skinShadow;

  return (
    <g data-avatar-aging-stage={design.agingStage}>
      <g
        fill="none"
        stroke={design.hairHighlight}
        strokeLinecap="round"
        opacity={isLich ? 0.92 : isWhite ? 0.76 : 0.58}
      >
        <path d="M 34 27 Q 38 19 42 17" strokeWidth="1.15" />
        <path d="M 43 24 Q 47 17 50 16" strokeWidth="0.9" />
        <path d="M 52 23 Q 56 18 61 22" strokeWidth="1.05" />
        {isWhite || isLich ? (
          <>
            <path d="M 30 31 Q 33 23 37 20" strokeWidth="0.75" />
            <path d="M 57 27 Q 62 22 65 30" strokeWidth="0.8" />
          </>
        ) : null}
      </g>

      <g
        fill="none"
        stroke={wrinkleStroke}
        strokeWidth={isLich ? 0.8 : 0.58}
        strokeLinecap="round"
        opacity={design.ageLineOpacity}
      >
        <path d="M 35 47 q 3.5 1.5 7 0" />
        <path d="M 54 47 q 3.5 1.5 7 0" />
        <path d="M 38 35 q 4 -1 8 0" />
        <path d="M 50 35 q 4 -1 8 0" />
        <path d={`M 40 ${faceBottom - 7} q 8 2.8 16 0`} />
        {isWhite || isLich ? (
          <>
            <path d="M 39 30 q 9 -2 18 0" />
            <path d="M 40 32 q 8 -1.6 16 0" />
            <path d="M 33 44 l -3 -1 M 33 46 l -3 0.5" />
            <path d="M 63 44 l 3 -1 M 63 46 l 3 0.5" />
            <path d={`M 37 ${faceBottom - 12} q -1 5 1 8`} />
            <path d={`M 59 ${faceBottom - 12} q 1 5 -1 8`} />
          </>
        ) : null}
      </g>

      {isLich ? (
        <>
          <g fill="#315B57" opacity="0.3">
            <ellipse cx="38.5" cy="45" rx="6.1" ry="4.6" />
            <ellipse cx="57.5" cy="45" rx="6.1" ry="4.6" />
            <path d={`M 34 ${faceBottom - 15} Q 38 ${faceBottom - 5} 43 ${faceBottom - 3} Q 38 ${faceBottom - 5} 34 ${faceBottom - 15} Z`} />
            <path d={`M 62 ${faceBottom - 15} Q 58 ${faceBottom - 5} 53 ${faceBottom - 3} Q 58 ${faceBottom - 5} 62 ${faceBottom - 15} Z`} />
          </g>
          <g fill="#A9FFF4" opacity="0.92">
            <circle cx="38.5" cy="45" r="1.45" />
            <circle cx="57.5" cy="45" r="1.45" />
          </g>
          <path
            d="M 47 51 l -2 5 3 1 3 -1 -2 -5"
            fill="#315B57"
            opacity="0.38"
          />
          <g
            fill="none"
            stroke="#527C77"
            strokeWidth="0.72"
            strokeLinecap="round"
            opacity="0.72"
          >
            <path d="M 32 39 l 3 -3 -1 -4" />
            <path d="M 64 39 l -3 -3 1 -4" />
            <path d="M 45 28 l 2 3 -1 3" />
            <path d={`M 46 ${faceBottom - 4} v 3 M 50 ${faceBottom - 4} v 3`} />
          </g>
        </>
      ) : null}
    </g>
  );
}

function CompactAgingDetails({ design }: { design: RiderAvatarDesign }) {
  if (design.agingStage === "adult") return null;

  const isWhite = design.agingStage === "white";
  const isLich = design.agingStage === "lich";

  return (
    <g data-avatar-aging-stage={design.agingStage}>
      <g
        fill="none"
        stroke={design.skinShadow}
        strokeWidth={isLich ? 1 : 0.65}
        strokeLinecap="round"
        opacity={design.ageLineOpacity}
      >
        <path d="M 34 50 q 4 2 8 0 M 54 50 q 4 2 8 0" />
        <path d="M 41 65 q 7 2 14 0" />
        {isWhite || isLich ? <path d="M 39 35 q 9 -2 18 0" /> : null}
      </g>
      {isLich ? (
        <>
          <g fill="#315B57" opacity="0.35">
            <ellipse cx="37" cy="45" rx="5" ry="4" />
            <ellipse cx="59" cy="45" rx="5" ry="4" />
          </g>
          <g fill="#A9FFF4">
            <circle cx="37" cy="45" r="1.2" />
            <circle cx="59" cy="45" r="1.2" />
          </g>
          <path d="M 48 50 l -2 6 2 1 2 -1Z" fill="#315B57" opacity="0.42" />
        </>
      ) : null}
    </g>
  );
}

function NationalChampionFlagPattern({
  countryCode,
  clipPathId,
}: {
  countryCode: string;
  clipPathId: string;
}) {
  return (
    <g clipPath={`url(#${clipPathId})`}>
      <SvgCountryFlag
        countryCode={countryCode}
        x="0"
        y="64"
        width={96}
        height={34}
      />
      <path d="M0 66h96v8c-24 5-72 5-96 0Z" fill="#FFFFFF" opacity="0.1" />
    </g>
  );
}
function WorldChampionAvatarPattern({ clipPathId }: { clipPathId: string }) {
  const colors = ["#2166B1", "#E32636", "#111111", "#F2C94C", "#16834A"];

  return (
    <g clipPath={`url(#${clipPathId})`}>
      {colors.map((color, index) => (
        <rect
          key={color}
          x="0"
          y={68 + index * 5}
          width="96"
          height="5"
          fill={color}
        />
      ))}
    </g>
  );
}

function SponsorJerseyArtwork({
  imagePath,
  clipPathId,
}: {
  imagePath: string;
  clipPathId: string;
}) {
  return (
    <g clipPath={`url(#${clipPathId})`}>
      <svg
        data-avatar-jersey-viewport="upper-body"
        x="0"
        y="64"
        width="96"
        height="34"
        viewBox="0 36 600 212.5"
        preserveAspectRatio="xMidYMid meet"
        overflow="hidden"
      >
        <image
          data-sponsor-jersey-artwork="true"
          href={imagePath}
          x="0"
          y="0"
          width="600"
          height="750"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
      <path
        d="M2 94C8 80 20 75 35 71M94 94C88 80 76 75 61 71"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        opacity="0.1"
      />
    </g>
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
          <rect
            x="40"
            y="67"
            width="16"
            height="31"
            fill={jersey.secondaryColor}
          />
          <rect x="46" y="67" width="4" height="31" fill={jersey.accentColor} />
        </>
      ) : null}

      {jersey.pattern === "diagonal" ? (
        <>
          <path
            d="M 4 97 L 37 68 H 55 L 22 97 Z"
            fill={jersey.secondaryColor}
          />
          <path d="M 21 97 L 55 68 H 62 L 29 97 Z" fill={jersey.accentColor} />
        </>
      ) : null}

      {jersey.pattern === "hoops" ? (
        <>
          <rect
            x="0"
            y="79"
            width="96"
            height="8"
            fill={jersey.secondaryColor}
          />
          <rect x="0" y="82" width="96" height="2" fill={jersey.accentColor} />
        </>
      ) : null}

      {jersey.pattern === "split" ? (
        <>
          <rect
            x="48"
            y="65"
            width="48"
            height="33"
            fill={jersey.secondaryColor}
          />
          <rect
            x="45.5"
            y="65"
            width="5"
            height="33"
            fill={jersey.accentColor}
          />
        </>
      ) : null}

      {jersey.pattern === "vertical" ? (
        <>
          <rect
            x="34"
            y="66"
            width="9"
            height="32"
            fill={jersey.secondaryColor}
          />
          <rect
            x="53"
            y="66"
            width="9"
            height="32"
            fill={jersey.secondaryColor}
          />
          <rect x="46" y="66" width="4" height="32" fill={jersey.accentColor} />
        </>
      ) : null}

      {jersey.pattern === "chevron" ? (
        <>
          <path
            d="M8 76 48 96 88 76v8L48 104 8 84Z"
            fill={jersey.secondaryColor}
          />
          <path
            d="M8 80 48 100 88 80"
            fill="none"
            stroke={jersey.accentColor}
            strokeWidth="3"
          />
        </>
      ) : null}

      {jersey.pattern === "quarters" ? (
        <>
          <rect
            x="0"
            y="64"
            width="48"
            height="17"
            fill={jersey.secondaryColor}
          />
          <rect
            x="48"
            y="81"
            width="48"
            height="17"
            fill={jersey.secondaryColor}
          />
          <path
            d="M48 64v34M0 81h96"
            stroke={jersey.accentColor}
            strokeWidth="3"
          />
        </>
      ) : null}

      {jersey.pattern === "cross" ? (
        <>
          <rect
            x="38"
            y="64"
            width="13"
            height="34"
            fill={jersey.secondaryColor}
          />
          <rect
            x="0"
            y="78"
            width="96"
            height="12"
            fill={jersey.secondaryColor}
          />
          <path
            d="M44.5 64v34M0 84h96"
            stroke={jersey.accentColor}
            strokeWidth="4"
          />
        </>
      ) : null}

      {jersey.pattern === "shoulders" ? (
        <>
          <path
            d="M0 64h96v17c-20 7-32 8-48 8s-28-1-48-8Z"
            fill={jersey.secondaryColor}
          />
          <path
            d="M0 80c20 7 32 8 48 8s28-1 48-8"
            fill="none"
            stroke={jersey.accentColor}
            strokeWidth="3"
          />
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
              ) : null,
            ),
          )}
          <path
            d="M24 67h48v30H24Z"
            fill="none"
            stroke={jersey.accentColor}
            strokeWidth="2"
          />
        </>
      ) : null}

      {jersey.pattern === "wave" ? (
        <>
          <path
            d="M0 76c20-13 32 13 49 0s30 13 47 0v17c-17 13-30-13-47 0S20 80 0 93Z"
            fill={jersey.secondaryColor}
          />
          <path
            d="M0 84c20-13 32 13 49 0s30 13 47 0"
            fill="none"
            stroke={jersey.accentColor}
            strokeWidth="3"
          />
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

function Ears({
  design,
  centerX,
  y,
}: {
  design: RiderAvatarDesign;
  centerX: number;
  y: number;
}) {
  const widthScale: Record<RiderAvatarDesign["earStyle"], number> = {
    angular: 1,
    attached: 0.82,
    lobed: 1.02,
    long: 0.94,
    pointed: 0.96,
    prominent: 1.28,
    rounded: 1,
    small: 0.72,
    tapered: 0.9,
    wide: 1.38,
  };
  const heightScale: Record<RiderAvatarDesign["earStyle"], number> = {
    angular: 1,
    attached: 0.92,
    lobed: 1.16,
    long: 1.4,
    pointed: 1.14,
    prominent: 1.08,
    rounded: 1,
    small: 0.76,
    tapered: 1.12,
    wide: 0.96,
  };
  const placementScale =
    design.earStyle === "attached"
      ? 0.08
      : design.earStyle === "prominent" || design.earStyle === "wide"
        ? 0.58
        : 0.34;
  const width = design.earWidth * widthScale[design.earStyle];
  const height = design.earHeight * heightScale[design.earStyle];

  return (
    <g>
      {([-1, 1] as const).map((direction) => {
        const earX =
          centerX + direction * (design.faceWidth / 2 + width * placementScale);
        const innerX = earX - direction * width * 0.72;
        const outerX = earX + direction * width;

        return (
          <g key={direction}>
            {design.earStyle === "angular" ? (
              <path
                d={
                  design.version === 1
                    ? `M ${innerX} ${y - height * 0.45} L ${outerX} ${y - height * 0.25} L ${outerX - direction * width * 0.08} ${y + height * 0.32} Q ${earX} ${y + height * 0.58} ${innerX} ${y + height * 0.38} Z`
                    : `M ${innerX} ${y - height * 0.43} Q ${outerX - direction * width * 0.12} ${y - height * 0.43} ${outerX} ${y - height * 0.2} L ${outerX - direction * width * 0.14} ${y + height * 0.28} Q ${earX} ${y + height * 0.55} ${innerX} ${y + height * 0.36} Z`
                }
                fill={design.skinTone}
                stroke={design.skinShadow}
                strokeWidth="0.7"
              />
            ) : design.earStyle === "tapered" || design.earStyle === "pointed" ? (
              <path
                d={
                  design.earStyle === "pointed"
                    ? `M ${innerX} ${y - height * 0.42} Q ${earX} ${y - height * 0.5} ${outerX} ${y - height * 0.2} Q ${outerX - direction * width * 0.18} ${y + height * 0.4} ${innerX} ${y + height * 0.36} Z`
                    : `M ${innerX} ${y - height * 0.42} Q ${outerX} ${y - height * 0.3} ${outerX - direction * width * 0.2} ${y + height * 0.08} Q ${earX} ${y + height * 0.62} ${innerX} ${y + height * 0.34} Z`
                }
                fill={design.skinTone}
                stroke={design.skinShadow}
                strokeWidth="0.7"
              />
            ) : design.earStyle === "lobed" ? (
              <path
                d={`M ${innerX} ${y - height * 0.42} Q ${outerX} ${y - height * 0.35} ${outerX} ${y + height * 0.12} Q ${outerX - direction * width * 0.08} ${y + height * 0.5} ${earX} ${y + height * 0.54} Q ${innerX} ${y + height * 0.38} ${innerX} ${y - height * 0.42} Z`}
                fill={design.skinTone}
                stroke={design.skinShadow}
                strokeWidth="0.7"
              />
            ) : (
              <ellipse
                cx={earX}
                cy={y}
                rx={width}
                ry={height / 2}
                fill={design.skinTone}
                stroke={design.skinShadow}
                strokeWidth="0.7"
              />
            )}
            <path
              d={`M ${outerX - direction * width * 0.18} ${y - height * 0.12} q ${-direction * width * 0.76} ${-height * 0.2} ${-direction * width * 0.2} ${height * 0.42}`}
              fill="none"
              stroke={design.skinShadow}
              strokeWidth="0.65"
              opacity="0.65"
            />
          </g>
        );
      })}
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
    case "afro":
      detail = (
        <g fill={color} stroke={highlight} strokeWidth="0.5">
          {[32, 37, 42, 48, 54, 59, 64].map((x, index) => (
            <circle key={x} cx={x} cy={faceTop - 2.5 - (index % 2) * 2} r="5.2" />
          ))}
          {[35, 41, 47, 53, 59].map((x) => (
            <circle key={`afro-${x}`} cx={x} cy={faceTop - 7} r="4.8" />
          ))}
        </g>
      );
      break;
    case "braids":
      detail = (
        <g fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round">
          {[35, 39, 43, 47, 51, 55, 59, 63].map((x, index) => (
            <path
              key={x}
              d={`M ${x} ${faceTop - 4} q ${index % 2 ? 1.4 : -1.4} 5 0 11 q ${index % 2 ? -1.2 : 1.2} 3 0 6`}
            />
          ))}
        </g>
      );
      break;
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
          <path
            d={`M 39 ${faceTop - 1} Q 48 ${faceTop + 2} 60 ${faceTop - 2}`}
            fill="none"
            stroke={highlight}
            strokeWidth="1.4"
          />
          <path
            d={`M 40 ${faceTop - 3} L 38 ${faceTop + 6}`}
            stroke={design.backgroundColor}
            strokeWidth="0.9"
          />
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
    case "football-curl":
      detail = (
        <>
          <path
            d={`M 36 ${faceTop + 1} Q 44 ${faceTop - 7} 59 ${faceTop - 3}`}
            fill="none"
            stroke={highlight}
            strokeWidth="1.25"
          />
          <path
            d={`M 53 ${faceTop + 1} Q 58 ${faceTop + 1} 58 ${faceTop + 7} Q 55 ${faceTop + 4} 52 ${faceTop + 8}`}
            fill="none"
            stroke={color}
            strokeWidth="3.1"
            strokeLinecap="round"
          />
        </>
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
    case "mohawk":
      detail = (
        <path
          d={`M 42 ${faceTop - 2} L 44 ${faceTop - 12} L 48 ${faceTop - 5} L 51 ${faceTop - 14} L 54 ${faceTop - 3}`}
          fill={color}
          stroke={highlight}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      );
      break;
    case "undercut":
      detail = (
        <>
          <path
            d={`M 35 ${faceTop + 7} Q 48 ${faceTop + 2} 62 ${faceTop + 7}`}
            fill="none"
            stroke={design.skinShadow}
            strokeWidth="1.6"
            opacity="0.32"
          />
          <path
            d={`M 38 ${faceTop} Q 47 ${faceTop - 8} 60 ${faceTop - 2}`}
            fill="none"
            stroke={highlight}
            strokeWidth="1.35"
          />
        </>
      );
      break;
    case "slicked":
      detail = (
        <>
          <path
            d={`M 37 ${faceTop + 1} Q 46 ${faceTop - 5} 60 ${faceTop - 2}`}
            fill="none"
            stroke={highlight}
            strokeWidth="1.1"
          />
          <path
            d={`M 39 ${faceTop + 3} Q 48 ${faceTop - 2} 61 ${faceTop}`}
            fill="none"
            stroke={highlight}
            strokeWidth="0.8"
          />
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
            <path
              key={x}
              d={`M ${x} ${faceTop - 3} q ${index % 2 ? 1 : -1} 5 0 10`}
            />
          ))}
        </g>
      );
      break;
    case "dreadlocks":
    case "long-dreadlocks": {
      const lockEnd =
        design.hairStyle === "long-dreadlocks" ? faceTop + 39 : faceTop + 25;
      detail = (
        <g stroke={color} strokeWidth="2.25" strokeLinecap="round" fill="none">
          {[33, 36, 39].map((x, index) => (
            <path
              key={`left-lock-${x}`}
              d={`M ${x + 2} ${faceTop - 1 + index * 0.5} Q ${x - 1.5} ${faceTop + 11} ${x - 1 - (index % 2)} ${lockEnd - index * 1.3}`}
            />
          ))}
          {[57, 60, 63].map((x, index) => (
            <path
              key={`right-lock-${x}`}
              d={`M ${x - 2} ${faceTop - 1 + index * 0.5} Q ${x + 1.5} ${faceTop + 11} ${x + 1 + (index % 2)} ${lockEnd - index * 1.3}`}
            />
          ))}
          <g stroke={highlight} strokeWidth="0.55" opacity="0.55">
            <path d={`M 33 ${faceTop + 6} Q 31 ${faceTop + 15} 32 ${lockEnd - 5}`} />
            <path d={`M 63 ${faceTop + 6} Q 65 ${faceTop + 15} 64 ${lockEnd - 5}`} />
          </g>
        </g>
      );
      break;
    }
    case "ponytail":
      detail = (
        <>
          <ellipse cx="63.5" cy={faceTop + 2} rx="3.2" ry="4" fill={color} />
          <path
            d={`M 64 ${faceTop + 2} Q 72 ${faceTop + 11} 65 ${faceTop + 29} Q 61 ${faceTop + 19} 62 ${faceTop + 6} Z`}
            fill={color}
            stroke={highlight}
            strokeWidth="0.7"
          />
        </>
      );
      break;
    case "man-bun":
      detail = (
        <>
          <circle cx="59.5" cy={faceTop - 7} r="5.2" fill={color} />
          <path
            d={`M 54 ${faceTop - 7} Q 60 ${faceTop - 11} 64 ${faceTop - 5}`}
            fill="none"
            stroke={highlight}
            strokeWidth="0.9"
          />
        </>
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
  const browWidth =
    design.eyeWidth +
    (design.browStyle === "heavy" ? 2.4 : design.browStyle === "soft" ? 1 : 1.6);
  const strokeWidth =
    design.browStyle === "heavy" ? 2.35 : design.browStyle === "soft" ? 1.25 : 1.65;
  const archHeight =
    design.browStyle === "arched"
      ? -2.4
      : design.browStyle === "straight"
        ? -0.1
        : design.browStyle === "low-angled"
          ? 0.8
          : -1.2;
  const outerOffset = design.browStyle === "low-angled" ? 1.1 : 0.5;

  return (
    <g
      fill="none"
      stroke={design.hairColor}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <path
        d={`M ${leftEyeX - browWidth / 2} ${design.browY + outerOffset} Q ${leftEyeX} ${design.browY + archHeight} ${leftEyeX + browWidth / 2} ${design.browY}`}
      />
      <path
        d={`M ${rightEyeX - browWidth / 2} ${design.browY} Q ${rightEyeX} ${design.browY + archHeight} ${rightEyeX + browWidth / 2} ${design.browY + outerOffset}`}
      />
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
    downturned: 2.15,
    hooded: 1.8,
    large: 3.25,
    monolid: 1.55,
    narrow: 1.45,
    prominent: 2.95,
    round: 2.75,
    sharp: 1.9,
    sleepy: 1.65,
    small: 1.65,
    soft: 2.3,
    squinting: 1.05,
    upturned: 2.05,
  };
  const eyeHeight = heightByStyle[design.eyeStyle];
  const styleTilt =
    design.eyeStyle === "upturned"
      ? 0.95
      : design.eyeStyle === "downturned"
        ? -0.95
        : 0;
  const tilt = (design.eyeTilt + styleTilt) * direction;
  const leftX = x - design.eyeWidth / 2;
  const rightX = x + design.eyeWidth / 2;
  const eyePath =
    design.eyeStyle === "sharp"
      ? `M ${leftX} ${y + tilt / 2} Q ${x} ${y - eyeHeight * 0.85} ${rightX} ${y - tilt / 2} L ${x + design.eyeWidth * 0.18} ${y + eyeHeight * 0.78} Q ${x} ${y + eyeHeight} ${leftX} ${y + tilt / 2} Z`
      : design.eyeStyle === "sleepy"
        ? `M ${leftX} ${y + tilt / 2} Q ${x} ${y - eyeHeight * 0.35} ${rightX} ${y - tilt / 2} Q ${x} ${y + eyeHeight} ${leftX} ${y + tilt / 2} Z`
        : `M ${leftX} ${y + tilt / 2} Q ${x} ${y - eyeHeight} ${rightX} ${y - tilt / 2} Q ${x} ${y + eyeHeight} ${leftX} ${y + tilt / 2} Z`;
  const irisScale =
    design.eyeStyle === "prominent" || design.eyeStyle === "large"
      ? 0.83
      : design.eyeStyle === "round"
        ? 0.76
        : 0.72;
  const pupilOffset =
    design.gazeStyle === "left"
      ? -0.75
      : design.gazeStyle === "right"
        ? 0.75
        : design.gazeStyle === "crossed"
          ? -direction * 0.68
          : design.gazeStyle === "wall-eyed"
            ? direction * 0.68
            : 0;
  const irisX = x + pupilOffset;
  const irisColor = direction === 1 ? design.rightEyeColor : design.eyeColor;

  return (
    <g>
      {design.eyeStyle === "deep" ||
      design.eyeStyle === "hooded" ||
      design.eyeStyle === "monolid" ||
      design.eyeStyle === "sleepy" ||
      design.eyeStyle === "squinting" ? (
        <path
          d={
            design.eyeStyle === "monolid" || design.eyeStyle === "squinting"
              ? `M ${leftX - 0.2} ${y - 1.5} Q ${x} ${y - 2.5} ${rightX + 0.2} ${y - 1.5}`
              : `M ${leftX - 0.4} ${y - 2.2} Q ${x} ${y - 4} ${rightX + 0.4} ${y - 2.2}`
          }
          fill="none"
          stroke={design.skinShadow}
          strokeWidth="0.65"
          opacity="0.55"
        />
      ) : null}
      <path
        d={eyePath}
        fill="#F7F3EA"
        stroke={design.skinShadow}
        strokeWidth="0.65"
      />
      <circle cx={irisX} cy={y} r={eyeHeight * irisScale} fill={irisColor} />
      <circle
        cx={irisX}
        cy={y}
        r={Math.max(0.75, eyeHeight * 0.34)}
        fill="#171513"
      />
      <circle
        cx={irisX - 0.45}
        cy={y - 0.55}
        r="0.38"
        fill="#FFFFFF"
        opacity="0.85"
      />
    </g>
  );
}

function Nose({
  design,
  layout,
}: {
  design: RiderAvatarDesign;
  layout: RiderAvatarFeatureLayout;
}) {
  const centerX = 48;
  const topY = layout.noseTopY;
  const bottomY = layout.noseBaseY;
  const widthFactor: Record<RiderAvatarDesign["noseStyle"], number> = {
    angular: 0.94,
    aquiline: 0.9,
    bulbous: 1.26,
    broad: 1.22,
    button: 0.88,
    compact: 0.92,
    fine: 0.66,
    flared: 1.38,
    flat: 1.2,
    hooked: 0.92,
    long: 0.9,
    rounded: 1.08,
    snub: 1.02,
    straight: 1,
    tapered: 0.82,
    "wide-bridge": 1.3,
  };
  const halfWidth = (design.noseWidth * widthFactor[design.noseStyle]) / 2;
  const bridgeOffset =
    design.noseStyle === "angular"
      ? 1.15
      : design.noseStyle === "aquiline" || design.noseStyle === "hooked"
        ? 1.35
        : design.noseStyle === "tapered"
          ? 0.45
          : 0.8;
  const bridgePath =
    design.noseStyle === "aquiline" || design.noseStyle === "hooked"
      ? `M ${centerX - bridgeOffset} ${topY} C ${centerX - 2.2} ${topY + (bottomY - topY) * 0.42}, ${centerX - 0.2} ${bottomY - 2.2}, ${centerX - halfWidth} ${bottomY - (design.noseStyle === "hooked" ? -0.5 : 0.8)}`
      : design.noseStyle === "button" || design.noseStyle === "snub"
        ? `M ${centerX - bridgeOffset * 0.7} ${topY + 1} Q ${centerX - 0.5} ${bottomY - 2.2} ${centerX - halfWidth} ${bottomY - 0.7}`
        : design.noseStyle === "flat"
          ? `M ${centerX - bridgeOffset * 0.55} ${topY + 1.2} Q ${centerX - 0.3} ${bottomY - 1.5} ${centerX - halfWidth} ${bottomY - 0.5}`
        : `M ${centerX - bridgeOffset} ${topY} Q ${centerX - bridgeOffset - 0.6} ${topY + (bottomY - topY) * 0.55} ${centerX - halfWidth} ${bottomY - 1}`;
  const basePath =
    design.noseStyle === "angular"
      ? `M ${centerX - halfWidth} ${bottomY - 1} L ${centerX} ${bottomY + 0.9} L ${centerX + halfWidth} ${bottomY - 1}`
      : design.noseStyle === "snub" || design.noseStyle === "flat"
        ? `M ${centerX - halfWidth} ${bottomY} Q ${centerX} ${bottomY - 0.8} ${centerX + halfWidth} ${bottomY}`
        : design.noseStyle === "bulbous"
          ? `M ${centerX - halfWidth} ${bottomY - 0.6} Q ${centerX - halfWidth * 0.6} ${bottomY + 1.5} ${centerX} ${bottomY + 1.6} Q ${centerX + halfWidth * 0.6} ${bottomY + 1.5} ${centerX + halfWidth} ${bottomY - 0.6}`
        : `M ${centerX - halfWidth} ${bottomY - 1} Q ${centerX - halfWidth - 1} ${bottomY + 0.5} ${centerX} ${bottomY + 1} Q ${centerX + halfWidth + 1} ${bottomY + 0.5} ${centerX + halfWidth} ${bottomY - 1}`;
  const showsNostrils = ["broad", "bulbous", "button", "flared", "flat", "rounded", "snub", "wide-bridge"].includes(
    design.noseStyle,
  );

  return (
    <g fill="none" stroke={design.skinShadow} strokeLinecap="round">
      <path d={bridgePath} strokeWidth="0.75" opacity="0.7" />
      <path d={basePath} strokeWidth="0.85" />
      {showsNostrils ? (
        <>
          <circle
            cx={centerX - halfWidth + 0.1}
            cy={bottomY}
            r="0.55"
            fill={design.skinShadow}
            stroke="none"
          />
          <circle
            cx={centerX + halfWidth - 0.1}
            cy={bottomY}
            r="0.55"
            fill={design.skinShadow}
            stroke="none"
          />
        </>
      ) : null}
      {design.noseStyle === "aquiline" || design.noseStyle === "hooked" || design.noseStyle === "long" ? (
        <path
          d={`M ${centerX + 0.8} ${topY + 1.4} Q ${centerX + 1.6} ${(topY + bottomY) / 2} ${centerX + halfWidth * 0.55} ${bottomY - 1.2}`}
          stroke={design.skinHighlight}
          strokeWidth="0.55"
          opacity="0.45"
        />
      ) : null}
    </g>
  );
}

function Mouth({
  design,
  layout,
}: {
  design: RiderAvatarDesign;
  layout: RiderAvatarFeatureLayout;
}) {
  const centerX = 48;
  const y = layout.mouthY;
  const widthFactor: Record<RiderAvatarDesign["mouthStyle"], number> = {
    balanced: 1,
    bowed: 0.98,
    defined: 0.94,
    downturned: 0.96,
    flat: 1,
    full: 1.03,
    gritted: 1.04,
    grimace: 1.02,
    narrow: 0.82,
    open: 0.94,
    "open-smile": 1.12,
    pursed: 0.68,
    smile: 1.08,
    smirk: 1.02,
    soft: 0.95,
    wide: 1.15,
  };
  const fullnessByStyle: Record<RiderAvatarDesign["mouthStyle"], number> = {
    balanced: 1.15,
    bowed: 1.5,
    defined: 1.05,
    downturned: 1.05,
    flat: 0.8,
    full: 2.1,
    gritted: 1.2,
    grimace: 0.9,
    narrow: 1,
    open: 2.1,
    "open-smile": 2.15,
    pursed: 1.4,
    smile: 1.15,
    smirk: 1.05,
    soft: 1.55,
    wide: 1,
  };
  const halfWidth = (design.mouthWidth * widthFactor[design.mouthStyle]) / 2;
  const fullness = fullnessByStyle[design.mouthStyle];
  const expressionCurve =
    design.mouthStyle === "smile" || design.mouthStyle === "open-smile"
      ? 1.8
      : design.mouthStyle === "downturned" || design.mouthStyle === "grimace"
        ? -1.8
        : design.mouthStyle === "flat"
          ? 0
          : design.mouthCurve;
  const cupidDepth = design.mouthStyle === "bowed" ? 0.95 : 0.2;
  const lipColor = shiftForLip(
    design.skinShadow,
    design.mouthStyle === "full" ? 12 : 5,
  );

  if (design.mouthStyle === "open" || design.mouthStyle === "open-smile") {
    const openingHeight = design.mouthStyle === "open-smile" ? 3.1 : 3.8;

    return (
      <g>
        <path
          d={`M ${centerX - halfWidth} ${y} Q ${centerX} ${y - fullness} ${centerX + halfWidth} ${y} Q ${centerX} ${y + openingHeight} ${centerX - halfWidth} ${y} Z`}
          fill="#3A1E1B"
          stroke={lipColor}
          strokeWidth="0.9"
        />
        <path
          d={`M ${centerX - halfWidth * 0.76} ${y + 0.2} Q ${centerX} ${y + 1.1} ${centerX + halfWidth * 0.76} ${y + 0.2}`}
          fill="none"
          stroke="#F5EEE3"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        {design.mouthStyle === "open" ? (
          <path
            d={`M ${centerX - halfWidth * 0.45} ${y + openingHeight - 0.65} Q ${centerX} ${y + openingHeight - 1.35} ${centerX + halfWidth * 0.45} ${y + openingHeight - 0.65}`}
            fill="none"
            stroke="#B76C67"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
        ) : null}
      </g>
    );
  }

  if (design.mouthStyle === "gritted") {
    return (
      <g>
        <path
          d={`M ${centerX - halfWidth} ${y} Q ${centerX} ${y - 1.3} ${centerX + halfWidth} ${y} Q ${centerX} ${y + 2.2} ${centerX - halfWidth} ${y} Z`}
          fill="#F3EEE5"
          stroke={lipColor}
          strokeWidth="0.9"
        />
        <path
          d={`M ${centerX - halfWidth * 0.85} ${y + 0.65} H ${centerX + halfWidth * 0.85}`}
          stroke={design.skinShadow}
          strokeWidth="0.45"
        />
      </g>
    );
  }

  if (design.mouthStyle === "smirk") {
    return (
      <path
        d={`M ${centerX - halfWidth} ${y + 0.8} Q ${centerX} ${y + 0.7} ${centerX + halfWidth} ${y - 1.2}`}
        fill="none"
        stroke={lipColor}
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    );
  }

  if (design.mouthStyle === "pursed") {
    return (
      <path
        d={`M ${centerX - halfWidth} ${y} Q ${centerX} ${y - 1.8} ${centerX + halfWidth} ${y} Q ${centerX} ${y + 1.8} ${centerX - halfWidth} ${y} Z`}
        fill={lipColor}
        stroke={design.skinShadow}
        strokeWidth="0.45"
      />
    );
  }

  return (
    <g>
      <path
        d={`M ${centerX - halfWidth} ${y} Q ${centerX - halfWidth / 2} ${y - fullness + expressionCurve * 0.2} ${centerX} ${y - cupidDepth} Q ${centerX + halfWidth / 2} ${y - fullness + expressionCurve * 0.2} ${centerX + halfWidth} ${y}`}
        fill={lipColor}
        opacity="0.85"
      />
      <path
        d={`M ${centerX - halfWidth} ${y} Q ${centerX} ${y + fullness + expressionCurve * 0.34} ${centerX + halfWidth} ${y} Q ${centerX} ${y + 0.25} ${centerX - halfWidth} ${y} Z`}
        fill={lipColor}
      />
      <path
        d={`M ${centerX - halfWidth} ${y} Q ${centerX} ${y + expressionCurve * 0.5} ${centerX + halfWidth} ${y}`}
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

  if (design.facialHairStyle === "five-o-clock") {
    const shadowDots = [
      [36, faceBottom - 13],
      [39, faceBottom - 9],
      [42, faceBottom - 6],
      [45, faceBottom - 4],
      [48, faceBottom - 3],
      [51, faceBottom - 4],
      [54, faceBottom - 6],
      [57, faceBottom - 9],
      [60, faceBottom - 13],
      [40, faceBottom - 12],
      [44, faceBottom - 9],
      [52, faceBottom - 9],
      [56, faceBottom - 12],
    ];

    return (
      <g data-avatar-facial-hair="five-o-clock">
        <path
          d={`M 34 ${faceBottom - 16} Q 36 ${faceBottom - 6} 43 ${faceBottom - 2} Q 48 ${faceBottom + 0.5} 53 ${faceBottom - 2} Q 60 ${faceBottom - 6} 62 ${faceBottom - 16} Q 58 ${faceBottom - 11} 54 ${faceBottom - 9} Q 48 ${faceBottom - 6.5} 42 ${faceBottom - 9} Q 38 ${faceBottom - 11} 34 ${faceBottom - 16} Z`}
          fill="#626966"
          opacity="0.2"
        />
        <g fill="#4F5552" opacity="0.42">
          {shadowDots.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.34" />
          ))}
        </g>
        <path
          d={`M 41 ${faceBottom - 12.7} Q 48 ${faceBottom - 14.2} 55 ${faceBottom - 12.7}`}
          fill="none"
          stroke="#555B58"
          strokeWidth="0.7"
          strokeDasharray="0.7 1"
          opacity="0.5"
        />
      </g>
    );
  }

  if (
    design.facialHairStyle === "moustache" ||
    design.facialHairStyle === "thick-moustache" ||
    design.facialHairStyle === "handlebar"
  ) {
    const thick = design.facialHairStyle !== "moustache";

    return (
      <g>
        <path
          d={`M ${thick ? 38 : 40} ${faceBottom - 12.5} Q 43 ${faceBottom - (thick ? 16 : 15)} 48 ${faceBottom - 12.8} Q 53 ${faceBottom - (thick ? 16 : 15)} ${thick ? 58 : 56} ${faceBottom - 12.5} Q 53 ${faceBottom - (thick ? 9.6 : 10.5)} 48 ${faceBottom - 12} Q 43 ${faceBottom - (thick ? 9.6 : 10.5)} ${thick ? 38 : 40} ${faceBottom - 12.5} Z`}
          fill={color}
          opacity={thick ? 0.82 : 0.78}
        />
        {design.facialHairStyle === "handlebar" ? (
          <path
            d={`M 40 ${faceBottom - 12.3} Q 35 ${faceBottom - 9.4} 34 ${faceBottom - 13.4} M 56 ${faceBottom - 12.3} Q 61 ${faceBottom - 9.4} 62 ${faceBottom - 13.4}`}
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ) : null}
      </g>
    );
  }

  if (design.facialHairStyle === "goatee") {
    return (
      <>
        <path
          d={`M 41 ${faceBottom - 12.6} Q 48 ${faceBottom - 15} 55 ${faceBottom - 12.6}`}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          opacity="0.75"
        />
        <path
          d={`M 44 ${faceBottom - 8} Q 48 ${faceBottom - 4} 52 ${faceBottom - 8} L 51 ${faceBottom - 2} Q 48 ${faceBottom} 45 ${faceBottom - 2} Z`}
          fill={color}
          opacity="0.68"
        />
      </>
    );
  }

  if (design.facialHairStyle === "sideburns") {
    return (
      <g fill={color} opacity="0.72">
        <path d={`M 33 ${faceBottom - 27} Q 36 ${faceBottom - 23} 37 ${faceBottom - 15} L 34 ${faceBottom - 13} Q 32 ${faceBottom - 20} 33 ${faceBottom - 27} Z`} />
        <path d={`M 63 ${faceBottom - 27} Q 60 ${faceBottom - 23} 59 ${faceBottom - 15} L 62 ${faceBottom - 13} Q 64 ${faceBottom - 20} 63 ${faceBottom - 27} Z`} />
      </g>
    );
  }

  if (design.facialHairStyle === "chinstrap") {
    return (
      <path
        d={`M 33 ${faceBottom - 15} Q 35 ${faceBottom - 5} 43 ${faceBottom - 1.2} Q 48 ${faceBottom + 1.2} 53 ${faceBottom - 1.2} Q 61 ${faceBottom - 5} 63 ${faceBottom - 15}`}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.72"
      />
    );
  }

  if (
    design.facialHairStyle === "full-beard" ||
    design.facialHairStyle === "long-beard"
  ) {
    const long = design.facialHairStyle === "long-beard";
    const beardBottom = faceBottom + (long ? 9 : 3);

    return (
      <g fill={color} opacity="0.86">
        <path
          d={`M 32 ${faceBottom - 22} Q 33 ${faceBottom - 5} 42 ${beardBottom - 1} Q 48 ${beardBottom + (long ? 3 : 0)} 54 ${beardBottom - 1} Q 63 ${faceBottom - 5} 64 ${faceBottom - 22} L 60 ${faceBottom - 16} Q 57 ${faceBottom - 10} 55 ${faceBottom - 8} Q 48 ${faceBottom - 5} 41 ${faceBottom - 8} Q 39 ${faceBottom - 10} 36 ${faceBottom - 16} Z`}
        />
        <path
          d={`M 39 ${faceBottom - 12.7} Q 43 ${faceBottom - 15.7} 48 ${faceBottom - 12.8} Q 53 ${faceBottom - 15.7} 57 ${faceBottom - 12.7} Q 52 ${faceBottom - 9.8} 48 ${faceBottom - 12} Q 44 ${faceBottom - 9.8} 39 ${faceBottom - 12.7} Z`}
        />
      </g>
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
          [37, 43],
          [40, 44],
          [43, 43.5],
          [53, 43.5],
          [56, 44],
          [59, 43],
        ]
      : design.faceMark === "cheek-freckles"
        ? [
            [35, 48],
            [38, 49],
            [58, 49],
            [61, 48],
          ]
        : [
            [38, 48],
            [41, 49],
            [55, 49],
            [58, 48],
            [48, 54],
          ];

  return (
    <g
      fill={design.skinShadow}
      opacity={design.faceMark === "sun-kissed" ? 0.28 : 0.45}
    >
      {freckles.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.45" />
      ))}
    </g>
  );
}

function shiftForLip(color: string, amount: number): string {
  const normalized = color.replace("#", "");
  const red = Math.min(
    255,
    Number.parseInt(normalized.slice(0, 2), 16) + amount + 12,
  );
  const green = Math.min(
    255,
    Number.parseInt(normalized.slice(2, 4), 16) + amount,
  );
  const blue = Math.min(
    255,
    Number.parseInt(normalized.slice(4, 6), 16) + amount,
  );

  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}
