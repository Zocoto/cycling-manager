import type { RaceCategoryCode } from "@/lib/game/race-calendar";

export const RIDER_PLANNING_EVENT_TYPES = [
  "race",
  "form_camp",
  "reconnaissance",
  "injury",
] as const;

export type RiderPlanningEventType =
  (typeof RIDER_PLANNING_EVENT_TYPES)[number];

export type RiderPlanningEventStatus =
  | "completed"
  | "active"
  | "upcoming";

export type RiderPlanningEvent = {
  id: string;
  riderId: string;
  type: RiderPlanningEventType;
  title: string;
  detail: string;
  startDay: number;
  endDay: number;
  status: RiderPlanningEventStatus;
  href: string | null;
  raceCategoryCode: RaceCategoryCode | null;
};

export type RiderPlanningEntry = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  avatarProfileKey: string | null;
  avatarSeed: number | string | null;
  age: number;
  events: RiderPlanningEvent[];
};

export type TeamRiderSeasonPlanning = {
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
  currentDayNumber: number;
  days: Array<{
    id: string;
    dayNumber: number;
    calendarDate: string;
  }>;
  riders: RiderPlanningEntry[];
};

export type RiderPlanningEventWithLane = RiderPlanningEvent & {
  lane: number;
};

export function getRiderPlanningEventStatus({
  startDay,
  endDay,
  currentDayNumber,
}: {
  startDay: number;
  endDay: number;
  currentDayNumber: number;
}): RiderPlanningEventStatus {
  if (endDay < currentDayNumber) return "completed";
  if (startDay > currentDayNumber) return "upcoming";
  return "active";
}

export function normalizeRiderPlanningEvent(
  event: RiderPlanningEvent,
): RiderPlanningEvent | null {
  const startDay = clampDay(event.startDay);
  const endDay = clampDay(event.endDay);
  if (endDay < startDay) return null;
  return { ...event, startDay, endDay };
}

export function assignRiderPlanningEventLanes(
  events: RiderPlanningEvent[],
): {
  events: RiderPlanningEventWithLane[];
  laneCount: number;
} {
  const orderedEvents = events
    .flatMap((event) => {
      const normalized = normalizeRiderPlanningEvent(event);
      return normalized ? [normalized] : [];
    })
    .sort(
      (left, right) =>
        left.startDay - right.startDay ||
        left.endDay - right.endDay ||
        eventPriority(left.type) - eventPriority(right.type) ||
        left.title.localeCompare(right.title, "fr"),
    );
  const laneEndDays: number[] = [];
  const positionedEvents = orderedEvents.map(
    (event): RiderPlanningEventWithLane => {
      const availableLane = laneEndDays.findIndex(
        (endDay) => endDay < event.startDay,
      );
      const lane =
        availableLane >= 0 ? availableLane : laneEndDays.length;
      laneEndDays[lane] = event.endDay;
      return { ...event, lane };
    },
  );

  return {
    events: positionedEvents,
    laneCount: Math.max(1, laneEndDays.length),
  };
}

export function countRiderPlannedDays(events: RiderPlanningEvent[]) {
  const days = new Set<number>();
  for (const event of events) {
    const normalized = normalizeRiderPlanningEvent(event);
    if (!normalized) continue;
    for (let day = normalized.startDay; day <= normalized.endDay; day += 1) {
      days.add(day);
    }
  }
  return days.size;
}

function clampDay(dayNumber: number) {
  return Math.min(28, Math.max(1, Math.trunc(dayNumber)));
}

function eventPriority(type: RiderPlanningEventType) {
  return RIDER_PLANNING_EVENT_TYPES.indexOf(type);
}
