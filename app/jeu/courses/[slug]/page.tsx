import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
  const nationalDiscipline = getNationalChampionshipDisciplineFromSlug(slug);
  if (nationalDiscipline) {
    redirect("/jeu/championnats-nationaux");
  }

  return <RaceProfileContent {...props} />;
}

function getNationalChampionshipDisciplineFromSlug(slug: string) {
  if (/^cn-[a-z]{2}-clm$/.test(slug)) return "contre-la-montre";
  if (/^cn-[a-z]{2}-route$/.test(slug)) return "route";
  return null;
}
