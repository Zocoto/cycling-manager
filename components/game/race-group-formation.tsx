import { SideRaceCyclist } from "@/components/game/race-cyclist-detailed";
import {
  getRaceGroupRiderSlots,
} from "@/lib/game/race-visual-layout";
import type {
  RaceGroupSnapshot,
  RaceIncident,
  RacePrimeResult,
  RiderSimulationInput,
} from "@/lib/game/race-simulation";

export function RaceGroupFormation({
  group,
  riderIds,
  riderById,
  incidents,
  primeWinnerId,
  primeResult,
  isMoving,
  compact,
}: {
  group: RaceGroupSnapshot;
  riderIds: string[];
  riderById: Map<string, RiderSimulationInput>;
  incidents: RaceIncident[];
  primeWinnerId: string | null;
  primeResult: RacePrimeResult | null;
  isMoving: boolean;
  compact: boolean;
}) {
  const slots = getRaceGroupRiderSlots({ riderIds, compact });
  const incidentRiderIds = new Set(
    incidents.flatMap((incident) => incident.riderIds),
  );

  return (
    <div
      data-race-group-formation={compact ? "compact" : "wide"}
      className={`relative overflow-visible ${
        compact ? "h-16 w-28" : "h-20 w-44"
      }`}
    >
      {riderIds.map((riderId, riderIndex) => {
        const rider = riderById.get(riderId);
        const slot = slots[riderIndex];
        if (!rider || !slot) return null;

        const incidentRider = incidentRiderIds.has(riderId);
        const primeWinner = riderId === primeWinnerId;
        const showName =
          incidentRider ||
          primeWinner ||
          group.riderIds.length <= 3 ||
          riderIndex < 2;

        return (
          <span
            key={riderId}
            className="absolute left-1/2 top-0 origin-top-left"
            style={{
              zIndex: slot.zIndex,
              transform: `translate(${slot.offsetX}px, ${slot.offsetY}px) scale(${slot.scale})`,
            }}
          >
            <SideRaceCyclist
              rider={rider}
              isMoving={isMoving}
              className={compact ? "h-8 w-14" : "h-9 w-16"}
            />
            {showName ? (
              <span
                className={`absolute left-1/2 top-[1.95rem] -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[7px] font-black shadow ${
                  primeWinner
                    ? "bg-[#F2C94C] text-[#17261E]"
                    : incidentRider
                      ? "bg-[#EF5B65] text-white"
                      : "bg-[#071A17]/88 text-white"
                }`}
              >
                {primeWinner
                  ? `${primeResult?.prime.type === "mountain" ? "GPM" : "SI"} · ${getRiderShortName(rider.name)}`
                  : getRiderShortName(rider.name)}
              </span>
            ) : null}
          </span>
        );
      })}

      {group.riderIds.length > riderIds.length ? (
        <span className="absolute bottom-0 right-0 z-20 grid h-7 w-7 place-items-center rounded-full border border-white/30 bg-[#071A17]/95 text-[8px] font-black text-white shadow-[-5px_0_0_rgba(7,26,23,0.62)]">
          +{group.riderIds.length - riderIds.length}
        </span>
      ) : null}
    </div>
  );
}

export function RaceSupportConvoy({
  left,
  top,
  primaryColor,
  secondaryColor,
  isMoving,
  showSecondCar,
}: {
  left: number;
  top: number;
  primaryColor: string;
  secondaryColor: string;
  isMoving: boolean;
  showSecondCar: boolean;
}) {
  return (
    <div
      data-race-support-convoy="true"
      className="pointer-events-none absolute z-[9] -translate-x-1/2"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <RaceSupportCar
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        isMoving={isMoving}
        label="Voiture sportive de l’équipe"
      />
      {showSecondCar ? (
        <div className="absolute -bottom-7 -left-12 scale-[0.82] opacity-90">
          <RaceSupportCar
            primaryColor="#243B35"
            secondaryColor="#F2C94C"
            isMoving={isMoving}
            label="Voiture de l’organisation"
          />
        </div>
      ) : null}
    </div>
  );
}

