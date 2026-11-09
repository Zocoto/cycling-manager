"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/app-link";

const DISMISSED_STORAGE_KEY =
  "cyclostratege:referral-invite:saison2-ambassadors-2026-08";
const REFERRAL_PATH = "/jeu/parrainage";

export function DashboardReferralInvite({
  inviteUrl,
  showBoosters,
}: {
  inviteUrl: string | null;
  showBoosters: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setDismissed(window.localStorage.getItem(DISMISSED_STORAGE_KEY) === "true");
      } catch {
        // Local storage may be unavailable in private browsing.
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
    } catch {
      // The tile still closes for this visit.
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      window.location.assign(REFERRAL_PATH);
    }
  }

  if (dismissed) return null;

  const actionClassName = "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#F2C94C] px-4 text-sm font-extrabold text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <aside className="relative mt-4 rounded-2xl border border-[#D6A600]/35 bg-[linear-gradient(100deg,#0B302B_0%,#124B40_67%,#176951_100%)] p-3 text-white sm:px-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer la proposition de parrainage"
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-[#D6DFD2] transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] sm:top-1/2 sm:-translate-y-1/2"
      >
        <CloseIcon />
      </button>

      <div className="flex flex-col gap-2 pr-10 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F2C94C] text-[#071A17]">
            <ReferralIcon />
          </span>
          <div>
            <h2 className="text-sm font-black">Invitez un ami dans le peloton</h2>
            {showBoosters ? (
              <p className="mt-0.5 text-sm font-semibold text-[#D6DFD2]">2 boosters Cyclo-Stickers par filleul confirmé</p>
            ) : null}
          </div>
        </div>

        {inviteUrl ? (
          <button type="button" onClick={() => void copyInvite()} className={actionClassName}>
            <span aria-live="polite">{copied ? "Lien copié !" : "Copier mon lien"}</span>
          </button>
        ) : (
          <Link href={REFERRAL_PATH} prefetch={false} className={actionClassName}>
            Voir mon lien
          </Link>
        )}
      </div>
    </aside>
  );
}

function ReferralIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" />
      <path d="M2.5 20c.5-4.2 2.4-6.3 5.5-6.3s5 2.1 5.5 6.3M13.5 14.5c3.8-.8 6.5 1 7.2 4.5" />
      <path d="m17 3 .8 1.5 1.7.3-1.2 1.2.3 1.7L17 7l-1.6.7.3-1.7-1.2-1.2 1.7-.3Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}
