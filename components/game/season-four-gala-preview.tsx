"use client";

import Image from "next/image";
import { useId, useState } from "react";
import Link from "@/components/ui/app-link";
import { AmateurTeamJersey } from "./amateur-team-jersey";
import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import { GALA_CONSUMABLE_PROPOSAL, GALA_COURSES, GALA_PODIUM_PROPOSAL, GALA_PROGRAM_PROFILES, SEASON_FOUR_GALA, galaClubCapacity, type GalaCourse, type GalaProfile, type GalaProgram } from "@/lib/game/season-four-gala";
import styles from "./season-four-gala.module.css";

const demoTeams: { name: string; director: string; rider: string; jersey: AmateurJerseyConfig }[] = [
  { name: "Vélo Club des Cimes", director: "AlpineFox", rider: "Noé Castan", jersey: { pattern: "chevron", primaryColor: "#23534C", secondaryColor: "#E9DEC1", accentColor: "#D8B656" } },
  { name: "Les Échappés du dimanche", director: "VéloPixel", rider: "Matteo Serra", jersey: { pattern: "diagonal", primaryColor: "#6B334E", secondaryColor: "#F2DDA8", accentColor: "#ED9157" } },
  { name: "Atelier du Peloton", director: "Sillage", rider: "Ilias Moreau", jersey: { pattern: "hoops", primaryColor: "#263B65", secondaryColor: "#E3EBEF", accentColor: "#90BDCE" } },
];