export function RaceDepartureFormation({
  riderIds,
  riderById,
  isMoving,
}: {
  riderIds: string[];
  riderById: Map<string, RiderSimulationInput>;
  isMoving: boolean;
}) {
  const visibleRiderIds = riderIds.slice(0, 8);
  const slots = getRaceGroupRiderSlots({
    riderIds: visibleRiderIds,
    compact: false,
  });

  return (
    <div
      data-race-group-formation="departure"
      className="relative h-20 w-44 overflow-visible"
    >
      {visibleRiderIds.map((riderId, index) => {
        const rider = riderById.get(riderId);
        const slot = slots[index];
        if (!rider || !slot) return null;

        return (
          <span
            key={riderId}
            className="absolute left-1/2 top-0 origin-top-left"
            style={{
              zIndex: slot.zIndex,
              transform: `translate(${slot.offsetX}px, ${slot.offsetY}px) scale(${slot.scale})`,
            }}
          >
            <SideRaceCyclist
              rider={rider}
              isMoving={isMoving}
              className="h-9 w-16"
            />
          </span>
        );
      })}
      {riderIds.length > visibleRiderIds.length ? (
        <span className="absolute bottom-0 right-0 z-20 grid h-7 w-7 place-items-center rounded-full border border-white/30 bg-[#071A17] text-[8px] font-black text-white shadow-lg">
          +{riderIds.length - visibleRiderIds.length}
        </span>
      ) : null}
    </div>
  );
}

function RaceSupportCar({
  primaryColor,
  secondaryColor,
  isMoving,
  label,
}: {
  primaryColor: string;
  secondaryColor: string;
  isMoving: boolean;
  label: string;
}) {
  return (
    <svg
      viewBox="0 0 124 60"
      role="img"
      aria-label={label}
      className={`h-11 w-[5.75rem] drop-shadow-xl ${
        isMoving ? "cm-support-car" : ""
      }`}
    >
      <defs>
        <linearGradient id="support-car-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EAF5F3" />
          <stop offset="1" stopColor="#72918C" />
        </linearGradient>
      </defs>
      <ellipse cx="62" cy="54" rx="52" ry="5" fill="rgba(5,17,14,0.24)" />
      <circle cx="30" cy="47" r="10" fill="#111916" stroke="#D7E5DE" strokeWidth="2.4" />
      <circle cx="30" cy="47" r="4" fill="#778A81" stroke="#EEF3F0" strokeWidth="1" />
      <circle cx="96" cy="47" r="10" fill="#111916" stroke="#D7E5DE" strokeWidth="2.4" />
      <circle cx="96" cy="47" r="4" fill="#778A81" stroke="#EEF3F0" strokeWidth="1" />
      <path
        d="M7 43 17 27l25-5 13-13h34l17 20 11 5 3 13H5Z"
        fill={primaryColor}
        stroke="#FFFDF4"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m46 22 12-11h28l12 18H39Z"
        fill="url(#support-car-glass)"
        stroke="#DCE8E2"
        strokeWidth="1.4"
      />
      <path d="M70 11v18M91 15l7 14" stroke="#315B3E" strokeWidth="1.25" />
      <path d="M11 40h105M45 29l-5 18M100 30l4 15" stroke={secondaryColor} strokeWidth="2.2" />
      <path d="M50 7h34M55 4h24" stroke="#17261E" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="58" cy="6" r="3.6" fill="#17261E" stroke="#DCE8E2" strokeWidth="1" />
      <circle cx="76" cy="6" r="3.6" fill="#17261E" stroke="#DCE8E2" strokeWidth="1" />
      <rect x="12" y="33" width="7" height="5" rx="2" fill="#FFF2B5" />
      <path d="M110 34h7" stroke="#EF5B65" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 36h34" stroke="#FFFDF4" strokeWidth="1.1" opacity="0.76" />
      <path d="M60 33h14v7H60Z" fill={secondaryColor} opacity="0.9" />
    </svg>
  );
}

function getRiderShortName(name: string) {
  return name.split(" ").at(-1) ?? name;
}
