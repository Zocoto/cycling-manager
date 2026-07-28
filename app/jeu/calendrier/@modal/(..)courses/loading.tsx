export default function CourseModalLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Chargement de la fiche de course"
      className="fixed inset-0 z-[100] grid place-items-center bg-[#071A17]/75 p-0 backdrop-blur-sm sm:p-5"
    >
      <div className="h-full w-full overflow-hidden bg-[#EAF5F3] shadow-2xl sm:max-h-[94vh] sm:max-w-[1480px] sm:rounded-[2rem]">
        <div className="animate-pulse">
          <div className="h-36 bg-[linear-gradient(135deg,#071A17,#176951)] sm:h-44" />
          <div className="space-y-5 p-5 sm:p-8">
            <div className="h-7 w-2/3 rounded-full bg-[#CFE1D8]" />
            <div className="h-4 w-full rounded-full bg-[#DCE9E3]" />
            <div className="h-4 w-5/6 rounded-full bg-[#DCE9E3]" />
            <div className="grid gap-4 pt-3 sm:grid-cols-2">
              <div className="h-40 rounded-2xl bg-white" />
              <div className="h-40 rounded-2xl bg-white" />
            </div>
          </div>
        </div>
        <span className="sr-only">Chargement de la fiche de course…</span>
      </div>
    </div>
  );
}
