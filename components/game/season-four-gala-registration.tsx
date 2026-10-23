"use client";
import { useActionState, useId, useState, type ReactNode } from "react";
import { changeSeasonFourGalaProgramAction, saveSeasonFourGalaCourseAction } from "@/app/jeu/gala-saison-4/actions";
import { GALA_COURSES, GALA_PROGRAM_PROFILES, type GalaProgram, type GalaProfile } from "@/lib/game/season-four-gala";
import { GALA_NATIVE_PRIMARY_KEYS, hasContinentalNativeRatings } from "@/lib/game/season-four-gala-startlists";
import type { GalaRegistrationState, SeasonFourGalaContext } from "@/lib/game/season-four-gala-registration";
import styles from "./season-four-gala.module.css";

const labels = { mountain: "MON", hills: "VAL", flat: "PLA", time_trial: "CLM", cobbles: "PAV", sprint: "SPR" };
const initialState: GalaRegistrationState = { status: "idle", message: "" };
type CourseRenderer = (profile: GalaProfile) => ReactNode;

export function SeasonFourGalaRegistration({ context, program, renderProfile, renderDetails, onKeepProgram }: {
  context: SeasonFourGalaContext; program: GalaProgram; renderProfile: CourseRenderer; renderDetails: CourseRenderer; onKeepProgram: (program: GalaProgram) => void;
}) {
  const [activeProfile, setActiveProfile] = useState<GalaProfile>("mountain");
  const profiles = GALA_PROGRAM_PROFILES[program];
  const selectedProfile = profiles.includes(activeProfile) ? activeProfile : profiles[0];
  const tabsId = useId();
  const changingProgram = context.program !== null && context.program !== program;

  if (context.unavailable) return <p role="alert" className={styles.registrationPanel}>Les inscriptions du gala sont temporairement indisponibles. Réessayez dans quelques instants.</p>;
  if (!context.team) return <p className={styles.registrationPanel}>Une équipe de saison 4 est nécessaire pour s’inscrire. Vous pouvez découvrir le gala et les équipes engagées.</p>;
  if (changingProgram) return <ProgramChange context={context} program={program} onKeepProgram={onKeepProgram} />;

  return <section id="inscriptions-gala" className={styles.registrationPanel} aria-labelledby="gala-registration-title">
    <p className={styles.eyebrow}>2 · À vous de composer</p>
    <h2 id="gala-registration-title">Une course, une sélection.</h2>
    <p><strong>{context.team.name}</strong> · Choisissez 7 à 8 coureurs, puis enregistrez cette course. Vous pourrez revenir sur chaque composition jusqu’à la clôture.</p>
    <div className={styles.courseTabs} role="tablist" aria-label="Course à préparer">
      {profiles.map(profile => {
        const count = (context.selections[profile] ?? []).length;
        return <button type="button" role="tab" id={`${tabsId}-${profile}`} aria-selected={selectedProfile === profile} aria-controls={`${tabsId}-${profile}-panel`} key={profile} onClick={() => setActiveProfile(profile)}>
          <strong>{GALA_COURSES[profile].profile}</strong><span>{count ? "✓ " : ""}{count ? `${count} coureurs inscrits` : "À composer"}</span>
        </button>;
      })}
    </div>
    {profiles.map(profile => <div key={`${program}:${profile}`} id={`${tabsId}-${profile}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${profile}`} hidden={selectedProfile !== profile}>
      <CourseRegistration context={context} program={program} profile={profile} renderProfile={renderProfile} renderDetails={renderDetails} />
    </div>)}
  </section>;
}

function ProgramChange({ context, program, onKeepProgram }: { context: SeasonFourGalaContext; program: GalaProgram; onKeepProgram: (program: GalaProgram) => void }) {
  const [state, action, pending] = useActionState(changeSeasonFourGalaProgramAction, initialState);
  return <div className={styles.programChange}>
    <h3>Changer de format ?</h3>
    <p>Vos inscriptions actuelles seront retirées. Vous pourrez ensuite composer vos équipes dans le nouveau format.</p>
    <form action={action}><input type="hidden" name="selection" value={JSON.stringify({ program, previousProgram: context.program })} />
      <button disabled={pending || !context.isOpen} type="submit">{pending ? "Enregistrement…" : "Confirmer le changement de format"}</button>
      <button disabled={pending} type="button" onClick={() => onKeepProgram(context.program!)}>Garder mon format actuel</button>
    </form>
    <ActionMessage state={state} />
  </div>;
}

