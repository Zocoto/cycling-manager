"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ChatMediaDialog({ title, onClose, children }: {
  title: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const resize = () => {
      dialog.style.setProperty("--chat-picker-height", `${window.visualViewport?.height ?? window.innerHeight}px`);
      dialog.style.setProperty("--chat-picker-top", `${window.visualViewport?.offsetTop ?? 0}px`);
    };
    resize();
    dialog.showModal();
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    return () => {
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
      className="fixed left-0 top-[var(--chat-picker-top,0px)] m-0 h-[var(--chat-picker-height,100dvh)] max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-[#0B302B] backdrop:bg-[#03110E]/45 backdrop:backdrop-blur-sm sm:left-1/2 sm:top-1/2 sm:h-[min(38rem,85dvh)] sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:shadow-2xl">
      <section className="flex h-full min-h-0 flex-col bg-[#F7FBF9] pt-[env(safe-area-inset-top)] sm:pt-0">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#315B3E]/10 bg-white px-4 py-3">
          <h2 id={titleId} className="text-base font-black">{title}</h2>
          <button type="button" autoFocus onClick={onClose} aria-label="Fermer le sélecteur"
            className="flex h-10 items-center gap-2 rounded-full bg-[#EAF5F0] px-4 text-xs font-black text-[#176951]">
            Terminé <span aria-hidden="true">×</span>
          </button>
        </header>
        {children}
        <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />
      </section>
    </dialog>, document.body,
  );
}
