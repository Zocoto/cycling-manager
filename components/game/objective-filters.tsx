"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  GameObjectiveStatusFilter,
  GameObjectiveTypeFilter,
} from "@/lib/game/objectives";

type ObjectiveFiltersProps = {
  groups: Array<{ value: string; label: string }>;
  initialType: GameObjectiveTypeFilter;
  initialStatus: GameObjectiveStatusFilter;
  initialGroup: string;
  totalCount: number;
  visibleCount: number;
};

type FilterState = {
  type: GameObjectiveTypeFilter;
  status: GameObjectiveStatusFilter;
  group: string;
};

export function ObjectiveFilters({
  groups,
  initialType,
  initialStatus,
  initialGroup,
  totalCount,
  visibleCount,
}: ObjectiveFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<FilterState>({
    type: initialType,
    status: initialStatus,
    group: initialGroup,
  });

  function applyFilters(nextFilters: FilterState) {
    setFilters(nextFilters);
    const params = new URLSearchParams();

    if (nextFilters.type !== "all") {
      params.set("type", nextFilters.type);
    }
    if (nextFilters.status !== "all") {
      params.set("statut", nextFilters.status);
    }
    if (nextFilters.group !== "all") {
      params.set("groupe", nextFilters.group);
    }

    const query = params.toString();
    startTransition(() => {
      router.replace(
        `/jeu/objectifs${query ? `?${query}` : ""}#objectives-list`
      );
    });
  }

  const hasActiveFilter =
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.group !== "all";

  return (
    <section
      aria-label="Filtres des objectifs"
      className="mt-8 rounded-[1.65rem] border border-[#315B3E]/14 bg-white p-5 shadow-[0_14px_36px_rgba(19,60,46,0.07)] sm:p-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            Affiner la feuille de route
          </p>
          <p className="mt-1 text-sm font-bold text-[#60756E]">
            {visibleCount} objectif{visibleCount > 1 ? "s" : ""} affiché
            {visibleCount > 1 ? "s" : ""} sur {totalCount}
          </p>
        </div>
        {isPending ? (
          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#278B70]">
            Mise à jour…
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1.2fr_auto] xl:items-end">
        <FilterSelect
          label="Type d’objectif"
          value={filters.type}
          onChange={(value) =>
            applyFilters({
              ...filters,
              type: value as GameObjectiveTypeFilter,
            })
          }
          options={[
            { value: "all", label: "Tous les types" },
            { value: "primary", label: "Objectifs primaires" },
            { value: "secondary", label: "Objectifs secondaires" },
          ]}
        />
        <FilterSelect
          label="État"
          value={filters.status}
          onChange={(value) =>
            applyFilters({
              ...filters,
              status: value as GameObjectiveStatusFilter,
            })
          }
          options={[
            { value: "all", label: "Tous les états" },
            { value: "in_progress", label: "En cours" },
            { value: "completed", label: "Terminés · à récupérer" },
            { value: "claimed", label: "Récompense récupérée" },
          ]}
        />
        <FilterSelect
          label="Thème"
          value={filters.group}
          onChange={(value) => applyFilters({ ...filters, group: value })}
          options={[
            { value: "all", label: "Tous les thèmes" },
            ...groups,
          ]}
        />
        <button
          type="button"
          disabled={!hasActiveFilter || isPending}
          onClick={() =>
            applyFilters({ type: "all", status: "all", group: "all" })
          }
          className="min-h-12 rounded-xl border border-[#315B3E]/15 bg-[#EFF4F1] px-5 text-xs font-black uppercase tracking-[0.12em] text-[#315B3E] transition hover:bg-[#DDF3E7] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Réinitialiser
        </button>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-[0.11em] text-[#526B62]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-xl border border-[#315B3E]/18 bg-white px-4 text-sm font-bold normal-case tracking-normal text-[#183F37] outline-none transition focus:border-[#278B70] focus:ring-4 focus:ring-[#42B99A]/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
