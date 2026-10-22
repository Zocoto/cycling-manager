import Link from "@/components/ui/app-link";
import { canAccessSeasonFourGala } from "@/lib/game/season-four-gala-access";
import { SEASON_FOUR_GALA } from "@/lib/game/season-four-gala";
import { DashboardHalloweenShortcut } from "./dashboard-halloween-shortcut";
import styles from "./season-four-gala-shortcut.module.css";

export async function DashboardSeasonFourGalaEvents({ userId }: { userId: string }) {
  // No extra lookup for any player. The private link is never rendered for them.
  if (!canAccessSeasonFourGala(userId)) return <DashboardHalloweenShortcut />;
  const halloween = await DashboardHalloweenShortcut({ compact: true });
  return <div className={styles.events} data-with-halloween={!!halloween} data-private-gala-events>
    <Link href={SEASON_FOUR_GALA.route} prefetch={false} showPendingIndicator={false} className={styles.gala}>
      <span aria-hidden="true" className={styles.ornament}>✦</span>
      <span className={styles.label}>Le Grand Gala · Saison 4</span>
      <strong>6 novembre · En live avec Gouille</strong>
      <span className={styles.description}>6 courses · World Tour ou Continental</span>
      <span className={styles.cta}>Draft privé ↗</span>
    </Link>
    {halloween}
  </div>;
}
