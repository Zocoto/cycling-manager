"use client";

import { useActionState, useId, useState } from "react";
import {
  saveSeasonFiveGalaRegistrationAction,
  withdrawSeasonFiveGalaRegistrationAction,
} from "@/app/jeu/gala-saison-5/actions";
import {
  buildSeasonFiveGalaSelections,
  initialGalaS5RegistrationState,
  isSeasonFiveGalaContinentalRiderEligible,
  type GalaS5Rider,
  type SeasonFiveGalaContext,
} from "@/lib/game/season-five-gala-registration";
import { GALA_S5_COURSES, SEASON_FIVE_GALA, type SeasonFiveGalaProgram } from "@/lib/game/season-five-gala";
import { useUnsavedManagementChanges } from "./use-management-draft";
import styles from "./season-five-gala-registration.module.css";

const ratings = [
  ["mountain", "MON"], ["hills", "VAL"], ["flat", "PLA"],
  ["time_trial", "CLM"], ["cobbles", "PAV"], ["sprint", "SPR"],
] as const;
type Rating = typeof ratings[number][0];
const programName = (program: SeasonFiveGalaProgram) => program === "pro-tour" ? "Pro Tour" : "Continental";

export function SeasonFiveGalaRegistration({ context, program }: {
  context: SeasonFiveGalaContext;
  program: SeasonFiveGalaProgram;
}) {
  const id = useId();
  const courses = GALA_S5_COURSES.filter(course => course.program === program);
  const [activeCourse, setActiveCourse] = useState(courses[0].id);
  const course = courses.find(value => value.id === activeCourse) ?? courses[0];
  const [selections, setSelections] = useState(context.selections);
  const [saved, setSaved] = useState({ program: context.program, selections: context.selections });
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);
  const [lastMutation, setLastMutation] = useState<"save" | "withdraw" | null>(null);
  const [sort, setSort] = useState<{ key: Rating | "name"; descending: boolean } | null>(null);
  const selected = selections[course.id] ?? [];
  const submitted = buildSeasonFiveGalaSelections(program, selections);
  const changingProgram = saved.program !== null && saved.program !== program;
  const dirty = JSON.stringify(submitted) !== JSON.stringify(buildSeasonFiveGalaSelections(program, saved.selections))
    || (changingProgram && Object.values(submitted).some(ids => ids.length > 0));
  const anyChanges = GALA_S5_COURSES.some(value => JSON.stringify(selections[value.id] ?? []) !== JSON.stringify(saved.selections[value.id] ?? []));
  useUnsavedManagementChanges(anyChanges);

  const [state, action, saving] = useActionState(async (previous: typeof initialGalaS5RegistrationState, form: FormData) => {
    const nextProgram = form.get("program") as SeasonFiveGalaProgram;
    const result = await saveSeasonFiveGalaRegistrationAction(previous, form);
    setLastMutation("save");
    if (result.status === "success") {
      const nextSelections = JSON.parse(String(form.get("selections"))) as Record<string, string[]>;
      setSaved({ program: nextProgram, selections: nextSelections });
      setSelections(nextSelections);
      setConfirmSwitch(false);
    }
    return result;
  }, initialGalaS5RegistrationState);
  const [withdrawalState, withdraw, withdrawing] = useActionState(async (previous: typeof initialGalaS5RegistrationState, form: FormData) => {
    const result = await withdrawSeasonFiveGalaRegistrationAction(previous, form);
    setLastMutation("withdraw");
    if (result.status === "success") {
      setSaved({ program: null, selections: {} });
      setSelections({});
      setConfirmWithdrawal(false);
    }
    return result;
  }, initialGalaS5RegistrationState);
  const pending = saving || withdrawing;

  if (context.unavailable) return <section id="inscriptions-gala-s5" className={styles.panel}>
    <p role="alert">Les inscriptions sont temporairement indisponibles. Rechargez la page dans quelques instants.</p>
  </section>;
  if (!context.team) return <section id="inscriptions-gala-s5" className={styles.panel}>
    <h2>Votre équipe au départ</h2><p>Une équipe de saison 5 est nécessaire pour participer au gala.</p>
  </section>;

  const allowed = new Set(context.riders.filter(rider => program === "pro-tour" || isSeasonFiveGalaContinentalRiderEligible(rider)).map(rider => rider.rider_id));
  const present = new Set(context.riders.map(rider => rider.rider_id));
  const hasDepartedRiders = Object.values(submitted).some(ids => ids.some(riderId => !present.has(riderId)));
  const invalid = Object.values(submitted).some(ids => ids.some(riderId => !allowed.has(riderId)));
  const complete = Object.values(submitted).filter(ids => ids.length >= 7 && ids.length <= 8).length;
  const incomplete = Object.values(submitted).some(ids => ids.length > 0 && ids.length < 7);
  const valid = complete > 0 && !incomplete && !invalid;
  const primary: Rating = course.profile === "Montagne" ? "mountain" : course.profile === "Vallons" ? "hills" : course.profile === "Pavés" ? "cobbles" : "sprint";
  const sortKey = sort?.key ?? primary;
  const descending = sort?.descending ?? true;
  const riders = [...context.riders].sort((a, b) => Number(allowed.has(b.rider_id)) - Number(allowed.has(a.rider_id))
    || (sortKey === "name"
      ? (descending ? -1 : 1) * `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "fr")
      : (descending ? -1 : 1) * (Number(a[sortKey]) - Number(b[sortKey])))
    || a.last_name.localeCompare(b.last_name, "fr") || a.rider_id.localeCompare(b.rider_id));
  function toggle(riderId: string) {
    setLastMutation(null);
    setSelections(previous => {
      const current = previous[course.id] ?? [];
      return { ...previous, [course.id]: current.includes(riderId)
        ? current.filter(value => value !== riderId)
        : current.length < 8 && allowed.has(riderId) ? [...current, riderId] : current };
    });
  }
  function changeSort(key: Rating | "name") {
    setSort(previous => ({ key, descending: previous?.key === key ? !previous.descending : key !== "name" }));
  }
  const disabled = !context.isOpen || pending;

  return <section id="inscriptions-gala-s5" className={styles.panel} aria-labelledby={`${id}-title`}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Votre inscription · {programName(program)}</p><h2 id={`${id}-title`}>Composez votre équipe.</h2></div>
      <div className={styles.identity}><strong>{context.team.futureName || context.team.name}</strong>
        <span>{context.team.identityReady ? "Identité de saison 6" : "Identité de saison 6 à confirmer"}</span></div>
    </header>
    <p className={styles.instructions}>Une seule catégorie par DS. Choisissez 7 à 8 coureurs par course ; vous pouvez enregistrer une course, puis compléter les autres plus tard.</p>
    <p className={styles.deadline}>Clôture : {SEASON_FIVE_GALA.registrationDeadlineLabel}</p>
    {saved.program ? <p className={styles.savedProgram}>Inscription actuelle : <strong>{programName(saved.program)}</strong>.</p> : null}
    {!context.isOpen ? <p role="status" className={styles.notice}>Les inscriptions sont closes. Vos compositions restent consultables.</p> : null}
    {changingProgram ? <p className={styles.notice}>Enregistrer en {programName(program)} remplacera toutes vos inscriptions en {programName(saved.program!)}.</p> : null}
    <div className={styles.courseTabs} role="group" aria-label="Course à composer">
      {courses.map(value => <button key={value.id} type="button" aria-pressed={course.id === value.id}
        disabled={pending} onClick={() => { setActiveCourse(value.id); setSort(null); }}>
        <strong>{value.name}</strong><span>{(selections[value.id] ?? []).length} / 8 coureurs</span>
      </button>)}
    </div>
    <form action={action} onReset={event => event.preventDefault()}>
      <input type="hidden" name="program" value={program} />
      <input type="hidden" name="previousProgram" value={saved.program ?? ""} />
      <input type="hidden" name="selections" value={JSON.stringify(submitted)} />
      <div className={styles.selectionHeader}><h3>{course.name}</h3><strong>{selected.length} / 8</strong>
        <button type="button" disabled={disabled || selected.length === 0} onClick={() => { setLastMutation(null); setSelections(previous => ({ ...previous, [course.id]: [] })); }}>Vider cette course</button></div>
      <p className={styles.hint}>Notes de saison 5, sans équipement. Cliquez sur une note pour trier.</p>
      {program === "continental" ? <p className={styles.hint}>75 maximum dans les six notes primaires à l’admission. Les coureurs déjà admis restent éligibles s’ils progressent.</p> : null}
      <div className={styles.tableScroll} role="region" aria-label="Effectif disponible pour le gala" tabIndex={0}>
        <table className={styles.riders}><thead><tr><th scope="col" aria-sort={sortKey === "name" ? descending ? "descending" : "ascending" : "none"}>
          <button type="button" onClick={() => changeSort("name")}>Coureur {sortKey === "name" ? descending ? "↓" : "↑" : "↕"}</button></th>
          {ratings.map(([key, label]) => <th key={key} scope="col" aria-sort={sortKey === key ? descending ? "descending" : "ascending" : "none"}>
            <button type="button" onClick={() => changeSort(key)}>{label} {sortKey === key ? descending ? "↓" : "↑" : "↕"}</button></th>)}
        </tr></thead><tbody>{riders.map(rider => <RiderChoice key={rider.rider_id} rider={rider} checked={selected.includes(rider.rider_id)}
          ineligible={!allowed.has(rider.rider_id)} disabled={disabled || (!selected.includes(rider.rider_id) && (selected.length >= 8 || !allowed.has(rider.rider_id)))}
          onToggle={() => toggle(rider.rider_id)} />)}</tbody></table>
      </div>
      {invalid ? <div role="alert" className={styles.error}><p>Un coureur sélectionné n’est plus éligible. Retirez-le avant d’enregistrer.</p>
        {hasDepartedRiders ? <button type="button" disabled={disabled} onClick={() => {
          setLastMutation(null);
          setSelections(previous => Object.fromEntries(Object.entries(previous).map(([courseId, ids]) => [courseId, (ids ?? []).filter(riderId => present.has(riderId))])));
        }}>Retirer les coureurs sortis de l’effectif</button> : null}</div> : null}
      {changingProgram ? <label className={styles.confirm}><input type="checkbox" checked={confirmSwitch} disabled={disabled}
        onChange={event => setConfirmSwitch(event.target.checked)} />Je remplace mes inscriptions en {programName(saved.program!)} par le programme {programName(program)}.</label> : null}
      <div className={styles.saveBar}>
        <p>{complete} / 3 courses prêtes<span>{incomplete ? "Complétez à 7 coureurs les courses commencées, ou videz-les." : dirty ? "Modifications à enregistrer" : saved.program === program ? "Compositions enregistrées" : "Choisissez vos coureurs."}</span></p>
        <button type="submit" disabled={disabled || !valid || !dirty || (changingProgram && !confirmSwitch)}>{saving ? "Enregistrement…" : "Valider mes inscriptions"}</button>
      </div>
      {lastMutation === "save" && !pending && state.message ? <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? styles.error : styles.success}>{state.message}</p> : null}
    </form>
    {saved.program && context.isOpen ? <div className={styles.withdrawal}>
      {!confirmWithdrawal ? <button type="button" disabled={pending} onClick={() => setConfirmWithdrawal(true)}>Retirer toutes mes inscriptions</button> : <form action={withdraw}>
        <p>Retirer vos inscriptions aux trois courses du gala ?</p>
        <button type="submit" disabled={pending}>{withdrawing ? "Retrait…" : "Retirer mes inscriptions"}</button>
        <button type="button" disabled={pending} onClick={() => setConfirmWithdrawal(false)}>Conserver mes inscriptions</button>
      </form>}
    </div> : null}
    {lastMutation === "withdraw" && !pending && withdrawalState.message ? <p role={withdrawalState.status === "error" ? "alert" : "status"} className={withdrawalState.status === "error" ? styles.error : styles.success}>{withdrawalState.message}</p> : null}
  </section>;
}

function RiderChoice({ rider, checked, disabled, ineligible, onToggle }: {
  rider: GalaS5Rider; checked: boolean; disabled: boolean; ineligible: boolean; onToggle: () => void;
}) {
  return <tr data-selected={checked} data-ineligible={ineligible}>
    <th scope="row"><label><input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} />
      <span><strong>{rider.first_name} {rider.last_name}</strong>{ineligible ? <small>Inéligible en Continental</small> : null}</span></label></th>
    {ratings.map(([key]) => <td key={key}>{Number.isFinite(Number(rider[key])) ? Number(rider[key]).toLocaleString("fr-FR", { maximumFractionDigits: 3 }) : "—"}</td>)}
  </tr>;
}
