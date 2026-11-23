"use client";

import Image from "next/image";
import { useId, useState } from "react";
import Link from "@/components/ui/app-link";
import { GALA_S5_COURSES, type SeasonFiveGalaProgram } from "@/lib/game/season-five-gala";
import type { SeasonFiveGalaPublicStartlists as PublicStartlists } from "@/lib/game/season-five-gala-public-startlists";
import { AmateurTeamJersey } from "./amateur-team-jersey";
import styles from "./season-five-gala-public-startlists.module.css";

export function SeasonFiveGalaPublicStartlists({ startlists, registeredProgram, onRefresh }: {
  startlists: PublicStartlists | null;
  registeredProgram: SeasonFiveGalaProgram | null;
  onRefresh?: () => void;
}) {
  const id = useId();
  const firstCourse = startlists?.courses.find(course => course.program === registeredProgram && course.teams.length)
    ?? startlists?.courses.find(course => course.program === registeredProgram)
    ?? startlists?.courses.find(course => course.teams.length)
    ?? startlists?.courses[0];
  const [expanded, setExpanded] = useState(() => new Set(firstCourse ? [firstCourse.eventKey] : []));
  const programOrder: SeasonFiveGalaProgram[] = registeredProgram === "continental"
    ? ["continental", "pro-tour"] : ["pro-tour", "continental"];
  const teamCount = new Set(startlists?.courses.flatMap(course => course.teams.map(team => team.teamId)) ?? []).size;

  return <section className={styles.board} id="startlists-gala-s5" aria-labelledby={`${id}-title`}>
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>Les maillots et les engagés</p><h2 id={`${id}-title`}>Startlists du gala</h2></div>
      {startlists ? <p>{teamCount} équipe(s) inscrite(s)</p> : null}
    </div>
    <p className={styles.intro}>Retrouvez les équipes inscrites et leurs coureurs pour chacune des six épreuves.</p>
    {!startlists ? <div className={styles.unavailable} role="alert">
      <p>Les startlists sont temporairement indisponibles. Vos inscriptions ne sont pas modifiées.</p>
      {onRefresh ? <button type="button" onClick={onRefresh}>Réessayer</button> : null}
    </div> : <div className={styles.programs}>
      {programOrder.map(program => <div key={program} className={styles.program}>
        <div className={styles.programHeading}><h3>{program === "pro-tour" ? "Pro Tour" : "Continental"}</h3>
          {registeredProgram === program ? <span>Votre programme</span> : null}</div>
        {GALA_S5_COURSES.filter(course => course.program === program).map(course => {
          const teams = startlists.courses.find(value => value.eventKey === course.id)?.teams ?? [];
          const isOpen = expanded.has(course.id);
          return <details key={course.id} className={styles.course} open={isOpen} data-gala-public-course={course.id}
            onToggle={event => {
              const open = event.currentTarget.open;
              setExpanded(previous => {
                const next = new Set(previous);
                if (open) next.add(course.id); else next.delete(course.id);
                return next;
              });
            }}>
            <summary><span><strong>{course.name}</strong><small>{course.profile}</small></span>
              <span className={styles.count}>{teams.length} équipe(s)<span aria-hidden="true">⌄</span></span></summary>
            {isOpen ? teams.length ? <ul className={styles.teams} aria-label={`Équipes inscrites : ${course.name}`}>
              {teams.map(team => {
                const name = team.futureName || team.name;
                return <li key={team.teamId} className={styles.team}>
                  <div className={styles.teamHeading}>
                    <Link href={`/jeu/equipes/${team.teamId}`} prefetch={false} className={styles.jersey} aria-label={`Voir l’équipe ${name}`}>
                      {team.jersey.kind === "sponsor"
                        ? <Image src={team.jersey.imagePath} alt="" width={48} height={54} className={styles.jerseyArtwork} unoptimized />
                        : <AmateurTeamJersey jersey={team.jersey.jersey} teamName={name} className={styles.jerseyArtwork} />}
                    </Link>
                    <div><Link href={`/jeu/equipes/${team.teamId}`} prefetch={false} className={styles.teamName}>{name}</Link>
                      <small>{team.riders.length} coureurs{team.identityReady ? " · Couleurs de saison 6" : " · Identité S6 à confirmer"}</small></div>
                  </div>
                  <ol className={styles.roster} aria-label={`Coureurs de ${name}`}>
                    {team.riders.map(rider => <li key={rider.riderId}>
                      <Link href={`/jeu/coureurs/${rider.riderId}`} prefetch={false}>{rider.firstName} {rider.lastName}</Link>
                    </li>)}
                  </ol>
                </li>;
              })}
            </ul> : <p className={styles.empty}>Aucune équipe inscrite pour cette épreuve pour le moment.</p> : null}
          </details>;
        })}
      </div>)}
    </div>}
  </section>;
}
