type GameRouteLoadingProps = {
  variant?: "dashboard" | "calendar" | "roster" | "finance";
};

const cardCounts = {
  dashboard: 6,
  calendar: 5,
  roster: 8,
  finance: 4,
} as const;

export function GameRouteLoading({
  variant = "dashboard",
}: GameRouteLoadingProps) {
  const count = cardCounts[variant];

  return (
    <main
      aria-busy="true"
      aria-label="Chargement de la page"
      className="min-h-screen bg-[#EAF5F3] text-[#082A2A]"
    >
      <div className="border-b border-white/10 bg-[#071A17]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <div className="h-11 w-40 animate-pulse rounded-xl bg-white/10" />
          <div className="hidden h-10 max-w-xl flex-1 animate-pulse rounded-xl bg-white/10 lg:block" />
          <div className="h-10 w-28 animate-pulse rounded-xl bg-white/10" />
        </div>
      </div>

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <div className="h-10 w-56 animate-pulse rounded-xl bg-[#176951]/12" />
        <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded-lg bg-[#176951]/10" />

        <div
          className={`mt-9 grid gap-5 ${
            variant === "roster"
              ? "sm:grid-cols-2 xl:grid-cols-4"
              : variant === "calendar"
                ? "lg:grid-cols-5"
                : "md:grid-cols-2 xl:grid-cols-3"
          }`}
        >
          {Array.from({ length: count }, (_, index) => (
            <div
              key={index}
              className="min-h-36 animate-pulse rounded-3xl border border-[#315B3E]/10 bg-white/75 shadow-sm"
            >
              <div className="h-3 w-2/5 rounded-full bg-[#176951]/10 m-6" />
              <div className="mx-6 mt-4 h-5 w-3/4 rounded-lg bg-[#176951]/10" />
              <div className="mx-6 mt-3 h-4 w-1/2 rounded-lg bg-[#176951]/8" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
