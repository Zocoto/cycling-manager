"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type CountryOption = {
  id: string;
  name: string;
  isoAlpha2: string;
};

type CountrySelectProps = {
  id: string;
  countries: CountryOption[];
  value: string;
  onChange: (countryId: string) => void;
  placeholder: string;
  listAriaLabel: string;
  describedBy?: string;
  disabled?: boolean;
  invalid?: boolean;
  locked?: boolean;
};

type CountryFlagProps = {
  isoAlpha2: string;
  countryName?: string;
  large?: boolean;
};

export function CountrySelect({
  id,
  countries,
  value,
  onChange,
  placeholder,
  listAriaLabel,
  describedBy,
  disabled = false,
  invalid = false,
  locked = false,
}: CountrySelectProps) {
  const [search, setSearch] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === value) ?? null,
    [countries, value]
  );

  const filteredCountries = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(search);

    if (!normalizedSearch) {
      return countries;
    }

    return countries.filter((country) =>
      normalizeSearchValue(
        `${country.name} ${country.isoAlpha2}`
      ).includes(normalizedSearch)
    );
  }, [countries, search]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    searchInputRef.current?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  function selectCountry(country: CountryOption) {
    onChange(country.id);
    setSearch("");
    setIsMenuOpen(false);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
      <div ref={menuRef} className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled || locked}
          aria-haspopup="listbox"
          aria-expanded={isMenuOpen}
          aria-describedby={describedBy}
          onClick={() => {
            if (disabled || locked) {
              return;
            }

            setIsMenuOpen((currentValue) => !currentValue);
          }}
          className={[
            "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border bg-white px-4 text-left text-[#082A2A] outline-none transition",
            "focus:border-[#42B99A] focus:ring-2 focus:ring-[#42B99A]/25",
            "disabled:cursor-not-allowed disabled:bg-[#EDF2EF] disabled:text-[#60756E]",
            invalid
              ? "border-[#D5B13E] ring-2 ring-[#D5B13E]/20"
              : "border-[#315B3E]/25",
          ].join(" ")}
        >
          <span className="flex min-w-0 items-center gap-3">
            {selectedCountry ? (
              <>
                <CountryFlag isoAlpha2={selectedCountry.isoAlpha2} />
                <span className="truncate font-semibold">
                  {selectedCountry.name}
                </span>
              </>
            ) : (
              <span className="text-[#789087]">{placeholder}</span>
            )}
          </span>

          {!locked ? (
            <span
              aria-hidden="true"
              className="shrink-0 text-sm text-[#60756E]"
            >
              {isMenuOpen ? "▲" : "▼"}
            </span>
          ) : (
            <span aria-hidden="true" className="shrink-0 text-base">
              🔒
            </span>
          )}
        </button>

        {isMenuOpen && !locked ? (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-[#315B3E]/20 bg-white shadow-xl">
            <div className="border-b border-[#315B3E]/10 p-3">
              <input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un pays..."
                aria-label="Rechercher un pays"
                autoComplete="off"
                className="min-h-10 w-full rounded-lg border border-[#315B3E]/20 bg-[#F8FBF9] px-3 text-sm text-[#082A2A] outline-none placeholder:text-[#789087] focus:border-[#42B99A] focus:ring-2 focus:ring-[#42B99A]/20"
              />
            </div>

            <div
              role="listbox"
              aria-label={listAriaLabel}
              className="max-h-72 overflow-y-auto p-2"
            >
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country) => {
                  const isSelected = country.id === value;

                  return (
                    <button
                      key={country.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectCountry(country)}
                      className={
                        isSelected
                          ? "flex min-h-11 w-full items-center gap-3 rounded-lg bg-[#DFF4EC] px-3 text-left font-bold text-[#176951]"
                          : "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[#183F37] transition hover:bg-[#F0F7F3]"
                      }
                    >
                      <CountryFlag isoAlpha2={country.isoAlpha2} />

                      <span className="min-w-0 flex-1 truncate">
                        {country.name}
                      </span>

                      {isSelected ? (
                        <span
                          aria-hidden="true"
                          className="font-black text-[#278B70]"
                        >
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-6 text-center text-sm text-[#60756E]">
                  Aucun pays trouvé.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-12 items-center justify-center overflow-hidden rounded-lg border border-[#315B3E]/15 bg-[#F5F9F7] px-4">
        {selectedCountry ? (
          <CountryFlag
            isoAlpha2={selectedCountry.isoAlpha2}
            countryName={selectedCountry.name}
            large
          />
        ) : (
          <span className="text-sm font-semibold text-[#789087]">
            Drapeau
          </span>
        )}
      </div>
    </div>
  );
}

function CountryFlag({
  isoAlpha2,
  countryName,
  large = false,
}: CountryFlagProps) {
  const normalizedCode = isoAlpha2.trim().toLowerCase();

  if (!/^[a-z]{2}$/.test(normalizedCode)) {
    return (
      <span
        aria-label={
          countryName
            ? `Drapeau : ${countryName}`
            : "Drapeau indisponible"
        }
        role="img"
        className={large ? "text-4xl" : "text-2xl"}
      >
        🏳️
      </span>
    );
  }

  return (
    <span
      role={countryName ? "img" : undefined}
      aria-label={
        countryName ? `Drapeau : ${countryName}` : undefined
      }
      aria-hidden={countryName ? undefined : true}
      className={[
        "fi",
        `fi-${normalizedCode}`,
        "shrink-0 overflow-hidden rounded-sm shadow-sm",
        large ? "text-4xl" : "text-2xl",
      ].join(" ")}
    />
  );
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
