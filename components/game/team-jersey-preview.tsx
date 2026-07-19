"use client";

import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import type { Sponsor } from "@/types/sponsor";

import { AmateurTeamJersey } from "./amateur-team-jersey";
import { SponsorJerseyPreview } from "./sponsor-jersey-preview";

type TeamJerseyPreviewProps = {
  amateurJersey: AmateurJerseyConfig;
  amateurTeamName?: string | null;
  sponsor?: Sponsor | null;
  sponsorJersey?: Sponsor["jerseys"][number] | null;
  className?: string;
};

export function TeamJerseyPreview({
  amateurJersey,
  amateurTeamName,
  sponsor,
  sponsorJersey,
  className,
}: TeamJerseyPreviewProps) {
  if (sponsor && sponsorJersey) {
    return (
      <SponsorJerseyPreview
        sponsor={sponsor}
        jersey={sponsorJersey}
        className={className}
      />
    );
  }

  return (
    <AmateurTeamJersey
      jersey={amateurJersey}
      teamName={amateurTeamName}
      className={className}
    />
  );
}
