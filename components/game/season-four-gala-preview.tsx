"use client";

import Image from "next/image";
import { useId, useState } from "react";
import Link from "@/components/ui/app-link";
import { AmateurTeamJersey } from "./amateur-team-jersey";
import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import { GALA_CONSUMABLE_PROPOSAL, GALA_COURSES, GALA_PODIUM_PROPOSAL, GALA_PROGRAM_PROFILES, SEASON_FOUR_GALA, galaClubCapacity, type GalaCourse, type GalaProfile, type GalaProgram } from "@/lib/game/season-four-gala";
import styles from "./season-four-gala.module.css";
import {SeasonFourGalaExports} from "./season-four-gala-exports";
import type {GalaExportStatus} from "@/lib/game/season-four-gala";
import type { SeasonFourGalaContext } from "@/lib/game/season-four-gala-registration";
import { SeasonFourGalaRegistration } from "./season-four-gala-registration";
import { SeasonFourGalaEntries } from "./season-four-gala-entries";

const demoTeams: { name: string; director: string; rider: string; jersey: AmateurJerseyConfig }[] = [
  { name: "Vélo Club des Cimes", director: "AlpineFox", rider: "Noé Castan", jersey: { pattern: "chevron", primaryColor: "#23534C", secondaryColor: "#E9DEC1", accentColor: "#D8B656" } },
  { name: "Les Échappés du dimanche", director: "VéloPixel", rider: "Matteo Serra", jersey: { pattern: "diagonal", primaryColor: "#6B334E", secondaryColor: "#F2DDA8", accentColor: "#ED9157" } },
  { name: "Atelier du Peloton", director: "Sillage", rider: "Ilias Moreau", jersey: { pattern: "hoops", primaryColor: "#263B65", secondaryColor: "#E3EBEF", accentColor: "#90BDCE" } },
];

