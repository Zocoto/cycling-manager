"use client";

import Link from "@/components/ui/app-link";
import type { RiderRatingImportance } from "@/lib/game/rider-profile";
import { getRiderRatingColorClasses } from "@/lib/game/rider-rating-colors";
import {
  getNextRosterSortDirection,
  type RosterSortDirection,
  type RosterSortKey,
} from "@/lib/game/roster-sort";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type MobileRosterSummaryRatingKey = Extract<
  RosterSortKey,
  | "mountain"
  | "hills"
  | "flat"
  | "time_trial"
  | "cobbles"
  | "sprint"
  | "acceleration"
  | "downhill"
  | "endurance"
  | "resistance"
  | "recovery"
  | "breakaway"
  | "prologue"
>;

export type MobileRosterSummaryRating = {
  key: MobileRosterSummaryRatingKey;
  label: string;
  fullLabel: string;
  importance: RiderRatingImportance;
  value: number;
  bonus?: number;
};

export type MobileRosterSummaryRider = {
  riderId: string;
  riderName: string;
  profile: string;
  form: number;
  morale: number;
  injuryLabel?: string | null;
  ratings: MobileRosterSummaryRating[];
};

type RatingPresetId =
  | "general"
  | "climbing"
  | "sprint"
  | "classics"
  | "chrono"
  | "breakaway";

const RATING_PRESETS: ReadonlyArray<{
  id: RatingPresetId;
  label: string;
  keys: readonly MobileRosterSummaryRatingKey[];
}> = [
  {
    id: "general",
    label: "Général",
    keys: [
      "mountain",
      "hills",
      "flat",
      "time_trial",
      "cobbles",
      "sprint",
    ],
  },
  {
    id: "climbing",
    label: "Montagne",
    keys: [
      "mountain",
      "hills",
      "endurance",
      "recovery",
      "acceleration",
      "downhill",
    ],
  },
  {
    id: "sprint",
    label: "Sprint",
    keys: [
      "sprint",
      "acceleration",
      "flat",
      "resistance",
      "endurance",
      "recovery",
    ],
  },
  {
    id: "classics",
    label: "Classiques",
    keys: [
      "cobbles",
      "hills",
      "endurance",
      "resistance",
      "acceleration",
      "sprint",
    ],
  },
  {
    id: "chrono",
    label: "Chrono",
    keys: [
      "time_trial",
      "prologue",
      "flat",
      "endurance",
      "resistance",
      "recovery",
    ],
  },
  {
    id: "breakaway",
    label: "Baroudeur",
    keys: [
      "breakaway",
      "downhill",
      "endurance",
      "recovery",
      "resistance",
      "hills",
    ],
  },
];

const DEFAULT_PRESET = RATING_PRESETS[0];
const STORAGE_KEY = "cyclostratege:mobile-roster-summary:v1";
const MAX_VISIBLE_RATINGS = 6;

