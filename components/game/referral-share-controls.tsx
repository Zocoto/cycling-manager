"use client";

import { useState } from "react";

import { appConfig } from "@/lib/app-config";

type ReferralShareControlsProps = {
  inviteUrl: string;
  code: string;
};

type ReferralShareDestination = "whatsapp" | "facebook" | "email";

export const REFERRAL_SHARE_TEXT =
  "Je joue à Cyclo Stratège, un jeu de management cycliste sur navigateur. Crée ton équipe et viens te mesurer au peloton avec moi 🚴";

export function ReferralShareControls({
  inviteUrl,
  code,
}: ReferralShareControlsProps) {
  const absoluteInviteUrl = new URL(inviteUrl, appConfig.siteUrl).toString();
  const [copiedTarget, setCopiedTarget] = useState<"link" | "message" | null>(
    null,
  );

  async function copyLink() {
    await copyToClipboard(absoluteInviteUrl, "link");
  }

  async function copyMessage() {
    await copyToClipboard(
      `${REFERRAL_SHARE_TEXT}\n\n${absoluteInviteUrl}`,
      "message",
    );
  }

  async function copyToClipboard(
    value: string,
    target: "link" | "message",
  ) {
    await navigator.clipboard.writeText(value);
    setCopiedTarget(target);
    window.setTimeout(() => setCopiedTarget(null), 2200);
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Rejoins-moi sur Cyclo Stratège",
          text: REFERRAL_SHARE_TEXT,
          url: absoluteInviteUrl,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        throw error;
      }
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
          {copiedTarget === "link" ? "Lien copié !" : "Copier le lien"}
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

      <div className="mt-3 flex flex-wrap gap-2">
        <ShareDestinationLink
          href={buildReferralShareHref("whatsapp", absoluteInviteUrl)}
          label="WhatsApp"
          shortLabel="WA"
        />
        <ShareDestinationLink
          href={buildReferralShareHref("facebook", absoluteInviteUrl)}
          label="Facebook"
          shortLabel="f"
        />
        <ShareDestinationLink
          href={buildReferralShareHref("email", absoluteInviteUrl)}
          label="E-mail"
          shortLabel="@"
          newTab={false}
        />
        <button
          type="button"
          onClick={() => void copyMessage()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/15 px-3 text-xs font-extrabold text-[#D6DFD2] transition hover:border-[#F2C94C]/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
        >
          <CopyIcon />
          {copiedTarget === "message"
            ? "Message copié !"
            : "Copier le message prêt à envoyer"}
        </button>
      </div>

      <p className="mt-2 text-xs font-semibold text-[#9FB5A8]">
        Code : {code} · Le lien attribue automatiquement votre filleul et mesure la campagne ambassadeurs.
      </p>
    </div>
  );
}

function ShareDestinationLink({
  href,
  label,
  shortLabel,
  newTab = true,
}: {
  href: string;
  label: string;
  shortLabel: string;
  newTab?: boolean;
}) {
  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noreferrer" : undefined}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 text-xs font-extrabold text-white transition hover:border-[#42B99A] hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42B99A]"
    >
      <span
        aria-hidden="true"
        className="grid h-6 min-w-6 place-items-center rounded-lg bg-white/10 px-1 text-[11px] font-black text-[#F2C94C]"
      >
        {shortLabel}
      </span>
      {label}
    </a>
  );
}

export function buildReferralShareHref(
  destination: ReferralShareDestination,
  inviteUrl: string,
): string {
  const encodedUrl = encodeURIComponent(inviteUrl);
  const encodedMessage = encodeURIComponent(REFERRAL_SHARE_TEXT);

  if (destination === "whatsapp") {
    return `https://wa.me/?text=${encodedMessage}%20${encodedUrl}`;
  }

  if (destination === "facebook") {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  }

  const subject = encodeURIComponent("Rejoins-moi sur Cyclo Stratège");
  const body = encodeURIComponent(
    `${REFERRAL_SHARE_TEXT}\n\n${inviteUrl}`,
  );

  return `mailto:?subject=${subject}&body=${body}`;
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
