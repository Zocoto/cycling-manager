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
  eventsCount: number;
  overallRank: number;
  divisionRank: number;
  groupRank: number;
  projectedDivision: number;
  movementZone: "promotion" | "relegation" | "safe";
  eventRanks: Record<string, number | null>;
};

const DIVISIONS = [1, 2, 3, 4] as const;
const GENERAL_RANKING = "general";
const numberFormatter = new Intl.NumberFormat("fr-FR");

export function getNationsCupDivisionView(
  standings: NationsCupStanding[],
  division: number,
  requestedGroup: string | null,
  rankingSlug = GENERAL_RANKING,
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
  const groupedStandings = activeGroup
    ? divisionStandings.filter((standing) => standing.groupCode === activeGroup)
    : divisionStandings;
  const visibleStandings = groupedStandings
    .filter((standing) => (
      rankingSlug === GENERAL_RANKING
      || standing.eventRanks[rankingSlug] != null
    ))
    .sort((left, right) => {
      if (rankingSlug !== GENERAL_RANKING) {
        return (left.eventRanks[rankingSlug] ?? Number.MAX_SAFE_INTEGER)
          - (right.eventRanks[rankingSlug] ?? Number.MAX_SAFE_INTEGER);
      }
      return activeGroup
        ? left.groupRank - right.groupRank
        : left.divisionRank - right.divisionRank;
    });

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
    () => DIVISIONS.filter((division) => (
      standings.some((standing) => standing.division === division)
    )),
    [standings],
  );
  const [selectedRanking, setSelectedRanking] = useState(GENERAL_RANKING);
  const [selectedDivision, setSelectedDivision] = useState<number>(
    availableDivisions[0] ?? 1,
  );
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const { activeGroup, divisionStandings, groups, visibleStandings } = useMemo(
    () => getNationsCupDivisionView(
      standings,
      selectedDivision,
      selectedGroup,
      selectedRanking,
    ),
    [selectedDivision, selectedGroup, selectedRanking, standings],
  );
  const selectedEvent = events.find((event) => event.slug === selectedRanking);
  const isGeneralRanking = selectedRanking === GENERAL_RANKING;
  const rankLabel = isGeneralRanking
    ? (activeGroup ? "Rang groupe" : "Rang division")
    : "Rang épreuve";

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
        <h2
          id="nations-cup-standings-title"
          className="mt-1 text-2xl font-black text-[#183F37]"
        >
          Classements Nations Cup
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
          Le général cumule les cinq épreuves et détermine seul les montées et
          descentes de fin de saison.
        </p>

        <div
          className="mt-5 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Classements de la Nations Cup"
        >
          <RankingTab
            label="Général"
            selected={isGeneralRanking}
            onSelect={() => setSelectedRanking(GENERAL_RANKING)}
          />
          {events.map((event) => (
            <RankingTab
              key={event.id}
              label={event.name}
              selected={selectedRanking === event.slug}
              onSelect={() => setSelectedRanking(event.slug)}
            />
          ))}
        </div>

        <div
          className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
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

        {isGeneralRanking ? (
          <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.08em]">
            {selectedDivision > 1 ? (
              <span className="rounded-full bg-[#DDF5E8] px-3 py-1.5 text-[#176951]">
                Zone verte · promotion
              </span>
            ) : null}
            {selectedDivision < 4 ? (
              <span className="rounded-full bg-[#FCE7E3] px-3 py-1.5 text-[#B13A2E]">
                Zone rouge · relégation
              </span>
            ) : null}
            <span className="rounded-full bg-[#EEF3F1] px-3 py-1.5 text-[#60756E]">
              Projection au classement actuel
            </span>
          </div>
        ) : null}
      </div>

      <div
        id="nations-cup-standings-panel"
        role="tabpanel"
        aria-label={`${isGeneralRanking ? "Classement général" : selectedEvent?.name ?? "Épreuve"}, division ${selectedDivision}${activeGroup ? `, groupe ${activeGroup}` : ""}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#315B3E]/10 bg-[#F8FBF9] px-5 py-3 sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#183F37]">
            {isGeneralRanking ? "Général" : selectedEvent?.name}
            {" · "}Division {selectedDivision}
            {activeGroup ? ` · Groupe ${activeGroup}` : ""}
          </p>
          <p className="text-xs font-bold text-[#60756E]">
            {visibleStandings.length} nation{visibleStandings.length > 1 ? "s" : ""}
          </p>
        </div>

        {visibleStandings.length === 0 ? (
          <div className="px-6 py-12 text-center sm:px-8">
            <p className="text-base font-black text-[#183F37]">
              Classement à venir
            </p>
            <p className="mt-2 text-sm font-semibold text-[#60756E]">
              Les positions seront publiées automatiquement après l’arrivée de cette épreuve.
            </p>
          </div>
        ) : isGeneralRanking ? (
          <GeneralStandingsTable
            activeGroup={activeGroup}
            events={events}
            rankLabel={rankLabel}
            standings={visibleStandings}
          />
        ) : selectedEvent ? (
          <EventStandingsTable
            event={selectedEvent}
            standings={visibleStandings}
          />
        ) : null}
      </div>
    </section>
  );
}

function RankingTab({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls="nations-cup-standings-panel"
      onClick={onSelect}
      className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] ${
        selected
          ? "border-[#F2C94C] bg-[#FFF4C7] text-[#5B4810]"
          : "border-[#315B3E]/15 bg-white text-[#315B3E] hover:border-[#176951]/45"
      }`}
    >
      {label}
    </button>
  );
}

