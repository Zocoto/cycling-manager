import type { ReactNode } from "react";

import Link from "@/components/ui/app-link";
import { PotentialStars } from "@/components/game/potential-stars";
import { RiderAvatar } from "@/components/game/rider-avatar";
import {
  buildComparableRiderOverall,
  buildComparableRiderRatings,
  compareRiderValues,
  type ComparableRiderValue,
  type RiderComparisonWinner,
} from "@/lib/game/rider-comparison";
import { getRiderExperience } from "@/lib/game/rider-experience";
import {
  createRadarPoints,
  getRiderSportingProfile,
  RIDER_RATING_AXES,
  serializeRadarPoints,
} from "@/lib/game/rider-profile";
import { formatScoutedPotentialValue } from "@/lib/game/transfer-scouting";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type { PublicRiderProfile } from "@/services/public-rider-profile";

const BLUE = "#367FD3";
const BLUE_SOFT = "#EAF4FF";
const GREEN = "#238B69";
const GREEN_SOFT = "#E5F5EE";
const RED = "#D44545";
const RADAR_CENTER = 150;
const RADAR_RADIUS = 94;
const experienceFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

export function RiderComparisonView({
  left,
  right,
  leftJersey,
  rightJersey,
}: {
  left: PublicRiderProfile;
  right: PublicRiderProfile;
  leftJersey: RiderJerseyAppearance;
  rightJersey: RiderJerseyAppearance;
}) {
  const leftName = `${left.firstName} ${left.lastName}`.trim();
  const rightName = `${right.firstName} ${right.lastName}`.trim();
  const leftRatings = buildComparableRiderRatings(left);
  const rightRatings = buildComparableRiderRatings(right);
  const leftOverall = buildComparableRiderOverall(left);
  const rightOverall = buildComparableRiderOverall(right);
  const leftExperience = getRiderExperience(left.careerRaceDays);
  const rightExperience = getRiderExperience(right.careerRaceDays);
  const usesScoutingEstimate =
    Object.values(leftRatings).some((rating) => rating.estimated) ||
    Object.values(rightRatings).some((rating) => rating.estimated);

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="comparison-riders-title"
        className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_22px_60px_rgba(19,60,46,0.12)]"
      >
        <div className="border-b border-[#315B3E]/10 bg-[#F7FAF9] px-5 py-5 text-center sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
            Face-à-face sportif
          </p>
          <h1
            id="comparison-riders-title"
            className="mt-2 text-2xl font-black text-[#183F37] sm:text-3xl"
          >
            Comparaison de coureurs
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#60756E]">
            Notes naturelles, profil et expérience uniquement. Contrats,
            matériel, transferts et historique ne sont pas inclus.
          </p>
        </div>

        <div className="grid gap-0 lg:grid-cols-2">
          <RiderIdentityCard
            profile={left}
            jersey={leftJersey}
            name={leftName}
            color={BLUE}
            softColor={BLUE_SOFT}
            label="Stats bleues"
          />
          <RiderIdentityCard
            profile={right}
            jersey={rightJersey}
            name={rightName}
            color={GREEN}
            softColor={GREEN_SOFT}
            label="Stats vertes"
            className="border-t border-[#315B3E]/10 lg:border-l lg:border-t-0"
          />
        </div>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
            Patatoïdes superposés
          </p>
          <h2 className="mt-2 text-xl font-black text-[#183F37]">
            Forme des profils
          </h2>
          <div className="mt-5">
            <ComparisonRadar
              leftName={leftName}
              rightName={rightName}
              leftValues={RIDER_RATING_AXES.map(
                (axis) => leftRatings[axis.key].plotValue,
              )}
              rightValues={RIDER_RATING_AXES.map(
                (axis) => rightRatings[axis.key].plotValue,
              )}
            />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs font-black text-[#48635B]">
            <LegendDot color={BLUE} label={leftName} />
            <LegendDot color={GREEN} label={rightName} />
          </div>
          {usesScoutingEstimate ? (
            <p className="mt-4 rounded-xl bg-[#FFF8DD] px-4 py-3 text-xs font-semibold leading-5 text-[#7A6119]">
              Les fourchettes du rapport de scouting sont tracées à leur valeur
              centrale. Les notes « ? » ne sont pas tracées et ne désignent
              jamais un vainqueur.
            </p>
          ) : null}
        </div>

        <div className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
            Notes côte à côte
          </p>
          <h2 className="mt-2 text-xl font-black text-[#183F37]">
            Comparatif statistique
          </h2>
          <div className="mt-5 space-y-2">
            {RIDER_RATING_AXES.map((axis) => (
              <StatComparisonRow
                key={axis.key}
                label={axis.label}
                shortLabel={axis.shortLabel}
                left={leftRatings[axis.key]}
                right={rightRatings[axis.key]}
                leftName={leftName}
                rightName={rightName}
                primary={axis.importance === "primary"}
              />
            ))}
            <StatComparisonRow
              label="Moyenne"
              shortLabel="MOY"
              left={leftOverall}
              right={rightOverall}
              leftName={leftName}
              rightName={rightName}
              primary
            />
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#60756E]">
            <span className="text-lg font-black text-[#D44545]" aria-hidden="true">
              ← →
            </span>
            La flèche rouge pointe vers la meilleure valeur. Une fourchette qui
            se chevauche reste indéterminée.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
          Repères complémentaires
        </p>
        <h2 className="mt-2 text-xl font-black text-[#183F37]">
          Identité et expérience
        </h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#315B3E]/10">
          <ComparisonDataRow
            label="Nationalité"
            left={
              <CountryValue code={left.country.code} name={left.country.name} />
            }
            right={
              <CountryValue
                code={right.country.code}
                name={right.country.name}
              />
            }
          />
          <ComparisonDataRow
            label="Âge"
            left={left.age === null ? "Non disponible" : `${left.age} ans`}
            right={right.age === null ? "Non disponible" : `${right.age} ans`}
          />
          <ComparisonDataRow
            label="Équipe actuelle"
            left={left.currentTeam?.displayName ?? "Sans équipe"}
            right={right.currentTeam?.displayName ?? "Sans équipe"}
          />
          <ComparisonDataRow
            label="Profil"
            left={
              left.ratings
                ? getRiderSportingProfile(left.ratings)
                : "Scouting partiel"
            }
            right={
              right.ratings
                ? getRiderSportingProfile(right.ratings)
                : "Scouting partiel"
            }
          />
          <ComparisonDataRow
            label="Expérience de course"
            left={`${leftExperience.level} · ${experienceFormatter.format(leftExperience.score)}/100`}
            right={`${rightExperience.level} · ${experienceFormatter.format(rightExperience.score)}/100`}
          />
          <ComparisonDataRow
            label="Jours de course"
            left={String(leftExperience.raceDays)}
            right={String(rightExperience.raceDays)}
          />
          <ComparisonDataRow
            label="Forme actuelle"
            left={`${Math.round(left.condition.form)}/100`}
            right={`${Math.round(right.condition.form)}/100`}
          />
          <ComparisonDataRow
            label="Potentiel"
            left={<PotentialValue profile={left} />}
            right={<PotentialValue profile={right} />}
          />
        </div>
      </section>
    </div>
  );
}

