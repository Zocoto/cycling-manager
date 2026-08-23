"use client";

import { useId, useState } from "react";

import { EquipmentRatingBonus } from "@/components/game/equipment-rating-bonus";
import type { RiderRatingImportance } from "@/lib/game/rider-profile";
import { getRiderRatingColorClasses } from "@/lib/game/rider-rating-colors";

export type MobileRiderRatingItem = {
  key: string;
  label: string;
  fullLabel: string;
  importance: RiderRatingImportance;
  value: number;
  bonus?: number;
};

export function CollapsibleMobileRiderRatings({
  riderName,
  ratings,
}: {
  riderName: string;
  ratings: MobileRiderRatingItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <section className="mt-3 rounded-xl border border-[#315B3E]/12 bg-[#F7FAF9]">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#EEF6F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70]"
      >
        <span>
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#48665F]">
            Statistiques
          </span>
          <span className="mt-0.5 block text-[10px] font-bold text-[#82958F]">
            Les 13 notes restent accessibles
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#176951] shadow-sm">
          {expanded ? "Replier" : "Voir les notes"}
          <span
            aria-hidden="true"
            className={`text-sm transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            ⌄
          </span>
        </span>
      </button>

      {expanded ? (
        <div
          id={panelId}
          aria-label={`Statistiques de ${riderName}`}
          className="border-t border-[#315B3E]/10 px-3 pb-3 pt-3"
        >
          <dl className="grid grid-cols-4 gap-2 min-[420px]:grid-cols-5 sm:grid-cols-7">
            {ratings.map((rating) => (
              <div
                key={rating.key}
                data-rating-importance={rating.importance}
                className="text-center"
              >
                <dt
                  title={rating.fullLabel}
                  className={[
                    "text-[9px] uppercase tracking-wide",
                    rating.importance === "primary"
                      ? "font-black text-[#48665F]"
                      : "font-bold text-[#91A098]",
                  ].join(" ")}
                >
                  {rating.label}
                </dt>
                <dd className="mt-1">
                  <span
                    title={`${rating.fullLabel} : ${rating.value}${Number(rating.bonus ?? 0) > 0 ? ` +${rating.bonus} équipement` : ""}`}
                    data-rating-importance={rating.importance}
                    className={[
                      "inline-flex h-8 min-w-9 items-center justify-center rounded-md border px-1.5 text-xs font-black",
                      getRiderRatingColorClasses(
                        rating.value,
                        rating.importance,
                      ),
                    ].join(" ")}
                  >
                    {rating.value}
                    <EquipmentRatingBonus
                      bonus={rating.bonus}
                      className="text-[9px]"
                    />
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
