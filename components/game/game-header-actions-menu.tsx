"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function GameHeaderActionsMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

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
        title="Ouvrir les autres raccourcis"
        aria-label={open ? "Fermer le menu du jeu" : "Ouvrir le menu du jeu"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] ${
          open
            ? "border-[var(--game-header-accent)] bg-[var(--game-header-accent)] text-[#071A17]"
            : "border-[#D6DFD2]/25 bg-white/5 text-[#D6DFD2] hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)]"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-5 w-5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M4 5h12M4 10h12M4 15h12" />
        </svg>
      </button>

      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-label="Raccourcis du jeu"
          onClickCapture={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("a")
            ) {
              setOpen(false);
            }
          }}
          className="absolute right-0 top-full z-[130] mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[#D6DFD2]/20 bg-[#0B302B] p-4 text-[#FFFDF4] shadow-[0_24px_70px_rgba(0,0,0,0.38)]"
        >
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--game-header-accent)]">
                Navigation
              </p>
              <p className="mt-0.5 text-sm font-extrabold">Menu rapide</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer le menu du jeu"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </div>

          {children}
        </section>
      ) : null}
    </div>
  );
}
