import { redirect } from "next/navigation";
import { SEASON_FIVE_GALA } from "@/lib/game/season-five-gala";

// Preserve previously shared review links now that the gala has launched.
export default function SeasonFiveGalaPreviewRedirect() {
  redirect(SEASON_FIVE_GALA.route);
}
