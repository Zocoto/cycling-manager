import Image from "next/image";
import AppLink from "@/components/ui/app-link";
import {
  GALA_CONSUMABLE_PROPOSAL,
  GALA_EVENTS,
  GALA_PODIUM_PROPOSAL,
  SEASON_FOUR_GALA,
  type GalaCourse,
  type GalaEventKey,
} from "@/lib/game/season-four-gala";
import { GALA_CONSUMABLE_KEYS, getSeasonFourGalaPrize } from "@/lib/game/season-four-gala-rewards";
import type { GalaPublishedResult } from "@/services/season-four-gala-results";
import { SeasonFourGalaCourseProfile } from "./season-four-gala-course-profile";
import theme from "./season-four-gala.module.css";
import styles from "./season-four-gala-results.module.css";

const programs = [
  { key: "world-tour", label: "World Tour" },
  { key: "continental", label: "Continental" },
] as const;

const consumableNames: Readonly<Record<string, string>> = {
  [GALA_CONSUMABLE_KEYS.capsule]: "Perfectionnement technique",
  [GALA_CONSUMABLE_KEYS.training]: "Bloc haute intensité",
  [GALA_CONSUMABLE_KEYS.form]: "Ration énergétique",
  [GALA_CONSUMABLE_KEYS.care]: "Trousse de récupération",
};

function PrizeCell({ course, rank }: { course: GalaCourse; rank: number }) {
  const podium = GALA_PODIUM_PROPOSAL.find(prize => prize.rank === rank);
  if (podium) {
    return <><strong>{podium.name}</strong><span>+{podium.primaryBonus} {course.primaryLabel}</span></>;
  }
  return (
    <ul className={styles.prizeList}>
      {getSeasonFourGalaPrize(course.id, rank).consumables.map(({ rewardKey, quantity }) => (
        <li key={rewardKey}>{quantity} × {consumableNames[rewardKey]}</li>
      ))}
    </ul>
  );
}

function CourseResults({ course, ranking, unavailable }: {
  course: GalaCourse;
  ranking?: GalaPublishedResult[];
  unavailable: boolean;
}) {
  return (
    <article className={styles.course}>
      <div className={styles.courseHeading}>
        <div>
          <h3>{course.name}</h3>
          <p>{course.distance}</p>
        </div>
        <span className={theme.smallBadge}>{course.profile}</span>
      </div>
      <SeasonFourGalaCourseProfile course={course} />
      <details className={styles.ranking}>
        <summary>
          <strong>Top 10</strong>
          <span>{unavailable ? "Indisponible" : ranking ? "Classement et lots" : "En cours de traitement"}</span>
        </summary>
        {ranking ? (
          <table className={styles.table} aria-label={`Top 10 · ${course.name}`}>
            <thead><tr><th scope="col">Place</th><th scope="col">Coureur</th><th scope="col">Lot</th></tr></thead>
            <tbody>
              {ranking.map(row => (
                <tr key={row.rank}>
                  <td>{row.rank}</td>
                  <td><strong>{row.riderName}</strong><span>{row.teamName}</span></td>
                  <td><PrizeCell course={course} rank={row.rank} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className={styles.empty}>{unavailable ? "Le classement est temporairement indisponible." : "Le top 10 sera publié après validation."}</p>}
      </details>
    </article>
  );
}

export function SeasonFourGalaResults({ results, liveParticipants }: {
  results: Partial<Record<GalaEventKey, GalaPublishedResult[]>> | null;
  liveParticipants: string[] | null;
}) {
  const pending = results && GALA_EVENTS.some(event => !results[event.key]);

  return (
    <>
      <div className={theme.privateBar}>
        <span>Le Grand Gala · Saison 4</span>
        <AppLink href="/jeu" prefetch={false}>Retour au bureau ↗</AppLink>
      </div>
      <header className={styles.hero}>
        <time dateTime={SEASON_FOUR_GALA.date}>{SEASON_FOUR_GALA.dateLabel}</time>
        <h1>Résultats du Grand Gala</h1>
        <nav aria-label="Rubriques des résultats du gala" className={styles.nav}>
          {programs.map(program => <a href={`#gala-${program.key}`} key={program.key}>{program.label}</a>)}
          <a href="#gala-live">Participants au live</a>
        </nav>
      </header>

      {pending || !results ? (
        <div className={styles.notice} role="status">
          <strong>{pending ? "Résultats en cours de traitement" : "Résultats temporairement indisponibles"}</strong>
          <p>{pending ? "Les classements et leurs lots seront affichés après validation." : "Les profils des épreuves restent consultables."}</p>
        </div>
      ) : null}

      {programs.map(program => (
        <section className={styles.section} id={`gala-${program.key}`} aria-labelledby={`gala-${program.key}-title`} key={program.key}>
          <h2 id={`gala-${program.key}-title`}>{program.label}</h2>
          <div className={styles.courseGrid}>
            {GALA_EVENTS.filter(event => event.program === program.key).map(event => (
              <CourseResults course={event.course} ranking={results?.[event.key]} unavailable={!results} key={event.key} />
            ))}
          </div>
        </section>
      ))}

      <details className={styles.prizeSchedule}>
        <summary>Barème des lots du top 10</summary>
        <ul>
          {GALA_PODIUM_PROPOSAL.map(prize => (
            <li key={prize.rank}>
              <b>{prize.rank === 1 ? "1er" : `${prize.rank}e`}</b>
              <span><strong>{prize.name}</strong><small>+{prize.primaryBonus} dans la spécialité de l’épreuve</small></span>
            </li>
          ))}
          {GALA_CONSUMABLE_PROPOSAL.map(pack => (
            <li key={pack.places}><b>{pack.places}</b><span><strong>{pack.name}</strong><small>{pack.detail}</small></span></li>
          ))}
        </ul>
      </details>

      <section id="gala-live" className={`${styles.section} ${styles.live}`} aria-labelledby="gala-live-title">
        <div className={styles.liveHeading}>
          <div className={styles.liveHost}>
            <Image src={SEASON_FOUR_GALA.hostAvatar} width={42} height={42} alt="Logo de la chaîne Twitch de Gouille" />
            <h2 id="gala-live-title">Participants au live</h2>
          </div>
          <a href={SEASON_FOUR_GALA.twitchUrl} target="_blank" rel="noopener noreferrer">Chaîne de Gouille sur Twitch ↗</a>
        </div>
        <div className={styles.liveGift}>
          <strong>Lots de présence</strong>
          <span>Gants Nuit dorée · +1 VAL</span>
          <span>{SEASON_FOUR_GALA.liveBoosters} boosters Cyclo-Stickers</span>
        </div>
        {liveParticipants?.length ? (
          <>
            <ul className={styles.participants} aria-label="Bénéficiaires des lots de présence">
              {liveParticipants.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}
            </ul>
            <p className={styles.empty}>Un oubli est possible. Si vous avez suivi le live et que votre nom manque, contactez directement Zocoto pour faire vérifier votre présence.</p>
          </>
        ) : (
          <p className={styles.empty}>{liveParticipants === null ? "La liste des participants est temporairement indisponible." : "La liste de présence est en cours de traitement."}</p>
        )}
      </section>
    </>
  );
}
