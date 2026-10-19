import { getTeamSponsorProject } from "@/services/sponsor-project";
import { SponsorProjectPanel } from "./sponsor-project-panel";

/** Optional streamed guidance: cannot delay roster/academy content. */
export async function SponsorProjectSlot({ teamId, scope }: { teamId: string | null; scope: "roster" | "youth" }) {
  return <SponsorProjectPanel project={await getTeamSponsorProject(teamId)} scope={scope} />;
}
