import Link from "@/components/ui/app-link";
import { SEASON_FIVE_GALA } from "@/lib/game/season-five-gala";
import styles from "./dashboard-season-five-gala.module.css";

export function DashboardSeasonFiveGala({ now }: { now: number }) {
  const isOpen = SEASON_FIVE_GALA.isRegistrationOpen
    && now < Date.parse(SEASON_FIVE_GALA.registrationClosesAt);

  return (
    <section aria-labelledby="dashboard-gala-s5-title" data-gala-s5-registration-feature>
      <Link href={SEASON_FIVE_GALA.route} prefetch={false} showPendingIndicator={false} className={styles.card}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Le rendez-vous de fin de saison 5</span>
          <h2 id="dashboard-gala-s5-title">Le Gala des Lumières</h2>
          <p>Pro Tour ou Continental · Trois courses par programme · En direct avec Gouille</p>
          <p className={styles.liveDate}>Live · <time dateTime={SEASON_FIVE_GALA.liveStartsAt}>{SEASON_FIVE_GALA.dateLabel}</time></p>
          <span className={styles.status}>{isOpen ? "Les inscriptions sont ouvertes" : "Les inscriptions sont closes"}</span>
        </div>
        <div className={styles.action}>
          <span className={styles.deadline}>Clôture des inscriptions</span>
          <strong>{SEASON_FIVE_GALA.registrationDeadlineLabel}</strong>
          <span className={styles.button}>{isOpen ? "Inscrire mon équipe" : "Voir le programme"}<span aria-hidden="true">↗</span></span>
        </div>
      </Link>
    </section>
  );
}
