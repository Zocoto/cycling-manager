"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { RiderAvatar } from "@/components/game/rider-avatar";
import Link from "@/components/ui/app-link";
import {
  groupFormerTeamRidersByDepartureSeason,
  type TeamRiderMemoryEntry,
} from "@/lib/game/team-rider-memory";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";

export function TeamRiderGlossary({
  riders,
  currentGameYear,
}: {
  riders: readonly TeamRiderMemoryEntry[];
  currentGameYear: number;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const seasons = useMemo(
    () => groupFormerTeamRidersByDepartureSeason(riders, currentGameYear),
    [currentGameYear, riders],
  );
  const riderCount = seasons.reduce(
    (count, season) => count + season.riders.length,
    0,
  );

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const closeDialog = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <section className="mt-7">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        className="group flex w-full items-center justify-between gap-5 overflow-hidden rounded-[1.6rem] border border-white/15 px-5 py-5 text-left text-white shadow-[0_16px_45px_var(--team-shadow)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_var(--team-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--team-accent)] sm:px-7"
        style={{
          background:
            "linear-gradient(120deg, var(--team-primary), var(--team-secondary))",
        }}
      >
        <span className="flex min-w-0 items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 text-xl" aria-hidden="true">
            ?
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/65">
              M?moire de l??quipe
            </span>
            <span className="mt-1 block text-lg font-black sm:text-xl">
              Glossaire des anciens coureurs
            </span>
            <span className="mt-1 hidden text-xs font-semibold text-white/70 sm:block">
              Consultez les d?parts class?s par leur derni?re saison au club.
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--team-accent)]">
            {riderCount} coureur{riderCount > 1 ? "s" : ""}
          </span>
          <span className="text-2xl font-light transition group-hover:translate-x-1" aria-hidden="true">
            ?
          </span>
        </span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071A17]/80 p-2 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-rider-glossary-title"
            className="flex max-h-[calc(100vh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[var(--team-surface)] shadow-[0_35px_100px_rgba(0,0,0,0.42)] sm:max-h-[calc(100vh-3rem)]"
          >
            <header
              className="flex shrink-0 items-start justify-between gap-5 px-5 py-5 text-white sm:px-8 sm:py-7"
              style={{
                background:
                  "linear-gradient(120deg, var(--team-primary), var(--team-secondary))",
              }}
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/65">
                  M?moire de l??quipe
                </p>
                <h2
                  id="team-rider-glossary-title"
                  className="mt-1 text-2xl font-black sm:text-3xl"
                >
                  Glossaire des anciens coureurs
                </h2>
                <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-white/75 sm:text-sm">
                  Chaque coureur n?appara?t qu?une fois, dans sa derni?re saison
                  au club. L?effectif actuel reste visible sur la fiche ?quipe.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDialog}
                aria-label="Fermer le glossaire des coureurs"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-xl font-light transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--team-accent)]"
              >
                ?
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              {seasons.length > 0 ? (
                <div className="space-y-4">
                  {seasons.map((season) => (
                    <section
                      key={season.gameYear}
                      aria-labelledby={`glossary-season-${season.gameYear}`}
                      className="overflow-hidden rounded-2xl border border-[var(--team-line)] bg-white shadow-[0_10px_30px_var(--team-shadow)]"
                    >
                      <header className="flex items-center justify-between gap-4 border-b border-[var(--team-line)] bg-[var(--team-soft)] px-4 py-3 sm:px-5">
                        <h3
                          id={`glossary-season-${season.gameYear}`}
                          className="font-black text-[var(--team-ink)]"
                        >
                          {season.seasonName}
                        </h3>
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--team-primary)] shadow-sm">
                          {season.riders.length} d?part
                          {season.riders.length > 1 ? "s" : ""}
                        </span>
                      </header>

                      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
                        {season.riders.map((rider) => {
                          const riderName = `${rider.firstName} ${rider.lastName}`.trim();
                          const presence =
                            rider.firstGameYear === rider.lastGameYear
                              ? "Une saison au club"
                              : `${rider.firstSeasonName} ? ${rider.lastSeasonName}`;

                          return (
                            <Link
                              key={rider.id}
                              href={`/jeu/coureurs/${rider.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="group/rider flex min-w-0 items-center gap-3 rounded-xl border border-[var(--team-line)] bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--team-primary)]"
                            >
                              <RiderAvatar
                                profileKey={rider.avatarProfileKey}
                                seed={rider.avatarSeed}
                                riderId={rider.id}
                                age={rider.age ?? 25}
                                jersey={FREE_AGENT_RIDER_JERSEY}
                                label={`Portrait de ${riderName}`}
                                className="h-12 w-12 shrink-0 ring-2 ring-[var(--team-soft)]"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-black text-[var(--team-ink)]">
                                  {riderName}
                                </span>
                                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-[var(--team-muted)]">
                                  <CountryFlag
                                    countryCode={rider.countryCode}
                                    countryName={rider.countryName}
                                  />
                                  <span className="truncate">{presence}</span>
                                </span>
                                {rider.isArchived ? (
                                  <span className="mt-1 block text-[9px] font-black uppercase tracking-wide text-[var(--team-primary)]">
                                    Carri?re termin?e
                                  </span>
                                ) : null}
                              </span>
                              <span
                                className="text-sm font-black text-[var(--team-secondary)] transition group-hover/rider:translate-x-0.5"
                                aria-hidden="true"
                              >
                                ?
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--team-line)] bg-white px-5 py-10 text-center">
                  <p className="font-black text-[var(--team-ink)]">
                    Aucun ancien coureur pour le moment
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--team-muted)]">
                    Les coureurs appara?tront ici apr?s leur d?part de l??quipe.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function CountryFlag({
  countryCode,
  countryName,
}: {
  countryCode: string;
  countryName: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Drapeau : ${countryName}`}
      className={`fi fi-${countryCode.toLowerCase()} shrink-0 rounded-sm`}
    />
  );
}
