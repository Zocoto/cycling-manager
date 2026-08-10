"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/app-link";

const DISMISSED_STORAGE_KEY = "cyclostrategie:referral-invite-dismissed";

export function DashboardReferralInvite() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDismissed(
        window.localStorage.getItem(DISMISSED_STORAGE_KEY) === "true",
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <aside className="relative mt-6 overflow-hidden rounded-2xl border border-[#D6A600]/35 bg-[linear-gradient(100deg,#0B302B_0%,#124B40_67%,#176951_100%)] p-5 text-white shadow-[0_16px_42px_rgba(19,60,46,0.17)] sm:p-6">
      <div aria-hidden="true" className="absolute -right-9 -top-14 h-40 w-40 rounded-full border-[28px] border-white/5" />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer la proposition de parrainage"
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-[#D6DFD2] transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
      >
        <CloseIcon />
      </button>

      <div className="relative flex flex-col gap-5 pr-9 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F2C94C] text-[#071A17] shadow-lg">
            <ReferralIcon />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9BE0BC]">Nouveau · Parrainage</p>
            <h2 className="mt-1 text-xl font-black">Invitez des amis, gagnez des objets niveau 5 à 7</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#D6DFD2]">Votre lien personnel est prêt. Débloquez aussi le trophée et la tenue spéciale « Le Parrain » pour votre avatar.</p>
          </div>
        </div>

        <Link
          href="/jeu/parrainage"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#F2C94C] px-5 text-sm font-extrabold text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Voir mes gains
        </Link>
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
