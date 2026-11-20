import type { ReactNode } from "react";

import { RiderConditionGauges } from "@/components/game/rider-condition-gauges";
import { RiderStatsRadar } from "@/components/game/rider-stats-radar";
import { TransferScoutingReportPanel } from "@/components/game/transfer-scouting-report";
import type { RiderRatingKey } from "@/lib/game/rider-profile";
import type { PublicRiderProfile } from "@/services/public-rider-profile";

export function RiderProfileSportingCard({
  ratings,
  scoutingReport,
  equipmentBonuses,
  condition,
  medical,
}: {
  ratings: PublicRiderProfile["ratings"];
  scoutingReport: PublicRiderProfile["scoutingReport"];
  equipmentBonuses?: Partial<Record<RiderRatingKey, number>>;
  condition: PublicRiderProfile["condition"];
  medical?: ReactNode;
}) {
  return (
    <section
      data-tutorial-id="rider-profile-stats"
      className="min-w-0 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7"
    >
      <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            Profil sportif
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#183F37]">
            Caractéristiques de la saison
          </h2>
        </div>
        <div data-tutorial-id="rider-profile-form" className="min-w-0">
          <RiderConditionGauges {...condition} embedded />
        </div>
      </div>
      {medical ? <div className="mt-5">{medical}</div> : null}
      <div className="mt-5 border-t border-[#315B3E]/10 pt-5">
        {ratings ? (
          <RiderStatsRadar ratings={ratings} equipmentBonuses={equipmentBonuses} layout="split" />
        ) : scoutingReport ? (
          <TransferScoutingReportPanel report={scoutingReport} />
        ) : (
          <p className="rounded-2xl border border-dashed border-[#315B3E]/15 bg-[#F3F8F5] p-5 text-sm font-semibold text-[#60756E]">
            Aucune caractéristique n’est disponible pour ce coureur.
          </p>
        )}
      </div>
    </section>
  );
}
