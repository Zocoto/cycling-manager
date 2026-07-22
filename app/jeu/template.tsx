import type { ReactNode } from "react";

export default function GameTemplate({ children }: { children: ReactNode }) {
  return <div className="game-workspace-background">{children}</div>;
}
