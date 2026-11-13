"use client";

import { useState, type ReactNode } from "react";

import { RIDER_RATING_AXES, type RiderRatingKey } from "@/lib/game/rider-profile";
import type { DevelopmentRider } from "@/services/development-team";

export function DevelopmentRaceRatingSort({
  riders,
  children,
}: {
  riders: readonly DevelopmentRider[];
  children: (rider: DevelopmentRider) => ReactNode;
}) {
  const [ratingKey, setRatingKey] = useState<RiderRatingKey | "roster">("roster");
  const [descending, setDescending] = useState(true);
  const sortedRiders =
    ratingKey === "roster"
      ? riders
      : [...riders].sort((left, right) =>
          descending
            ? right.ratings[ratingKey] - left.ratings[ratingKey]
            : left.ratings[ratingKey] - right.ratings[ratingKey],
        );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="grid min-w-0 gap-1 text-xs font-bold text-[#183F37]">
          Trier par
          <select
            value={ratingKey}
            onChange={(event) =>
              setRatingKey(event.currentTarget.value as RiderRatingKey | "roster")
            }
            className="min-h-11 max-w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-xs text-[#183F37]"
          >
            <option value="roster">Ordre de l’effectif</option>
            {RIDER_RATING_AXES.map((axis) => (
              <option key={axis.key} value={axis.key}>
                {axis.label} ({axis.shortLabel})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={ratingKey === "roster"}
          onClick={() => setDescending((current) => !current)}
          aria-label={
            descending ? "Trier par ordre croissant" : "Trier par ordre décroissant"
          }
          title={descending ? "Ordre décroissant" : "Ordre croissant"}
          className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-[#315B3E]/15 bg-[#F8FBF9] text-base font-black text-[#315B3E] disabled:opacity-40"
        >
          <span aria-hidden="true">{descending ? "↓" : "↑"}</span>
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">{sortedRiders.map(children)}</div>
    </>
  );
}
