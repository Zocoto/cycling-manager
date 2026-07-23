export default function RaceLiveLoading() {
  return (
    <main className="min-h-screen bg-[#EAF5F3] px-3 py-8 sm:px-8">
      <div className="mx-auto max-w-[1800px] animate-pulse">
        <div className="h-8 w-64 rounded-lg bg-[#176951]/15" />
        <div className="mt-5 h-16 rounded-2xl bg-white/80" />
        <div className="mt-4 h-[34rem] rounded-[2rem] bg-[#0B302B]/90" />
        <p className="mt-4 text-center text-sm font-bold text-[#48665F]">
          Préparation de la course et de sa startlist…
        </p>
      </div>
    </main>
  );
}
