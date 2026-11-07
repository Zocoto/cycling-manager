import { useId } from "react";
import type { GalaCourse } from "@/lib/game/season-four-gala";
import styles from "./season-four-gala.module.css";

export function SeasonFourGalaCourseProfile({ course }: { course: GalaCourse }) {
  const id = useId();
  const line = course.elevation.map((height, index) => {
    const position = course.elevationPositions?.[index] ?? index / (course.elevation.length - 1);
    return `${position * 480},${112 - height}`;
  }).join(" ");

  return (
    <figure className={styles.profile}>
      <svg viewBox="0 0 480 120" role="img" aria-label={`Profil schématique : ${course.profile}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#EACA7C" stopOpacity=".35" />
            <stop offset="1" stopColor="#EACA7C" stopOpacity=".02" />
          </linearGradient>
        </defs>
        <path d={`M0 120 L${line.replaceAll(" ", " L")} L480 120Z`} fill={`url(#${id})`} />
        <polyline points={line} stroke="#EACA7C" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
        {course.id === "cobbles" ? (
          <path d="M160 116H200M220 116H265M290 116H335M355 116H395M415 116H455" stroke="#B0916A" strokeWidth="5" />
        ) : null}
      </svg>
      <figcaption>Profil schématique <span>{course.profile}</span></figcaption>
    </figure>
  );
}
