import Link from "@/components/ui/app-link";
import type {
  DashboardEvent,
  DashboardEventCategory,
  DashboardEventPriority,
} from "@/lib/game/dashboard-events";

const PRIORITY_STYLES: Record<
  DashboardEventPriority,
  { label: string; badge: string; icon: string }
> = {
  critical: {
    label: "Urgent",
    badge: "border-[#D85D5D]/25 bg-[#FFF0EE] text-[#9A3434]",
    icon: "border-[#D85D5D]/20 bg-[#FFF0EE] text-[#B53F3F]",
  },
  action: {
    label: "À suivre",
    badge: "border-[#D4A82F]/30 bg-[#FFF7D9] text-[#7A5B09]",
    icon: "border-[#D4A82F]/25 bg-[#FFF7D9] text-[#8A6812]",
  },
  update: {
    label: "Nouveau",
    badge: "border-[#278B70]/20 bg-[#E8F7F1] text-[#176951]",
    icon: "border-[#278B70]/20 bg-[#E8F7F1] text-[#176951]",
  },
};

type DashboardEventGroup = {
  id: "health" | "race" | "squad" | "club" | "objectives";
  title: string;
  description: string;
  iconCategory: DashboardEventCategory;
  categories: readonly DashboardEventCategory[];
  events: DashboardEvent[];
};

const EVENT_GROUPS = [
  {
    id: "health",
    title: "Santé de l’effectif",
    description: "Blessures, indisponibilités et retours estimés.",
    iconCategory: "health",
    categories: ["health"],
  },
  {
    id: "race",
    title: "Courses et résultats",
    description: "Résultats, inscriptions et sélections à suivre.",
    iconCategory: "race",
    categories: ["race"],
  },
  {
    id: "squad",
    title: "Effectif et développement",
    description: "Contrats, entraînement et détection des coureurs.",
    iconCategory: "contract",
    categories: ["contract", "training", "scouting"],
  },
  {
    id: "club",
    title: "Vie de l’équipe",
    description: "Finances, centre de formation et infrastructures.",
    iconCategory: "infrastructure",
    categories: ["finance", "academy", "infrastructure"],
  },
  {
    id: "objectives",
    title: "Objectifs et récompenses",
    description: "Objectifs terminés et récompenses disponibles.",
    iconCategory: "objective",
    categories: ["objective"],
  },
] as const satisfies ReadonlyArray<
  Omit<DashboardEventGroup, "events">
>;

