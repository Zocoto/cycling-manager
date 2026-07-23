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
    label: "À traiter",
    badge: "border-[#D4A82F]/30 bg-[#FFF7D9] text-[#7A5B09]",
    icon: "border-[#D4A82F]/25 bg-[#FFF7D9] text-[#8A6812]",
  },
  update: {
    label: "Nouveau",
    badge: "border-[#278B70]/20 bg-[#E8F7F1] text-[#176951]",
    icon: "border-[#278B70]/20 bg-[#E8F7F1] text-[#176951]",
  },
};

export function DashboardEventsCard({
  events,
}: {
  events: DashboardEvent[];
}) {
  return (
    <section
      aria-labelledby="dashboard-events-title"
      className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.13)]"
    >
      <header className="flex flex-col gap-4 bg-[#0B302B] px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8ED9B1]">
            Fil du Directeur Sportif
          </p>
          <h2
            id="dashboard-events-title"
            className="mt-2 text-2xl font-black tracking-[-0.02em]"
          >
            À ne pas manquer
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#BDD1C7]">
            Les événements récents et les décisions qui demandent votre attention.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-extrabold text-white">
            {events.length} actualité{events.length > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {events.length > 0 ? (
        <div role="list" className="divide-y divide-[#315B3E]/10">
          {events.map((event) => {
            const style = PRIORITY_STYLES[event.priority];

            return (
              <Link
                key={event.id}
                href={event.href}
                role="listitem"
                className="group grid gap-4 px-5 py-5 transition hover:bg-[#F5FAF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70] sm:px-8 lg:grid-cols-[52px_minmax(0,1fr)_auto_auto] lg:items-center"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${style.icon}`}
                  aria-hidden="true"
                >
                  <DashboardEventIcon category={event.category} />
                </span>

                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-[#153C34]">
                      {event.title}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${style.badge}`}
                    >
                      {event.badgeLabel ?? style.label}
                    </span>
                  </span>
                  <span className="mt-1.5 block max-w-4xl text-sm font-semibold leading-6 text-[#60756E]">
                    {event.description}
                  </span>
                </span>

                <span className="justify-self-start rounded-full bg-[#EEF5F1] px-3 py-1.5 text-xs font-black text-[#315B3E] lg:justify-self-end">
                  {event.dayNumber ? `J${event.dayNumber}` : "Récent"}
                </span>

                <span className="inline-flex items-center gap-2 justify-self-start text-sm font-black text-[#176951] lg:min-w-40 lg:justify-self-end">
                  {event.actionLabel}
                  <span
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center px-6 py-10 text-center sm:px-8">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F7F1] text-[#176951]"
          >
            <CheckIcon />
          </span>
          <p className="mt-4 text-lg font-black text-[#153C34]">
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
