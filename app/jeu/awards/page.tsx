import { redirect } from "next/navigation";

export default function SeasonAwardsPage() {
  redirect("/jeu/gazette?onglet=awards");
}
