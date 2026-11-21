"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  GALA_S5_COURSES,
  GALA_S5_LIVE_REWARD,
  GALA_S5_REWARD_PROPOSAL,
  SEASON_FIVE_GALA,
  type SeasonFiveGalaCourse,
  type SeasonFiveGalaProgram,
} from "@/lib/game/season-five-gala";
import styles from "./season-five-gala.module.css";
import type { SeasonFiveGalaContext } from "@/lib/game/season-five-gala-registration";
import { SeasonFiveGalaRegistration } from "./season-five-gala-registration";
import { SeasonFiveGalaHero } from "./season-five-gala-hero";

const programs: readonly SeasonFiveGalaProgram[] = ["pro-tour", "continental"];

export function SeasonFiveGalaPreview({ registrationContext }: { registrationContext?: SeasonFiveGalaContext }) {
  const [program, setProgram] = useState<SeasonFiveGalaProgram>(registrationContext?.program ?? "pro-tour");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const courses = GALA_S5_COURSES.filter((course) => course.program === program);

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      nextIndex = (index + 1) % programs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = programs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setProgram(programs[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar} aria-label="Navigation du gala">
          <span><Image src="/logo-cyclo-stratege.png" width={30} height={30} alt="" unoptimized />Cyclo Stratège</span>
          <a href="/jeu">Retour au bureau <span aria-hidden="true">↗</span></a>
        </nav>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Le rendez-vous de fin de saison 5</p>
            <h1>Le Gala<br />des <em>Lumières.</em></h1>
            <p className={styles.heroDate}>{SEASON_FIVE_GALA.dateLabel}</p>
            <p className={styles.heroLead}>
              Six grandes routes, vos futures couleurs et le plaisir de courir ensemble.
              Le peloton fête la saison sur Pro Cycling Manager 26, en direct avec Gouille.
            </p>
            <div className={styles.heroActions}>
              <a href={registrationContext?.isOpen && registrationContext.team ? "#inscriptions-gala-s5" : "#programme-gala-s5"} className={styles.goldButton}>
                {registrationContext?.isOpen && registrationContext.team ? "Inscrire mon équipe" : "Découvrir les courses"} <span aria-hidden="true">↓</span></a>
              <a href="#lots-gala-s5" className={styles.textLink}>Voir les lots</a>
            </div>
          </div>
          <SeasonFiveGalaHero className={styles.heroArt} />
          <p className={styles.previewNotice}>
            Avant-première privée · Programme et lots en préparation.
          </p>
        </header>

        <section className={styles.live} aria-labelledby={`${id}-live-title`}>
          <div className={styles.liveHost}>
            <Image src={SEASON_FIVE_GALA.hostAvatar} width={64} height={64}
              alt="Logo de la chaîne Twitch de Gouille" className={styles.hostAvatar} unoptimized />
            <div>
              <p className={styles.eyebrow}>Le gala en direct sur Twitch</p>
              <h2 id={`${id}-live-title`}>On se retrouve chez Gouille.</h2>
              <p>Les courses sur PCM26, les réactions du peloton et des cadeaux pour les spectateurs.</p>
            </div>
            <a href={SEASON_FIVE_GALA.twitchUrl} target="_blank" rel="noopener noreferrer"
              className={styles.twitchLink}>La chaîne de Gouille <span aria-hidden="true">↗</span></a>
          </div>
          <div className={styles.liveGifts}>
            <div className={styles.liveGift}>
              <Image src="/images/equipment/products/montclair-victoire-atelier.webp"
                width={68} height={68} alt="Cuissard de cyclisme" className={styles.shortsImage} unoptimized />
              <div><h3>{GALA_S5_LIVE_REWARD.name} <span>{GALA_S5_LIVE_REWARD.bonus}</span></h3>
                <p>{GALA_S5_LIVE_REWARD.detail}</p></div>
            </div>
            <div className={styles.liveGift}>
              <BoosterIllustration />
              <div><h3>{GALA_S5_LIVE_REWARD.boosters} boosters Cyclo-Stickers</h3>
                <p>Deux pochettes pour enrichir votre collection.</p></div>
            </div>
          </div>
          <p className={styles.giftNote}>Une dotation par DS présent au live. Les modalités de présence seront précisées avant le gala.</p>
        </section>

        <section id="programme-gala-s5" className={styles.section} aria-labelledby={`${id}-program-title`}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Choisissez votre programme</p>
              <h2 id={`${id}-program-title`}>Trois courses. Votre collectif.</h2></div>
            <p>Une seule catégorie par DS · {SEASON_FIVE_GALA.minRiders} à {SEASON_FIVE_GALA.maxRiders} coureurs par épreuve</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Programme du gala">
            {programs.map((value, index) => (
              <button key={value} type="button" role="tab" id={`${id}-${value}-tab`}
                ref={(element) => { tabRefs.current[index] = element; }}
                aria-selected={program === value} aria-controls={`${id}-courses`}
                tabIndex={program === value ? 0 : -1}
                onClick={() => setProgram(value)} onKeyDown={(event) => handleTabKey(event, index)}>
                <span><strong>{value === "pro-tour" ? "Pro Tour" : "Continental"}</strong>
                  <small>{value === "pro-tour" ? "Montagne · Vallons · Pavés" : "Montagne · Vallons · Sprint"}</small></span>
                <span className={styles.tabRule}>{value === "pro-tour" ? "Sans plafond" : `${SEASON_FIVE_GALA.continentalCap} max.`}</span>
              </button>
            ))}
          </div>
          <p className={styles.programRule}>
            {program === "continental"
              ? `Continental · ${SEASON_FIVE_GALA.continentalCap} maximum dans chacune des six notes primaires natives (MON, VAL, PLA, CLM, PAV, SPR).`
              : "Pro Tour · Toutes les notes sont admises. Vos spécialistes ont rendez-vous sur trois terrains exigeants."}
            {" "}Vous pourrez changer de composition entre les épreuves.
          </p>
          <div id={`${id}-courses`} role="tabpanel" aria-labelledby={`${id}-${program}-tab`} tabIndex={0}>
            <div className={styles.courseGrid}>
              {courses.map((course) => <CourseCard key={course.id} course={course} />)}
            </div>
          </div>
          <div className={styles.registration}>
            <div><strong>Vos couleurs de saison {SEASON_FIVE_GALA.nextSeason}, en avant-première.</strong>
              <p>Les équipes s’inscriront sous leur future identité, avec leurs maillots de la saison prochaine.</p></div>
            <div><strong>Clôture des inscriptions</strong><p>{SEASON_FIVE_GALA.registrationDeadlineLabel}</p></div>
          </div>
          {registrationContext ? <SeasonFiveGalaRegistration context={registrationContext} program={program} /> : null}
        </section>

        <section id="lots-gala-s5" className={`${styles.section} ${styles.rewards}`} aria-labelledby={`${id}-rewards-title`}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Les récompenses du gala</p>
              <h2 id={`${id}-rewards-title`}>Un souvenir pour le top 10.</h2></div>
            <p>Le même barème pour chacune des six courses.</p>
          </div>
          <div className={styles.rewardTableWrap}>
            <table className={styles.rewardTable}>
              <caption className={styles.screenReader}>Récompenses proposées pour les dix premiers de chaque épreuve</caption>
              <thead><tr><th scope="col">Place</th><th scope="col">Récompenses</th></tr></thead>
              <tbody>{GALA_S5_REWARD_PROPOSAL.map((reward) => (
                <tr key={reward.places}><th scope="row">{reward.places}</th><td>{reward.detail}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className={styles.tableNote}>Chaque coureur classé dans le top 10 rapporte le lot de sa place à son équipe. Les consommables s’utiliseront au choix du DS.</p>
        </section>

        <div className={styles.rules}>
          <div><h2>Une fête hors circuit.</h2><p>Le gala se joue sur PCM26, avec des lots dédiés. Il n’affecte ni la forme, ni le moral, ni la fatigue et n’attribue aucun point UCI.</p></div>
          <div><h2>Une place pour chaque équipe.</h2><p>Si la capacité d’une course est dépassée, plusieurs groupes seront simulés. Chacun aura son classement et son top 10 récompensé.</p></div>
          <p className={styles.startlistNote}>Les six épreuves disposeront de six startlists PCM distinctes.</p>
        </div>
        <footer className={styles.footer}>Cyclo Stratège · Gala de fin de saison 5</footer>
      </div>
    </main>
  );
}

function CourseCard({ course }: { course: SeasonFiveGalaCourse }) {
  return (
    <article className={styles.course}>
      <div className={styles.courseTop}><span className={styles.terrain}>{course.profile}</span>
        <span>{course.distanceKm !== null ? `${course.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km` : "Distance à confirmer"}</span></div>
      <h3>{course.name}</h3>
      <p className={styles.courseTagline}>{course.title}</p>
      <p className={styles.courseEdition}>PCM {course.pcmEditionYear}{course.pcmStageNumber && course.pcmStageNumber > 1 ? <> · Étape {course.pcmStageNumber}</> : null}</p>
      <CourseElevation course={course} />
      <p className={styles.courseDescription}>{course.description}</p>
      <p className={styles.highlights}>{course.highlights.join(" · ")}</p>
      {course.pcmName && course.startlistFilename ? (
        <details className={styles.pcmDetails}>
          <summary>Parcours et capacité PCM</summary>
          <div><strong>{course.pcmName}</strong>
            <p>{course.nativeCapacity !== null ? `${course.nativeCapacity - 1} équipes participantes au maximum par simulation.` : "Capacité en cours de vérification."}</p>
            <code>{course.startlistFilename}</code></div>
        </details>
      ) : null}
    </article>
  );
}

function CourseElevation({ course }: { course: SeasonFiveGalaCourse }) {
  const id = useId();
  if (course.elevation.length < 2) {
    return <div className={styles.profilePending}><span aria-hidden="true">↗</span><p>Le profil PCM est en cours de vérification.</p></div>;
  }
  const start = course.elevation[0][0];
  const finish = course.elevation[course.elevation.length - 1][0];
  if (finish <= start) {
    return <div className={styles.profilePending}><p>Le profil PCM est en cours de vérification.</p></div>;
  }
  const heights = course.elevation.map((point) => point[1]);
  const minimum = Math.min(...heights);
  const maximum = Math.max(...heights);
  const range = Math.max(1, maximum - minimum);
  const points = course.elevation.map(([distance, altitude]) =>
    `${12 + ((distance - start) / (finish - start)) * 456},${119 - ((altitude - minimum) / range) * 105}`,
  ).join(" ");
  return (
    <figure className={styles.profile}>
      <div className={styles.altitudeScale}><span>Profil du parcours PCM26</span><span>{course.profile}</span></div>
      <svg viewBox="0 0 480 136" preserveAspectRatio="none" role="img" aria-label={`Profil du parcours PCM de ${course.name}`}>
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#DDC586" stopOpacity=".4" /><stop offset="1" stopColor="#DDC586" stopOpacity=".025" /></linearGradient></defs>
        <path d="M12 119H468M12 67H468M12 15H468" stroke="#FFFFFF" strokeOpacity=".07" fill="none" />
        <path d={`M12 125 L${points.replaceAll(" ", " L")} L468 125Z`} fill={`url(#${id})`} />
        <polyline points={points} fill="none" stroke="#E6CC8B" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption><span>Départ</span><span>Arrivée{course.distanceKm !== null ? ` · ${course.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km` : ""}</span></figcaption>
    </figure>
  );
}

function BoosterIllustration() {
  return <svg className={styles.boosters} viewBox="0 0 82 78" aria-hidden="true" fill="none">
    <g transform="rotate(-12 28 41)"><path d="M8 9H47V66H8Z" fill="#153D32" stroke="#D2B879" /><path d="M8 14H47M8 61H47" stroke="#D2B879" strokeDasharray="2 2" /><path d="M19 35H36M19 40H32" stroke="#D2B879" /><circle cx="27" cy="29" r="5" stroke="#D2B879" /></g>
    <g transform="rotate(11 54 40)"><path d="M33 12H72V69H33Z" fill="#23342E" stroke="#E2CD94" /><path d="M33 17H72M33 64H72" stroke="#E2CD94" strokeDasharray="2 2" /><path d="M44 40H61M44 45H57" stroke="#E2CD94" /><path d="M53 26L55 30L59 31L56 34L57 38L53 36L49 38L50 34L47 31L51 30Z" fill="#D2B879" /></g>
  </svg>;
}
