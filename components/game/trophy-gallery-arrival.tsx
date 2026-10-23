"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import NextLink from "next/link";

import Link from "@/components/ui/app-link";
import { TrophyNotificationsSeenMarker } from "@/components/game/trophy-notifications-seen-marker";
import { getTrophyCardAnchor, type TrophyArrival } from "@/lib/game/trophy-arrivals";

const ArrivalContext = createContext<TrophyArrival[]>([]);

export function TrophyGalleryArrival({
  arrivals,
  children,
  acknowledgeNotifications = false,
}: {
  arrivals: TrophyArrival[];
  children: ReactNode;
  acknowledgeNotifications?: boolean;
}) {
  // Acknowledging notifications refreshes server data. Keep this visit's
  // snapshot so the new-award markers don't disappear while being viewed.
  const [visitArrivals] = useState(arrivals);
  const targetId = visitArrivals[0]?.trophyId;
  useEffect(() => {
    if (!targetId || window.location.hash === "#trophee-alpha-tester") return;
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(getTrophyCardAnchor(targetId));
      card?.scrollIntoView({ block: "center", behavior: "instant" });
      card?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [targetId]);

  return <ArrivalContext.Provider value={visitArrivals}>{children}{acknowledgeNotifications ? <TrophyNotificationsSeenMarker /> : null}</ArrivalContext.Provider>;
}

export function TrophyArrivalSummary() {
  const arrivals = useContext(ArrivalContext);
  if (!arrivals.length) return null;
  return (
    <aside className="mb-8 rounded-2xl border border-[#F2C94C]/40 bg-[#F2C94C]/10 p-4" aria-label="Trophées à découvrir">
      <p className="text-sm font-black text-[#FFF2AD]">
        {arrivals.some((arrival) => arrival.isNew) ? "Vos nouveaux trophées" : "Trophée sélectionné"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {arrivals.map((arrival) => (
          <a key={arrival.win.id} href={`#${getTrophyCardAnchor(arrival.trophyId)}`} className="rounded-xl border border-[#F2C94C]/25 bg-black/20 px-3 py-2 text-xs font-bold text-[#FFF2AD] hover:bg-black/35">
            {arrival.trophyTitle} · {arrival.win.seasonName}
          </a>
        ))}
      </div>
    </aside>
  );
}

export function TrophyArrivalLabel({ trophyId }: { trophyId: string }) {
  const arrivals = useContext(ArrivalContext).filter((arrival) => arrival.trophyId === trophyId);
  if (!arrivals.length) return null;
  return (
    <div data-trophy-arrival-label className="mt-3 rounded-xl border border-[#F2C94C]/30 bg-[#F2C94C]/10 px-3 py-2 text-xs font-bold leading-5 text-[#FFF2AD]">
      {arrivals.map(({ win, isNew }) => (
        <p key={win.id}>
          <span className="font-black">{isNew ? "Nouveau trophée" : "Trophée sélectionné"}</span>
          {" · "}{win.seasonName}{win.riderName ? ` · ${win.riderName}` : ""}
        </p>
      ))}
    </div>
  );
}

export function TrophyArrivalCard({
  trophyId,
  href,
  className,
  locked,
  label,
  children,
}: {
  trophyId: string;
  href: string | null;
  className: string;
  locked: boolean;
  label: string;
  children: ReactNode;
}) {
  const arrivals = useContext(ArrivalContext);
  const highlighted = !locked && arrivals.some((arrival) => arrival.trophyId === trophyId);
  const props = {
    className: `${className} ${highlighted ? "ring-2 ring-[#F2C94C] shadow-[0_0_35px_rgba(242,201,76,0.18)]" : ""}`,
    "data-trophy-status": locked ? "locked" : "earned",
    "aria-label": label,
  };
  // Focus the wrapper, not AppLink: focusing a race link opens its quick
  // preview and would both hide the trophy and issue an unrelated request.
  return (
    <div id={getTrophyCardAnchor(trophyId)} tabIndex={-1} className="h-full scroll-mt-28 rounded-[1.6rem] focus:outline-none" data-trophy-highlighted={highlighted ? "true" : undefined}>
      {href ? highlighted ? (
        // Scrolling an arrival under the pointer must not open a race preview
        // over the award. Keep the link to results, without hover preloading.
        <NextLink {...props} href={href} prefetch={false} scroll={false}>{children}</NextLink>
      ) : <Link {...props} href={href}>{children}</Link> : <article {...props}>{children}</article>}
    </div>
  );
}
