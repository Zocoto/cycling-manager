"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { startYouthScoutingAction } from "@/app/jeu/centre-de-formation/actions";
import {
  getScoutingCountrySuggestions, getScoutingMapPoint, isScoutingMapPointVisible,
  SCOUTING_MAP_VIEWS, type ScoutingMapView,
} from "@/lib/game/youth-scouting-map";
import {
  YOUTH_SCOUTING_DURATION_OPTIONS,
  YOUTH_SCOUTING_LAST_SEASON_DAY,
  getYouthScoutingDurationOptionsForDay,
} from "@/lib/game/youth-scouting-duration";
import { getScoutingSupervisionPercentageForDay } from "@/lib/game/scouting-supervision";
import type { ScoutingSupervisionStatus } from "@/lib/game/scouting-supervision";
import type { YouthCountry, YouthScout } from "@/services/youth-development";

export function YouthScoutingMap({
  countries,
  scouts,
  currentDayNumber,
  scoutingSupervision,
  defaultCountryId,
  errorMessage,
  tutorialMode = false,
}: {
  countries: YouthCountry[];
  scouts: YouthScout[];
  currentDayNumber: number;
  scoutingSupervision: ScoutingSupervisionStatus;
  defaultCountryId?: string | null;
  errorMessage?: string | null;
  tutorialMode?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [mapView, setMapView] = useState<ScoutingMapView>("world");
  const searchId = useId();
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [selectedDurationDays, setSelectedDurationDays] = useState(3);
  const [manualDialogMessage, setManualDialogMessage] = useState<string | null>(
    null,
  );
  const [dismissedErrorMessage, setDismissedErrorMessage] = useState<
    string | null
  >(null);
  const [selectedCountryId, setSelectedCountryId] = useState(() =>
    countries.some((country) => country.id === defaultCountryId)
      ? (defaultCountryId ?? "")
      : (countries.find((country) => country.code === "FR")?.id ??
        countries[0]?.id ??
        ""),
  );
  const mapScrollRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    return getScoutingCountrySuggestions(countries, search);
  }, [countries, search]);
  const suggestionsVisible = searchOpen && search.trim().length > 0;
  const selectCountry = (country: YouthCountry) => {
    setSelectedCountryId(country.id);
    setSearch(country.name);
    setSearchOpen(false);
    setActiveSuggestion(0);
    // A search always covers every country, even outside the current crop.
    if (!isScoutingMapPointVisible(getScoutingMapPoint(country, mapView))) setMapView("world");
  };
  const selected = countries.find((country) => country.id === selectedCountryId) ?? countries[0];
  const availableScouts = scouts.filter((scout) => !scout.activeMissionId);
  const availableDurationOptions = getYouthScoutingDurationOptionsForDay(
    currentDayNumber,
  );
  const unavailableDurationOptions = YOUTH_SCOUTING_DURATION_OPTIONS.filter(
    (durationDays) => !availableDurationOptions.includes(durationDays),
  );
  const durationDays = availableDurationOptions.includes(selectedDurationDays)
    ? selectedDurationDays
    : (availableDurationOptions[0] ?? null);
  const completionDayNumber = currentDayNumber + (durationDays ?? 0);
  const plannedSupervisionPercentage =
    durationDays === null
      ? 0
      : getScoutingSupervisionPercentageForDay(
          scoutingSupervision.effects,
          completionDayNumber,
        );
  const dialogMessage =
    manualDialogMessage ??
    (errorMessage && errorMessage !== dismissedErrorMessage
      ? errorMessage
      : null);

  useEffect(() => {
    const scroller = mapScrollRef.current;
    if (!scroller || !selected || scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }

    const selectedPoint = getScoutingMapPoint({
      latitude: selected.latitude,
      longitude: selected.longitude,
    }, mapView);
    const point = isScoutingMapPointVisible(selectedPoint) ? selectedPoint : { x: 50, y: 50 };
    const targetLeft =
      (scroller.scrollWidth * point.x) / 100 - scroller.clientWidth / 2;
    const maximumLeft = scroller.scrollWidth - scroller.clientWidth;

    scroller.scrollTo({
      left: Math.min(maximumLeft, Math.max(0, targetLeft)),
      behavior: "smooth",
    });
  }, [selected, mapView]);

  useEffect(() => {
    const list = suggestionsRef.current;
    const option = list?.children[activeSuggestion] as HTMLElement | undefined;
    if (!list || !option || !suggestionsVisible) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [activeSuggestion, suggestionsVisible, filtered]);

  if (!selected) return null;

  return (
    <>
      <div
      data-tutorial-id="youth-tutorial-map"
      className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.7fr)]"
      >
      <div className="self-start overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-[#0B302B] shadow-[0_18px_45px_rgba(11,48,43,0.15)]">
        <div
          data-tutorial-id="youth-tutorial-filters"
          className="relative z-40 flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#72D4B7]">Réseau mondial</p>
            <h2 className="mt-1 text-xl font-black text-white">Choisir une zone de détection</h2>
          </div>
          <div className="relative sm:w-72 sm:shrink-0" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
          }}>
            <label htmlFor={searchId} className="sr-only">Rechercher un pays</label>
            <input id={searchId} value={search} type="search" role="combobox" autoComplete="off"
              aria-autocomplete="list" aria-expanded={suggestionsVisible}
              aria-controls={`${searchId}-suggestions`}
              aria-activedescendant={suggestionsVisible && filtered[activeSuggestion] ? `${searchId}-suggestion-${filtered[activeSuggestion].id}` : undefined}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => { setSearch(event.target.value); setActiveSuggestion(0); setSearchOpen(true); }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Escape") { setSearchOpen(false); return; }
                if (!search.trim()) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault(); setSearchOpen(true);
                  if (filtered.length) setActiveSuggestion((current) => !suggestionsVisible ? 0
                    : (current + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length);
                } else if (event.key === "Enter" && suggestionsVisible) {
                  event.preventDefault();
                  if (filtered[activeSuggestion]) selectCountry(filtered[activeSuggestion]);
                }
              }}
              placeholder="Rechercher un pays…" className="min-h-11 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white outline-none placeholder:text-[#D6DFD2]/60 focus:border-[#F2C94C] focus:ring-2 focus:ring-[#F2C94C]/20" />
            {suggestionsVisible ? <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[#F2C94C]/40 bg-[#FFFDF4] shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
              <div id={`${searchId}-suggestions`} ref={suggestionsRef} role="listbox" aria-label="Pays suggérés" className="relative max-h-72 overflow-y-auto overscroll-contain py-1">
                {filtered.map((country, index) => <button key={country.id} id={`${searchId}-suggestion-${country.id}`}
                  type="button" role="option" tabIndex={-1} aria-selected={activeSuggestion === index}
                  onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveSuggestion(index)}
                  onClick={() => selectCountry(country)}
                  className={`flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-[#183F37] ${activeSuggestion === index ? "bg-[#F2C94C]/20" : "hover:bg-[#EAF5F3]"}`}>
                  <span aria-hidden="true" className={`fi fi-${country.code.toLowerCase()} h-4 w-6 shrink-0 rounded-sm`} />
                  <span className="min-w-0 flex-1 truncate">{country.name}</span>
                  <span className="text-[10px] text-[#60756E]">{country.code}</span>
                </button>)}
                {!filtered.length ? <p role="status" className="px-4 py-3 text-sm font-semibold text-[#60756E]">Aucun pays trouvé.</p> : null}
              </div>
            </div> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#071A17]/55 px-5 py-3">
          <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wide text-[#9BE0CA]">
            Zoom
            <select value={mapView} onChange={(event) => setMapView(event.target.value as ScoutingMapView)} aria-label="Zoom sur la carte"
              className="min-h-10 rounded-lg border border-white/15 bg-[#0B302B] px-3 text-xs font-bold text-white outline-none focus:border-[#F2C94C]">
              {Object.entries(SCOUTING_MAP_VIEWS).map(([code, view]) => <option key={code} value={code}>{view.label}</option>)}
            </select>
          </label>
          {mapView !== "world" ? <button type="button" onClick={() => setMapView("world")} className="min-h-10 rounded-full border border-white/20 px-3 text-[10px] font-black text-[#D6DFD2] hover:border-[#F2C94C]">Vue mondiale</button> : null}
        </div>

        <p
          id="scouting-map-mobile-help"
          className="border-b border-white/10 bg-[#071A17]/70 px-5 py-2 text-center text-[9px] font-black uppercase tracking-[0.12em] text-[#9BE0CA] md:hidden"
        >
          Faites glisser la carte horizontalement pour explorer le monde
        </p>
        <div
          ref={mapScrollRef}
          data-scouting-map-scroll
          tabIndex={0}
          role="region"
          aria-label="Carte mondiale interactive des pays à explorer"
          aria-describedby="scouting-map-mobile-help"
          className="max-w-full touch-pan-x overflow-x-auto overscroll-x-contain [scrollbar-color:#72D4B7_#071A17] [scrollbar-width:thin] md:overflow-hidden"
        >
          <div
            data-scouting-world-map
            className="relative h-[330px] w-[660px] max-w-none shrink-0 overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#176951_0%,#0B302B_58%,#071A17_100%)] md:aspect-[2/1] md:h-auto md:min-h-[330px] md:w-full"
          >
            <WorldPlanisphere view={mapView} />
            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-[#071A17]/65 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#D6DFD2] backdrop-blur-md">
              {countries.length} pays explorables
            </div>
            {countries.map((country) => {
              const point = getScoutingMapPoint(country, mapView);
              if (!isScoutingMapPointVisible(point)) return null;
              const isSelected = country.id === selected.id;
              return (
                <button
                  key={country.id}
                  type="button"
                  title={country.name}
                  aria-label={`Sélectionner ${country.name}`}
                  onClick={() => selectCountry(country)}
                  className={`group absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${isSelected ? "z-20" : "z-10 hover:z-20"}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  <span className={`block rounded-full border transition ${isSelected ? "h-4 w-4 border-white bg-[#F2C94C] shadow-[0_0_0_7px_rgba(242,201,76,0.2),0_0_22px_rgba(242,201,76,0.65)]" : "h-2 w-2 border-[#C9F0E4]/60 bg-[#72D4B7]/80 shadow-[0_0_7px_rgba(114,212,183,0.4)] group-hover:h-3 group-hover:w-3 group-hover:border-white group-hover:bg-[#F2C94C]"}`} />
                  {isSelected ? (
                    <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#F2C94C]/50 bg-[#071A17]/90 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur-md">
                      {country.code} · {country.name}
                    </span>
                  ) : null}
                </button>
              );
            })}
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
        <p className="mt-2 rounded-xl border border-[#315B3E]/10 bg-white px-3 py-2 text-[10px] font-bold leading-4 text-[#60756E]">
          {selected.reputationSourceSeasonName
            ? `Réputation calculée uniquement depuis le classement UCI ${selected.reputationSourceSeasonName} : ${selected.uciNationRank ? `${selected.uciNationRank}${selected.uciNationRank === 1 ? "er" : "e"}` : "nation non classée"}.`
            : "Aucune saison UCI précédente : réputation provisoire minimale."}
        </p>
        <div className="mt-4 rounded-2xl border border-[#315B3E]/10 bg-[#EAF5F3] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#60756E]">Traditions de formation</p>
          <p className="mt-2 text-sm font-extrabold text-[#176951]">{selected.specialtyLabel} · {selected.secondarySpecialtyLabel}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">Une tendance locale, jamais une garantie : les rapports peuvent révéler d’autres profils.</p>
        </div>
        {!tutorialMode && scoutingSupervision.currentPercentage > 0 ? (
          <div className="mt-4 rounded-2xl border border-[#D6A600]/25 bg-[#FFF9DB] p-4 text-[#715700]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em]">
              Supervision renforcée
            </p>
            <p className="mt-1 text-sm font-black">
              +{scoutingSupervision.currentPercentage} % sur les rapports
            </p>
            <p className="mt-1 text-xs font-semibold leading-5">
              Cumul complet actif pendant encore{" "}
              {scoutingSupervision.remainingDays} jour
              {scoutingSupervision.remainingDays > 1 ? "s" : ""}
              {scoutingSupervision.stableThroughDayNumber
                ? `, jusqu’au J${scoutingSupervision.stableThroughDayNumber}.`
                : "."}
            </p>
          </div>
        ) : null}
        {tutorialMode ? (
          <TutorialMissionLauncher countryName={selected.name} />
        ) : (
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
            <select name="durationDays" value={durationDays ?? ""} disabled={durationDays === null} onChange={(event) => setSelectedDurationDays(Number(event.target.value))} className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] disabled:cursor-not-allowed disabled:bg-[#EDF1EF]">
              {durationDays === null ? <option value="">Aucune durée disponible</option> : null}
              {YOUTH_SCOUTING_DURATION_OPTIONS.map((day) => <option key={day} value={day} disabled={!availableDurationOptions.includes(day)}>{day} jours{availableDurationOptions.includes(day) ? "" : " — après J28"}</option>)}
            </select>
          </label>
          {unavailableDurationOptions.length ? (
            <p role="alert" className="rounded-xl border border-[#D6A600]/30 bg-[#FFF9DB] px-3 py-2.5 text-xs font-bold leading-5 text-[#715700]">
              {availableDurationOptions.length
                ? `La saison est au J${currentDayNumber} : ${unavailableDurationOptions.length === 1 ? `la durée de ${unavailableDurationOptions[0]} jours dépasserait` : `les durées de ${unavailableDurationOptions.join(", ")} jours dépasseraient`} le J${YOUTH_SCOUTING_LAST_SEASON_DAY} et ${unavailableDurationOptions.length === 1 ? "a été désactivée" : "ont été désactivées"}.`
                : `La saison est au J${currentDayNumber} : il ne reste plus assez de temps pour une mission de 3 jours avant le J${YOUTH_SCOUTING_LAST_SEASON_DAY}.`}
            </p>
          ) : null}
          {durationDays !== null && plannedSupervisionPercentage > 0 ? (
            <p className="rounded-xl border border-[#42B99A]/25 bg-[#EAF5F3] px-3 py-2.5 text-xs font-bold leading-5 text-[#176951]">
              Rapport prévu au J{completionDayNumber} · bonus de supervision
              confirmé : +{plannedSupervisionPercentage} %.
            </p>
          ) : durationDays !== null && scoutingSupervision.currentPercentage > 0 ? (
            <p className="rounded-xl border border-[#D6A600]/25 bg-[#FFF9DB] px-3 py-2.5 text-xs font-bold leading-5 text-[#715700]">
              Le bonus actif aujourd’hui aura expiré avant le rapport du J
              {completionDayNumber}.
            </p>
          ) : null}
          <MissionSubmitButton
            disabled={!availableScouts.length}
            seasonBoundaryBlocked={durationDays === null}
            onSeasonBoundaryBlocked={() =>
              setManualDialogMessage(
                `Mission impossible : au J${currentDayNumber}, une mission de 3 jours minimum finirait après le J${YOUTH_SCOUTING_LAST_SEASON_DAY}, dernier jour de la saison. Le scouting rouvrira à la prochaine saison.`,
              )
            }
          />
          {!availableScouts.length ? <p className="text-xs font-bold text-[#B54242]">Aucun scout disponible : attendez le retour d’une mission ou recrutez-en un.</p> : null}
          </form>
        )}
      </aside>
      </div>

      {dialogMessage ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="scouting-error-title"
          aria-describedby="scouting-error-message"
          className="fixed inset-0 z-[300] flex items-center justify-center bg-[#041411]/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-[1.75rem] border border-[#F4A6A6]/35 bg-[#FFFDF4] p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.45)] sm:p-8">
            <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FDE8E8] text-2xl font-black text-[#A22F2F]">!</div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#A22F2F]">Scouting non lancé</p>
            <h2 id="scouting-error-title" className="mt-2 text-2xl font-black text-[#071A17]">Le scout reste disponible</h2>
            <p id="scouting-error-message" className="mt-3 text-sm font-semibold leading-6 text-[#526861]">{dialogMessage}</p>
            <button type="button" autoFocus onClick={() => { setManualDialogMessage(null); if (errorMessage) setDismissedErrorMessage(errorMessage); }} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#176951] px-4 text-xs font-black uppercase tracking-[0.13em] text-white transition hover:bg-[#0B302B]">Compris</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TutorialMissionLauncher({ countryName }: { countryName: string }) {
  const [durationDays, setDurationDays] = useState(3);
  const [started, setStarted] = useState(false);

  return (
    <div
      data-tutorial-id="youth-tutorial-mission-launch"
      className="mt-5 space-y-4"
    >
      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">
          Scout assigné · simulation
        </span>
        <select
          value="tutorial-scout"
          disabled
          className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37]"
        >
          <option value="tutorial-scout">Camille Moreau · Niveau 3</option>
        </select>
      </label>
      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">
          Durée du scouting
        </span>
        <select
          value={durationDays}
          onChange={(event) => {
            setDurationDays(Number(event.target.value));
            setStarted(false);
          }}
          className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70]"
        >
          {YOUTH_SCOUTING_DURATION_OPTIONS.map((day) => (
            <option key={day} value={day}>
              {day} jours
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => setStarted(true)}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#176951] px-4 text-xs font-black uppercase tracking-[0.13em] text-white transition hover:bg-[#0B302B]"
      >
        {started ? "Mission simulée" : "Simuler le départ"}
      </button>
      <p
        aria-live="polite"
        className={`rounded-xl px-3 py-2 text-xs font-bold ${
          started
            ? "bg-[#DDF3E7] text-[#176951]"
            : "bg-[#FFF5D6] text-[#806114]"
        }`}
      >
        {started
          ? `Camille explore ${countryName} pendant ${durationDays} jour${durationDays > 1 ? "s" : ""}. Aucune donnée n’a été enregistrée.`
          : "Scout fictif disponible : cette simulation reste sans effet sur votre staff et votre budget."}
      </p>
    </div>
  );
}

function CountryMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-3 ${accent ? "border-[#F2C94C]/60 bg-[#F2C94C]/15" : "border-[#315B3E]/10 bg-white"}`}><dt className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">{label}</dt><dd className="mt-1 text-lg font-black text-[#071A17]">{value}</dd></div>;
}

function MissionSubmitButton({
  disabled,
  seasonBoundaryBlocked,
  onSeasonBoundaryBlocked,
}: {
  disabled: boolean;
  seasonBoundaryBlocked: boolean;
  onSeasonBoundaryBlocked: () => void;
}) {
  const { pending } = useFormStatus();
  return <button type={seasonBoundaryBlocked ? "button" : "submit"} disabled={disabled || pending} onClick={seasonBoundaryBlocked ? onSeasonBoundaryBlocked : undefined} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#176951] px-4 text-xs font-black uppercase tracking-[0.13em] text-white transition hover:bg-[#0B302B] disabled:cursor-not-allowed disabled:bg-[#B8C8C2]">{pending ? "Départ en cours…" : seasonBoundaryBlocked ? "Pourquoi le scouting est indisponible ?" : "Envoyer le scout"}</button>;
}

function WorldPlanisphere({ view }: { view: ScoutingMapView }) {
  const frame = SCOUTING_MAP_VIEWS[view];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bg-[length:100%_100%] bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("/images/scouting-world-map.svg")',
        left: `${-frame.left * 100 / frame.size}%`, top: `${-frame.top * 100 / frame.size}%`,
        width: `${10000 / frame.size}%`, height: `${10000 / frame.size}%` }}
    />
  );
}