function CourseRegistration({ context, program, profile, renderProfile, renderDetails }: {
  context: SeasonFourGalaContext; program: GalaProgram; profile: GalaProfile; renderProfile: CourseRenderer; renderDetails: CourseRenderer;
}) {
  const savedIds = context.selections[profile] ?? [];
  const [ids, setIds] = useState<string[]>(savedIds);
  const [state, action, pending] = useActionState(async (previous: GalaRegistrationState, form: FormData) => {
    const result = await saveSeasonFourGalaCourseAction(previous, form);
    if (result.status === "success" && form.get("intent") === "withdraw-course") setIds([]);
    return result;
  }, initialState);
  const course = GALA_COURSES[profile];
  const primary = GALA_NATIVE_PRIMARY_KEYS.find(key => key === course.primary)!;
  const eligible = new Set(context.riders.filter(rider => program !== "continental" || hasContinentalNativeRatings(rider)).map(rider => rider.rider_id));
  const invalid = ids.some(id => !eligible.has(id));
  const valid = ids.length >= 7 && ids.length <= 8 && !invalid;
  const dirty = ids.length !== savedIds.length || ids.some((id, index) => id !== savedIds[index]);
  const disabled = !context.isOpen || pending;
  const riders = [...context.riders].sort((a, b) => Number(eligible.has(b.rider_id)) - Number(eligible.has(a.rider_id)) || Number(b[primary] ?? 0) - Number(a[primary] ?? 0) || a.last_name.localeCompare(b.last_name, "fr"));
  function toggle(id: string) { setIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id].slice(0, 8)); }

  return <div className={styles.coursePreparation}>
    <div className={styles.preparationHeader}><div><p className={styles.eyebrow}>{course.profile}</p><h3>{course.name}</h3></div><span className={styles.keyRating}>Note clé <b>{course.primaryLabel}</b></span></div>
    {renderProfile(profile)}
    <details className={styles.preparationDetails}><summary>Le parcours et les engagés <span aria-hidden="true">＋</span></summary>{renderDetails(profile)}</details>
    <form action={action}>
      <input type="hidden" name="selection" value={JSON.stringify({ program, profile, riderIds: ids })} />
      <div className={styles.selectionHeading}><h4>Qui prend le départ ?</h4><strong>{ids.length} / 8</strong></div>
      <p className={styles.selectionHint}>Triés par {course.primaryLabel}. Notes natives de saison 4, sans équipement.</p>
      {program === "continental" ? <p className={styles.selectionHint}>Continental : 75 maximum dans chaque note primaire native.</p> : null}
      {invalid ? <p role="alert" className={styles.exportError}>Un coureur sélectionné n’est plus éligible. Retirez-le pour enregistrer cette course.</p> : null}
      <div className={styles.riderChoices}>
        {riders.map(rider => <label className={styles.riderChoice} key={rider.rider_id} data-selected={ids.includes(rider.rider_id)} data-ineligible={!eligible.has(rider.rider_id)}>
          <input type="checkbox" checked={ids.includes(rider.rider_id)} disabled={disabled || (!ids.includes(rider.rider_id) && (!eligible.has(rider.rider_id) || ids.length >= 8))} onChange={() => toggle(rider.rider_id)} />
          <span className={styles.riderChoiceName}><strong>{rider.first_name} {rider.last_name}</strong><small>{GALA_NATIVE_PRIMARY_KEYS.filter(key => key !== primary).map(key => <span key={key}>{labels[key]} {formatRating(rider[key])}</span>)}</small>{!eligible.has(rider.rider_id) ? <em>Inéligible en Continental</em> : null}</span>
          <span className={styles.riderKeyRating}><small>{course.primaryLabel}</small><b>{formatRating(rider[primary])}</b></span>
        </label>)}
      </div>
      <div className={styles.courseSaveBar}>
        <span>{!context.isOpen ? "Inscriptions closes" : dirty ? "Modifications non enregistrées" : savedIds.length ? "✓ Composition enregistrée" : "7 à 8 coureurs par course"}</span>
        <button type="submit" name="intent" value="save-course" disabled={disabled || !valid || !dirty}>{pending ? "Enregistrement…" : savedIds.length ? "Enregistrer les modifications" : "Valider cette course"}</button>
        {savedIds.length > 0 ? <button type="submit" className={styles.withdrawCourse} name="intent" value="withdraw-course" disabled={disabled}>Retirer cette course</button> : null}
      </div>
      <ActionMessage state={dirty && state.status === "success" ? initialState : state} />
    </form>
  </div>;
}

function ActionMessage({ state }: { state: GalaRegistrationState }) {
  return state.message ? <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? styles.exportError : styles.exportSuccess}>{state.message}</p> : null;
}
function formatRating(value: string | number | null) { return value == null ? "—" : Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 }); }