export function DashboardEventsCard({
  events,
}: {
  events: DashboardEvent[];
}) {
  const eventGroups = groupDashboardEvents(events);

  return (
    <section
      aria-labelledby="dashboard-events-title"
      className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.13)]"
    >
      <header className="flex min-h-[118px] flex-col gap-3 bg-[#0B302B] px-6 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8ED9B1]">
            Fil du Directeur Sportif
          </p>
          <h2
            id="dashboard-events-title"
            className="mt-1.5 text-xl font-black tracking-[-0.02em]"
          >
            À ne pas manquer
          </h2>
          <p className="mt-0.5 text-sm font-semibold text-[#BDD1C7]">
            L’essentiel aujourd’hui. Ouvrez une rubrique pour consulter son
            historique.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-extrabold text-white">
            {events.length} actualité{events.length > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {events.length > 0 ? (
        <div role="list" className="flex-1 divide-y divide-[#315B3E]/10">
          {eventGroups.map((eventGroup) => {
            const groupPriority = getGroupPriority(eventGroup.events);
            const style = PRIORITY_STYLES[groupPriority];

            return (
              <details
                key={eventGroup.id}
                role="listitem"
                className="group/event"
              >
                <summary className="grid cursor-pointer list-none gap-3 px-5 py-3.5 transition hover:bg-[#F5FAF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70] [&::-webkit-details-marker]:hidden sm:px-8 lg:grid-cols-[44px_minmax(0,1fr)_auto_auto] lg:items-center">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border ${style.icon}`}
                    aria-hidden="true"
                  >
                    <DashboardEventIcon category={eventGroup.iconCategory} />
                  </span>

                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-[#153C34] sm:text-base">
                        {eventGroup.title}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${style.badge}`}
                      >
                        {style.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[#60756E] sm:text-sm">
                      {eventGroup.description}
                    </span>
                  </span>

                  <span className="justify-self-start rounded-full bg-[#EEF5F1] px-3 py-1.5 text-xs font-black text-[#315B3E] lg:justify-self-end">
                    {formatEventCount(eventGroup.events.length)}
                  </span>

                  <span className="inline-flex items-center gap-2 justify-self-start text-sm font-black text-[#176951] lg:min-w-36 lg:justify-self-end">
                    Voir le détail
                    <ChevronIcon />
                  </span>
                </summary>

                <div
                  role="list"
                  aria-label={`Détail : ${eventGroup.title}`}
                  className="divide-y divide-[#315B3E]/10 border-t border-[#315B3E]/10 bg-[#F8FBF9]"
                >
                  {eventGroup.events.map((event) => (
                    <Link
                      key={event.id}
                      href={event.href}
                      role="listitem"
                      className="group/detail grid gap-2 px-5 py-3 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70] sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-[#153C34]">
                            {event.title}
                          </span>
                          {event.badgeLabel ? (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${PRIORITY_STYLES[event.priority].badge}`}
                            >
                              {event.badgeLabel}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-[#60756E] sm:text-sm">
                          {event.description}
                        </span>
                      </span>

                      <span className="justify-self-start rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-[#315B3E] lg:justify-self-end">
                        {event.dayNumber ? `J${event.dayNumber}` : "Récent"}
                      </span>

                      <span className="inline-flex items-center gap-2 justify-self-start text-xs font-black text-[#176951] lg:min-w-36 lg:justify-self-end">
                        {event.actionLabel}
                        <span
                          aria-hidden="true"
                          className="transition-transform group-hover/detail:translate-x-1"
                        >
                          →
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center sm:px-8">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F7F1] text-[#176951]"
          >
            <CheckIcon />
          </span>
          <p className="mt-3 text-base font-black text-[#153C34]">
            Tout est à jour
          </p>
          <p className="mt-1 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">
            Aucun événement récent ni aucune décision urgente ne réclame votre
            attention pour le moment.
          </p>
        </div>
      )}
    </section>
  );
}

function groupDashboardEvents(
  events: DashboardEvent[]
): DashboardEventGroup[] {
  return EVENT_GROUPS
    .flatMap((eventGroup) => {
      const groupedEvents = events.filter((event) =>
        (
          eventGroup.categories as readonly DashboardEventCategory[]
        ).includes(event.category)
      );

      if (groupedEvents.length === 0) {
        return [];
      }

      return [
        {
          ...eventGroup,
          events: groupedEvents,
        },
      ];
    })
    .sort(
      (left, right) =>
        events.indexOf(left.events[0]) -
        events.indexOf(right.events[0])
    );
}

function getGroupPriority(
  events: DashboardEvent[]
): DashboardEventPriority {
  if (events.some((event) => event.priority === "critical")) {
    return "critical";
  }

  if (events.some((event) => event.priority === "action")) {
    return "action";
  }

  return "update";
}

function formatEventCount(value: number): string {
  return `${value} élément${value > 1 ? "s" : ""}`;
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 transition-transform group-open/event:rotate-180"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

function DashboardEventIcon({
  category,
}: {
  category: DashboardEventCategory;
}) {
  if (category === "health") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 4v16M4 12h16" strokeLinecap="round" />
      </svg>
    );
  }

  if (category === "race") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="6.5" cy="17" r="3.5" />
        <circle cx="17.5" cy="17" r="3.5" />
        <path d="m6.5 17 4-7h3l4 7M10.5 10l3 7M9 7h3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (category === "finance") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="M15 8.5c-.7-.7-1.6-1-2.8-1-1.5 0-2.7.8-2.7 2s1 1.8 2.8 2.2c1.8.4 2.7 1 2.7 2.3s-1.2 2.2-2.9 2.2c-1.2 0-2.3-.4-3.1-1.2M12 6v12" strokeLinecap="round" />
      </svg>
    );
  }

  if (category === "objective") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="m12 12 6-6" strokeLinecap="round" />
      </svg>
    );
  }

  if (category === "scouting") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 4 4M8 10.5h5M10.5 8v5" strokeLinecap="round" />
      </svg>
    );
  }

  if (category === "training") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 6v12M17 6v12M4 9v6M20 9v6M7 12h10" strokeLinecap="round" />
      </svg>
    );
  }

  if (category === "infrastructure") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20V9l8-5 8 5v11M8 20v-6h8v6" strokeLinejoin="round" />
      </svg>
    );
  }

  if (category === "contract") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 3h8l4 4v14H7V3Z" strokeLinejoin="round" />
        <path d="M15 3v5h4M10 12h6M10 16h4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 4 7v5c0 4.7 3.2 7.5 8 9 4.8-1.5 8-4.3 8-9V7l-8-4Z" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 12 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
