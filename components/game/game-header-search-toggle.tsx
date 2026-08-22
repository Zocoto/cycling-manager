"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function GameHeaderSearchToggle({
  children,
  isEnglish = false,
}: {
  children: ReactNode;
  isEnglish?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    rootRef.current?.querySelector("input")?.focus();

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        title={isEnglish ? "Search" : "Rechercher"}
        aria-label={
          open
            ? isEnglish
              ? "Close search"
              : "Fermer la recherche"
            : isEnglish
              ? "Open search"
              : "Ouvrir la recherche"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] sm:h-10 sm:w-10 ${
          open
            ? "border-[var(--game-header-accent)] bg-[var(--game-header-accent)] text-[#071A17]"
            : "border-[#D6DFD2]/25 bg-white/5 text-[#D6DFD2] hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)]"
        }`}
      >
        <SearchIcon className="h-[18px] w-[18px]" />
      </button>

      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-label={isEnglish ? "Global search" : "Recherche globale"}
          className="fixed left-3 right-3 top-[3.75rem] z-[150] w-auto rounded-2xl border border-[#D6DFD2]/20 bg-[#0B302B] p-2.5 text-[#FFFDF4] shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(32rem,calc(100vw-1.5rem))] sm:p-3"
        >
          {children}
        </section>
      ) : null}
    </div>
  );
}

function SearchIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
