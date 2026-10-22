import { notFound } from "next/navigation";
import { SeasonFourGalaPreview } from "@/components/game/season-four-gala-preview";
import styles from "@/components/game/season-four-gala.module.css";

export const metadata = { title: "Gala S4 · recette locale", robots: { index: false, follow: false } };
export default function LocalGalaPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <div className="game-workspace-background"><main className={styles.page} data-gala-s4-page><SeasonFourGalaPreview /></main></div>;
}
