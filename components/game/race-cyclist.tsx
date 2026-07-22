import type { RiderSimulationInput } from "@/lib/game/race-simulation";
import {
  getTeamKitPattern,
  getTeamMonogram,
  type TeamKitPattern,
} from "@/lib/game/race-visuals";

export function SideRaceCyclist({
  rider,
  isMoving = true,
  className = "h-12 w-[4.5rem]",
}: {
  rider: RiderSimulationInput;
  isMoving?: boolean;
  className?: string;
}) {
  const kitPattern = getTeamKitPattern(rider.teamId);
  const monogram = getTeamMonogram(rider.teamName);

  return (
    <svg
      viewBox="0 0 72 48"
      role="img"
      aria-label={`${rider.name}, ${rider.teamName}`}
      className={`${className} overflow-visible drop-shadow-md ${isMoving ? "cm-bike-bob" : ""}`}
    >
      <title>{rider.name} · {rider.teamName}</title>
      <SideWheel cx={14} moving={isMoving} />
      <SideWheel cx={58} moving={isMoving} />

      <g fill="none" stroke="#DCE8E2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 36 29 21l8 15H14l13-19 18 2 13 17" strokeWidth="1.65" />
        <path d="M29 21h9M45 19l6-4M49 15h7" strokeWidth="1.35" />
        <circle cx="37" cy="36" r="2.4" strokeWidth="1.1" />
      </g>

      <g className={isMoving ? "cm-bike-pedal" : ""} style={{ transformOrigin: "37px 36px" }}>
        <path d="M31 33 37 36 43 39" fill="none" stroke="#18241F" strokeWidth="2" strokeLinecap="round" />
        <path d="M29 32h5M41 40h5" stroke="#F3F5F4" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      <path d="M35 22 31 32" stroke="#E7B18C" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M35 22 43 28 42 38" fill="none" stroke="#E7B18C" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M33 21 39 22 38 27 33 26Z" fill="#15231E" stroke="#071A17" strokeWidth="0.8" />

      <path
        d="M35 11.5 29 16.5 31.5 24 39.5 23 47 15.5 43.5 11Z"
        fill={rider.teamPrimaryColor}
        stroke="#F4F7F5"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <SideJerseyPattern pattern={kitPattern} color={rider.teamSecondaryColor} />
      <path d="M30 16.5 25 22" stroke={rider.teamSecondaryColor} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M45 15 51 20 55 18" fill="none" stroke="#E7B18C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="37.5" y="18.2" textAnchor="middle" fontSize="4.1" fontWeight="900" fill="#FFFFFF" stroke="#071A17" strokeWidth="0.8" paintOrder="stroke">
        {monogram}
      </text>

      <circle cx="48.5" cy="8.6" r="4.4" fill="#E7B18C" stroke="#6E4A39" strokeWidth="0.65" />
      <path d="M44.2 8.3c.4-4.2 3.4-5.8 6.5-4.8 2.3.7 3.4 2.4 3.5 4.1l-4.8-1Z" fill={rider.teamSecondaryColor} stroke="#071A17" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="m46.5 4.5 1.2 2.2m2-2.7.2 3.1m2-1.8-.5 2" stroke="#FFFDF4" strokeOpacity="0.65" strokeWidth="0.65" strokeLinecap="round" />
      <path d="M52.7 8.4 50.8 12" stroke="#24332C" strokeWidth="0.65" />
    </svg>
  );
}

