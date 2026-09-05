import { permanentRedirect } from "next/navigation";

export default function LegacyTeamRivalriesPage() {
  permanentRedirect("/jeu/gazette?onglet=rivalites");
}
