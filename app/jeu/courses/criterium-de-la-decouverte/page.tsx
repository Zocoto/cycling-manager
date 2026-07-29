import type { Metadata } from "next";

import {
  CriteriumDiscoveryRaceContent,
  type CriteriumRacePageProps,
} from "./criterium-race-content";
import { CRITERIUM_DISCOVERY_NAME } from "@/lib/tutorial/criterium-discovery";

export const metadata: Metadata = {
  title: CRITERIUM_DISCOVERY_NAME,
  description:
    "Inscrivez cinq coureurs au Critérium de la découverte et vivez une course dans les conditions réelles de Cyclostratège.",
};

export default function CriteriumDiscoveryRacePage(
  props: CriteriumRacePageProps,
) {
  return <CriteriumDiscoveryRaceContent {...props} />;
}
