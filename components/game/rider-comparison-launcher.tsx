"use client";

import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { RiderComparisonOption } from "@/lib/game/rider-comparison";

const RiderComparisonOptionsContext = createContext<RiderComparisonOption[]>(
  [],
);

export function RiderComparisonRosterProvider({
  options,
  children,
}: {
  options: RiderComparisonOption[];
  children: ReactNode;
}) {
  return (
    <RiderComparisonOptionsContext.Provider value={options}>
      {children}
    </RiderComparisonOptionsContext.Provider>
  );
}

export function RiderComparisonLauncher({
  riderId,
  riderName,
  options,
  tone = "light",
  compact = false,
}: {
  riderId: string;
  riderName: string;
  options?: RiderComparisonOption[];
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  const selectId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [comparisonRiderId, setComparisonRiderId] = useState("");
  const inheritedOptions = useContext(RiderComparisonOptionsContext);
  const availableOptions = options ?? inheritedOptions;
  const candidates = useMemo(
    () => availableOptions.filter((option) => option.id !== riderId),
    [availableOptions, riderId],
  );
  const isDark = tone === "dark";
  const selectedCandidate = candidates.find(
    (candidate) => candidate.id === comparisonRiderId,
  );

  return (
    <div className={compact ? "w-full" : "w-full max-w-sm"}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={selectId}
        disabled={candidates.length === 0}
        onClick={() => setIsOpen((current) => !current)}
        className={[
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-black uppercase tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
          compact ? "w-full" : "sm:w-auto",
          isDark
            ? "border-white/20 bg-white/10 text-white hover:bg-white/15 focus-visible:ring-[#F2C94C]"
            : "border-[#278B70]/25 bg-[#EAF5F3] text-[#176951] hover:border-[#278B70]/45 hover:bg-[#DDF2EC] focus-visible:ring-[#278B70]",
        ].join(" ")}
      >
        <CompareIcon />
        Comparer à
        <span aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
      </button>

      {isOpen ? (
        <div
          id={selectId}
          className={[
            "mt-2 rounded-xl border p-3 shadow-lg",
            isDark
              ? "border-white/15 bg-[#102D28]"
              : "border-[#315B3E]/15 bg-white",
          ].join(" ")}
        >
          <label
            htmlFor={`${selectId}-select`}
            className={[
              "block text-[10px] font-black uppercase tracking-[0.12em]",
              isDark ? "text-[#9BE0BC]" : "text-[#60756E]",
            ].join(" ")}
          >
            Comparer {riderName} avec…
          </label>
          <select
            id={`${selectId}-select`}
            value={comparisonRiderId}
            onChange={(event) => setComparisonRiderId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-[#315B3E]/20 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/25"
          >
            <option value="" disabled>
              Choisir dans votre effectif
            </option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.firstName} {candidate.lastName} · {candidate.age ?? "?"}
                {candidate.age ? " ans" : ""} · {candidate.countryCode}
              </option>
            ))}
          </select>
          {selectedCandidate ? (
            <a
              href={`/jeu/coureurs/${encodeURIComponent(riderId)}/comparer/${encodeURIComponent(selectedCandidate.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={[
                "mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-center text-xs font-black uppercase tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2",
                isDark
                  ? "bg-[#F2C94C] text-[#102D28] hover:bg-[#F7D968] focus-visible:ring-white"
                  : "bg-[#176951] text-white hover:bg-[#105942] focus-visible:ring-[#278B70]",
              ].join(" ")}
              aria-label={`Comparer ${riderName} avec ${selectedCandidate.firstName} ${selectedCandidate.lastName} dans un nouvel onglet`}
            >
              Ouvrir la comparaison
              <span className="ml-2" aria-hidden="true">
                ↗
              </span>
            </a>
          ) : (
            <span
              aria-disabled="true"
              className={[
                "mt-3 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-lg border px-4 text-center text-xs font-black uppercase tracking-[0.08em] opacity-55",
                isDark
                  ? "border-white/15 bg-white/5 text-white"
                  : "border-[#315B3E]/15 bg-[#F1F5F3] text-[#60756E]",
              ].join(" ")}
            >
              Choisir un coureur
            </span>
          )}
          <p
            className={[
              "mt-2 text-[10px] font-semibold",
              isDark ? "text-[#BFD1C6]" : "text-[#60756E]",
            ].join(" ")}
          >
            Sélectionnez un coureur puis ouvrez la comparaison. Sur iPhone en
            mode app, elle peut s’ouvrir dans Safari.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CompareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M7 4v16m10-16v16M4 8l3-3 3 3m4 8 3 3 3-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
