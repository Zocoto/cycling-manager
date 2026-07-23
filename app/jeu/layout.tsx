import "flag-icons/css/flag-icons.min.css";

import type { ReactNode } from "react";

import { RaceSettlementWatcher } from "@/components/game/race-settlement-watcher";

export default function GameLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <RaceSettlementWatcher />
      {children}
    </>
  );
}
