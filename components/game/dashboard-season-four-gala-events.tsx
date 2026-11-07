import Link from "@/components/ui/app-link";
import { SEASON_FOUR_GALA } from "@/lib/game/season-four-gala";
import { DashboardHalloweenShortcut } from "./dashboard-halloween-shortcut";
import styles from "./season-four-gala-shortcut.module.css";

export async function DashboardSeasonFourGalaEvents({userId}: { userId: string }) {
  if (!userId) return <DashboardHalloweenShortcut />;
  const halloween = await DashboardHalloweenShortcut({ compact: true });
  return <div className={styles.events} data-with-halloween={!!halloween} data-private-gala-events>
    <DashboardSeasonFourGalaCard />
    {halloween}
  </div>;
}

export function DashboardSeasonFourGalaCard() {
  return (
    <section aria-labelledby="dashboard-gala-s4-title" data-gala-results-feature>
      <Link href={SEASON_FOUR_GALA.route} prefetch={false} showPendingIndicator={false} className={styles.gala}>
        <div className={styles.intro}>
          <span className={styles.label}>Le Grand Gala · Saison 4</span>
          <h2 id="dashboard-gala-s4-title">Consulter les résultats du gala du 6 novembre</h2>
        </div>
        <span aria-hidden="true" className={styles.arrow}>→</span>
      </Link>
    </section>
  );
}
