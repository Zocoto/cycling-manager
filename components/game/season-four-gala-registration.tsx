"use client";
import { useActionState, useState } from "react";
import { saveSeasonFourGalaRegistrationAction } from "@/app/jeu/gala-saison-4/actions";
import { GALA_COURSES, GALA_PROGRAM_PROFILES, SEASON_FOUR_GALA, type GalaProgram, type GalaProfile } from "@/lib/game/season-four-gala";
import { GALA_NATIVE_PRIMARY_KEYS, hasContinentalNativeRatings } from "@/lib/game/season-four-gala-startlists";
import type { GalaRegistrationState, SeasonFourGalaContext } from "@/lib/game/season-four-gala-registration";
import styles from "./season-four-gala.module.css";

const labels = ["MON", "VAL", "PLA", "CLM", "PAV", "SPR"];
const initialState: GalaRegistrationState = { status: "idle", message: "" };

export function SeasonFourGalaRegistration({ context, program }: { context: SeasonFourGalaContext; program: GalaProgram }) {
  const [selections, setSelections] = useState<Partial<Record<GalaProfile, string[]>>>(context.selections);
  const [state, action, pending] = useActionState(saveSeasonFourGalaRegistrationAction, initialState);
  const profiles = GALA_PROGRAM_PROFILES[program];
  const eligible = new Set(context.riders.filter(rider => program !== "continental" || hasContinentalNativeRatings(rider)).map(rider => rider.rider_id));
  const valid = profiles.every(profile => { const ids = selections[profile] ?? []; return ids.length >= 7 && ids.length <= 8 && ids.every(id => eligible.has(id)); });
  const disabled = !context.isOpen || pending;
  const payload = { program, selections: Object.fromEntries(profiles.map(profile => [profile, selections[profile] ?? []])) };

  if (context.unavailable) return <p role="alert" className={styles.registrationPanel}>Les inscriptions du gala sont temporairement indisponibles. Réessayez dans quelques instants.</p>;
  if (!context.team) return <p className={styles.registrationPanel}>Une équipe de saison 4 est nécessaire pour s’inscrire. Vous pouvez découvrir le gala et les équipes engagées.</p>;
  function toggle(profile: GalaProfile, id: string) {
    setSelections(previous => { const ids = previous[profile] ?? []; return { ...previous, [profile]: ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id].slice(0, 8) }; });
  }
  return <section id="inscriptions-gala" className={styles.registrationPanel} aria-labelledby="gala-registration-title">
    <p className={styles.eyebrow}>À vous de jouer</p>
    <h2 id="gala-registration-title">Votre équipe au gala.</h2>
    <p><strong>{context.team.name}</strong> · Identité et effectif de la saison 4.</p>
    <p>Programme choisi : <strong>{program === "world-tour" ? "World Tour" : "Continental"}</strong> · <a href="#programme-gala" className="underline">Changer de programme ↑</a></p>
    <p>Clôture : {SEASON_FOUR_GALA.registrationDeadlineLabel}. Le programme se choisit avec les deux boutons ci-dessus ; validez ensuite les trois compositions ensemble.</p>
    <p><strong>{context.program ? `Programme enregistré : ${context.program === "world-tour" ? "World Tour" : "Continental"}.` : "Votre équipe n’est pas encore inscrite."}</strong>{!context.isOpen ? " Les inscriptions et modifications sont closes." : " Toute modification doit être validée ci-dessous."}</p>
    <form action={action}>
      <input type="hidden" name="selection" value={JSON.stringify(payload)} />
      {profiles.map(profile => {
        const ids = selections[profile] ?? [];
        const invalid = ids.some(id => !eligible.has(id));
        return <details className={styles.registrationCourse} key={profile}>
          <summary>{GALA_COURSES[profile].profile}<span>{ids.length} / 8 coureurs · minimum 7</span></summary>
          <div className={styles.registrationTools}>
            <button type="button" disabled={disabled || ids.length < 7 || invalid} onClick={() => setSelections(Object.fromEntries(profiles.map(key => [key, [...ids]])))}>Reprendre cette sélection sur les 3 courses</button>
            <button type="button" disabled={disabled} onClick={() => setSelections(previous => ({ ...previous, [profile]: [] }))}>Réinitialiser cette course</button>
          </div>
          {invalid ? <p role="alert">Un coureur sélectionné n’est plus éligible. Réinitialisez la course ou retirez ce coureur.</p> : null}
          <div className={styles.rosterScroll}><table className={styles.registrationTable}>
            <caption>Notes primaires natives S4 · aucun bonus d’équipement</caption>
            <thead><tr><th scope="col">Coureur</th>{labels.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{context.riders.map(rider => <tr key={rider.rider_id} data-ineligible={!eligible.has(rider.rider_id)}>
              <th scope="row"><label><input type="checkbox" checked={ids.includes(rider.rider_id)} disabled={disabled || (!ids.includes(rider.rider_id) && (!eligible.has(rider.rider_id) || ids.length >= 8))} onChange={() => toggle(profile, rider.rider_id)} />{rider.first_name} {rider.last_name}</label></th>
              {GALA_NATIVE_PRIMARY_KEYS.map(key => <td key={key}>{rider[key] == null ? "—" : Number(rider[key]).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>)}
            </tr>)}</tbody>
          </table></div>
        </details>;
      })}
      {program === "continental" ? <p>Les coureurs dépassant 75 dans au moins une note primaire native sont inéligibles. L’éligibilité sera aussi contrôlée lors de l’export : vérifiez vos compositions avant la clôture.</p> : null}
      <div className={styles.registrationSubmit}>
        <button type="submit" name="intent" value="save" disabled={disabled || !valid}>{pending ? "Enregistrement…" : "Valider les trois compositions"}</button>
        {context.program ? <button type="submit" name="intent" value="withdraw" formNoValidate disabled={disabled} onClick={event => { if (!window.confirm("Retirer votre équipe des trois courses du gala ?")) event.preventDefault(); }}>Retirer mon inscription</button> : null}
      </div>
      {state.message ? <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? styles.exportError : styles.exportSuccess}>{state.message}</p> : null}
    </form>
  </section>;
}
