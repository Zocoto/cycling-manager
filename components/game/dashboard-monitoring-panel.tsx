"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";

import { loadDashboardMonitoringAction } from "@/app/jeu/actions";
import type { DashboardMonitoringPayload } from "@/lib/game/dashboard-monitoring";

const DashboardMonitoringOverview = dynamic(
  () =>
    import("@/components/game/dashboard-monitoring-overview").then(
      (module) => module.DashboardMonitoringOverview,
    ),
  {
    ssr: false,
    loading: () => <DashboardMonitoringSkeleton />,
  },
);

export function DashboardMonitoringPanel({
  teamId,
  seasonName,
  actionCount,
}: {
  teamId: string | null;
  seasonName: string;
  actionCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<DashboardMonitoringPayload | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleMonitoring() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    if (payload || isPending) return;

    setErrorMessage(null);
    startTransition(async () => {
      const result = await loadDashboardMonitoringAction();
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      setPayload(result.payload);
    });
  }

  return (
    <section className="mt-8" aria-labelledby="dashboard-monitoring-title">
      <div className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-[0_16px_46px_rgba(19,60,46,0.1)]">
        <button
          type="button"
          onClick={toggleMonitoring}
          aria-expanded={isOpen}
          aria-controls="dashboard-monitoring-content"
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#F5FAF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70] sm:px-6"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#278B70]">
              Centre de monitoring
            </span>
            <span
              id="dashboard-monitoring-title"
              className="mt-1 block text-lg font-black tracking-[-0.02em] text-[#082A2A] sm:text-xl"
            >
              {actionCount > 0
                ? `${actionCount} action${actionCount > 1 ? "s" : ""} à suivre`
                : "L’essentiel est sous contrôle"}
            </span>
            <span className="mt-0.5 block text-xs font-semibold text-[#60756E]">
              Alertes, temps forts et classements · {seasonName}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-2">
            {actionCount > 0 ? (
              <span className="rounded-full bg-[#FFF3CE] px-2.5 py-1 text-[10px] font-black text-[#76590B]">
                {actionCount}
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F7F1] text-[#176951] transition-transform ${isOpen ? "rotate-180" : ""}`}
            >
              ⌄
            </span>
          </span>
        </button>

        {isOpen ? (
          <div
            id="dashboard-monitoring-content"
            className="border-t border-[#315B3E]/10 bg-[#F8FBF9] px-4 pb-6 sm:px-6"
          >
            {errorMessage ? (
              <div className="mt-5 rounded-xl border border-[#D85D5D]/20 bg-[#FFF0EE] px-4 py-3 text-sm font-bold text-[#923B33]">
                {errorMessage}
              </div>
            ) : payload ? (
              <DashboardMonitoringOverview
                teamId={payload.teamId ?? teamId}
                dashboardEvents={payload.dashboardEvents}
                rankings={payload.rankings}
                pelotonNews={payload.pelotonNews}
                embedded
              />
            ) : (
              <DashboardMonitoringSkeleton />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DashboardMonitoringSkeleton() {
  return (
    <div className="mt-5 grid animate-pulse gap-5 xl:grid-cols-2" aria-label="Chargement du monitoring">
      <span className="h-48 rounded-2xl bg-[#DCEBE5]" />
      <span className="h-48 rounded-2xl bg-[#DCEBE5]" />
    </div>
  );
}
