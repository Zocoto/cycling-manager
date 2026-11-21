import Link from "@/components/public/public-link";
import { getPublicGuide, PUBLIC_GUIDE_SLUGS } from "@/lib/seo/public-guides";

const sections = [
  { id: "journee", title: "Plan a day as sports director", text: "Use your desk to review alerts, race entries, training and club finances. The calendar shows upcoming races and their profiles. Check which riders are available before planning the team’s next target." },
  { id: "coureurs", title: "Understand your riders", text: "Riders have distinct attributes for climbing, hills, flat roads, time trials, cobbles, sprinting and other racing skills. Compare those strengths with their natural profile, age and potential. Physical form and morale describe two different parts of their current condition." },
  { id: "courses", title: "Prepare a race strategy", text: "Choose a route that suits your squad, enter your riders and assign their jobs in race preparation. Decide who leads, who supports and which riders have more freedom. Equipment and reconnaissance can also contribute to the plan. Follow the simulation, then use the result and race journal to understand what happened." },
  { id: "baremes", title: "Read results and rewards", text: "The value of a result depends on the event and the placing. Stage results and the general classification are different targets. Read the event information and reward descriptions when choosing your programme, and review the official results after racing." },
  { id: "equipe", title: "Build a team that works together", text: "Recruit riders for clear jobs and check their contract terms and future wages. Coaches help development, while medical staff and recovery facilities support rider availability. A balanced roster gives you more options than relying on the same leader for every race." },
  { id: "sponsors", title: "Follow your sponsor’s objectives", text: "Sponsors support the club and set sporting or development commitments. Read the target, its progress and its satisfaction reward. Use those objectives to plan the season alongside your own sporting ambitions." },
  { id: "structures", title: "Develop your club’s facilities", text: "Facilities expand your options for training, recovery, scouting and team development. Review construction cost, time and capacity before committing. Some facilities also offer a specialisation: choose an orientation that matches how you manage your squad." },
  { id: "progression", title: "Prepare the club’s future", text: "Scouting, the cycling school and the Dev Team let you invest in young riders. Race results, reputation and sponsor relationships help shape the club’s longer-term opportunities. Review finances regularly and leave space for future commitments." },
  { id: "pages", title: "Find your way around the game", text: "Your desk is the starting point. The navigation groups the roster and staff, races and results, equipment and inventory, club management, federations and championships, and community features. The sports director’s assistant links important alerts to the relevant settings." },
] as const;

export function EnglishGameGuide() {
  return (
    <div className="bg-[#F7FAF7] text-[#082A2A]">
      <header className="border-b border-[#315B3E]/15 bg-[#EAF5F3] px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">The sports director’s guide</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">Your first steps in Cyclo Stratège.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#48665F]">Manage a cycling team, develop your riders and prepare for races against other managers. Cyclo Stratège is a free browser game for desktop and mobile.</p>
          <Link href="/inscription" className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-[#F2C94C] px-5 py-3 font-black text-[#071A17]">Create my team for free</Link>
          <nav aria-label="Guide contents" className="mt-8 flex flex-wrap gap-2">
            <Link href="#demarrage" className="rounded-lg border border-[#315B3E]/20 bg-white px-3 py-2 text-sm font-bold text-[#176951]">Getting started</Link>
            {sections.map(section => <Link key={section.id} href={`#${section.id}`} className="rounded-lg border border-[#315B3E]/20 bg-white px-3 py-2 text-sm font-bold text-[#176951]">{section.title}</Link>)}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section id="demarrage" className="scroll-mt-40">
          <h2 className="text-3xl font-black">Start with a clear plan</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["Create your identity", "Choose your sports director’s profile, then found your amateur team and meet your first riders."],
              ["Get to know your squad", "Compare rider profiles, attributes, form and morale. Choose suitable training and identify an achievable first race."],
              ["Take your first start", "Enter a squad, prepare rider roles and follow the race. Review the result before planning your next target."],
            ].map(([title, text], index) => <li key={title} className="rounded-2xl border border-[#315B3E]/15 bg-white p-5"><span className="font-black text-[#278B70]">0{index + 1}</span><h3 className="mt-3 text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-[#48665F]">{text}</p></li>)}
          </ol>
        </section>
        <section className="mt-10 rounded-2xl bg-[#0B302B] p-5 text-[#FFFDF4] sm:p-8">
          <h2 className="text-2xl font-black">Practical guides</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {PUBLIC_GUIDE_SLUGS.map(slug => <Link key={slug} href={`/guide/${slug}`} className="rounded-xl border border-white/20 bg-white/5 p-4 font-bold leading-7 hover:border-[#F2C94C]">{getPublicGuide(slug, "en").title} →</Link>)}
          </div>
        </section>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {sections.map(section => <section id={section.id} key={section.id} className="scroll-mt-40 rounded-2xl border border-[#315B3E]/15 bg-white p-5 sm:p-7"><h2 className="text-2xl font-black">{section.title}</h2><p className="mt-4 leading-8 text-[#48665F]">{section.text}</p></section>)}
        </div>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/inscription" className="inline-flex min-h-12 items-center rounded-xl bg-[#F2C94C] px-5 py-3 font-black text-[#071A17]">Create my team for free</Link>
          <Link href="/a-propos" className="inline-flex min-h-12 items-center rounded-xl border border-[#315B3E]/30 px-5 py-3 font-bold text-[#176951]">About Cyclo Stratège</Link>
        </div>
      </div>
    </div>
  );
}
