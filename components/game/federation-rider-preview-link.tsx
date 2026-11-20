"use client";

import { RiderPreviewLink } from "@/components/game/rider-preview-link";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import type { RiderQuickPreview } from "@/lib/game/rider-quick-preview";
import type { FederationSelectionRider } from "@/services/federation-selection-pool";

export function FederationRiderPreviewLink({
  rider,
  countryCode,
  countryName,
}: {
  rider: FederationSelectionRider;
  countryCode: string;
  countryName: string;
}) {
  const profileHref = rider.category === "professional"
    ? `/jeu/coureurs/${rider.id}`
    : rider.juniorAffiliation === "development_team"
      ? `/jeu/centre-de-formation/development/${rider.id}`
      : null;
  const previewData: RiderQuickPreview = {
    id: rider.id,
    name: rider.name,
    age: rider.age,
    country: { code: countryCode, name: countryName },
    team: rider.teamId ? { id: rider.teamId, name: rider.teamName } : null,
    ratings: Object.fromEntries(RIDER_RATING_AXES.map(({ key }) => [key, {
      kind: "exact",
      value: rider.ratings[key],
    }])) as NonNullable<RiderQuickPreview["ratings"]>,
    ratingVisibility: "exact",
    equipmentRatingBonuses: {},
    potentialSteps: null,
    scoutedPotential: null,
  };

  return (
    <RiderPreviewLink
      riderId={rider.id}
      href={profileHref ?? "#"}
      profileHref={profileHref}
      previewData={previewData}
      prefetch={false}
      className="inline-block rounded font-black text-[#176951] underline decoration-[#176951]/30 underline-offset-4 transition hover:decoration-[#176951] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
    >
      {rider.name}
    </RiderPreviewLink>
  );
}