function GeneralStandingsTable({
  activeGroup,
  events,
  rankLabel,
  standings,
}: {
  activeGroup: string | null;
  events: NationsCupEvent[];
  rankLabel: string;
  standings: NationsCupStanding[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
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
            <th className="px-4 py-3 text-center">Mouvement</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#315B3E]/10">
          {standings.map((standing) => (
            <tr
              key={standing.countryId}
              className={`${movementRowClass(standing.movementZone)} hover:brightness-[0.985]`}
            >
              <td className="px-4 py-3 text-center text-lg font-black text-[#183F37]">
                #{activeGroup ? standing.groupRank : standing.divisionRank}
              </td>
              <NationCell standing={standing} />
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
              <td className="px-4 py-3 text-center">
                <MovementBadge standing={standing} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventStandingsTable({
  event,
  standings,
}: {
  event: NationsCupEvent;
  standings: NationsCupStanding[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-[#F2F8F5] text-[10px] font-black uppercase tracking-[0.11em] text-[#60756E]">
          <tr>
            <th className="w-20 px-4 py-3 text-center">Rang épreuve</th>
            <th className="px-4 py-3 text-left">Nation</th>
            <th className="px-4 py-3 text-center">Division/groupe</th>
            <th className="px-4 py-3 text-center">Rang général</th>
            <th className="px-4 py-3 text-center">Points épreuve</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#315B3E]/10">
          {standings.map((standing) => {
            const eventRank = standing.eventRanks[event.slug];
            return (
              <tr key={standing.countryId} className="hover:bg-[#F8FBF9]">
                <td className="px-4 py-3 text-center text-lg font-black text-[#183F37]">
                  #{eventRank}
                </td>
                <NationCell standing={standing} />
                <td className="px-4 py-3 text-center font-black text-[#60756E]">
                  D{standing.division}{standing.groupCode ?? ""}
                </td>
                <td className="px-4 py-3 text-center font-black text-[#183F37]">
                  #{standing.overallRank}
                </td>
                <td className="px-4 py-3 text-center text-lg font-black text-[#176951]">
                  {eventPoints(eventRank)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NationCell({ standing }: { standing: NationsCupStanding }) {
  return (
    <td className="px-4 py-3">
      <Link
        href={`/jeu/nations/${standing.countryCode.toLowerCase()}`}
        className="flex items-center gap-3 font-black text-[#183F37] hover:text-[#278B70]"
      >
        <span className="grid h-8 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-[#315B3E]/12 bg-white">
          <svg viewBox="0 0 44 32" className="h-full w-full" aria-hidden="true">
            <SvgCountryFlag
              countryCode={standing.countryCode}
              x={0}
              y={0}
              width={44}
              height={32}
            />
          </svg>
        </span>
        <span>{standing.countryName}</span>
      </Link>
    </td>
  );
}

function MovementBadge({ standing }: { standing: NationsCupStanding }) {
  if (standing.movementZone === "promotion") {
    return (
      <span className="inline-flex rounded-full bg-[#DDF5E8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#176951]">
        ↑ Montée D{standing.projectedDivision}
      </span>
    );
  }
  if (standing.movementZone === "relegation") {
    return (
      <span className="inline-flex rounded-full bg-[#FCE7E3] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#B13A2E]">
        ↓ Descente D{standing.projectedDivision}
      </span>
    );
  }
  return <span className="font-bold text-[#9AABA5]">—</span>;
}

function movementRowClass(movementZone: NationsCupStanding["movementZone"]) {
  if (movementZone === "promotion") return "bg-[#F2FBF6]";
  if (movementZone === "relegation") return "bg-[#FFF7F5]";
  return "hover:bg-[#F8FBF9]";
}

function eventPoints(rank: number | null | undefined) {
  if (rank == null) return 0;
  const points = [50, 40, 32, 26, 22, 18, 15, 12, 10, 8, 6, 5, 4, 3, 2, 1];
  return points[rank - 1] ?? 0;
}
