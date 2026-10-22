import type { Metadata } from "next";

import { GameGuideContent } from "@/components/guide/game-guide-content";

export const metadata: Metadata = {
  title: "Guide complet du Directeur Sportif",
  description:
    "Le manuel complet de Cyclo Stratège : calendrier, courses, entraînement, forme, staff, transferts, finances, objectifs et progression.",
  alternates: {
    canonical: "/guide",
  },
  openGraph: {
    url: "/guide",
    title: "Guide du jeu de management cycliste Cyclo Stratège",
    description:
      "Calendrier, courses, entraînement, staff, transferts, finances et progression : préparez votre carrière de directeur sportif.",
  },
};

export default function GuidePage() {
  return <GameGuideContent />;
}
