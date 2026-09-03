import { SvgCountryFlag } from "@/components/game/svg-country-flag";
import {
  normalizeNationalJerseyDraft,
  type NationalJerseyDraft,
  type NationalJerseyElement,
} from "@/lib/game/national-jersey-preview";

export const NATIONAL_JERSEY_SHIRT_PATH =
  "M39 9 19 18 5 48l19 10 8-14v78h56V44l8 14 19-10-14-30-20-9c-4 7-10 10-21 10S43 16 39 9Z";

export function NationalJerseyDesignArtwork({
  countryCode,
  design,
  idPrefix,
}: {
  countryCode: string;
  design: NationalJerseyDraft;
  idPrefix: string;
}) {
  const normalized = normalizeNationalJerseyDraft(design);

  return (
    <>
      <rect width="120" height="132" fill={normalized.baseColor} />
      {normalized.elements.map((element, index) => (
        <NationalJerseyElementArtwork
          key={element.id}
          countryCode={countryCode}
          element={element}
          clipId={`${idPrefix}-${index}-${element.id}`.replace(/[^a-zA-Z0-9_-]/g, "")}
        />
      ))}
    </>
  );
}

export function NationalJerseyDesignPattern({
  countryCode,
  design,
  idPrefix,
  clipPathId,
  x = 0,
  y = 0,
  width,
  height,
}: {
  countryCode: string;
  design: NationalJerseyDraft;
  idPrefix: string;
  clipPathId: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
}) {
  return (
    <g clipPath={`url(#${clipPathId})`}>
      <svg
        x={x}
        y={y}
        width={width}
        height={height}
        viewBox="0 0 120 132"
        preserveAspectRatio="xMidYMid slice"
        overflow="hidden"
      >
        <NationalJerseyDesignArtwork
          countryCode={countryCode}
          design={design}
          idPrefix={idPrefix}
        />
      </svg>
    </g>
  );
}

function NationalJerseyElementArtwork({
  countryCode,
  element,
  clipId,
}: {
  countryCode: string;
  element: NationalJerseyElement;
  clipId: string;
}) {
  const transform = `translate(${element.x} ${element.y}) rotate(${element.rotation})`;
  const left = -element.width / 2;
  const top = -element.height / 2;

  if (element.kind === "band") {
    return (
      <g
        data-national-jersey-element={element.id}
        transform={transform}
        opacity={element.opacity}
      >
        <rect
          x={left}
          y={top}
          width={element.width}
          height={element.height}
          rx={Math.min(4, element.height / 4)}
          fill={element.color}
        />
        <rect
          x={left}
          y={-Math.max(1.5, element.height * 0.08)}
          width={element.width}
          height={Math.max(3, element.height * 0.16)}
          fill={element.secondaryColor}
        />
      </g>
    );
  }

  const shape = getShapeArtwork(element);

  if (element.kind === "shape") {
    return (
      <g
        data-national-jersey-element={element.id}
        transform={transform}
        opacity={element.opacity}
      >
        {shape}
      </g>
    );
  }

  return (
    <g
      data-national-jersey-element={element.id}
      transform={transform}
      opacity={element.opacity}
    >
      <defs>
        <clipPath id={clipId}>{getShapeArtwork(element, true)}</clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {element.kind === "flag" ? (
          <SvgCountryFlag
            countryCode={countryCode}
            x={left}
            y={top}
            width={element.width}
            height={element.height}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <NationalEmblemArtwork
            countryCode={countryCode}
            width={element.width}
            height={element.height}
            primaryColor={element.color}
            accentColor={element.secondaryColor}
          />
        )}
      </g>
      {getShapeOutline(element)}
    </g>
  );
}

function getShapeArtwork(
  element: NationalJerseyElement,
  clipOnly = false,
) {
  const left = -element.width / 2;
  const top = -element.height / 2;
  const common = clipOnly
    ? { fill: "#000000" }
    : {
        fill: element.color,
        stroke: element.secondaryColor,
        strokeWidth: Math.max(1.5, Math.min(4, element.width / 18)),
      };

  if (element.shape === "roundel") {
    return <ellipse cx="0" cy="0" rx={element.width / 2} ry={element.height / 2} {...common} />;
  }
  if (element.shape === "diamond") {
    return (
      <path
        d={`M0 ${top} ${element.width / 2} 0 0 ${element.height / 2} ${left} 0Z`}
        {...common}
      />
    );
  }
  if (element.shape === "hexagon") {
    return (
      <path
        d={`M${left * 0.58} ${top} ${-left * 0.58} ${top} ${-left} 0 ${-left * 0.58} ${-top} ${left * 0.58} ${-top} ${left} 0Z`}
        {...common}
      />
    );
  }
  if (element.shape === "shield") {
    const halfWidth = element.width / 2;
    const halfHeight = element.height / 2;
    return (
      <path
        d={`M${-halfWidth} ${-halfHeight}H${halfWidth}V${-halfHeight * 0.05}C${halfWidth} ${halfHeight * 0.48} ${halfWidth * 0.52} ${halfHeight * 0.84} 0 ${halfHeight}C${-halfWidth * 0.52} ${halfHeight * 0.84} ${-halfWidth} ${halfHeight * 0.48} ${-halfWidth} ${-halfHeight * 0.05}Z`}
        {...common}
      />
    );
  }

  return (
    <rect
      x={left}
      y={top}
      width={element.width}
      height={element.height}
      rx={Math.min(5, element.width / 8, element.height / 8)}
      {...common}
    />
  );
}

function getShapeOutline(element: NationalJerseyElement) {
  return (
    <g fill="none" stroke={element.secondaryColor} strokeWidth="2">
      {getShapeArtwork({ ...element, color: "transparent" })}
    </g>
  );
}

function NationalEmblemArtwork({
  countryCode,
  width,
  height,
  primaryColor,
  accentColor,
}: {
  countryCode: string;
  width: number;
  height: number;
  primaryColor: string;
  accentColor: string;
}) {
  const code = countryCode.trim().toUpperCase();
  const scale = Math.min(width, height) / 64;

  if (code === "BE") {
    return (
      <g
        data-national-emblem="belgian-lion"
        transform={`scale(${scale})`}
        fill={primaryColor}
        stroke={accentColor}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M-16 17c5-4 5-11 3-17l8-7 8 2 6-8 5 3-4 8 8 2-5 6 3 10-8 1-4-7-6 5-1 11-8 1-1-9Z" />
        <path d="M-12-2c-8-2-11-9-7-15 1 6 6 7 10 6M9-12l-2-6 5 3 4-5 1 7" fill="none" />
        <circle cx="8" cy="-8" r="1.5" fill={accentColor} stroke="none" />
      </g>
    );
  }

  if (code === "MX") {
    return (
      <g data-national-emblem="mexican-eagle-and-serpent">
        <SvgCountryFlag
          countryCode="MX"
          x={-width * 1.5}
          y={-height * 1.5}
          width={width * 3}
          height={height * 3}
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    );
  }

  return (
    <g data-national-emblem={`flag-center-${code.toLowerCase()}`}>
      <SvgCountryFlag
        countryCode={code}
        x={-width}
        y={-height}
        width={width * 2}
        height={height * 2}
        preserveAspectRatio="xMidYMid slice"
      />
    </g>
  );
}
