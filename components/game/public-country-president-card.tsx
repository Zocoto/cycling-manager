import Link from "@/components/ui/app-link";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import type { GlobalSearchResult } from "@/lib/game/global-search";

export function PublicCountryPresidentCard({
  president,
}: {
  president: GlobalSearchResult | null;
}) {
  if (!president) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-lg text-[#F2C94C]"
        >
          ◇
        </span>
        <span className="min-w-0">
          <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-[#A8DEC6]">
            Présidence fédérale
          </span>
          <strong className="mt-0.5 block text-sm font-black text-white">
            Gestion automatique
          </strong>
          <span className="mt-0.5 block text-[11px] font-semibold text-white/60">
            Aucun président élu actuellement
          </span>
        </span>
      </div>
    );
  }

  return (
    <Link
      href={`/jeu/directeurs-sportifs/${encodeURIComponent(
        president.public_identifier,
      )}`}
      aria-label={`Voir le profil de ${president.display_name}, président de la fédération`}
      className="group flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 transition hover:-translate-y-0.5 hover:border-[#F2C94C]/55 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
    >
      <SportingDirectorAvatar
        avatarKey={president.avatar_key}
        frameKey={president.avatar_frame_key}
        size="small"
        label={`Avatar de ${president.display_name}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-[#A8DEC6]">
          Président de la fédération
        </span>
        <strong className="mt-0.5 block truncate text-sm font-black text-white">
          {president.display_name}
        </strong>
        <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/65">
          @{president.public_identifier}
          {president.team_name ? ` · ${president.team_name}` : ""}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="text-sm font-black text-[#F2C94C] transition group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}
