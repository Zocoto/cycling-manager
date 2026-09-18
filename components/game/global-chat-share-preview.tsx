"use client";

import dynamic from "next/dynamic";
import NextLink from "next/link";
import { useEffect, useRef, useState } from "react";

import { PotentialStars } from "@/components/game/potential-stars";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import Link from "@/components/ui/app-link";
import { getRiderPreview } from "@/lib/game/rider-preview-client";
import type { RiderQuickPreview } from "@/lib/game/rider-quick-preview";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import { createTeamProfileTheme } from "@/lib/game/team-profile-theme";
import { formatScoutedNumericValue } from "@/lib/game/transfer-scouting";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type { GlobalChatPreview } from "@/services/global-chat";

const RiderAvatar = dynamic(
  () =>
    import("@/components/game/rider-avatar").then(
      (module) => module.RiderAvatar,
    ),
  {
    loading: () => (
      <span className="block h-16 w-16 animate-pulse rounded-full bg-[#DDE5E1]" />
    ),
  },
);

const PREVIEW_LABELS = {
  rider: "Coureur partagé",
  team: "Équipe partagée",
  director: "Directeur Sportif partagé",
} as const;

export function GlobalChatSharePreview({
  preview,
}: {
  preview: GlobalChatPreview;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [riderDetails, setRiderDetails] = useState<RiderQuickPreview | null>(null);
  const [riderDetailsUnavailable, setRiderDetailsUnavailable] = useState(false);

  useEffect(() => {
    if (preview.type !== "rider") return;
    const card = cardRef.current;
    if (!card) return;
    let active = true;
    const loadDetails = () => {
      void getRiderPreview(preview.entityId)
        .then((details) => {
          if (active) setRiderDetails(details);
        })
        .catch(() => {
          if (active) setRiderDetailsUnavailable(true);
        });
    };
    if (typeof IntersectionObserver === "undefined") {
      loadDetails();
      return () => { active = false; };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        loadDetails();
      },
      { rootMargin: "160px" },
    );
    observer.observe(card);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [preview.entityId, preview.type]);

  const theme = createTeamProfileTheme({
    primary: preview.palette.primaryColor,
    secondary: preview.palette.secondaryColor,
    accent: preview.palette.accentColor,
  });

  return (
    <section
      ref={cardRef}
      data-chat-share-preview={preview.type}
      className="relative mt-3 overflow-hidden rounded-2xl border bg-white text-[#0B302B] shadow-[0_12px_30px_rgba(11,48,43,0.10)]"
      style={{
        borderColor: theme.line,
        background: `linear-gradient(135deg, ${theme.soft} 0%, #FFFFFF 58%)`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: `linear-gradient(90deg, ${preview.palette.primaryColor}, ${preview.palette.secondaryColor} 68%, ${preview.palette.accentColor})`,
        }}
      />

      <div className="flex min-w-0 items-center gap-3.5 px-3.5 pb-3.5 pt-4 sm:px-4">
        <PreviewVisual preview={preview} />

        <div className="min-w-0 flex-1">
          <p
            className="text-[9px] font-black uppercase tracking-[0.16em]"
            style={{ color: theme.secondary }}
          >
            {PREVIEW_LABELS[preview.type]}
          </p>
          <NextLink
            href={preview.href}
            prefetch={false}
            className="mt-0.5 block truncate text-[15px] font-black text-[#0B302B] transition hover:underline"
          >
            <span data-i18n-skip>{preview.title}</span>
          </NextLink>
          {preview.type === "rider" && preview.teamId ? (
            <Link
              href={`/jeu/equipes/${preview.teamId}`}
              data-i18n-skip
              className="mt-0.5 block truncate text-[10px] font-bold text-[#60756E] underline decoration-[#60756E]/40 underline-offset-2 hover:text-[#176951]"
            >
              {preview.subtitle}
            </Link>
          ) : (
            <p data-i18n-skip className="mt-0.5 truncate text-[10px] font-bold text-[#60756E]">
              {preview.type === "rider" ? "Agent libre" : preview.subtitle}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {preview.country ? (
              <span className="inline-flex items-center rounded-full border border-[#315B3E]/10 bg-white/85 px-2 py-1 text-[9px] font-black text-[#48665F] shadow-sm">
                <span
                  aria-hidden="true"
                  className={`fi fi-${preview.country.code.toLowerCase()} mr-1.5 rounded-sm`}
                />
                <span data-i18n-skip>{preview.country.name}</span>
              </span>
            ) : null}
            {preview.type === "rider" && preview.age ? (
              <span className="rounded-full border border-[#315B3E]/10 bg-white/85 px-2 py-1 text-[9px] font-black text-[#48665F] shadow-sm">
                {preview.age} ans
              </span>
            ) : null}
            {preview.type === "rider" && riderDetails?.potentialSteps != null ? (
              <span className="rounded-full border border-[#315B3E]/10 bg-white/85 px-2 py-1 text-[9px] font-black text-[#48665F] shadow-sm">
                Potentiel <PotentialStars potentialSteps={riderDetails.potentialSteps} compact />
              </span>
            ) : null}
            {preview.type === "rider" && riderDetails?.potentialSteps == null && (riderDetails || riderDetailsUnavailable) ? (
              <span className="rounded-full border border-[#315B3E]/10 bg-white/85 px-2 py-1 text-[9px] font-black text-[#60756E] shadow-sm">
                Potentiel à découvrir
              </span>
            ) : null}
            {preview.type === "rider" && !preview.teamId ? (
              <span className="rounded-full bg-[#E5E7EB] px-2 py-1 text-[9px] font-black text-[#4B5563]">
                Libre
              </span>
            ) : null}
          </div>
        </div>

        <NextLink
          href={preview.href}
          prefetch={false}
          aria-label={`Voir la fiche de ${preview.title}`}
          className="hidden h-9 w-9 shrink-0 place-items-center rounded-full border bg-white/80 text-base font-black shadow-sm transition hover:translate-x-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 sm:grid"
          style={{
            borderColor: theme.line,
            color: theme.primary,
          }}
        >
          →
        </NextLink>
      </div>
      {preview.type === "rider" ? (
        <RiderPrimaryRatings details={riderDetails} unavailable={riderDetailsUnavailable} />
      ) : null}
    </section>
  );
}

export function RiderPrimaryRatings({ details, unavailable }: { details: RiderQuickPreview | null; unavailable: boolean }) {
  if (!details?.ratings) {
    return (
      <div className="border-t border-[#315B3E]/10 px-3.5 pb-3.5 pt-2.5 sm:px-4">
        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">Notes primaires</p>
        {details || unavailable ? (
          <p className="text-[10px] font-bold text-[#60756E]">Notes indisponibles pour le moment · ouvrir la fiche du coureur</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" aria-label="Chargement des notes primaires">
            {RIDER_RATING_AXES.filter((axis) => axis.importance === "primary").map((axis) => (
              <div key={axis.key} className="rounded-lg border border-[#315B3E]/10 bg-white/80 px-1.5 py-1.5 text-center">
                <span className="block text-[9px] font-extrabold text-[#60756E]">{axis.shortLabel}</span>
                <span className="block text-xs font-black text-[#A2B4AD]">…</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-[#315B3E]/10 px-3.5 pb-3.5 pt-2.5 sm:px-4">
      <p className="mb-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
        Notes primaires{details.ratingVisibility === "scouted" ? " · estimations" : ""}
      </p>
      <div data-chat-primary-ratings className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {RIDER_RATING_AXES.filter((axis) => axis.importance === "primary").map((axis) => (
          <div
            key={axis.key}
            title={axis.label}
            className="rounded-lg border border-[#315B3E]/10 bg-white/80 px-1.5 py-1.5 text-center"
          >
            <span className="block text-[9px] font-extrabold text-[#60756E]">{axis.shortLabel}</span>
            <span className="block text-xs font-black text-[#183F37]">
              {formatScoutedNumericValue(details.ratings![axis.key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewVisual({ preview }: { preview: GlobalChatPreview }) {
  if (preview.type === "rider") {
    const jersey: RiderJerseyAppearance = {
      primaryColor: preview.palette.primaryColor,
      secondaryColor: preview.palette.secondaryColor,
      accentColor: preview.palette.accentColor,
      pattern: preview.jerseyPattern,
      status: preview.jerseyStatus,
    };

    return (
      <div className="shrink-0 text-center">
        <Link
          href={preview.href}
          prefetch={false}
          aria-label={`Portrait de ${preview.title} — statistiques au survol`}
          title="Survoler pour afficher les statistiques"
          className="group/avatar block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
        >
          <RiderAvatar
            profileKey={preview.riderAvatarProfileKey}
            seed={preview.riderAvatarSeed}
            riderId={preview.entityId}
            age={preview.age ?? undefined}
            jersey={jersey}
            label={`Portrait de ${preview.title}`}
            className="h-16 w-16 border-2 border-white shadow-[0_8px_18px_rgba(11,48,43,0.20)] transition group-hover/avatar:scale-[1.04]"
          />
        </Link>
        <span className="mt-1 block text-[7px] font-black uppercase tracking-[0.08em] text-[#789087]">
          Stats au survol
        </span>
      </div>
    );
  }

  if (preview.type === "director") {
    return (
      <SportingDirectorAvatar
        avatarKey={preview.directorAvatarKey}
        frameKey={preview.directorAvatarFrameKey}
        size="medium"
        label={`Avatar de ${preview.title}`}
        className="shadow-[0_8px_18px_rgba(11,48,43,0.18)]"
      />
    );
  }

  return (
    <span
      className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-white text-lg font-black text-white shadow-[0_8px_18px_rgba(11,48,43,0.20)]"
      style={{
        background: `linear-gradient(145deg, ${preview.palette.primaryColor}, ${preview.palette.secondaryColor})`,
      }}
      aria-label={`Identité visuelle de ${preview.title}`}
    >
      {getInitials(preview.title)}
      <SportingDirectorAvatar
        avatarKey={preview.directorAvatarKey}
        frameKey={preview.directorAvatarFrameKey}
        size="small"
        label={`Directeur Sportif de ${preview.title}`}
        className="absolute -bottom-2 -right-2 h-8 w-8 ring-2 ring-white"
      />
    </span>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
