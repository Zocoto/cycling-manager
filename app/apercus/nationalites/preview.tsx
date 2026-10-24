"use client";

import { useState } from "react";
import { CountrySelect } from "@/components/game/country-select";

const countries = [
  { id: "bw", name: "Botswana", isoAlpha2: "BW", directorCount: 0 },
  { id: "fr", name: "France", isoAlpha2: "FR", directorCount: 12 },
  { id: "rw", name: "Rwanda", isoAlpha2: "RW", directorCount: 1 },
  { id: "cd", name: "République démocratique du Congo", isoAlpha2: "CD", directorCount: 1234 },
];

export function CountryChoicePreview() {
  const [nationality, setNationality] = useState("");
  const [teamCountry, setTeamCountry] = useState("");
  return <main className="min-h-screen bg-[#F5F9F7] p-4 text-[#183F37] sm:p-10">
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-lg sm:p-8">
      <p className="mb-6 text-xs text-[#60756E]">Aperçu local · nombres fictifs</p>
      <h1 className="mb-6 text-2xl font-black">Choisissez votre bannière</h1>
      <label htmlFor="nationality-preview" className="mb-2 block font-bold">Nationalité du DS</label>
      <CountrySelect id="nationality-preview" countries={countries} value={nationality} onChange={setNationality}
        placeholder="Sélectionnez votre nationalité" listAriaLabel="Liste des nationalités" />
      <p className="mt-2 text-xs text-[#60756E]">Le compteur indique les DS joueurs de chaque nationalité.</p>
      <label htmlFor="team-country-preview" className="mb-2 mt-8 block font-bold">Pays d’affiliation de l’équipe</label>
      <CountrySelect id="team-country-preview" countries={countries} value={teamCountry} onChange={setTeamCountry}
        placeholder="Sélectionnez un pays" listAriaLabel="Liste des pays d’affiliation" />
    </div>
  </main>;
}
