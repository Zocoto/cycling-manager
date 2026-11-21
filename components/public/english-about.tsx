import Link from "@/components/public/public-link";

export function EnglishAbout() {
  return (
    <article className="bg-[#F7FAF7] px-5 py-12 text-[#082A2A] sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">About Cyclo Stratège</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">A cycling game built around sporting decisions.</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-[#48665F]">Cyclo Stratège is an independent, free online cycling management game. You take charge of a team, recruit and train riders, plan a race calendar and set tactics against other managers.</p>
        <section className="mt-10 rounded-2xl border border-[#315B3E]/15 bg-white p-6 sm:p-8">
          <h2 className="text-3xl font-black">The sports director’s seat</h2>
          <p className="mt-5 leading-8 text-[#48665F]">Every rider brings different strengths. Your job is to build a squad, choose the opportunities that suit it and support its development over the seasons. Recruitment, staff, facilities and sponsor objectives connect the racing programme with the future of the club.</p>
          <p className="mt-4 leading-8 text-[#48665F]">The project grows through regular updates and feedback from its community. Cycling enthusiasm and tactical depth guide its development, with room for both new managers and players who enjoy detailed planning.</p>
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Cycling", "Rider profiles, varied routes and team roles give every race a sporting context."],
            ["Management", "Build a team over time through recruitment, training, staff and club development."],
            ["Community", "Race against other managers and share the life of the peloton throughout the season."],
          ].map(([title, text]) => <div key={title} className="rounded-2xl bg-[#EAF5F3] p-6"><h2 className="text-xl font-black">{title}</h2><p className="mt-3 leading-7 text-[#48665F]">{text}</p></div>)}
        </section>
        <p className="mt-8 leading-8 text-[#48665F]">Play in a browser on desktop or mobile. You can also add the game to your phone’s home screen, without an app-store download.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/inscription" className="inline-flex min-h-12 items-center rounded-xl bg-[#F2C94C] px-5 py-3 font-black text-[#071A17]">Create my team for free</Link>
          <Link href="/guide" className="inline-flex min-h-12 items-center rounded-xl border border-[#315B3E]/30 px-5 py-3 font-bold text-[#176951]">Discover the game guide</Link>
        </div>
      </div>
    </article>
  );
}
