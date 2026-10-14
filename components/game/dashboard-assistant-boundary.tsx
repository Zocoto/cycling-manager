import { Suspense, type ReactNode } from "react";
import { DashboardAssistantSkeleton } from "./dashboard-assistant";

// The essential assistant can stream while calendar/weight/objective reads finish.
// Both versions share the same promise: no duplicate requests or client bundle.
export function DashboardAssistantBoundary({ ready, initial, children }: {
  ready: Promise<unknown>;
  initial: ReactNode;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardAssistantSkeleton />}>
      <AssistantStages ready={ready} initial={initial}>{children}</AssistantStages>
    </Suspense>
  );
}

async function AssistantStages({ ready, initial, children }: {
  ready: Promise<unknown>;
  initial: ReactNode;
  children: ReactNode;
}) {
  // A suspended fallback would be captured by the outer boundary. Resolve the
  // shared core first, so the inner fallback is immediately renderable.
  await ready;
  return <Suspense fallback={initial}>{children}</Suspense>;
}
