export default function PantheonLoading() {
  return (
    <main aria-busy="true" className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
        <div className="rounded-3xl bg-[#102720] px-6 py-12 text-[#FFFDF4] sm:px-10">
          <h1 className="font-serif text-5xl font-black">Panthéon</h1>
        </div>
        <p role="status" className="mt-5 rounded-2xl bg-white p-6">
          Chargement du palmarès…
        </p>
      </div>
    </main>
  );
}
