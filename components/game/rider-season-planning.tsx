import Link from "@/components/ui/app-link";
import { RiderAvatar } from "@/components/game/rider-avatar";
import {
  assignRiderPlanningEventLanes,
  countRiderPlannedDays,
  type RiderPlanningEntry,
  type RiderPlanningEvent,
  type RiderPlanningEventStatus,
  type RiderPlanningEventType,
  type TeamRiderSeasonPlanning,
} from "@/lib/game/rider-season-planning";
import {
  RACE_CATEGORY_STYLE,
  type RaceCategoryCode,
} from "@/lib/game/race-calendar";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";

const EVENT_TYPE_LABELS: Record<RiderPlanningEventType, string> = {
  race: "Course",
  form_camp: "Stage de forme",
  reconnaissance: "Reconnaissance",
  injury: "Blessure",
};

const EVENT_STATUS_LABELS: Record<RiderPlanningEventStatus, string> = {
  completed: "Terminé",
  active: "En cours",
  upcoming: "À venir",
};

export function RiderSeasonPlanning({
  planning,
  jersey,
  variant = "team",
}: {
  planning: TeamRiderSeasonPlanning;
  jersey: RiderJerseyAppearance;
  variant?: "team" | "rider";
}) {
  const events = planning.riders.flatMap((rider) => rider.events);
  const upcomingEvents = events.filter(
    (event) => event.status === "upcoming",
  ).length;
  const activeEvents = events.filter(
    (event) => event.status === "active",
  ).length;
  const ridersWithEvents = planning.riders.filter(
    (rider) => rider.events.length > 0,
  ).length;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_18px_50px_rgba(19,60,46,0.1)]">
      <header className="bg-[linear-gradient(135deg,#071A17,#0B302B_55%,#176951)] px-5 py-6 text-white sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
              {planning.seasonName} · J{planning.currentDayNumber}/28
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
              {variant === "rider"
                ? "Programme de la saison"
                : "Planning de l’effectif"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
              Courses, stages, reconnaissances et indisponibilités médicales
              sont réunis sur une seule ligne de temps.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <HeaderMetric label="En cours" value={activeEvents} />
            <HeaderMetric label="À venir" value={upcomingEvents} />
            <HeaderMetric
              label="Programmés"
              value={ridersWithEvents}
              suffix={variant === "team" ? `/${planning.riders.length}` : ""}
            />
          </div>
        </div>
        <PlanningLegend />
      </header>

      {planning.riders.length ? (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-[1540px]">
              <PlanningDayHeader
                days={planning.days}
                currentDayNumber={planning.currentDayNumber}
              />
              <div className="divide-y divide-[#315B3E]/10">
                {planning.riders.map((rider) => (
                  <PlanningRiderRow
                    key={rider.id}
                    rider={rider}
                    jersey={jersey}
                    currentDayNumber={planning.currentDayNumber}
                  />
                ))}
              </div>
            </div>
          </div>
          {variant === "rider" && planning.riders[0] ? (
            <RiderEventDetails rider={planning.riders[0]} />
          ) : null}
        </>
      ) : (
        <div className="px-6 py-12 text-center">
          <p className="text-lg font-black text-[#183F37]">
            Aucun coureur dans l’effectif actif
          </p>
          <p className="mt-2 text-sm font-semibold text-[#60756E]">
            Le planning se remplira dès qu’un coureur rejoindra l’équipe.
          </p>
        </div>
      )}
    </section>
  );
}

