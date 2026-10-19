"use client";

import { ALBUM_ACHIEVEMENTS, getAlbumAchievementProgress, type AlbumPilotAction, type AlbumPilotState, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { CollectorAlbumTrophy } from "./collector-album-artwork";
import styles from "./collector-album-retro.module.css";

const money=(amount:number)=>`${amount.toLocaleString("fr-FR")} €`;
export function CollectorAlbumAchievements({state,snapshot,ready,onAction}: {state:AlbumPilotState;snapshot:CollectorAlbumSnapshot;ready:boolean;onAction:(action:AlbumPilotAction,text:string)=>void}) {
  const earned=ALBUM_ACHIEVEMENTS.filter(a=>state.claimedAchievements.includes(a.id));
  const completed=state.pasted.length===snapshot.cards.length;
  return <section className={styles.achievementDesk}>
    <header className={styles.sectionHeading}><p>LE LIVRE D’OR · SAISON {snapshot.collectionSeason}</p><h2>Les petites fiertés font les grandes collections.</h2><span>Dix-neuf rendez-vous, des premiers collages à l’album complet. Les doublons ne font pas avancer la complétude.</span></header>
    <div className={styles.trophyCabinet}><div className={styles.trophyPlinth}><CollectorAlbumTrophy season={snapshot.collectionSeason} /><span>{completed ? "Album complet · essai" : "Le trophée de l’album complet"}</span></div><div><p className={styles.redCaption}>LA PIÈCE MAÎTRESSE DE LA SAISON {snapshot.collectionSeason}</p><h3>Mémoire du peloton</h3><p>Les cinquante cartes à leur place, du bronze aux cinq légendes en or. Un trophée numéroté pour garder une trace de chaque saison complétée.</p><strong className={styles.grandReward}>250 000 € <span>+ 1 000 XP · + 100 réputation</span></strong><small>Prime du succès final, en plus des paliers et chapitres précédents.</small></div></div>
    <div className={styles.testBanner}><strong>Récompenses simulées dans cet aperçu.</strong> Les gains ci-dessous ne sont pas versés au compte et aucun trophée n’est ajouté à la galerie publique. Tu peux tester les paliers accessibles sans modifier ton équipe.</div>
    <div className={styles.earned}><span>{earned.length} / {ALBUM_ACHIEVEMENTS.length} succès testés</span><strong>{money(earned.reduce((sum,a)=>sum+a.cash,0))}</strong><span>{earned.reduce((sum,a)=>sum+a.xp,0)} XP · {earned.reduce((sum,a)=>sum+a.reputation,0)} réputation simulés</span></div>
    <div className={styles.achievementGrid}>{ALBUM_ACHIEVEMENTS.map(achievement=>{
      const progress=getAlbumAchievementProgress(achievement,state,snapshot.cards);
      const claimed=state.claimedAchievements.includes(achievement.id);
      const unlocked=progress.value>=progress.target;
      return <article className={`${styles.achievement} ${claimed ? styles.claimed : ""}`} key={achievement.id}>
        <div className={styles.achievementTop}><span>{achievement.trophy ? "GRAND TROPHÉE" : achievement.kind === "profile" ? "CHAPITRE" : achievement.kind === "rarity" ? "FINITION" : "SOUVENIR"}</span><b>{Math.min(progress.value,progress.target)} / {progress.target}</b></div>
        <h3>{achievement.name}</h3><p>{achievement.description}</p><progress aria-label={achievement.name} max={progress.target} value={Math.min(progress.target,progress.value)} />
        <div className={styles.rewardLine}><strong>{money(achievement.cash)}</strong><span>+ {achievement.xp} XP{achievement.reputation ? ` · + ${achievement.reputation} réputation` : ""}</span></div>
        <button type="button" disabled={!ready || !unlocked || claimed} onClick={()=>onAction({type:"claim-achievement",id:achievement.id},`Succès testé : ${achievement.name}. Aucun gain réel n’a été versé.`)}>{claimed ? "Gain simulé · déjà testé" : unlocked ? "Tester la récompense" : "À compléter"}</button>
      </article>;
    })}</div>
  </section>;
}
