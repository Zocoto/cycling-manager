const cardWidths = ["w-2/3", "w-4/5", "w-3/5"];

export default function GameLoading() {
  return (
    <main
      className="min-h-screen bg-[#EAF5F3] text-[#082A2A]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="border-b border-[#78947D]/25 bg-[#071A17] px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4">
          <div className="h-12 w-12 animate-pulse rounded-full bg-[#278B70]/45" />
          <div className="h-8 w-36 animate-pulse rounded-lg bg-white/10" />
          <div className="ml-auto hidden h-10 max-w-xl flex-1 animate-pulse rounded-xl bg-white/10 lg:block" />
          <div className="h-10 w-28 animate-pulse rounded-lg bg-[#F2C94C]/20" />
        </div>
      </div>

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <p className="sr-only">Chargement de votre espace de jeu…</p>

        <div className="animate-pulse rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] p-8 shadow-[0_24px_70px_rgba(19,60,46,0.14)] sm:p-10">
          <div className="h-3 w-36 rounded-full bg-[#9BE0BC]/35" />
          <div className="mt-5 h-10 max-w-xl rounded-xl bg-white/15" />
          <div className="mt-4 h-4 max-w-2xl rounded-full bg-white/10" />
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cardWidths.concat(cardWidths).map((width, index) => (
            <div
              key={`${width}-${index}`}
              className="min-h-44 animate-pulse rounded-2xl border border-[#315B3E]/10 bg-white p-6 shadow-[0_14px_36px_rgba(19,60,46,0.06)]"
            >
              <div className="h-11 w-11 rounded-xl bg-[#D7EAE4]" />
              <div className={`mt-6 h-5 rounded-full bg-[#C8DED7] ${width}`} />
              <div className="mt-4 h-3 w-full rounded-full bg-[#E1ECE8]" />
              <div className="mt-2 h-3 w-4/5 rounded-full bg-[#E1ECE8]" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
