import type { StickerAlbumLeaderboard } from "@/lib/game/cyclo-stickers-leaderboard";
import styles from "./collector-album-leaderboard.module.css";

export function CollectorAlbumLeaderboard({
  leaderboard,
  total,
  onViewAll,
}: {
  leaderboard: StickerAlbumLeaderboard | null;
  total: number;
  onViewAll?: () => void;
}) {
  const entries = onViewAll ? leaderboard?.entries.slice(0, 5) : leaderboard?.entries;
  const viewer = leaderboard?.viewer;

  return (
    <section className={styles.panel} aria-label="Classement des collections">
      <header className={styles.header}>
        <p className={styles.kicker}>Le peloton des collectionneurs</p>
        <h2>Classement des collections</h2>
        <p>Les collections sont classées au nombre de vignettes collées.</p>
      </header>

      {!leaderboard ? (
        <p className={styles.status}>Le classement est momentanément indisponible.</p>
      ) : entries?.length ? (
        <ol className={styles.rows} aria-label="Vignettes collées">
          {entries.map((entry, index) => (
            <li key={`${entry.displayName}-${index}`} className={styles.row} data-viewer={entry.isViewer || undefined}>
              <span className={styles.rank} data-podium={entry.rank <= 3 ? entry.rank : undefined}>#{entry.rank}</span>
              <div className={styles.collector}>
                <span className={styles.name}>{entry.displayName}</span>
                <progress className={styles.progress} aria-hidden="true" value={entry.pastedCount} max={total} />
              </div>
              <span className={styles.count}><strong>{entry.pastedCount}</strong> / {total}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.status}>Le classement débutera dès la première vignette collée.</p>
      )}

      {leaderboard && (
        <div className={styles.viewer}>
          <strong>Ta collection</strong>
          {viewer ? (
            <span>#{viewer.rank} <span aria-hidden="true">·</span> {viewer.pastedCount} / {total}</span>
          ) : (
            <span>Colle une vignette pour entrer au classement.</span>
          )}
        </div>
      )}

      {onViewAll && (
        <button className={styles.button} type="button" onClick={onViewAll}>
          Voir le classement <span aria-hidden="true">↗</span>
        </button>
      )}
    </section>
  );
}
