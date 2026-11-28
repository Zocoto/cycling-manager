"use client";

import { Fragment, useState, type ReactNode } from "react";

import {
  STAFF_ROLES,
  STAFF_ROLE_DEFINITIONS,
  filterTeamStaffMembers,
  type StaffRole,
  type TeamStaffFilters,
} from "@/lib/game/staff";

type StaffCard = {
  id: string;
  role: StaffRole;
  countryCode: string;
  countryName: string;
  level: number;
  card: ReactNode;
};

export function TeamStaffList({ members }: { members: StaffCard[] }) {
  const [selection, setSelection] = useState<TeamStaffFilters>({});
  const roles = STAFF_ROLES.filter((role) => members.some((member) => member.role === role));
  const countries = new Map(members.map(({ countryCode, countryName }) => [countryCode, countryName]));
  const levels = [...new Set(members.map(({ level }) => level))].sort((a, b) => a - b).map(String);
  const fields = [
    {
      key: "role",
      label: "Fonction",
      all: "Toutes les fonctions",
      options: roles.map((role) => [role, STAFF_ROLE_DEFINITIONS[role].label] as const),
    },
    {
      key: "countryCode",
      label: "Nationalité",
      all: "Toutes les nationalités",
      options: [...countries].sort((a, b) => a[1].localeCompare(b[1], "fr")),
    },
    {
      key: "level",
      label: "Niveau",
      all: "Tous les niveaux",
      options: levels.map((level) => [level, level] as const),
    },
  ] as const;

  const role = roles.find((value) => value === selection.role);
  const countryCode = countries.has(selection.countryCode ?? "") ? selection.countryCode : undefined;
  const level = levels.find((value) => value === selection.level);
  const filters = { role, countryCode, level };
  const visibleMembers = filterTeamStaffMembers(members, filters);
  const hasFilters = Boolean(role || countryCode || level);

  return (
    <>
      <div className="mt-5 rounded-2xl border border-[#315B3E]/12 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {fields.map(({ key, label, all, options }) => (
            <label key={key} className="min-w-0 text-[10px] font-black uppercase tracking-[0.14em] text-[#48665F]">
              {label}
              <select
                value={filters[key] ?? ""}
                onChange={(event) => setSelection({ ...filters, [key]: event.target.value })}
                className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold normal-case tracking-normal focus-visible:outline-[#176951]"
              >
                <option value="">{all}</option>
                {options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
              </select>
            </label>
          ))}
        </div>
        {hasFilters ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3">
            <p role="status" className="text-xs font-bold text-[#60756E]">
              Membres affichés · {visibleMembers.length}/{members.length}
            </p>
            <button type="button" onClick={() => setSelection({})} className="min-h-11 text-sm font-bold text-[#176951] underline underline-offset-4">
              Réinitialiser les filtres
            </button>
          </div>
        ) : null}
      </div>
      {visibleMembers.length > 0 ? (
        <div className="mt-5 grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleMembers.map(({ id, card }) => <Fragment key={id}>{card}</Fragment>)}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-[#315B3E]/25 bg-white/70 px-5 py-8 text-center text-sm font-bold text-[#60756E]">
          Aucun membre ne correspond à ces filtres.
        </p>
      )}
    </>
  );
}
