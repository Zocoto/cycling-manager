"use client";

import { useState } from "react";

import Link from "@/components/ui/app-link";

type NationsCupEventTab = {
  id: string;
  slug: string;
  name: string;
  profileType: string;
  status: string;
};

export function NationsCupEventTabs({
  events,
}: {
  events: NationsCupEventTab[];
}) {
  const [selectedSlug, setSelectedSlug] = useState(events[0]?.slug ?? "");
  const selectedEvent =
    events.find((event) => event.slug === selectedSlug) ?? events[0];

  if (!selectedEvent) return null;

  return (
    <section
      className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]"
      aria-labelledby="nations-cup-events-title"
    >
      <div className="border-b border-[#315B3E]/10 px-5 py-5 sm:px-7">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
          Programme complet
        </p>
        <h2
          id="nations-cup-events-title"
          className="mt-1 text-2xl font-black text-[#183F37]"
        >
          Les cinq épreuves
        </h2>
        <div
          className="mt-4 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Épreuves de la Nations Cup"
        >
          {events.map((event) => {
            const selected = event.slug === selectedEvent.slug;
            return (
              <button
                key={event.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`nations-cup-panel-${event.slug}`}
                onClick={() => setSelectedSlug(event.slug)}
                className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] ${
                  selected
                    ? "border-[#176951] bg-[#176951] text-white"
                    : "border-[#315B3E]/15 bg-[#F3F8F5] text-[#315B3E] hover:border-[#176951]/45"
                }`}
              >
                {event.name}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`nations-cup-panel-${selectedEvent.slug}`}
        role="tabpanel"
        className="grid gap-5 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#278B70]">
            {formatProfile(selectedEvent.profileType)}
          </p>
          <h3 className="mt-2 text-2xl font-black text-[#183F37]">
            Nations Cup · {selectedEvent.name}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
            Une sélection différente par nation. Cette épreuve compte dans le
            classement cumulé de la Nations Cup.
          </p>
        </div>
        <Link
          href={`/jeu/courses/${selectedEvent.slug}`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#176951] px-5 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
        >
          {selectedEvent.status === "completed"
            ? "Voir les résultats"
            : "Voir la fiche"}
        </Link>
      </div>
    </section>
  );
}

function formatProfile(profileType: string): string {
  const labels: Record<string, string> = {
    mountain: "Montagne",
    hilly: "Vallons",
    sprint: "Sprint",
    cobbles: "Pavés",
    time_trial: "Contre-la-montre",
  };
  return labels[profileType] ?? "Profil mixte";
}