function PlanningDayHeader({
  days,
  currentDayNumber,
}: {
  days: TeamRiderSeasonPlanning["days"];
  currentDayNumber: number;
}) {
  const dayByNumber = new Map(days.map((day) => [day.dayNumber, day]));

  return (
    <div className="grid grid-cols-[250px_minmax(0,1fr)] border-b border-[#315B3E]/15 bg-[#F3F8F6]">
      <div className="sticky left-0 z-30 flex items-end border-r border-[#315B3E]/15 bg-[#F3F8F6] px-5 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#60756E]">
          Coureur
        </p>
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(28, minmax(46px, 1fr))" }}
      >
        {Array.from({ length: 28 }, (_, index) => {
          const dayNumber = index + 1;
          const day = dayByNumber.get(dayNumber);
          const isCurrent = dayNumber === currentDayNumber;
          return (
            <div
              key={dayNumber}
              className={`border-r px-1 py-2 text-center ${
                dayNumber % 7 === 0
                  ? "border-r-2 border-r-[#315B3E]/30"
                  : "border-r-[#315B3E]/10"
              } ${isCurrent ? "bg-[#F2C94C]/30" : ""}`}
            >
              <p
                className={`text-[10px] font-black ${
                  isCurrent ? "text-[#71580A]" : "text-[#315B3E]"
                }`}
              >
                J{dayNumber}
              </p>
              <p className="mt-0.5 text-[8px] font-bold text-[#86968F]">
                {day ? formatCalendarDate(day.calendarDate) : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanningRiderRow({
  rider,
  jersey,
  currentDayNumber,
}: {
  rider: RiderPlanningEntry;
  jersey: RiderJerseyAppearance;
  currentDayNumber: number;
}) {
  const layout = assignRiderPlanningEventLanes(rider.events);
  const rowHeight = Math.max(70, layout.laneCount * 34 + 18);

  return (
    <article className="grid grid-cols-[250px_minmax(0,1fr)] bg-white">
      <div
        className="sticky left-0 z-20 flex items-center gap-3 border-r border-[#315B3E]/15 bg-white px-4 py-3"
        style={{ minHeight: rowHeight }}
      >
        <RiderAvatar
          profileKey={rider.avatarProfileKey}
          seed={rider.avatarSeed}
          riderId={rider.id}
          age={rider.age}
          jersey={jersey}
          label={`Portrait de ${rider.firstName} ${rider.lastName}`}
          className="h-12 w-12 shrink-0"
        />
        <div className="min-w-0">
          <Link
            href={`/jeu/coureurs/${rider.id}`}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-black text-[#183F37] transition hover:text-[#176951]"
          >
            {rider.firstName} {rider.lastName} ↗
          </Link>
          <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-[#60756E]">
            <span
              className={`fi fi-${rider.countryCode.toLowerCase()} rounded-sm`}
              role="img"
              aria-label={`Drapeau ${rider.countryName}`}
            />
            {countRiderPlannedDays(rider.events)} jour
            {countRiderPlannedDays(rider.events) > 1 ? "s" : ""} occupé
            {countRiderPlannedDays(rider.events) > 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <div
        className="relative"
        style={{ minHeight: rowHeight }}
        aria-label={`Planning de ${rider.firstName} ${rider.lastName}`}
      >
        <TimelineGrid
          currentDayNumber={currentDayNumber}
          rowHeight={rowHeight}
        />
        <div
          className="absolute inset-0 grid content-center gap-y-1 py-2"
          style={{
            gridTemplateColumns: "repeat(28, minmax(46px, 1fr))",
            gridTemplateRows: `repeat(${layout.laneCount}, 30px)`,
          }}
        >
          {layout.events.map((event) => (
            <PlanningEventBar key={event.id} event={event} />
          ))}
        </div>
        {rider.events.length === 0 ? (
          <p className="absolute inset-0 flex items-center px-4 text-xs font-bold italic text-[#8A9993]">
            Aucun engagement ni indisponibilité programmé.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function TimelineGrid({
  currentDayNumber,
  rowHeight,
}: {
  currentDayNumber: number;
  rowHeight: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 grid"
      style={{
        minHeight: rowHeight,
        gridTemplateColumns: "repeat(28, minmax(46px, 1fr))",
      }}
    >
      {Array.from({ length: 28 }, (_, index) => {
        const dayNumber = index + 1;
        return (
          <span
            key={dayNumber}
            className={`border-r ${
              dayNumber % 7 === 0
                ? "border-r-2 border-r-[#315B3E]/25"
                : "border-r-[#315B3E]/10"
            } ${
              dayNumber === currentDayNumber
                ? "bg-[#F2C94C]/12"
                : dayNumber < currentDayNumber
                  ? "bg-[#F3F8F6]/45"
                  : ""
            }`}
          />
        );
      })}
    </div>
  );
}

function PlanningEventBar({
  event,
}: {
  event: RiderPlanningEvent & { lane: number };
}) {
  const style = getEventStyle(event);
  const className = `relative z-10 mx-0.5 flex min-w-0 items-center truncate rounded-lg border px-2 text-[9px] font-black shadow-sm transition ${
    event.status === "completed" ? "opacity-60 saturate-50" : ""
  } ${event.href ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`;
  const content = (
    <>
      <span className="mr-1.5 shrink-0" aria-hidden="true">
        {eventIcon(event.type)}
      </span>
      <span className="truncate">{event.title}</span>
    </>
  );
  const sharedProps = {
    className,
    style: {
      gridColumn: `${event.startDay} / ${event.endDay + 1}`,
      gridRow: event.lane + 1,
      backgroundColor: style.background,
      borderColor: style.border,
      color: style.foreground,
    },
    title: `${event.title} · ${event.detail} · J${event.startDay}${
      event.endDay > event.startDay ? `–J${event.endDay}` : ""
    }`,
    "aria-label": `${EVENT_TYPE_LABELS[event.type]} : ${event.title}, J${event.startDay} à J${event.endDay}`,
  };

  return event.href ? (
    <Link href={event.href} {...sharedProps}>
      {content}
    </Link>
  ) : (
    <div {...sharedProps}>{content}</div>
  );
}

function RiderEventDetails({ rider }: { rider: RiderPlanningEntry }) {
  return (
    <div className="border-t border-[#315B3E]/12 bg-[#F7FAF8] px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
            Détail du programme
          </p>
          <h3 className="mt-1 text-xl font-black text-[#183F37]">
            {rider.events.length} événement
            {rider.events.length > 1 ? "s" : ""} cette saison
          </h3>
        </div>
        <p className="text-xs font-bold text-[#60756E]">
          {countRiderPlannedDays(rider.events)} journée
          {countRiderPlannedDays(rider.events) > 1 ? "s" : ""} occupée
          {countRiderPlannedDays(rider.events) > 1 ? "s" : ""}
        </p>
      </div>
      {rider.events.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rider.events.map((event) => {
            const style = getEventStyle(event);
            const content = (
              <article className="h-full rounded-2xl border border-[#315B3E]/10 bg-white p-4 transition hover:border-[#278B70]/35 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em]"
                    style={{
                      color: style.foreground,
                      backgroundColor: style.background,
                      borderColor: style.border,
                    }}
                  >
                    {EVENT_TYPE_LABELS[event.type]}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#60756E]">
                    {EVENT_STATUS_LABELS[event.status]}
                  </span>
                </div>
                <h4 className="mt-3 font-black text-[#183F37]">
                  {event.title}
                </h4>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">
                  {event.detail}
                </p>
                <p className="mt-3 text-xs font-black text-[#176951]">
                  J{event.startDay}
                  {event.endDay > event.startDay
                    ? ` → J${event.endDay}`
                    : ""}
                </p>
              </article>
            );
            return event.href ? (
              <Link key={event.id} href={event.href} className="block">
                {content}
              </Link>
            ) : (
              <div key={event.id}>{content}</div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-[#315B3E]/20 bg-white p-5 text-sm font-semibold text-[#60756E]">
          Aucun événement n’est encore enregistré pour ce coureur.
        </p>
      )}
    </div>
  );
}

function PlanningLegend() {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {(
        [
          ["race", "#2457C5"],
          ["form_camp", "#278B70"],
          ["reconnaissance", "#C77A1B"],
          ["injury", "#D94F4F"],
        ] as const
      ).map(([type, color]) => (
        <span
          key={type}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.11em] text-[#F4F8F5]"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {EVENT_TYPE_LABELS[type]}
        </span>
      ))}
    </div>
  );
}

function HeaderMetric({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="min-w-20 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-center">
      <p className="text-lg font-black text-[#F2C94C]">
        {value}
        {suffix}
      </p>
      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#BFD1C6]">
        {label}
      </p>
    </div>
  );
}

function getEventStyle(event: RiderPlanningEvent): {
  background: string;
  foreground: string;
  border: string;
} {
  if (event.type === "race") {
    return event.raceCategoryCode
      ? categoryStyle(event.raceCategoryCode)
      : {
          background: "#2457C5",
          foreground: "#FFFFFF",
          border: "#163B91",
        };
  }
  if (event.type === "form_camp") {
    return {
      background: "#278B70",
      foreground: "#FFFFFF",
      border: "#176951",
    };
  }
  if (event.type === "reconnaissance") {
    return {
      background: "#C77A1B",
      foreground: "#FFFFFF",
      border: "#8B5311",
    };
  }
  return {
    background: "#D94F4F",
    foreground: "#FFFFFF",
    border: "#A62E2E",
  };
}

function categoryStyle(code: RaceCategoryCode) {
  return RACE_CATEGORY_STYLE[code];
}

function eventIcon(type: RiderPlanningEventType) {
  if (type === "race") return "◆";
  if (type === "form_camp") return "↗";
  if (type === "reconnaissance") return "⌖";
  return "✚";
}

function formatCalendarDate(value: string) {
  const [, month, day] = value.split("-");
  return day && month ? `${day}/${month}` : value;
}
