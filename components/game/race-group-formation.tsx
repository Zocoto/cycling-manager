import { useId, type CSSProperties } from "react";

import { SideRaceCyclist } from "@/components/game/race-cyclist-detailed";
import {
  getRaceGroupRiderSlots,
  type RaceGroupVisualFormation,
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
  primeSprintContenderIds = [],
  primeSprintProgress = null,
}: {
  group: RaceGroupSnapshot;
  riderIds: string[];
  riderById: Map<string, RiderSimulationInput>;
  incidents: RaceIncident[];
  primeWinnerId: string | null;
  primeResult: RacePrimeResult | null;
  isMoving: boolean;
  compact: boolean;
  primeSprintContenderIds?: string[];
  primeSprintProgress?: number | null;
}) {
  const groupSprintContenderIds = primeSprintContenderIds.filter((riderId) =>
    group.riderIds.includes(riderId),
  );
  const isPrimeSprintBattle =
    primeSprintProgress !== null && groupSprintContenderIds.length >= 2;
  const formation: RaceGroupVisualFormation = isPrimeSprintBattle
    ? "prime-sprint"
    : group.type === "breakaway"
      ? "breakaway-line"
      : group.type === "peloton"
        ? "peloton-front"
        : "bunch";
  const orderedRiderIds = orderFormationRiderIds({
    riderIds,
    riderById,
    formation,
    primeSprintContenderIds: groupSprintContenderIds,
  });
  const slots = getRaceGroupRiderSlots({
    riderIds: orderedRiderIds,
    compact,
    formation,
  });
  const incidentRiderIds = new Set(
    incidents.flatMap((incident) => incident.riderIds),
  );

  return (
    <div
      data-race-group-formation={formation}
      data-race-prime-sprint={isPrimeSprintBattle ? "active" : undefined}
      className={`relative overflow-visible ${
        formation === "breakaway-line"
          ? compact
            ? "h-16 w-40"
            : "h-20 w-60"
          : formation === "peloton-front"
            ? compact
              ? "h-16 w-36"
              : "h-20 w-52"
            : formation === "prime-sprint"
              ? compact
                ? "h-20 w-40"
                : "h-20 w-52"
              : compact
                ? "h-16 w-28"
                : "h-20 w-44"
      }`}
    >
      {isPrimeSprintBattle ? (
        <span
          aria-hidden="true"
          className="absolute -right-10 top-0 h-14 w-32 opacity-75 cm-prime-sprint-wind-lines"
        />
      ) : null}
      {orderedRiderIds.map((riderId, riderIndex) => {
        const rider = riderById.get(riderId);
        const slot = slots[riderIndex];
        if (!rider || !slot) return null;

        const incidentRider = incidentRiderIds.has(riderId);
        const primeWinner = riderId === primeWinnerId;
        const primeContenderIndex = groupSprintContenderIds.indexOf(riderId);
        const showName =
          incidentRider ||
          primeWinner ||
          primeContenderIndex >= 0 ||
          group.riderIds.length <= 3 ||
          riderIndex < 2;
        const weaveStyle = {
          "--cm-rider-weave-x": `${1 + (riderIndex % 3) * 0.35}px`,
          "--cm-rider-weave-y": `${0.7 + (riderIndex % 2) * 0.45}px`,
          animationDelay: `${-(riderIndex % 5) * 0.43}s`,
          animationDuration: `${2.7 + (riderIndex % 4) * 0.32}s`,
        } as CSSProperties;

        return (
          <span
            key={riderId}
            className="absolute left-1/2 top-0 origin-top-left"
            style={{
              zIndex: slot.zIndex,
              transform: `translate(${slot.offsetX}px, ${slot.offsetY}px) scale(${slot.scale})`,
            }}
          >
            <span
              data-race-rider-weave={isMoving ? "active" : "still"}
              data-prime-sprint-contender={
                primeContenderIndex >= 0 ? primeContenderIndex + 1 : undefined
              }
              className={`relative block ${isMoving ? "cm-race-rider-weave" : ""} ${
                isMoving && primeContenderIndex >= 0
                  ? "cm-prime-sprint-contender"
                  : ""
              }`}
              style={weaveStyle}
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
                        : primeContenderIndex >= 0
                          ? "border border-[#9BE0CA]/60 bg-[#0B4A3B]/95 text-white"
                          : "bg-[#071A17]/88 text-white"
                  }`}
                >
                  {primeWinner
                    ? `${primeResult?.prime.type === "mountain" ? "GPM" : "SI"} · ${getRiderShortName(rider.name)}`
                    : primeContenderIndex >= 0
                      ? `Sprint · ${getRiderShortName(rider.name)}`
                      : getRiderShortName(rider.name)}
                </span>
              ) : null}
            </span>
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
        variant="team"
      />
      {showSecondCar ? (
        <div className="absolute -bottom-7 -left-12 scale-[0.82] opacity-90">
          <RaceSupportCar
            primaryColor="#243B35"
            secondaryColor="#F2C94C"
            isMoving={isMoving}
            label="Voiture de l’organisation"
            variant="organization"
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
  variant,
}: {
  primaryColor: string;
  secondaryColor: string;
  isMoving: boolean;
  label: string;
  variant: "team" | "organization";
}) {
  const visualId = `support-car-${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 154 72"
      role="img"
      aria-label={label}
      data-race-support-car={variant}
      data-race-car-direction="right"
      className={`h-12 w-28 drop-shadow-xl ${
        isMoving ? "cm-support-car" : ""
      }`}
    >
      <defs>
        <linearGradient id={`${visualId}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={secondaryColor} stopOpacity="0.72" />
          <stop offset="0.22" stopColor={primaryColor} />
          <stop offset="1" stopColor={primaryColor} />
        </linearGradient>
        <linearGradient id={`${visualId}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4FAF8" />
          <stop offset="0.45" stopColor="#A9C5C0" />
          <stop offset="1" stopColor="#4F6D68" />
        </linearGradient>
      </defs>
      <ellipse cx="78" cy="64" rx="66" ry="4.5" fill="rgba(5,17,14,0.2)" />
      <path
        d="M8 53 14 40q2-5 8-6l27-5 13-15q3-4 9-4h34q6 0 10 5l17 18 11 4q6 2 7 8l1 9-7 5h-14a14 14 0 0 0-27 0H52a14 14 0 0 0-27 0H12q-5-1-4-6Z"
        fill={`url(#${visualId}-body)`}
        stroke="#EAF1ED"
        strokeWidth="1.05"
        strokeLinejoin="round"
      />
      <path
        d="m55 29 11-14q2-2 6-2h12v17Zm32-16h15q4 0 7 4l13 14H87Z"
        fill={`url(#${visualId}-glass)`}
        stroke="#DCE8E2"
        strokeWidth="0.85"
      />
      <path d="M86 13v18M112 21l10 10" stroke="#425E59" strokeWidth="0.75" />
      <path d="M18 39h119" stroke={secondaryColor} strokeWidth="1.45" opacity="0.95" />
      <path d="M55 30 50 55m37-24v25m38-24 5 18" fill="none" stroke="#142720" strokeWidth="0.65" opacity="0.62" />
      <path d="M61 39h17m17 0h16" stroke="#F3F7F5" strokeWidth="0.7" strokeLinecap="round" opacity="0.82" />
      <path d="M68 35h7m26 0h7" stroke="#18332A" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M48 27h-7l-5 4h11" fill={primaryColor} stroke="#DCE8E2" strokeWidth="0.75" strokeLinejoin="round" />
      <path d="M12 41h9v5h-8" fill="#E4545E" stroke="#F5CFD2" strokeWidth="0.55" />
      <rect x="135" y="40" width="10" height="5" rx="2.3" fill="#FFF3B5" stroke="#EAF1ED" strokeWidth="0.55" />
      <path d="M148 40.5h5m-5 3h6" stroke="#FFF3B5" strokeWidth="0.7" strokeLinecap="round" opacity="0.78" />
      <path d="M10 51h9m117 0h13M64 54h28" stroke="#12231D" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M17 49h5m118-2h7" stroke="#E8F0EC" strokeWidth="0.55" />

      <g data-race-car-roof-rack="detailed" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M58 9h57M64 6v5m43-5v5" stroke="#17261E" strokeWidth="1.35" />
        <g transform="translate(73 -1) scale(.34)" stroke="#17261E">
          <circle cx="0" cy="17" r="10" strokeWidth="2.4" />
          <circle cx="43" cy="17" r="10" strokeWidth="2.4" />
          <path d="M0 17 14 2l10 15H0L12-5l19 2 12 20M14 2h10m7-5 7-7m-3 0h10" strokeWidth="2.1" />
        </g>
      </g>

      {[38, 116].map((wheelX) => (
        <g
          key={wheelX}
          data-race-car-wheel="fine"
          data-race-car-wheel-animation={isMoving ? "running" : "paused"}
        >
          <circle cx={wheelX} cy="57" r="10.6" fill="#101714" stroke="#26352F" strokeWidth="1.1" />
          <circle cx={wheelX} cy="57" r="6.4" fill="#8B9A93" stroke="#E2EBE6" strokeWidth="0.75" />
          <g
            data-race-car-wheel-rotor="centered"
            className={isMoving ? "cm-race-car-wheel" : ""}
          >
            <path
              d={`M${wheelX - 5.4} 57h10.8M${wheelX} 51.6v10.8`}
              stroke="#D8E2DD"
              strokeWidth="0.55"
            />
            <path
              d={`M${wheelX - 3.8} 53.2l7.6 7.6M${wheelX + 3.8} 53.2l-7.6 7.6`}
              stroke="#D8E2DD"
              strokeWidth="0.55"
            />
          </g>
          <circle cx={wheelX} cy="57" r="2" fill="#24342E" />
        </g>
      ))}
    </svg>
  );
}

function orderFormationRiderIds({
  riderIds,
  riderById,
  formation,
  primeSprintContenderIds,
}: {
  riderIds: string[];
  riderById: Map<string, RiderSimulationInput>;
  formation: RaceGroupVisualFormation;
  primeSprintContenderIds: string[];
}) {
  if (formation === "prime-sprint") {
    const contenders = primeSprintContenderIds.filter((riderId) =>
      riderIds.includes(riderId),
    );
    return [
      ...contenders,
      ...riderIds.filter((riderId) => !contenders.includes(riderId)),
    ];
  }

  if (formation !== "peloton-front") return riderIds;

  const workers = riderIds
    .filter((riderId) => {
      const role = riderById.get(riderId)?.role;
      return role === "domestique" || role === "leadout";
    })
    .slice(0, 3);
  return [
    ...workers,
    ...riderIds.filter((riderId) => !workers.includes(riderId)),
  ];
}

function getRiderShortName(name: string) {
  return name.split(" ").at(-1) ?? name;
}
