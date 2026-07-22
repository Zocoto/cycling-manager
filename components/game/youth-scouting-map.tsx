"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { startYouthScoutingAction } from "@/app/jeu/centre-de-formation/actions";
import { projectCountryCoordinate } from "@/data/country-map-coordinates";
import type { YouthCountry, YouthScout } from "@/services/youth-development";

export function YouthScoutingMap({ countries, scouts }: { countries: YouthCountry[]; scouts: YouthScout[] }) {
  const [search, setSearch] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState(countries.find((country) => country.code === "FR")?.id ?? countries[0]?.id ?? "");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    return query ? countries.filter((country) => country.name.toLocaleLowerCase("fr").includes(query) || country.code.toLocaleLowerCase("fr").includes(query)).slice(0, 12) : countries.slice(0, 8);
  }, [countries, search]);
  const selected = countries.find((country) => country.id === selectedCountryId) ?? countries[0];
  const availableScouts = scouts.filter((scout) => !scout.activeMissionId);
  if (!selected) return null;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.7fr)]">
      <div className="overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-[#0B302B] shadow-[0_18px_45px_rgba(11,48,43,0.15)]">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#72D4B7]">Réseau mondial</p>
            <h2 className="mt-1 text-xl font-black text-white">Choisir une zone de détection</h2>
          </div>
          <label className="relative block sm:w-72">
            <span className="sr-only">Rechercher un pays</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Rechercher un pays…" className="min-h-11 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white outline-none placeholder:text-[#D6DFD2]/60 focus:border-[#F2C94C] focus:ring-2 focus:ring-[#F2C94C]/20" />
          </label>
        </div>

        <div className="relative aspect-[2/1] min-h-[330px] overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#176951_0%,#0B302B_58%,#071A17_100%)]">
          <WorldSilhouette />
          {countries.map((country) => {
            const point = projectCountryCoordinate({ latitude: country.latitude, longitude: country.longitude });
            const isSelected = country.id === selected.id;
            return (
              <button key={country.id} type="button" title={country.name} aria-label={`Sélectionner ${country.name}`} onClick={() => setSelectedCountryId(country.id)} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${isSelected ? "z-20 h-4 w-4 border-white bg-[#F2C94C] shadow-[0_0_0_7px_rgba(242,201,76,0.2)]" : "h-2 w-2 border-[#9BE0CA]/50 bg-[#72D4B7]/65 hover:z-10 hover:h-3 hover:w-3 hover:bg-[#F2C94C]"}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} />
            );
          })}
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
            {filtered.map((country) => (
              <button key={country.id} type="button" onClick={() => setSelectedCountryId(country.id)} className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] backdrop-blur-md transition ${country.id === selected.id ? "border-[#F2C94C] bg-[#F2C94C] text-[#071A17]" : "border-white/15 bg-[#071A17]/70 text-[#D6DFD2] hover:border-[#72D4B7]"}`}>{country.code} · {country.name}</button>
            ))}
          </div>
        </div>
      </div>

      <aside className="rounded-[1.75rem] border border-[#315B3E]/15 bg-[#FFFDF4] p-6 shadow-[0_18px_45px_rgba(11,48,43,0.1)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">Zone sélectionnée</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#071A17]">{selected.name}</h2>
          </div>
          <span className={`fi fi-${selected.code.toLowerCase()} mt-1 h-8 w-11 rounded shadow-sm`} aria-label={selected.code} />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3">
          <CountryMetric label="Réputation mondiale" value={`${selected.reputation}/10`} accent />
          <CountryMetric label="Installations locales" value={`Niveau ${selected.facilityLevel}`} />
        </dl>
        <div className="mt-4 rounded-2xl border border-[#315B3E]/10 bg-[#EAF5F3] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#60756E]">Traditions de formation</p>
          <p className="mt-2 text-sm font-extrabold text-[#176951]">{selected.specialtyLabel} · {selected.secondarySpecialtyLabel}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">Une tendance locale, jamais une garantie : les rapports peuvent révéler d’autres profils.</p>
        </div>
        <form action={startYouthScoutingAction} className="mt-5 space-y-4">
          <input type="hidden" name="countryId" value={selected.id} />
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">Scout assigné</span>
            <select name="scoutContractId" required defaultValue="" className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70]">
              <option value="" disabled>Choisir un scout</option>
              {availableScouts.map((scout) => <option key={scout.contractId} value={scout.contractId}>{scout.firstName} {scout.lastName} · N{scout.level}{scout.countryId === selected.id ? " · affinité +15%" : ""}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">Durée du scouting</span>
            <select name="durationDays" defaultValue="3" className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70]">
              {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day} jour{day > 1 ? "s" : ""}</option>)}
            </select>
          </label>
          <MissionSubmitButton disabled={!availableScouts.length} />
          {!availableScouts.length ? <p className="text-xs font-bold text-[#B54242]">Aucun scout disponible : attendez le retour d’une mission ou recrutez-en un.</p> : null}
        </form>
      </aside>
    </div>
  );
}

function CountryMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-3 ${accent ? "border-[#F2C94C]/60 bg-[#F2C94C]/15" : "border-[#315B3E]/10 bg-white"}`}><dt className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">{label}</dt><dd className="mt-1 text-lg font-black text-[#071A17]">{value}</dd></div>;
}

function MissionSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#176951] px-4 text-xs font-black uppercase tracking-[0.13em] text-white transition hover:bg-[#0B302B] disabled:cursor-not-allowed disabled:bg-[#B8C8C2]">{pending ? "Départ en cours…" : "Envoyer le scout"}</button>;
}

function WorldSilhouette() {
  return (
    <svg aria-hidden="true" viewBox="0 0 1000 500" className="absolute inset-0 h-full w-full opacity-90">
      <g fill="#9BE0CA" opacity="0.17" stroke="#9BE0CA" strokeWidth="2">
        <path d="M55 105 105 55l105 12 76 43 14 49-54 35-31 70-50 38-38-61-51-20-34-64Z" />
        <path d="m255 282 55 28 30 64-24 96-45-47-20-78Z" />
        <path d="m430 98 48-42 75 18 46-20 115 24 79 62-42 47-105 2-43 53-33 106-70-27-23-75-65-26-17-61Z" />
        <path d="m505 229 84 9 54 92-47 127-55-15-34-93-43-64Z" />
        <path d="m793 315 73-30 82 49-19 73-91 7-55-46Z" />
        <path d="m866 435 19-9 15 16-17 18Z" />
      </g>
      <g stroke="#D6DFD2" strokeWidth="1" opacity="0.08"><path d="M0 100h1000M0 200h1000M0 300h1000M0 400h1000" /><path d="M200 0v500M400 0v500M600 0v500M800 0v500" /></g>
    </svg>
  );
}
