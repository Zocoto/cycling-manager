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

  if (element.kind === "text") {
    return <g data-national-jersey-element={element.id} transform={transform} opacity={element.opacity}>
      <text textAnchor="middle" dominantBaseline="central" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800"
        fontSize={Math.max(4, Math.min(48, element.height))} textLength={element.width} lengthAdjust="spacingAndGlyphs"
        fill={element.color} stroke={element.border === false ? "none" : element.secondaryColor} strokeWidth="0.25" paintOrder="stroke">
        {element.text ?? "NATION"}
      </text>
    </g>;
  }

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
      {element.border !== false ? getShapeOutline(element) : null}
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
        stroke: element.border === false ? "none" : element.secondaryColor,
        strokeWidth: Math.max(1.5, Math.min(4, element.width / 18)),
      };

  if (["stripes", "dots", "checkerboard"].includes(element.shape) && !clipOnly) {
    return <g data-jersey-pattern={element.shape}>
      <svg x={left} y={top} width={element.width} height={element.height} viewBox="0 0 100 100" preserveAspectRatio="none" overflow="hidden">
        {element.shape === "stripes" ? Array.from({length: 8}, (_, i) => <path key={i} d={`M${i * 28 - 110} 0h12l100 100h-12Z`} fill={element.color} />) : null}
        {element.shape === "dots" ? Array.from({length: 20}, (_, i) => <ellipse key={i} cx={10 + (i % 5) * 20} cy={12.5 + Math.floor(i / 5) * 25} rx="4" ry="5" fill={element.color} />) : null}
        {element.shape === "checkerboard" ? Array.from({length: 24}, (_, i) => <rect key={i} x={(i % 6) * 100 / 6} y={Math.floor(i / 6) * 25} width={100 / 6 + 0.05} height="25.05" fill={(i % 6 + Math.floor(i / 6)) % 2 === 0 ? element.color : element.secondaryColor} />) : null}
      </svg>
      {element.border !== false ? <rect x={left} y={top} width={element.width} height={element.height} fill="none" stroke={element.secondaryColor} strokeWidth={common.strokeWidth} /> : null}
    </g>;
  }

  if (element.shape === "triangle") {
    return <path d={`M0 ${top} ${-left} ${-top} ${left} ${-top}Z`} {...common} />;
  }
  if (element.shape === "star") {
    const points = Array.from({length: 10}, (_, i) => {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 1 : 0.43;
      return `${Math.cos(angle) * -left * radius},${Math.sin(angle) * -top * radius}`;
    }).join(" ");
    return <polygon points={points} {...common} />;
  }
  if (element.shape === "chevron") {
    return <path d={`M${left} ${top} 0 ${top * 0.25} ${-left} ${top}V${-top * 0.25}L0 ${-top} ${left} ${-top * 0.25}Z`} {...common} />;
  }
  if (element.shape === "lightning") {
    return <path d={`M${-left * 0.25} ${top} ${left} ${-top * 0.15} ${-left * 0.08} ${-top * 0.15} ${left * 0.3} ${-top} ${-left} ${top * 0.12} ${left * 0.05} ${top * 0.12}Z`} {...common} />;
  }
  if (element.shape === "line") {
    return <rect x={left} y={top} width={element.width} height={element.height} rx={element.height / 2} {...common} />;
  }
  if (element.shape === "wave") {
    return <path d={`M${left} ${top * 0.4}C${left * 0.5} ${top * 1.5} ${left * 0.5} ${-top * 0.7} 0 ${top * 0.4}S${-left * 0.5} ${-top * 0.7} ${-left} ${top * 0.4}V${-top * 0.4}C${-left * 0.5} ${-top * 1.5} ${-left * 0.5} ${top * 0.7} 0 ${-top * 0.4}S${left * 0.5} ${top * 0.7} ${left} ${-top * 0.4}Z`} {...common} />;
  }

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
