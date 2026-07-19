"use client";

import { useRouter } from "next/navigation";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
} from "react";

export function CourseModal({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        router.back();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [router]);

  function closeOnBackdrop(
    event: MouseEvent<HTMLDivElement>
  ) {
    if (event.target === event.currentTarget) {
      router.back();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fiche de course"
      onMouseDown={closeOnBackdrop}
      className="fixed inset-0 z-[100] grid place-items-center bg-[#071A17]/75 p-0 backdrop-blur-sm sm:p-5"
    >
      <div className="relative h-full w-full overflow-y-auto bg-[#EAF5F3] shadow-2xl sm:max-h-[94vh] sm:max-w-[1480px] sm:rounded-[2rem] [&_main]:min-h-0 [&_main>header]:hidden [&_main>section]:max-w-none [&_main>section]:px-3 [&_main>section]:py-3 sm:[&_main>section]:px-5 sm:[&_main>section]:py-5 [&_main>section>a]:hidden [&_main>section>article]:mt-0">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Fermer la fiche de course"
          className="fixed right-4 top-4 z-[110] grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-[#071A17] text-xl font-black text-white shadow-xl transition hover:scale-105 hover:bg-[#176951] sm:absolute"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
