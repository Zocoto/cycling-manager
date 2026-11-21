import type { DashboardRaceRosterAlert } from "@/lib/game/dashboard-assistant";

export async function DashboardRaceRosterStatus({ alertsPromise }: {
  alertsPromise: Promise<DashboardRaceRosterAlert[] | null>;
}) {
  return <RaceRosterStatus alerts={await alertsPromise} />;
}

export function DashboardRaceRosterStatusPlaceholder() {
  return <RaceRosterStatus alerts={null} />;
}

function RaceRosterStatus({ alerts }: { alerts: DashboardRaceRosterAlert[] | null }) {
  const count = alerts?.length ?? 0;

  return (
    <span
      role="status"
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${count > 0
        ? "bg-[#EF5B65]/20 text-[#FFB0B6] ring-1 ring-[#EF5B65]/40"
        : "bg-white/10 text-[#BFD1C6]"}`}
    >
      {alerts === null ? "Consulter le calendrier" : count > 0 ? (
        <>{count} {count === 1 ? "start-list à corriger" : "start-lists à corriger"}</>
      ) : "Saison ouverte"}
    </span>
  );
}