function RiderIdentityCard({
  profile,
  jersey,
  name,
  color,
  softColor,
  label,
  className = "",
}: {
  profile: PublicRiderProfile;
  jersey: RiderJerseyAppearance;
  name: string;
  color: string;
  softColor: string;
  label: string;
  className?: string;
}) {
  return (
    <article
      className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-4 p-5 sm:gap-6 sm:p-8 ${className}`}
      style={{ backgroundColor: softColor }}
    >
      <RiderAvatar
        profileKey={profile.avatarProfileKey}
        seed={profile.avatarSeed}
        riderId={profile.id}
        age={profile.age ?? 25}
        jersey={jersey}
        label={`Portrait de ${name}`}
        className="h-24 w-24 border-4 sm:h-32 sm:w-32"
      />
      <div className="min-w-0">
        <span
          className="inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
        <h2 className="mt-3 text-xl font-black leading-tight text-[#183F37] sm:text-2xl">
          {name}
        </h2>
        <p className="mt-1 truncate text-sm font-semibold text-[#60756E]">
          {profile.currentTeam?.displayName ?? "Sans équipe"}
        </p>
        <Link
          href={`/jeu/coureurs/${profile.id}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-black text-[#176951] underline decoration-[#176951]/30 underline-offset-4 hover:decoration-[#176951]"
        >
          Ouvrir sa fiche ↗
        </Link>
      </div>
    </article>
  );
}

function StatComparisonRow({
  label,
  shortLabel,
  left,
  right,
  leftName,
  rightName,
  primary,
}: {
  label: string;
  shortLabel: string;
  left: ComparableRiderValue;
  right: ComparableRiderValue;
  leftName: string;
  rightName: string;
  primary: boolean;
}) {
  const winner = compareRiderValues(left, right);

  return (
    <div
      className={[
        "grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-center gap-2 rounded-xl border p-2",
        primary
          ? "border-[#315B3E]/14 bg-[#F9FBFA]"
          : "border-[#315B3E]/8 bg-[#FCFDFC]",
      ].join(" ")}
    >
      <div className="col-span-3 flex items-center justify-between gap-3 px-1 pb-0.5">
        <span className="text-xs font-black text-[#183F37]">{label}</span>
        <span className="text-[10px] font-black text-[#82958F]">
          {shortLabel}
        </span>
      </div>
      <RatingValue value={left} color={BLUE} softColor={BLUE_SOFT} />
      <WinnerIndicator
        winner={winner}
        leftName={leftName}
        rightName={rightName}
      />
      <RatingValue value={right} color={GREEN} softColor={GREEN_SOFT} />
    </div>
  );
}

function RatingValue({
  value,
  color,
  softColor,
}: {
  value: ComparableRiderValue;
  color: string;
  softColor: string;
}) {
  return (
    <span
      className="flex min-h-11 items-center justify-center rounded-lg border text-center text-base font-black"
      style={{ color, borderColor: `${color}55`, backgroundColor: softColor }}
    >
      {value.display}
      {value.estimated && value.display !== "?" ? (
        <sup className="ml-1 text-[9px]">est.</sup>
      ) : null}
    </span>
  );
}

function WinnerIndicator({
  winner,
  leftName,
  rightName,
}: {
  winner: RiderComparisonWinner;
  leftName: string;
  rightName: string;
}) {
  if (winner === "left" || winner === "right") {
    const winnerName = winner === "left" ? leftName : rightName;
    return (
      <span
        className="text-center text-2xl font-black"
        style={{ color: RED }}
        aria-label={`${winnerName} possède la meilleure valeur`}
        title={`${winnerName} possède la meilleure valeur`}
      >
        {winner === "left" ? "←" : "→"}
      </span>
    );
  }

  return (
    <span
      className="text-center text-sm font-black text-[#91A39E]"
      aria-label={winner === "tie" ? "Valeurs égales" : "Écart indéterminé"}
      title={winner === "tie" ? "Valeurs égales" : "Écart indéterminé"}
    >
      {winner === "tie" ? "=" : "—"}
    </span>
  );
}

function ComparisonRadar({
  leftName,
  rightName,
  leftValues,
  rightValues,
}: {
  leftName: string;
  rightName: string;
  leftValues: Array<number | null>;
  rightValues: Array<number | null>;
}) {
  const leftPoints = createRadarPoints({
    values: leftValues.map((value) => value ?? 0),
    center: RADAR_CENTER,
    radius: RADAR_RADIUS,
  });
  const rightPoints = createRadarPoints({
    values: rightValues.map((value) => value ?? 0),
    center: RADAR_CENTER,
    radius: RADAR_RADIUS,
  });
  const outerPoints = createRadarPoints({
    values: RIDER_RATING_AXES.map(() => 100),
    center: RADAR_CENTER,
    radius: RADAR_RADIUS,
  });

  return (
    <svg
      viewBox="0 0 300 300"
      role="img"
      aria-label={`Patatoïdes superposés : ${leftName} en bleu et ${rightName} en vert`}
      className="mx-auto w-full max-w-[34rem] overflow-visible"
    >
      {[25, 50, 75, 100].map((level) => (
        <polygon
          key={level}
          points={serializeRadarPoints(
            createRadarPoints({
              values: RIDER_RATING_AXES.map(() => level),
              center: RADAR_CENTER,
              radius: RADAR_RADIUS,
            }),
          )}
          fill={level === 100 ? "#F4F8F6" : "none"}
          stroke="#315B3E"
          strokeOpacity={level === 100 ? 0.28 : 0.11}
          strokeWidth={level === 100 ? 1.4 : 1}
        />
      ))}
      {outerPoints.map((point, index) => (
        <line
          key={RIDER_RATING_AXES[index].key}
          x1={RADAR_CENTER}
          y1={RADAR_CENTER}
          x2={point.x}
          y2={point.y}
          stroke="#315B3E"
          strokeOpacity={
            RIDER_RATING_AXES[index].importance === "primary" ? 0.17 : 0.07
          }
        />
      ))}
      <polygon
        data-radar-layer="left-rider"
        points={serializeRadarPoints(leftPoints)}
        fill={BLUE}
        fillOpacity="0.18"
        stroke={BLUE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <polygon
        data-radar-layer="right-rider"
        points={serializeRadarPoints(rightPoints)}
        fill={GREEN}
        fillOpacity="0.17"
        stroke={GREEN}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {leftPoints.map((point, index) =>
        leftValues[index] === null ? null : (
          <circle
            key={`left-${RIDER_RATING_AXES[index].key}`}
            cx={point.x}
            cy={point.y}
            r="2.8"
            fill="white"
            stroke={BLUE}
            strokeWidth="2"
          />
        ),
      )}
      {rightPoints.map((point, index) =>
        rightValues[index] === null ? null : (
          <circle
            key={`right-${RIDER_RATING_AXES[index].key}`}
            cx={point.x}
            cy={point.y}
            r="2.8"
            fill="white"
            stroke={GREEN}
            strokeWidth="2"
          />
        ),
      )}
      {RIDER_RATING_AXES.map((axis, index) => {
        const angle =
          -Math.PI / 2 + (index * Math.PI * 2) / RIDER_RATING_AXES.length;
        const x = RADAR_CENTER + Math.cos(angle) * 121;
        const y = RADAR_CENTER + Math.sin(angle) * 121;
        return (
          <text
            key={axis.key}
            x={x}
            y={y}
            textAnchor={
              x < RADAR_CENTER - 10
                ? "end"
                : x > RADAR_CENTER + 10
                  ? "start"
                  : "middle"
            }
            dominantBaseline="middle"
            fill={axis.importance === "primary" ? "#183F37" : "#82958F"}
            fontSize="10"
            fontWeight={axis.importance === "primary" ? "900" : "700"}
          >
            {axis.shortLabel}
          </text>
        );
      })}
    </svg>
  );
}

function ComparisonDataRow({
  label,
  left,
  right,
}: {
  label: string;
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(6rem,0.7fr)_minmax(0,1fr)] items-stretch border-b border-[#315B3E]/10 last:border-b-0">
      <div className="flex min-h-14 items-center bg-[#EAF4FF] px-3 py-3 text-sm font-black text-[#285F9D] sm:px-5">
        {left}
      </div>
      <div className="flex min-h-14 items-center justify-center bg-[#F7FAF9] px-2 py-3 text-center text-[10px] font-black uppercase tracking-[0.08em] text-[#60756E] sm:text-xs">
        {label}
      </div>
      <div className="flex min-h-14 items-center justify-end bg-[#E5F5EE] px-3 py-3 text-right text-sm font-black text-[#176951] sm:px-5">
        {right}
      </div>
    </div>
  );
}

function CountryValue({ code, name }: { code: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`fi fi-${code.toLowerCase()} rounded-sm`}
        role="img"
        aria-label={`Drapeau ${name}`}
      />
      <span>{name}</span>
    </span>
  );
}

function PotentialValue({ profile }: { profile: PublicRiderProfile }) {
  if (profile.potentialSteps !== null) {
    return (
      <PotentialStars
        potentialSteps={profile.potentialSteps}
        compact
        showLabel={false}
      />
    );
  }
  if (profile.scoutingReport) {
    return formatScoutedPotentialValue(profile.scoutingReport.potential);
  }
  return "Non disponible";
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
