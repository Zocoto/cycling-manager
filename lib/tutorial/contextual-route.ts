import { CRITERIUM_DISCOVERY_KEY } from "@/lib/tutorial/criterium-discovery";
import { EQUIPMENT_TUTORIAL_KEY } from "@/lib/tutorial/equipment";
import { INFRASTRUCTURE_TUTORIAL_KEY } from "@/lib/tutorial/infrastructure";
import { MEDICAL_CENTER_TUTORIAL_KEY } from "@/lib/tutorial/medical-center";
import { ONBOARDING_TUTORIAL_KEY } from "@/lib/tutorial/onboarding";
import { ROSTER_TUTORIAL_KEY } from "@/lib/tutorial/roster";
import { SPONSORING_TUTORIAL_KEY } from "@/lib/tutorial/sponsoring";
import { STAFF_TUTORIAL_KEY } from "@/lib/tutorial/staff";
import { TRAINING_TUTORIAL_KEY } from "@/lib/tutorial/training";
import { TRANSFER_TUTORIAL_KEY } from "@/lib/tutorial/transfers";
import { YOUTH_DEVELOPMENT_TUTORIAL_KEY } from "@/lib/tutorial/youth-development";

const ROUTE_GUIDES: readonly [prefix: string, tutorialKey: string][] = [
  ["/jeu/courses/criterium-de-la-decouverte", CRITERIUM_DISCOVERY_KEY],
  ["/jeu/resultats/criterium-de-la-decouverte", CRITERIUM_DISCOVERY_KEY],
  ["/jeu/directeur-sportif", ONBOARDING_TUTORIAL_KEY],
  ["/jeu/sponsoring", SPONSORING_TUTORIAL_KEY],
  ["/jeu/centre-de-formation", YOUTH_DEVELOPMENT_TUTORIAL_KEY],
  ["/jeu/centre-de-soin", MEDICAL_CENTER_TUTORIAL_KEY],
  ["/jeu/infrastructures", INFRASTRUCTURE_TUTORIAL_KEY],
  ["/jeu/entrainement", TRAINING_TUTORIAL_KEY],
  ["/jeu/transferts", TRANSFER_TUTORIAL_KEY],
  ["/jeu/inventaire", EQUIPMENT_TUTORIAL_KEY],
  ["/jeu/materiel", EQUIPMENT_TUTORIAL_KEY],
  ["/jeu/coureurs", ROSTER_TUTORIAL_KEY],
  ["/jeu/effectif", ROSTER_TUTORIAL_KEY],
  ["/jeu/equipe", ROSTER_TUTORIAL_KEY],
  ["/jeu/staff", STAFF_TUTORIAL_KEY],
  ["/jeu/calendrier", CRITERIUM_DISCOVERY_KEY],
];

export function getContextualTutorialKey(pathname: string): string | null {
  const normalizedPath =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (normalizedPath === "/jeu") {
    return ONBOARDING_TUTORIAL_KEY;
  }

  return (
    ROUTE_GUIDES.find(
      ([prefix]) =>
        normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
    )?.[1] ?? null
  );
}
