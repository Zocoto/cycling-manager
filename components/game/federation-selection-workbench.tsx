"use client";

import { useMemo, useState } from "react";

import type { FederationSelectionRider } from "@/services/federation-selection-pool";

type SelectionSlot = {
  id: string;
  label: string;
  competition: string;
  category: FederationSelectionRider["category"];
  profile: string;
  hostName: string;
  hostCode: string;
  day: number;
  limit: number;
  nationsCupProfile?: FederationSelectionRider["profile"];
};

const SELECTION_SLOTS: SelectionSlot[] = [
  { id: "cc-pro-road", label: "CC Pros · Route", competition: "Championnats continentaux", category: "professional", profile: "Route", hostName: "Pays-Bas", hostCode: "nl", day: 22, limit: 8 },
  { id: "cc-pro-itt", label: "CC Pros · CLM", competition: "Championnats continentaux", category: "professional", profile: "Chrono", hostName: "Pays-Bas", hostCode: "nl", day: 22, limit: 2 },
  { id: "cc-junior-road", label: "CC Juniors · Route", competition: "Championnats continentaux juniors", category: "junior", profile: "Route", hostName: "Pays-Bas", hostCode: "nl", day: 22, limit: 6 },
  { id: "cc-junior-itt", label: "CC Juniors · CLM", competition: "Championnats continentaux juniors", category: "junior", profile: "Chrono", hostName: "Pays-Bas", hostCode: "nl", day: 22, limit: 2 },
  { id: "nc-mountain", label: "Nations Cup · Montagne", competition: "Nations Cup", category: "professional", profile: "Montagne", hostName: "Suisse", hostCode: "ch", day: 24, limit: 1, nationsCupProfile: "Montagne" },
  { id: "nc-hills", label: "Nations Cup · Vallons", competition: "Nations Cup", category: "professional", profile: "Vallons", hostName: "Suisse", hostCode: "ch", day: 24, limit: 1, nationsCupProfile: "Vallons" },
  { id: "nc-sprint", label: "Nations Cup · Sprint", competition: "Nations Cup", category: "professional", profile: "Sprint", hostName: "Suisse", hostCode: "ch", day: 24, limit: 1, nationsCupProfile: "Sprint" },
  { id: "nc-cobbles", label: "Nations Cup · Pavés", competition: "Nations Cup", category: "professional", profile: "Pavés", hostName: "Suisse", hostCode: "ch", day: 24, limit: 1, nationsCupProfile: "Pavés" },
  { id: "nc-time-trial", label: "Nations Cup · Chrono", competition: "Nations Cup", category: "professional", profile: "CLM individuel en S3", hostName: "Suisse", hostCode: "ch", day: 24, limit: 1, nationsCupProfile: "Chrono" },
  { id: "world-pro-road", label: "Mondiaux Pros · Route", competition: "Championnats du monde", category: "professional", profile: "Route", hostName: "Canada", hostCode: "ca", day: 26, limit: 8 },
  { id: "world-pro-itt", label: "Mondiaux Pros · CLM", competition: "Championnats du monde", category: "professional", profile: "Chrono", hostName: "Canada", hostCode: "ca", day: 26, limit: 2 },
  { id: "world-junior-road", label: "Mondiaux Juniors · Route", competition: "Championnats du monde juniors", category: "junior", profile: "Route", hostName: "Canada", hostCode: "ca", day: 26, limit: 6 },
  { id: "world-junior-itt", label: "Mondiaux Juniors · CLM", competition: "Championnats du monde juniors", category: "junior", profile: "Chrono", hostName: "Canada", hostCode: "ca", day: 26, limit: 2 },
];