export function MobileRosterSummary({
  riders,
  availableRatings,
  currentSortKey,
  currentDirection,
}: {
  riders: MobileRosterSummaryRider[];
  availableRatings: Array<
    Pick<
      MobileRosterSummaryRating,
      "key" | "label" | "fullLabel" | "importance"
    >
  >;
  currentSortKey: RosterSortKey | null;
  currentDirection: RosterSortDirection;
}) {
  const selectId = useId();
  const [presetId, setPresetId] = useState<RatingPresetId | "custom">(
    DEFAULT_PRESET.id,
  );
  const [customKeys, setCustomKeys] = useState<
    MobileRosterSummaryRatingKey[]
  >([...DEFAULT_PRESET.keys]);
  const preferencesReady = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedValue = window.localStorage.getItem(STORAGE_KEY);
        if (!storedValue) return;

        const parsedValue = JSON.parse(storedValue) as {
          presetId?: unknown;
          customKeys?: unknown;
        };
        const storedPresetId = isRatingPresetId(parsedValue.presetId)
          ? parsedValue.presetId
          : parsedValue.presetId === "custom"
            ? "custom"
            : null;
        const storedCustomKeys = Array.isArray(parsedValue.customKeys)
          ? parsedValue.customKeys.filter(isMobileRosterSummaryRatingKey).slice(
              0,
              MAX_VISIBLE_RATINGS,
            )
          : [];

        if (storedPresetId) setPresetId(storedPresetId);
        if (storedCustomKeys.length > 0) setCustomKeys(storedCustomKeys);
      } catch {
        // A private browser session can deny access to localStorage.
      } finally {
        preferencesReady.current = true;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!preferencesReady.current) return;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ presetId, customKeys }),
      );
    } catch {
      // The view remains fully usable when preferences cannot be persisted.
    }
  }, [customKeys, presetId]);

  const visibleKeys = useMemo(() => {
    if (presetId === "custom") return customKeys;
    return (
      RATING_PRESETS.find((preset) => preset.id === presetId) ?? DEFAULT_PRESET
    ).keys;
  }, [customKeys, presetId]);
  const visibleRatings = visibleKeys
    .map((key) => availableRatings.find((rating) => rating.key === key))
    .filter((rating) => rating !== undefined);
  const paddedVisibleRatings = [
    ...visibleRatings,
    ...Array.from({
      length: Math.max(0, MAX_VISIBLE_RATINGS - visibleRatings.length),
    }).map(() => null),
  ].slice(0, MAX_VISIBLE_RATINGS);

  function selectPreset(value: string) {
    if (value === "custom") {
      if (presetId !== "custom") {
        const currentPreset =
          RATING_PRESETS.find((preset) => preset.id === presetId) ??
          DEFAULT_PRESET;
        setCustomKeys([...currentPreset.keys]);
      }
      setPresetId("custom");
      return;
    }

    if (isRatingPresetId(value)) setPresetId(value);
  }

  function customizeRating(key: MobileRosterSummaryRatingKey) {
    setPresetId("custom");
    setCustomKeys((currentKeys) =>
      toggleMobileRosterCustomRating(currentKeys, key),
    );
  }

  return (
    <div data-mobile-roster-summary className="bg-[#F3F8F5]">
      <section className="border-b border-[#315B3E]/12 bg-white px-2 py-3">
        <div className="flex min-w-0 items-end gap-2">
          <label
            htmlFor={selectId}
            className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#48665F]"
          >
            Notes affichées
            <select
              id={selectId}
              value={presetId}
              onChange={(event) => selectPreset(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded-xl border border-[#315B3E]/18 bg-[#F7FAF9] px-3 text-sm font-black normal-case tracking-normal text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/20"
            >
              {RATING_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Personnalisé</option>
            </select>
          </label>

          <span className="pb-3 text-[10px] font-bold text-[#82958F]">
            6 notes · sans défilement
          </span>
        </div>

        {presetId === "custom" ? (
          <fieldset className="mt-3 rounded-xl border border-[#315B3E]/12 bg-[#F7FAF9] p-2">
            <legend className="px-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#60756E]">
              Choisir jusqu’à six notes
            </legend>
            <div className="grid grid-cols-4 gap-1.5">
              {availableRatings.map((rating) => {
                const isSelected = customKeys.includes(rating.key);

                return (
                  <button
                    key={rating.key}
                    type="button"
                    aria-pressed={isSelected}
                    title={rating.fullLabel}
                    onClick={() => customizeRating(rating.key)}
                    className={[
                      "min-h-9 rounded-lg border text-[10px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]",
                      isSelected
                        ? "border-[#278B70] bg-[#D7EEE8] text-[#0F5944]"
                        : "border-[#315B3E]/12 bg-white text-[#60756E]",
                    ].join(" ")}
                  >
                    {rating.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}
      </section>

      <div
        className="p-1.5 min-[390px]:p-2"
        data-tutorial-id="roster-mobile-list"
      >
        <table className="w-full table-fixed overflow-hidden rounded-xl border-separate border-spacing-0 bg-white shadow-[0_8px_20px_rgba(19,60,46,0.08)]">
          <colgroup>
            <col />
            {Array.from({ length: MAX_VISIBLE_RATINGS }).map((_, index) => (
              <col className="w-8 min-[390px]:w-9" key={index} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-[#EAF4EF]">
              <th className="rounded-tl-xl border-b border-[#315B3E]/12 p-0 text-left">
                <SummarySortLink
                  sortKey="rider"
                  label="Coureur"
                  fullLabel="nom du coureur"
                  currentSortKey={currentSortKey}
                  currentDirection={currentDirection}
                  className="justify-start px-2"
                />
              </th>
              {paddedVisibleRatings.map((rating, index) => (
                <th
                  key={rating?.key ?? `empty-${index}`}
                  data-summary-rating={rating?.key}
                  className={[
                    "border-b border-[#315B3E]/12 p-0 text-center",
                    index === MAX_VISIBLE_RATINGS - 1 ? "rounded-tr-xl" : "",
                  ].join(" ")}
                >
                  {rating ? (
                    <SummarySortLink
                      sortKey={rating.key}
                      label={rating.label}
                      fullLabel={rating.fullLabel}
                      currentSortKey={currentSortKey}
                      currentDirection={currentDirection}
                    />
                  ) : (
                    <span aria-hidden="true" className="block min-h-11" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {riders.map((rider) => {
              const ratingsByKey = new Map(
                rider.ratings.map((rating) => [rating.key, rating]),
              );

              return (
                <tr
                  key={rider.riderId}
                  className="last:[&>td]:border-b-0"
                >
                  <td className="border-b border-[#315B3E]/10 px-2 py-2 align-middle">
                    <Link
                      href={`/jeu/coureurs/${rider.riderId}`}
                      prefetchOnIntent
                      target="_blank"
                      rel="noreferrer"
                      className="block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
                      aria-label={`Ouvrir la fiche de ${rider.riderName} dans un nouvel onglet`}
                    >
                      <span className="block truncate text-[12px] font-black leading-4 text-[#082A2A]">
                        {rider.riderName}
                      </span>
                      <span className="block truncate text-[9px] font-bold leading-3 text-[#60756E]">
                        {rider.injuryLabel
                          ? `Blessé · ${rider.injuryLabel}`
                          : rider.profile}
                      </span>
                    </Link>
                    <CompactHealthGauges
                      form={rider.form}
                      morale={rider.morale}
                    />
                  </td>
                  {paddedVisibleRatings.map((visibleRating, index) => {
                    const rating = visibleRating
                      ? ratingsByKey.get(visibleRating.key)
                      : null;

                    return (
                      <td
                        key={rating?.key ?? `empty-${index}`}
                        className="border-b border-[#315B3E]/10 px-0.5 py-2 text-center align-middle"
                      >
                        {rating ? <CompactRatingBadge rating={rating} /> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummarySortLink({
  sortKey,
  label,
  fullLabel,
  currentSortKey,
  currentDirection,
  className = "justify-center",
}: {
  sortKey: RosterSortKey;
  label: string;
  fullLabel: string;
  currentSortKey: RosterSortKey | null;
  currentDirection: RosterSortDirection;
  className?: string;
}) {
  const isActive = currentSortKey === sortKey;
  const nextDirection = getNextRosterSortDirection({
    sortKey,
    currentSortKey,
    currentDirection,
  });

  return (
    <Link
      href={{
        pathname: "/jeu/effectif",
        query: {
          vue: "statistiques",
          mobile: "synthese",
          sort: sortKey,
          direction: nextDirection,
        },
      }}
      scroll={false}
      aria-label={`Trier par ${fullLabel}`}
      aria-current={isActive ? "page" : undefined}
      className={`flex min-h-11 w-full items-center gap-0.5 text-[8px] font-black uppercase tracking-normal min-[390px]:text-[9px] min-[390px]:tracking-wide ${className} ${
        isActive ? "text-[#0F5944]" : "text-[#48665F]"
      }`}
    >
      <span className="truncate">{label}</span>
      <span aria-hidden="true" className="shrink-0 text-[8px]">
        {isActive ? (currentDirection === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </Link>
  );
}

function CompactRatingBadge({
  rating,
}: {
  rating: MobileRosterSummaryRating;
}) {
  const bonus = Number(rating.bonus ?? 0);

  return (
    <span
      title={`${rating.fullLabel} : ${rating.value}${bonus > 0 ? ` +${bonus} équipement` : ""}`}
      data-rating-importance={rating.importance}
      className={[
        "relative inline-flex size-7 items-center justify-center rounded-md border px-0 text-[10px] font-black tabular-nums min-[390px]:size-8 min-[390px]:text-[11px]",
        getRiderRatingColorClasses(rating.value, rating.importance),
      ].join(" ")}
    >
      {rating.value}
      {bonus > 0 ? (
        <span
          aria-label={`Bonus équipement : +${bonus}`}
          className="absolute -right-0.5 -top-1 rounded-full border border-[#78AEDA] bg-[#F7FBFF] px-0.5 text-[7px] font-black leading-3 text-[#145A8D]"
        >
          +{bonus}
        </span>
      ) : null}
    </span>
  );
}

function CompactHealthGauges({
  form,
  morale,
}: {
  form: number;
  morale: number;
}) {
  const normalizedForm = normalizePercentage(form);
  const normalizedMorale = normalizePercentage(morale);

  return (
    <div
      aria-label={`Santé : forme ${normalizedForm} %, moral ${normalizedMorale} %`}
      className="mt-1 grid max-w-28 grid-cols-2 gap-1.5"
    >
      <CompactGauge
        abbreviation="F"
        label="Forme"
        value={normalizedForm}
        trackClassName="bg-[#D7EEE8]"
        valueClassName="bg-[#2FA982]"
      />
      <CompactGauge
        abbreviation="M"
        label="Moral"
        value={normalizedMorale}
        trackClassName="bg-[#DCEBFA]"
        valueClassName="bg-[#3B82F6]"
      />
    </div>
  );
}

function CompactGauge({
  abbreviation,
  label,
  value,
  trackClassName,
  valueClassName,
}: {
  abbreviation: string;
  label: string;
  value: number;
  trackClassName: string;
  valueClassName: string;
}) {
  return (
    <span title={`${label} : ${value} %`} className="block min-w-0">
      <span className="flex items-center justify-between gap-1 text-[8px] font-black leading-3 text-[#60756E]">
        <span aria-hidden="true">{abbreviation}</span>
        <span className="tabular-nums">{value}</span>
      </span>
      <span
        role="progressbar"
        aria-label={`${label} : ${value} %`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className={`block h-1 overflow-hidden rounded-full ${trackClassName}`}
      >
        <span
          className={`block h-full rounded-full ${valueClassName}`}
          style={{ width: `${value}%` }}
        />
      </span>
    </span>
  );
}

export function toggleMobileRosterCustomRating(
  currentKeys: readonly MobileRosterSummaryRatingKey[],
  key: MobileRosterSummaryRatingKey,
): MobileRosterSummaryRatingKey[] {
  if (currentKeys.includes(key)) {
    return currentKeys.length > 1
      ? currentKeys.filter((currentKey) => currentKey !== key)
      : [...currentKeys];
  }

  if (currentKeys.length < MAX_VISIBLE_RATINGS) {
    return [...currentKeys, key];
  }

  return [...currentKeys.slice(1), key];
}

function isRatingPresetId(value: unknown): value is RatingPresetId {
  return RATING_PRESETS.some((preset) => preset.id === value);
}

function isMobileRosterSummaryRatingKey(
  value: unknown,
): value is MobileRosterSummaryRatingKey {
  return typeof value === "string" &&
    [
      "mountain",
      "hills",
      "flat",
      "time_trial",
      "cobbles",
      "sprint",
      "acceleration",
      "downhill",
      "endurance",
      "resistance",
      "recovery",
      "breakaway",
      "prologue",
    ].includes(value);
}

function normalizePercentage(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