export function TopRaceCyclist({
  rider,
  isMoving = true,
}: {
  rider: RiderSimulationInput;
  isMoving?: boolean;
}) {
  const kitPattern = getTeamKitPattern(rider.teamId);
  const monogram = getTeamMonogram(rider.teamName);

  return (
    <svg
      viewBox="0 0 72 34"
      role="img"
      aria-label={`${rider.name}, ${rider.teamName}`}
      className={`h-9 w-[4.75rem] overflow-visible drop-shadow-lg ${isMoving ? "cm-bike-top-sway" : ""}`}
    >
      <title>{rider.name} · {rider.teamName}</title>
      <g fill="none" stroke="#E7EEE9" strokeWidth="1.25">
        <ellipse className={isMoving ? "cm-bike-wheel" : ""} cx="10" cy="17" rx="8" ry="3.3" strokeDasharray="3 2" />
        <ellipse className={isMoving ? "cm-bike-wheel" : ""} cx="62" cy="17" rx="8" ry="3.3" strokeDasharray="3 2" />
        <path d="M10 17 30 11l14 6H10l20 6 14-6h18M44 17l10-7m-2 0h7" stroke="#DCE8E2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="M31 11 23 7m8 16-8 4" stroke="#E7B18C" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M40 10 52 12m-12 12 12-2" stroke="#E7B18C" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="37" cy="17" rx="13" ry="8.2" fill={rider.teamPrimaryColor} stroke="#F4F7F5" strokeWidth="0.85" />
      <TopJerseyPattern pattern={kitPattern} color={rider.teamSecondaryColor} />
      <text x="36" y="19" textAnchor="middle" fontSize="4.2" fontWeight="900" fill="#FFFFFF" stroke="#071A17" strokeWidth="0.8" paintOrder="stroke">
        {monogram}
      </text>
      <ellipse cx="51" cy="17" rx="4.8" ry="4" fill="#E7B18C" stroke="#6E4A39" strokeWidth="0.6" />
      <path d="M48 13.4c4-1.5 7.2.1 8 3.2l-7.2.1Z" fill={rider.teamSecondaryColor} stroke="#071A17" strokeWidth="0.8" />
      <path d="m50.5 13.3.4 2.4m2.1-2.2-.2 2.3m2-.9-.5 1.3" stroke="#FFFDF4" strokeOpacity="0.65" strokeWidth="0.55" />
    </svg>
  );
}

function SideWheel({ cx, moving }: { cx: number; moving: boolean }) {
  return (
    <g>
      <circle className={moving ? "cm-bike-wheel" : ""} cx={cx} cy="36" r="10" fill="rgba(7,26,23,0.12)" stroke="#F1F5F3" strokeWidth="1.25" strokeDasharray="3 2" />
      <circle cx={cx} cy="36" r="8.7" fill="none" stroke="#AFC2B9" strokeWidth="0.45" />
      <circle cx={cx} cy="36" r="1.2" fill="#E8EFEB" />
      <path d={`M${cx - 8.5} 36h17M${cx} 27.5v17M${cx - 6} 30l12 12M${cx + 6} 30l-12 12`} stroke="#DCE8E2" strokeOpacity="0.68" strokeWidth="0.45" />
    </g>
  );
}

function SideJerseyPattern({ pattern, color }: { pattern: TeamKitPattern; color: string }) {
  if (pattern === "center_stripe") return <path d="M35 11.4 39 11.3 38 23.3 34 23.6Z" fill={color} />;
  if (pattern === "halves") return <path d="M39 11.3 43.5 11 47 15.5 39.5 23 38 23.2Z" fill={color} />;
  if (pattern === "chevron") return <path d="m30.4 16.1 6.5 3.4 9.3-5.6 1.1 2.2-10.1 6.2-7.5-4Z" fill={color} />;
  return <path d="m31.6 14.1 2.7-2.2 9.8 7.2-2.5 2.3Z" fill={color} />;
}

function TopJerseyPattern({ pattern, color }: { pattern: TeamKitPattern; color: string }) {
  if (pattern === "center_stripe") return <rect x="33.5" y="9" width="5" height="16" rx="2" fill={color} />;
  if (pattern === "halves") return <path d="M37 8.8c7.2 0 13 3.6 13 8.2s-5.8 8.2-13 8.2Z" fill={color} />;
  if (pattern === "chevron") return <path d="m26 12 11 6 12-6 1.2 3.3L37 22 24.8 15.2Z" fill={color} />;
  return <path d="m27 10.5 4-1.3 15 14.2-4 1.3Z" fill={color} />;
}
