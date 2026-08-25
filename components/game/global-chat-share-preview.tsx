"use client";

import dynamic from "next/dynamic";
import NextLink from "next/link";

import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import Link from "@/components/ui/app-link";
import { createTeamProfileTheme } from "@/lib/game/team-profile-theme";
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
  const theme = createTeamProfileTheme({
    primary: preview.palette.primaryColor,
    secondary: preview.palette.secondaryColor,
    accent: preview.palette.accentColor,
  });

  return (
    <section
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
          <p
            data-i18n-skip
            className="mt-0.5 truncate text-[10px] font-bold text-[#60756E]"
          >
            {preview.type === "rider" && !preview.teamId
              ? "Agent libre"
              : preview.subtitle}
          </p>

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
    </section>
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
