import Image from "next/image";

import Link from "@/components/ui/app-link";
import type { TeamRankingJerseyArtwork } from "@/services/uci-rankings";

import { AmateurTeamJersey } from "./amateur-team-jersey";

export function TeamRankingJersey({
  teamId,
  teamName,
  jersey,
}: {
  teamId: string;
  teamName: string;
  jersey: TeamRankingJerseyArtwork;
}) {
  return (
    <Link
      href={`/jeu/equipes/${teamId}`}
      aria-label={`Voir l’équipe ${teamName}`}
      className="relative flex h-16 w-14 shrink-0 items-center justify-center rounded-xl border border-[#315B3E]/10 bg-[#EAF5F3]/65 transition hover:border-[#278B70]/35 hover:bg-[#DDF3E7]"
    >
      {jersey.kind === "sponsor" ? (
        <Image
          src={jersey.imagePath}
          alt=""
          fill
          sizes="56px"
          className="object-contain p-1 drop-shadow-[0_4px_5px_rgba(7,26,23,0.18)]"
        />
      ) : (
        <AmateurTeamJersey
          jersey={jersey.jersey}
          teamName={teamName}
          className="h-14 w-12 drop-shadow-[0_4px_5px_rgba(7,26,23,0.18)]"
        />
      )}
    </Link>
  );
}
