"use client";

import { useState } from "react";
import { CourseRegistration } from "@/components/game/season-four-gala-registration";
import type { GalaRegistrationState, SeasonFourGalaContext } from "@/lib/game/season-four-gala-registration";
import styles from "@/components/game/season-four-gala.module.css";

const riders = Array.from({ length: 9 }, (_, index) => ({
  rider_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  first_name: index === 1 ? "Sebastian" : index === 8 ? "Hussein" : "Coureur",
  last_name: index === 1 ? "Conroy" : index === 8 ? "Awada" : `Démo ${index + 1}`,
  mountain: 60, hills: 60, flat: 60, time_trial: 60, cobbles: 75 - index, sprint: 60,
}));
const initialContext: SeasonFourGalaContext = {
  isOpen: true, team: { id: "demo-team", name: "Équipe de démonstration" }, program: "world-tour",
  selections: { cobbles: riders.filter((_, index) => index !== 1).map(rider => rider.rider_id) },
  riders, counts: { "world-tour": 1, continental: 0 },
};

/** Offline action stand-in: no database, live registrations or player messages. */
export function GalaSelectionPreview() {
  const [context, setContext] = useState(initialContext);
  const [fail, setFail] = useState(false);
  async function save(_previous: GalaRegistrationState, form: FormData): Promise<GalaRegistrationState> {
    await Promise.resolve();
    if (fail) return { status: "error", message: "Enregistrement non confirmé. Rechargez la page pour vérifier cette course avant de réessayer." };
    const { riderIds } = JSON.parse(String(form.get("selection"))) as { riderIds: string[] };
    const saved = form.get("intent") === "withdraw-course" ? [] : riderIds;
    setContext(current => ({ ...current, selections: { cobbles: saved } }));
    return { status: "success", message: saved.length ? "Composition enregistrée pour cette course." : "Inscription retirée pour cette course." };
  }
  return <main className={styles.page}>
    <p className="p-4 text-center text-white">Aperçu local · données fictives</p>
    <label className="m-4 flex gap-3 text-white"><input type="checkbox" checked={fail} onChange={event => setFail(event.target.checked)} />Simuler une erreur</label>
    <p data-testid="saved-selection" className="m-4 text-sm text-white">{context.selections.cobbles?.map(id => {
      const rider = riders.find(candidate => candidate.rider_id === id)!;
      return `${rider.first_name} ${rider.last_name}`;
    }).join(" · ")}</p>
    <section className={styles.registrationPanel}>
      <CourseRegistration context={context} program="world-tour" profile="cobbles" active={false} renderProfile={() => null} renderDetails={() => null} saveCourseAction={save} />
    </section>
  </main>;
}
