"use client";

import { useMemo, useState } from "react";

import { SvgCountryFlag } from "@/components/game/svg-country-flag";
import Link from "@/components/ui/app-link";

type NationsCupEvent = {
  id: string;
  slug: string;
  name: string;
};

export type NationsCupStanding = {
  countryId: string;
  countryCode: string;
  countryName: string;
  division: number;
  groupCode: string | null;
  points: number;
  overallRank: number;
  divisionRank: number;
  groupRank: number;
  eventRanks: Record<string, number | null>;
};

const DIVISIONS = [1, 2, 3, 4] as const;
const numberFormatter = new Intl.NumberFormat("fr-FR");

export function getNationsCupDivisionView(
  standings: NationsCupStanding[],
  division: number,
  requestedGroup: string | null,
) {
  const divisionStandings = standings.filter(
    (standing) => standing.division === division,
  );
  const groups = [
    ...new Set(
      divisionStandings.flatMap((standing) =>
        standing.groupCode ? [standing.groupCode] : [],
      ),
    ),
  ].sort((left, right) => left.localeCompare(right, "fr"));
  const activeGroup = groups.includes(requestedGroup ?? "")
    ? requestedGroup
    : (groups[0] ?? null);
  const visibleStandings = activeGroup
    ? divisionStandings.filter((standing) => standing.groupCode === activeGroup)
    : divisionStandings;

  return { activeGroup, divisionStandings, groups, visibleStandings };
}

export function NationsCupStandings({
  events,
  standings,
}: {
  events: NationsCupEvent[];
  standings: NationsCupStanding[];
}) {
  const availableDivisions = useMemo(
    () => DIVISIONS.filter((division) => standings.some((standing) => standing.division === division)),
    [standings],
  );
  const [selectedDivision, setSelectedDivision] = useState<number>(
    availableDivisions[0] ?? 1,
  );
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const { activeGroup, divisionStandings, groups, visibleStandings } = useMemo(
    () => getNationsCupDivisionView(standings, selectedDivision, selectedGroup),
    [selectedDivision, selectedGroup, standings],
  );
  const rankLabel = activeGroup ? "Rang groupe" : "Rang division";

  if (availableDivisions.length === 0) return null;

  return (
    <section
      className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]"
      aria-labelledby="nations-cup-standings-title"
    >
      <div className="border-b border-[#315B3E]/10 px-5 py-5 sm:px-8 sm:py-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
          Hiérarchie des nations
        </p>
        <h2 id="nations-cup-standings-title" className="mt-1 text-2xl font-black text-[#183F37]">
          Classement général
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
          Consulte chaque division séparément, puis sélectionne un groupe pour
          les divisions 2 à 4.
        </p>

        <div
          className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          role="tablist"
          aria-label="Divisions de la Nations Cup"
        >
          {availableDivisions.map((division) => {
            const selected = division === selectedDivision;
            const nationCount = standings.filter(
              (standing) => standing.division === division,
            ).length;
            return (
              <button
                key={division}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="nations-cup-standings-panel"
                onClick={() => {
                  setSelectedDivision(division);
                  setSelectedGroup(null);
                }}
                className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] sm:min-w-40 ${
                  selected
                    ? "border-[#176951] bg-[#176951] text-white shadow-[0_8px_22px_rgba(23,105,81,0.2)]"
                    : "border-[#315B3E]/15 bg-[#F3F8F5] text-[#315B3E] hover:border-[#176951]/45"
                }`}
              >
                <span className="text-sm font-black">Division {division}</span>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-black ${
                    selected ? "bg-white/15 text-white" : "bg-white text-[#60756E]"
                  }`}
                >
                  {nationCount}
                </span>
              </button>
            );
          })}
        </div>

        {groups.length > 0 ? (
          <div
            className="mt-3 flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label={`Groupes de la division ${selectedDivision}`}
          >
            {groups.map((groupCode) => {
              const selected = groupCode === activeGroup;
              const nationCount = divisionStandings.filter(
                (standing) => standing.groupCode === groupCode,
              ).length;
              return (
                <button
                  key={groupCode}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="nations-cup-standings-panel"
                  onClick={() => setSelectedGroup(groupCode)}
                  className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] ${
                    selected
                      ? "border-[#0B302B] bg-[#0B302B] text-white"
                      : "border-[#315B3E]/15 bg-white text-[#315B3E] hover:border-[#176951]/45"
                  }`}
                >
                  Groupe {groupCode} · {nationCount}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div
        id="nations-cup-standings-panel"
        role="tabpanel"
        aria-label={activeGroup
          ? `Division ${selectedDivision}, groupe ${activeGroup}`
          : `Division ${selectedDivision}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#315B3E]/10 bg-[#F8FBF9] px-5 py-3 sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#183F37]">
            Division {selectedDivision}{activeGroup ? ` · Groupe ${activeGroup}` : ""}
          </p>
          <p className="text-xs font-bold text-[#60756E]">
            {visibleStandings.length} nation{visibleStandings.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-sm">
            <thead className="bg-[#F2F8F5] text-[10px] font-black uppercase tracking-[0.11em] text-[#60756E]">
              <tr>
                <th className="w-20 px-4 py-3 text-center">{rankLabel}</th>
                <th className="px-4 py-3 text-left">Nation</th>
                <th className="px-3 py-3 text-center">Global</th>
                {events.map((event) => (
                  <th key={event.id} className="px-3 py-3 text-center">{event.name}</th>
                ))}
                <th className="px-4 py-3 text-center">Points</th>
                {activeGroup ? (
                  <th className="px-4 py-3 text-center">Rang div.</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#315B3E]/10">
              {visibleStandings.map((standing) => (
                <tr key={standing.countryId} className="hover:bg-[#F8FBF9]">
                  <td className="px-4 py-3 text-center text-lg font-black text-[#183F37]">
                    #{activeGroup ? standing.groupRank : standing.divisionRank}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/jeu/nations/${standing.countryCode.toLowerCase()}`}
                      className="flex items-center gap-3 font-black text-[#183F37] hover:text-[#278B70]"
                    >
                      <span className="grid h-8 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-[#315B3E]/12 bg-white">
                        <svg viewBox="0 0 44 32" className="h-full w-full" aria-hidden="true">
                          <SvgCountryFlag countryCode={standing.countryCode} x={0} y={0} width={44} height={32} />
                        </svg>
                      </span>
                      <span>{standing.countryName}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-[#60756E]">
                    #{standing.overallRank}
                  </td>
                  {events.map((event) => {
                    const rank = standing.eventRanks[event.slug];
                    return (
                      <td key={event.id} className="px-3 py-3 text-center font-bold text-[#183F37]">
                        {rank == null ? "—" : `#${rank}`}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center text-lg font-black text-[#176951]">
                    {numberFormatter.format(standing.points)}
                  </td>
                  {activeGroup ? (
                    <td className="px-4 py-3 text-center font-black text-[#183F37]">
                      #{standing.divisionRank}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
