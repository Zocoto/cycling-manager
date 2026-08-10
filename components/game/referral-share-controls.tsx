"use client";

import { useState } from "react";

type ReferralShareControlsProps = {
  inviteUrl: string;
  code: string;
};

export function ReferralShareControls({
  inviteUrl,
  code,
}: ReferralShareControlsProps) {
  const [copied, setCopied] = useState(false);

  function getAbsoluteUrl() {
    return new URL(inviteUrl, window.location.origin).toString();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(getAbsoluteUrl());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function shareLink() {
    const url = getAbsoluteUrl();
    if (navigator.share) {
      await navigator.share({
        title: "Rejoins mon équipe sur Cyclostratège",
        text: "Crée ton équipe cycliste et viens te mesurer au peloton.",
        url,
      });
      return;
    }

    await copyLink();
  }

  return (
    <div className="mt-6">
      <label
        htmlFor="referral-url"
        className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#9BE0BC]"
      >
        Votre lien personnel
      </label>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="referral-url"
          readOnly
          value={inviteUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-4 text-sm font-semibold text-white outline-none focus:border-[#F2C94C] focus:ring-2 focus:ring-[#F2C94C]/20"
        />
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#F2C94C] px-5 text-sm font-extrabold text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <CopyIcon />
          {copied ? "Lien copié !" : "Copier le lien"}
        </button>
        <button
          type="button"
          onClick={() => void shareLink()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/8 px-5 text-sm font-extrabold text-white transition hover:border-[#42B99A] hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42B99A]"
        >
          <ShareIcon />
          Partager
        </button>
      </div>

      <p className="mt-2 text-xs font-semibold text-[#9FB5A8]">
        Code : {code} · Le lien attribue automatiquement votre filleul.
      </p>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="6" y="6" width="10" height="10" rx="2" />
      <path d="M4 13H3.5A1.5 1.5 0 0 1 2 11.5v-8A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5V4" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="15" cy="4" r="2" />
      <circle cx="5" cy="10" r="2" />
      <circle cx="15" cy="16" r="2" />
      <path d="m7 9 6-4M7 11l6 4" />
    </svg>
  );
}
