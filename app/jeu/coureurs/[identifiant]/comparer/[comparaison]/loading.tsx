export default function RiderComparisonLoading() {
  return (
    <main className="min-h-screen bg-[#EAF5F3] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-11 w-40 rounded-xl bg-[#D4E7E2]" />
        <div className="h-72 rounded-[2rem] bg-white shadow-sm" />
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-[34rem] rounded-[2rem] bg-white shadow-sm" />
          <div className="h-[34rem] rounded-[2rem] bg-white shadow-sm" />
        </div>
      </div>
    </main>
  );
}