export function SeasonFourGalaPreview() {
  const [program, setProgram] = useState<GalaProgram>("world-tour");
  const [rewardProfile, setRewardProfile] = useState<GalaProfile>("mountain");
  const tabId = useId();
  const profiles = GALA_PROGRAM_PROFILES[program];
  const rewardCourse = GALA_COURSES[rewardProfile];
  return <div className={styles.shell}>
    <div className={styles.privateBar}><span><span aria-hidden="true">◈</span> Aperçu privé · Zocoto</span><Link href="/jeu" prefetch={false}>Retour au bureau ↗</Link></div>
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>Cyclo Stratège · Le rendez-vous de fin de saison</p>
        <h1>Le Grand <em>Gala.</em></h1>
        <p className={styles.heroLead}>Six courses. Deux programmes.<br />Une soirée pour faire briller le peloton.</p>
        <div className={styles.heroMeta}><span>SAISON 4</span><strong>6 NOVEMBRE 2026</strong><span>EN DIRECT SUR TWITCH</span></div>
        <div className={styles.heroLinks}><a className={styles.goldButton} href="#programme-gala">Découvrir les courses ↓</a><a className={styles.textLink} href="#recompenses-gala">Les récompenses ↗</a></div>
      </div>
      <div className={styles.heroSeal} aria-hidden="true"><span>GRAND GALA</span><GalaTrophy /><strong>IV</strong><span>LE PELOTON À L’HONNEUR</span></div>
    </header>

    <a href={SEASON_FOUR_GALA.twitchUrl} target="_blank" rel="noopener noreferrer" className={styles.liveCard}>
      <Image src={SEASON_FOUR_GALA.hostAvatar} width={70} height={70} alt="Logo de la chaîne Twitch de Gouille" className={styles.hostAvatar} />
      <div className={styles.liveCopy}><span className={styles.liveLabel}><TwitchMark /> LE LIVE DU GALA</span><h2>Gouille prend les commandes.</h2><p>Les six courses seront simulées en direct sur PCM26, sur sa chaîne Twitch, le vendredi 6 novembre. Horaire à venir.</p></div>
      <span className={styles.twitchButton}>Rejoindre la chaîne <span aria-hidden="true">↗</span></span>
    </a>

    <section id="programme-gala" className={styles.section} aria-labelledby="programme-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>À chaque équipe son défi</p><h2 id="programme-title">Choisissez votre terrain de jeu.</h2></div><span className={styles.smallBadge}>1 programme = 3 courses</span></div>
      <p className={styles.intro}>Votre équipe participe aux trois courses World Tour <strong>ou</strong> aux trois courses Continentales. Les deux programmes sont exclusifs ; le World Tour reste ouvert aux équipes qui veulent se mesurer aux plus fortes.</p>
      <div role="tablist" aria-label="Programme du gala" className={styles.programTabs}>
        <button id={`${tabId}-wt`} role="tab" aria-selected={program === "world-tour"} aria-controls={`${tabId}-panel`} onClick={() => setProgram("world-tour")} className={program === "world-tour" ? styles.selectedProgram : undefined}><span className={styles.programIndex}>01</span><span><strong>World Tour</strong><small>Montagne · Vallons · Pavés</small></span><span className={styles.programTag}>Sans plafond</span></button>
        <button id={`${tabId}-ct`} role="tab" aria-selected={program === "continental"} aria-controls={`${tabId}-panel`} onClick={() => setProgram("continental")} className={program === "continental" ? styles.selectedProgram : undefined}><span className={styles.programIndex}>02</span><span><strong>Continental</strong><small>Montagne · Vallons · Sprint</small></span><span className={styles.programTag}>75 max.</span></button>
      </div>
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${program === "world-tour" ? "wt" : "ct"}`} tabIndex={0}>
        <p className={styles.programNote}>{program === "world-tour" ? "Le grand défi, sans plafond de notes. Montagne, côtes à répétition et pavés : trois occasions de marquer la soirée." : "La même exigence en montagne et dans les vallons, puis une classique pour les sprinteurs. Plafond : 75 dans chacune des notes primaires — MON, VAL, PLA, CLM, PAV et SPR."}</p>
        <div className={styles.raceGrid}>{profiles.map((profile, index) => <CourseCard key={`${program}-${profile}`} course={GALA_COURSES[profile]} program={program} number={index + 1} />)}</div>
      </div>
      <div className={styles.registrationNote}><span aria-hidden="true">◉</span><div><strong>Des inscriptions ouvertes, un choix éclairé.</strong><p>Les capacités PCM sont indicatives. Aucun plafond d’inscription pour l’instant : si un programme dépasse la capacité d’un parcours, l’organisation arbitrera avant le live.</p></div></div>
      <div role="status" className={styles.previewStatus}>Programme prévisualisé : <strong>{program === "world-tour" ? "World Tour" : "Continental"}</strong>. Ce premier jet ne réserve aucune place.</div>
    </section>

    <section id="recompenses-gala" className={styles.section} aria-labelledby="rewards-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Sur chacune des six courses</p><h2 id="rewards-title">Le podium s’habille d’or.</h2></div><span className={styles.smallBadge}>Top 10 récompensé</span></div>
      <div className={styles.rewardPicker}><label htmlFor={`${tabId}-reward`}>Voir les bonus pour</label><select id={`${tabId}-reward`} value={rewardProfile} onChange={event => setRewardProfile(event.target.value as GalaProfile)}>{Object.values(GALA_COURSES).map(course => <option value={course.id} key={course.id}>{course.profile}</option>)}</select><span>Même dotation en World Tour et en Continental</span></div>
      <div className={styles.podiumGrid}>{GALA_PODIUM_PROPOSAL.map(prize => <article key={prize.rank} className={styles.prizeCard} data-first={prize.rank === 1}>
        <span className={styles.prizePlace}>{prize.rank === 1 ? "1re place" : `${prize.rank}e place`}</span><Image src={prize.image} width={160} height={130} sizes="160px" alt={prize.name} className={styles.prizeImage} /><h3>{prize.name}</h3><span className={styles.bonus}>+{prize.primaryBonus} {rewardCourse.primaryLabel}</span><p>Édition Gala S4 · {rewardCourse.profile}</p>
      </article>)}</div>
      <div className={styles.consumables}>{GALA_CONSUMABLE_PROPOSAL.map(pack => <article key={pack.places}><span>{pack.places}</span><div><h3>{pack.name}</h3><p>{pack.detail}</p></div><span aria-hidden="true">✦</span></article>)}</div>
      <p className={styles.rewardFootnote}>Les lots reviennent à l’équipe de chaque coureur classé. Équipements prévus pour être utilisables sur la fiche du coureur et dans la préparation de course. Dotation proposée pour validation.</p>
    </section>

    <section className={styles.liveGifts} aria-labelledby="live-gifts-title">
      <div className={styles.giftIntro}><p className={styles.eyebrow}>Le rendez-vous compte autant que le résultat</p><h2 id="live-gifts-title">Dans le live,<br /><em>tout le monde gagne.</em></h2><p>Chaque joueur présent au live recevra ces cadeaux, même sans podium. Une seule dotation par compte joueur ; les modalités de présence seront annoncées avant le gala.</p></div>
      <article className={styles.glovesGift}><span className={styles.smallBadge}>Édition exclusive du live</span><Image src="/images/equipment/products/montclair-podium-atelier.webp" alt="Aperçu de gants pour l’édition Gala" width={150} height={120} /><h3>Gants · Nuit dorée</h3><span className={styles.bonus}>+1 PLA</span><p>Un bonus dans une note primaire, utilisable sur tous les profils. Visuel et bonus proposés.</p></article>
      <article className={styles.boostersGift}><span className={styles.smallBadge}>L’avant-première de la saison 5</span><BoosterPacks /><h3>2 boosters Cyclo-Stickers</h3><p>Pour inaugurer le nouvel album en saison 5. Deux pochettes, les premières surprises de votre collection.</p></article>
    </section>

    <details className={styles.organizerNotes}><summary>Les derniers points à caler ensemble <span aria-hidden="true">＋</span></summary><ul><li>Horaire du live, clôture des inscriptions et taille des compositions à confirmer.</li><li>Continental : proposition d’éligibilité à 75 maximum dans toutes les notes primaires, bonus d’équipement inclus. À trancher avant l’ouverture : éligibilité ou plafonnement des notes dans PCM.</li><li>Parcours repérés dans le pack PCM local ; contrôle en jeu et export des six courses à effectuer après validation. Les profils dessinés ici sont schématiques.</li><li>Consommables proposés : une dose de forme apporte +5 de forme ; un soin retire 12 heures à une blessure raccourcissable. Le circuit de distribution sera branché après validation.</li><li>Les équipes, coureurs et favoris de démonstration ne correspondent à aucune inscription réelle.</li></ul></details>
    <footer className={styles.footer}>GALA DE LA SAISON 4 <span>06.11.2026 · EN LIVE AVEC GOUILLE</span></footer>
  </div>;
}

function CourseCard({ course, program, number }: { course: GalaCourse; program: GalaProgram; number: number }) {
  return <article className={styles.raceCard}>
    <header><span className={styles.courseNumber}>0{number}</span><span className={styles.smallBadge}>{course.profile}</span></header>
    <p className={styles.raceTitle}>{course.title}</p><h3>{course.name}</h3><p className={styles.raceDistance}>{course.distance} <span>· {program === "world-tour" ? "World Tour" : "Continental · 75 max."}</span></p>
    <CourseProfile course={course} /><p className={styles.raceDescription}>{course.description}</p>
    <div className={styles.highlights}>{course.highlights.map(text => <span key={text}>{text}</span>)}</div>
    <details className={styles.courseDetails}><summary>Maillots & engagés <small>Démonstration</small><span aria-hidden="true">＋</span></summary><div className={styles.demoWarning}>Exemple visuel · 3 équipes fictives · aucune inscription réelle</div>{demoTeams.map(team => <div className={styles.teamRow} key={team.name}><AmateurTeamJersey jersey={team.jersey} teamName={team.name} className="h-12 w-12 shrink-0" /><div><strong>{team.name}</strong><small>{team.director} · composition à découvrir</small></div></div>)}</details>
    <details className={styles.courseDetails}><summary>Les favoris <small>Exemple</small><span aria-hidden="true">＋</span></summary><div className={styles.demoWarning}>Classement fictif pour prévisualiser la présentation.</div>{demoTeams.map((team,index) => <div className={styles.favoriteRow} key={team.rider}><span>0{index+1}</span><div><strong>{team.rider}</strong><small>{team.name}</small></div><b>{program === "world-tour" ? 83-index*2 : 75-index} {course.primaryLabel}</b></div>)}</details>
    <details className={styles.courseDetails}><summary>Parcours & capacité PCM <span aria-hidden="true">＋</span></summary><div className={styles.capacityDetails}><strong>{course.nativeCapacity} équipes dans la base source</strong><p>Soit {galaClubCapacity(course)} clubs si une équipe spectatrice est réservée. Capacité indicative, sans blocage des inscriptions.</p><code>{course.filename}</code>{course.sourceUrl ? <a href={course.sourceUrl} target="_blank" rel="noopener noreferrer">En savoir plus sur le parcours ↗</a> : null}</div></details>
  </article>;
}

function CourseProfile({course}: {course: GalaCourse}) {
  const id=useId();
  const line=course.elevation.map((height,index)=>`${index*480/(course.elevation.length-1)},${112-height}`).join(' ');
  return <figure className={styles.profile}><svg viewBox="0 0 480 120" role="img" aria-label={`Profil schématique : ${course.profile}`} preserveAspectRatio="none"><defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#EACA7C" stopOpacity=".35"/><stop offset="1" stopColor="#EACA7C" stopOpacity=".02"/></linearGradient></defs><path d={`M0 120 L${line.replaceAll(' ',' L')} L480 120Z`} fill={`url(#${id})`}/><polyline points={line} stroke="#EACA7C" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke"/>{course.id==='cobbles'?<path d="M160 116H200M220 116H265M290 116H335M355 116H395M415 116H455" stroke="#B0916A" strokeWidth="5"/>:null}</svg><figcaption>Profil schématique <span>{course.profile}</span></figcaption></figure>;
}

export function GalaTrophy() { return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M29 18H71V37C71 54 61 65 50 65S29 54 29 37V18Z" stroke="currentColor" strokeWidth="2"/><path d="M29 24H16V32C16 46 24 50 35 50M71 24H84V32C84 46 76 50 65 50M50 65V79M35 84H65M39 79H61L65 84H35L39 79Z" stroke="currentColor" strokeWidth="2"/><path d="M50 28L53 37L63 37L55 43L58 53L50 47L42 53L45 43L37 37L47 37L50 28Z" fill="currentColor"/><path d="M19 61Q22 75 36 79M81 61Q78 75 64 79" stroke="currentColor" strokeWidth="2"/></svg>; }
function TwitchMark() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 2L2 6V20H8V23L11 20H16L22 14V2H4ZM20 13L16 17H11L8 20V17H5V4H20V13ZM16 7H18V12H16V7ZM11 7H13V12H11V7Z"/></svg>; }
function BoosterPacks() { return <svg className={styles.boosterArt} viewBox="0 0 200 145" role="img" aria-label="Deux boosters de l’album Cyclo-Stickers"><g transform="rotate(-12 75 75)"><path d="M33 17H108V126H33Z" fill="#26394A" stroke="#C7A45B"/><path d="M33 22H108M33 121H108" stroke="#C7A45B" strokeDasharray="3 2"/><text x="70" y="56" textAnchor="middle" fill="#E8CC8A" fontSize="11" fontWeight="900">CYCLO</text><text x="70" y="72" textAnchor="middle" fill="#FFF7DE" fontSize="10" fontWeight="900">STICKERS</text><text x="70" y="100" textAnchor="middle" fill="#E8CC8A" fontSize="25" fontWeight="900">S5</text></g><g transform="rotate(9 126 80)"><path d="M87 20H162V129H87Z" fill="#225348" stroke="#E1BE6C"/><path d="M87 25H162M87 124H162" stroke="#E1BE6C" strokeDasharray="3 2"/><text x="124" y="59" textAnchor="middle" fill="#E8CC8A" fontSize="11" fontWeight="900">CYCLO</text><text x="124" y="75" textAnchor="middle" fill="#FFF7DE" fontSize="10" fontWeight="900">STICKERS</text><text x="124" y="103" textAnchor="middle" fill="#E8CC8A" fontSize="25" fontWeight="900">S5</text></g></svg>; }