export function SeasonFourGalaPreview({exportStatus, context, canExport = false}: {exportStatus?:GalaExportStatus; context?:SeasonFourGalaContext; canExport?: boolean} = {}) {
  const [program, setProgram] = useState<GalaProgram>(context?.program ?? "world-tour");
  const [rewardProfile, setRewardProfile] = useState<GalaProfile>("mountain");
  const tabId = useId();
  const profiles = GALA_PROGRAM_PROFILES[program];
  const rewardCourse = GALA_COURSES[rewardProfile];
  return <div className={styles.shell}>
    <div className={styles.privateBar}><span><span aria-hidden="true">◈</span> {context ? context.unavailable ? "Inscriptions temporairement indisponibles" : context.isOpen ? "Inscriptions ouvertes · Saison 4" : "Inscriptions closes · Saison 4" : "Aperçu local · données fictives"}</span><Link href="/jeu" prefetch={false}>Retour au bureau ↗</Link></div>
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>Cyclo Stratège · Le rendez-vous de fin de saison</p>
        <h1>Le Grand <em>Gala.</em></h1>
        <p className={styles.heroLead}>Six courses. Deux programmes.<br />Une soirée pour faire briller le peloton.</p>
        <div className={styles.heroMeta}><span>SAISON 4</span><strong>6 NOVEMBRE 2026</strong><span>EN DIRECT SUR TWITCH</span></div>
        <div className={styles.heroLinks}><a className={styles.goldButton} href={context?.isOpen ? "#inscriptions-gala" : "#programme-gala"}>{context?.isOpen ? "Inscrire mon équipe ↓" : "Découvrir les courses ↓"}</a><a className={styles.textLink} href="#recompenses-gala">Les récompenses ↗</a></div>
        <p className={styles.intro}>Une fête hors circuit : aucun frais d’inscription, aucun effet sur la forme, le moral ou les blessures, et aucun point UCI. Seuls les lots du gala sont en jeu.</p>
        <p className={styles.intro}>Clôture des inscriptions : {SEASON_FOUR_GALA.registrationDeadlineLabel}.</p>
      </div>
      <div className={styles.heroSeal} aria-hidden="true"><span>GRAND GALA</span><GalaTrophy /><strong>IV</strong><span>LE PELOTON À L’HONNEUR</span></div>
    </header>

    <section className={styles.liveCard} aria-labelledby="gouille-live-title">
      <div className={styles.liveHeader}>
        <Image src={SEASON_FOUR_GALA.hostAvatar} width={70} height={70} alt="Logo de la chaîne Twitch de Gouille" className={styles.hostAvatar} />
        <div className={styles.liveCopy}><span className={styles.liveLabel}><TwitchMark /> LE LIVE DU GALA</span><h2 id="gouille-live-title">Gouille prend les commandes.</h2><p>Les six courses seront simulées en direct sur PCM26, sur sa chaîne Twitch, le vendredi 6 novembre. Horaire à venir.</p></div>
        <a href={SEASON_FOUR_GALA.twitchUrl} target="_blank" rel="noopener noreferrer" className={styles.twitchButton}>Rejoindre la chaîne ↗</a>
      </div>
      <div className={styles.liveRewards}>
        <article><Image src="/images/equipment/products/montclair-podium-atelier.webp" alt="Gants de l’édition Gala" width={62} height={62}/><div><span>Cadeau exclusif du live</span><h3>Gants · Nuit dorée <b>+1 VAL</b></h3><p>Une paire unique, à équiper sur un coureur.</p></div></article>
        <article><BoosterPacks/><div><span>Le lancement de la saison 5</span><h3>2 boosters Cyclo-Stickers</h3><p>Les premières pochettes du nouvel album.</p></div></article>
      </div>
      <p className={styles.liveGiftNote}>Pour chaque joueur présent au live, même sans podium. Une dotation par compte ; modalités de présence annoncées avant le gala.</p>
    </section>

    <section id="programme-gala" className={styles.section} aria-labelledby="programme-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>À chaque équipe son défi</p><h2 id="programme-title">Choisissez votre terrain de jeu.</h2></div><span className={styles.smallBadge}>3 courses · 7 à 8 coureurs par course</span></div>
      <div className={styles.divisionRule}>
        <p>Un seul programme pour toute l’équipe</p>
        <div><strong>Les trois courses World Tour</strong><span>OU</span><strong>Les trois courses Continentales</strong></div>
        <p>Une équipe engagée en World Tour ne peut pas s’inscrire en Continental, et inversement. Le World Tour reste ouvert aux équipes qui veulent se mesurer aux plus fortes.</p>
      </div>
      <div role="tablist" aria-label="Programme du gala" className={styles.programTabs}>
        <button id={`${tabId}-wt`} role="tab" aria-selected={program === "world-tour"} aria-controls={`${tabId}-panel`} onClick={() => setProgram("world-tour")} className={program === "world-tour" ? styles.selectedProgram : undefined}><span className={styles.programIndex}>01</span><span><strong>World Tour</strong><small>Montagne · Vallons · Pavés</small></span><span className={styles.programTag}>Sans plafond</span></button>
        <button id={`${tabId}-ct`} role="tab" aria-selected={program === "continental"} aria-controls={`${tabId}-panel`} onClick={() => setProgram("continental")} className={program === "continental" ? styles.selectedProgram : undefined}><span className={styles.programIndex}>02</span><span><strong>Continental</strong><small>Montagne · Vallons · Sprint</small></span><span className={styles.programTag}>75 max.</span></button>
      </div>
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${program === "world-tour" ? "wt" : "ct"}`} tabIndex={0}>
        <p className={styles.programNote}>{program === "world-tour" ? "Le grand défi, sans plafond de notes. Montagne, côtes à répétition et pavés : trois occasions de marquer la soirée." : "La même exigence en montagne et dans les vallons, puis une classique pour les sprinteurs. Plafond : 75 dans chacune des notes primaires natives — MON, VAL, PLA, CLM, PAV et SPR. Les bonus d’équipement sont ignorés."}</p>
        <div className={styles.raceGrid}>{profiles.map((profile, index) => <CourseCard key={`${program}-${profile}`} course={GALA_COURSES[profile]} program={program} number={index + 1} context={context} />)}</div>
      </div>
      <p className={styles.rosterRule}>7 à 8 coureurs par équipe et par épreuve. La composition peut changer d’une course à l’autre au sein du même programme.</p>
      <div className={styles.registrationNote}><span aria-hidden="true">◉</span><div><strong>Des inscriptions ouvertes, un choix éclairé.</strong><p>Les capacités PCM sont indicatives. Aucun plafond d’inscription pour l’instant : si un programme dépasse la capacité d’un parcours, l’organisation arbitrera avant le live.</p></div></div>
      {context ? <SeasonFourGalaRegistration context={context} program={program} /> : <div role="status" className={styles.previewStatus}>Démonstration locale : aucune inscription ne sera enregistrée.</div>}
    </section>

    <section id="recompenses-gala" className={styles.compactRewards} aria-labelledby="rewards-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Sur chacune des six courses</p><h2 id="rewards-title">Les gains du top 10.</h2></div><span className={styles.smallBadge}>Même dotation dans les deux programmes</span></div>
      <div className={styles.rewardPicker}><label htmlFor={`${tabId}-reward`}>Voir les bonus pour</label><select id={`${tabId}-reward`} value={rewardProfile} onChange={event => setRewardProfile(event.target.value as GalaProfile)}>{Object.values(GALA_COURSES).map(course => <option value={course.id} key={course.id}>{course.profile}</option>)}</select></div>
      <div className={styles.rewardRows}>{GALA_PODIUM_PROPOSAL.map(prize => <article key={prize.rank}>
        <strong className={styles.rewardRank}>{prize.rank === 1 ? "1er" : prize.rank+"e"}</strong><Image src={prize.image} width={38} height={38} alt=""/><div><h3>{prize.name}</h3><p>Équipement exclusif · {rewardCourse.profile}</p></div><b className={styles.bonus}>+{prize.primaryBonus} {rewardCourse.primaryLabel}</b>
      </article>)}{GALA_CONSUMABLE_PROPOSAL.map(pack=><article key={pack.places}><strong className={styles.rewardRank}>{pack.places}</strong><span className={styles.consumableMark} aria-hidden="true">✦</span><div><h3>{pack.name}</h3><p>{pack.detail}</p></div></article>)}</div>
      <p className={styles.rewardFootnote}>Chaque coureur du top 10 rapporte le lot de sa place à son équipe. Les équipements seront utilisables depuis la fiche du coureur et en préparation de course.</p>
      <div className={styles.rewardDefinitions}>
        <p><strong>Capsule technique</strong> : un objet « Perfectionnement technique » à utiliser dans l’inventaire pour ajouter définitivement +1 à une note secondaire au choix d’un coureur, dans les limites habituelles.</p>
        <p><strong>Stage d’entraînement</strong> : trois objets « Bloc haute intensité ». Chacun double la progression d’une séance collective des professionnels à 8 h. Ils s’utilisent sur trois séances successives, pas en cumul sur une seule.</p>
        <p><strong>Forme et soins</strong> : chaque dose est une « Ration énergétique » (+5 de forme, sans dépasser 100) ; chaque soin est une « Trousse de récupération » (−12 h sur une blessure raccourcissable).</p>
        <p>Les lots rejoignent l’inventaire après validation et import des résultats. Les consommables s’activent ensuite au choix du DS ; ils ne sont pas utilisés automatiquement.</p>
      </div>
    </section>
    {canExport ? <SeasonFourGalaExports status={exportStatus}/> : null}

    <footer className={styles.footer}>GALA DE LA SAISON 4 <span>06.11.2026 · EN LIVE AVEC GOUILLE</span></footer>
  </div>;
}

function CourseCard({ course, program, number, context }: { course: GalaCourse; program: GalaProgram; number: number; context?:SeasonFourGalaContext }) {
  return <article className={styles.raceCard}>
    <header><span className={styles.courseNumber}>0{number}</span><span className={styles.smallBadge}>{course.profile}</span></header>
    <p className={styles.raceTitle}>{course.title}</p><h3>{course.name}</h3><p className={styles.raceDistance}>{course.distance} <span>· {program === "world-tour" ? "World Tour" : "Continental · 75 max."}</span></p>
    <CourseProfile course={course} /><p className={styles.raceDescription}>{course.description}</p>
    <div className={styles.highlights}>{course.highlights.map(text => <span key={text}>{text}</span>)}</div>
    {context ? <><SeasonFourGalaEntries key={`${program}:${course.id}:${context.counts[program]}:${JSON.stringify(context.selections)}`} program={program} profile={course.id} count={context.counts[program]}/><p className={styles.entriesNote}>{context.isOpen ? "Les favoris seront dévoilés après la clôture des inscriptions." : "Les noms à suivre figurent avec les engagés."}</p></> : <>
      <details className={styles.courseDetails}><summary>Maillots & engagés <small>Démonstration</small><span aria-hidden="true">＋</span></summary><div className={styles.demoWarning}>Exemple visuel · 3 équipes fictives · aucune inscription réelle</div>{demoTeams.map(team => <div className={styles.teamRow} key={team.name}><AmateurTeamJersey jersey={team.jersey} teamName={team.name} className="h-12 w-12 shrink-0" /><div><strong>{team.name}</strong><small>{team.director} · composition à découvrir</small></div></div>)}</details>
      <details className={styles.courseDetails}><summary>Les favoris <small>Exemple</small><span aria-hidden="true">＋</span></summary><div className={styles.demoWarning}>Classement fictif pour prévisualiser la présentation.</div>{demoTeams.map((team,index) => <div className={styles.favoriteRow} key={team.rider}><span>0{index+1}</span><div><strong>{team.rider}</strong><small>{team.name}</small></div><b>{program === "world-tour" ? 83-index*2 : 75-index} {course.primaryLabel}</b></div>)}</details>
    </>}
    <details className={styles.courseDetails}><summary>Parcours & capacité PCM <span aria-hidden="true">＋</span></summary><div className={styles.capacityDetails}><strong>{galaClubCapacity(course)} clubs + 1 équipe de simulation</strong><p>Capacité PCM : {course.nativeCapacity} équipes au total. Aucun blocage à l’inscription ; un dépassement demandera un arbitrage avant la simulation.</p><code>{course.filename}</code>{course.sourceUrl ? <a href={course.sourceUrl} target="_blank" rel="noopener noreferrer">En savoir plus sur le parcours ↗</a> : null}</div></details>
  </article>;
}

function CourseProfile({course}: {course: GalaCourse}) {
  const id=useId();
  const line=course.elevation.map((height,index)=>`${(course.elevationPositions?.[index] ?? index/(course.elevation.length-1))*480},${112-height}`).join(' ');
  return <figure className={styles.profile}><svg viewBox="0 0 480 120" role="img" aria-label={`Profil schématique : ${course.profile}`} preserveAspectRatio="none"><defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#EACA7C" stopOpacity=".35"/><stop offset="1" stopColor="#EACA7C" stopOpacity=".02"/></linearGradient></defs><path d={`M0 120 L${line.replaceAll(' ',' L')} L480 120Z`} fill={`url(#${id})`}/><polyline points={line} stroke="#EACA7C" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke"/>{course.id==='cobbles'?<path d="M160 116H200M220 116H265M290 116H335M355 116H395M415 116H455" stroke="#B0916A" strokeWidth="5"/>:null}</svg><figcaption>Profil schématique <span>{course.profile}</span></figcaption></figure>;
}

export function GalaTrophy() { return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M29 18H71V37C71 54 61 65 50 65S29 54 29 37V18Z" stroke="currentColor" strokeWidth="2"/><path d="M29 24H16V32C16 46 24 50 35 50M71 24H84V32C84 46 76 50 65 50M50 65V79M35 84H65M39 79H61L65 84H35L39 79Z" stroke="currentColor" strokeWidth="2"/><path d="M50 28L53 37L63 37L55 43L58 53L50 47L42 53L45 43L37 37L47 37L50 28Z" fill="currentColor"/><path d="M19 61Q22 75 36 79M81 61Q78 75 64 79" stroke="currentColor" strokeWidth="2"/></svg>; }
function TwitchMark() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 2L2 6V20H8V23L11 20H16L22 14V2H4ZM20 13L16 17H11L8 20V17H5V4H20V13ZM16 7H18V12H16V7ZM11 7H13V12H11V7Z"/></svg>; }
function BoosterPacks() { return <svg className={styles.boosterArt} viewBox="0 0 200 145" role="img" aria-label="Deux boosters de l’album Cyclo-Stickers"><g transform="rotate(-12 75 75)"><path d="M33 17H108V126H33Z" fill="#26394A" stroke="#C7A45B"/><path d="M33 22H108M33 121H108" stroke="#C7A45B" strokeDasharray="3 2"/><text x="70" y="56" textAnchor="middle" fill="#E8CC8A" fontSize="11" fontWeight="900">CYCLO</text><text x="70" y="72" textAnchor="middle" fill="#FFF7DE" fontSize="10" fontWeight="900">STICKERS</text><text x="70" y="100" textAnchor="middle" fill="#E8CC8A" fontSize="25" fontWeight="900">S5</text></g><g transform="rotate(9 126 80)"><path d="M87 20H162V129H87Z" fill="#225348" stroke="#E1BE6C"/><path d="M87 25H162M87 124H162" stroke="#E1BE6C" strokeDasharray="3 2"/><text x="124" y="59" textAnchor="middle" fill="#E8CC8A" fontSize="11" fontWeight="900">CYCLO</text><text x="124" y="75" textAnchor="middle" fill="#FFF7DE" fontSize="10" fontWeight="900">STICKERS</text><text x="124" y="103" textAnchor="middle" fill="#E8CC8A" fontSize="25" fontWeight="900">S5</text></g></svg>; }
