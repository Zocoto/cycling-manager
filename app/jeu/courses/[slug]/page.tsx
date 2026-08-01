import type { Metadata } from "next";

import { RaceSettlementWatcher } from "@/components/game/race-settlement-watcher";
import {
  RaceProfileContent,
  type RaceProfilePageProps,
} from "./race-profile-content";

export async function generateMetadata({
  params,
}: RaceProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const readableName = slug
    .split("-")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");

  return {
    title: readableName,
    description: `Consultez la fiche de ${readableName} dans Cyclostratège.`,
  };
}

export default async function RaceProfilePage(
  props: RaceProfilePageProps,
) {
  const { slug } = await props.params;

  return (
    <>
      <RaceSettlementWatcher raceSlug={slug} />
      <RaceProfileContent {...props} />
    </>
  );
}