export function FederationSelectionWorkbench({
  countryCode,
  countryName,
  riders,
}: {
  countryCode: string;
  countryName: string;
  riders: FederationSelectionRider[];
}) {
  const [slotId, setSlotId] = useState(SELECTION_SLOTS[0].id);
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");
  const [profile, setProfile] = useState("all");
  const [selectedBySlot, setSelectedBySlot] = useState<Record<string, string[]>>({});
  const slot = SELECTION_SLOTS.find((candidate) => candidate.id === slotId) ?? SELECTION_SLOTS[0];
  const selected = selectedBySlot[slot.id] ?? [];
  const availableTeams = useMemo(
    () => [...new Set(riders.filter((rider) => rider.category === slot.category).map((rider) => rider.teamName))].sort((a, b) => a.localeCompare(b, "fr")),
    [riders, slot.category],
  );
  const filteredRiders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return riders.filter((rider) =>
      rider.category === slot.category &&
      (team === "all" || rider.teamName === team) &&
      (profile === "all" || rider.profile === profile) &&
      (!normalizedQuery || `${rider.name} ${rider.teamName}`.toLocaleLowerCase("fr").includes(normalizedQuery)),
    );
  }, [profile, query, riders, slot.category, team]);

  function toggleRider(riderId: string) {
    setSelectedBySlot((current) => {
      const currentSlot = current[slot.id] ?? [];
      if (currentSlot.includes(riderId)) {
        return { ...current, [slot.id]: currentSlot.filter((id) => id !== riderId) };
      }
      if (currentSlot.length >= slot.limit) return current;

      const withoutOtherNationsCupEntries = slot.nationsCupProfile
        ? Object.fromEntries(
            Object.entries(current).map(([key, riderIds]) => [
              key,
              key.startsWith("nc-") ? riderIds.filter((id) => id !== riderId) : riderIds,
            ]),
          )
        : current;
      return { ...withoutOtherNationsCupEntries, [slot.id]: [...currentSlot, riderId] };
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">Atelier de présélection S3</p>
            <h2 className="mt-2 text-3xl font-black text-[#183F37]">Construire les listes dès aujourd’hui</h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
              Le filtre de nationalité est verrouillé sur {countryName}. Les
              choix restent une simulation locale en S2 ; leur disponibilité
              sera confirmée par chaque DS via une alerte et un mail en S3.
            </p>
          </div>
          <label>
            <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]">Épreuve à préparer</span>
            <select value={slot.id} onChange={(event) => { setSlotId(event.target.value); setTeam("all"); setProfile("all"); }} className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/18 bg-[#F8FBF9] px-4 text-sm font-black text-[#183F37] outline-none focus:border-[#278B70]">
              {SELECTION_SLOTS.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      {slot.competition === "Nations Cup" ? (
        <nav aria-label="Profils de la Nations Cup" className="grid grid-cols-2 gap-2 rounded-2xl border border-[#315B3E]/12 bg-white p-2 sm:grid-cols-5">
          {SELECTION_SLOTS.filter((candidate) => candidate.competition === "Nations Cup").map((candidate) => (
            <button key={candidate.id} type="button" onClick={() => setSlotId(candidate.id)} className={`rounded-xl px-3 py-3 text-xs font-black transition ${candidate.id === slot.id ? "bg-[#123F36] text-white" : "bg-[#F2F8F5] text-[#315B3E] hover:bg-[#E5F4ED]"}`}>
              {candidate.nationsCupProfile}
            </button>
          ))}
        </nav>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
        <div className="grid gap-4 bg-[#123F36] p-5 text-white sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-center gap-4">
            <span role="img" aria-label={`Pays hôte : ${slot.hostName}`} className={`fi fi-${slot.hostCode} text-4xl shadow-sm`} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">J{slot.day} · Pays hôte : {slot.hostName}</p>
              <h3 className="mt-1 text-xl font-black">{slot.label}</h3>
              <p className="mt-1 text-xs font-semibold text-[#D6DFD2]">Profil : {slot.profile}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#BFD1C6]">Liste</p>
            <p className="mt-1 text-2xl font-black text-[#F2C94C]">{selected.length}/{slot.limit}</p>
          </div>
        </div>

        <div className="grid gap-3 border-b border-[#315B3E]/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">Nationalité verrouillée</span><span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-[#315B3E]/12 bg-[#EEF3F1] px-3 text-sm font-black text-[#183F37]"><span className={`fi fi-${countryCode.toLowerCase()}`} />{countryName}</span></label>
          <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">Recherche</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Coureur ou équipe" className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70]" /></label>
          <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">Équipe</span><select value={team} onChange={(event) => setTeam(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 px-3 text-sm font-bold text-[#183F37]"><option value="all">Toutes</option>{availableTeams.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">Profil</span><select value={profile} onChange={(event) => setProfile(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 px-3 text-sm font-bold text-[#183F37]"><option value="all">Tous</option>{["Montagne", "Vallons", "Sprint", "Pavés", "Chrono", "Polyvalent"].map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full border-collapse text-left">
            <thead className="bg-[#F2F8F5] text-[9px] font-black uppercase tracking-[0.11em] text-[#60756E]"><tr><th className="px-5 py-3">Choix</th><th className="px-3 py-3">Coureur</th><th className="px-3 py-3">Équipe</th><th className="px-3 py-3">Profil</th>{["MO", "VAL", "PL", "CLM", "PAV", "SPR"].map((label) => <th key={label} className="px-2 py-3 text-center">{label}</th>)}<th className="px-3 py-3 text-center">Moy.</th><th className="px-5 py-3">Accord</th></tr></thead>
            <tbody className="divide-y divide-[#315B3E]/10">
              {filteredRiders.map((rider) => {
                const isSelected = selected.includes(rider.id);
                const limitReached = !isSelected && selected.length >= slot.limit;
                return <tr key={rider.id} className={isSelected ? "bg-[#E8F7F1]" : "bg-white"}><td className="px-5 py-4"><input type="checkbox" checked={isSelected} disabled={limitReached} onChange={() => toggleRider(rider.id)} aria-label={`Sélectionner ${rider.name}`} className="h-5 w-5 accent-[#176951]" /></td><td className="px-3 py-4"><p className="font-black text-[#183F37]">{rider.name}</p><p className="mt-1 text-xs font-semibold text-[#60756E]">{rider.age} ans · {rider.category === "junior" ? "Junior" : "Pro"}</p></td><td className="max-w-56 px-3 py-4 text-sm font-bold text-[#526B62]">{rider.teamName}</td><td className="px-3 py-4"><span className="rounded-full bg-[#EEF3F1] px-3 py-1 text-xs font-black text-[#315B3E]">{rider.profile}</span></td>{Object.values(rider.ratings).map((rating, index) => <td key={index} className="px-2 py-4 text-center font-black text-[#183F37]">{formatRating(rating)}</td>)}<td className="px-3 py-4 text-center text-base font-black text-[#176951]">{formatRating(rider.overall)}</td><td className="px-5 py-4 text-xs font-bold text-[#806300]">À confirmer par le DS</td></tr>;
              })}
            </tbody>
          </table>
          {filteredRiders.length === 0 ? <p className="px-5 py-10 text-center text-sm font-semibold text-[#60756E]">Aucun coureur ne correspond aux filtres.</p> : null}
        </div>

        <div className="flex flex-col gap-4 border-t border-[#315B3E]/10 bg-[#F8FBF9] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl text-xs font-semibold leading-5 text-[#60756E]">
            Les juniors sont gérés ici : les DS n’auront plus d’inscription
            directe depuis leur DevTeam. Un coureur Nations Cup ne peut être
            retenu que sur un seul profil.
          </p>
          <button type="button" disabled className="min-h-11 shrink-0 cursor-not-allowed rounded-xl bg-[#9AA9A3] px-5 text-sm font-black text-white">Enregistrer en S3</button>
        </div>
      </section>
    </div>
  );
}

function formatRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}
