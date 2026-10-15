import { Suspense, type ReactNode } from "react";

/** Stream optional details without holding the usable dashboard hostage. */
export function DeferredDashboardValue<T>({ promise, fallback, children }: {
  promise: Promise<T>;
  fallback: ReactNode;
  children: (value: T) => ReactNode;
}) {
  return <Suspense fallback={fallback}><ResolvedValue promise={promise}>{children}</ResolvedValue></Suspense>;
}

async function ResolvedValue<T>({ promise, children }: {
  promise: Promise<T>;
  children: (value: T) => ReactNode;
}) {
  return children(await promise);
}
