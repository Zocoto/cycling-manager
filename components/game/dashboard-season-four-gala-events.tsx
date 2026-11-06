import Image from "next/image";
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
  return <section className={styles.gala} aria-labelledby="dashboard-gala-s4-title" data-gala-live-feature>
    <span aria-hidden="true" className={styles.ornament}>✦</span>
    <div className={styles.intro}>
      <span className={styles.label}>Le Grand Gala · Saison 4</span>
      <h2 id="dashboard-gala-s4-title">Gouille prend les commandes.</h2>
      <p className={styles.date}>{SEASON_FOUR_GALA.dateLabel}</p>
      <p className={styles.description}>Les équipes World Tour et Continental se retrouvent pour six courses, commentées en direct par Gouille.</p>
      <Link href={SEASON_FOUR_GALA.route} prefetch={false} showPendingIndicator={false} className={styles.program}>Voir le programme du gala ↗</Link>
    </div>
    <div className={styles.stream}>
      <div className={styles.host}>
        <Image src={SEASON_FOUR_GALA.hostAvatar} alt="Logo de la chaîne Twitch de Gouille" width={72} height={72} className={styles.avatar} />
        <span className={styles.hostName}>Gouille<span>Twitch</span></span>
      </div>
      <time dateTime={SEASON_FOUR_GALA.liveStartsAt} className={styles.liveTime}>{SEASON_FOUR_GALA.liveLabel}</time>
      <span className={styles.timezone}>Heure de Paris</span>
      <a href={SEASON_FOUR_GALA.twitchUrl} target="_blank" rel="noopener noreferrer" className={styles.twitch}>Suivre le live sur Twitch ↗</a>
      <span className={styles.channel}>twitch.tv/gouille_tw</span>
    </div>
  </section>;
}
