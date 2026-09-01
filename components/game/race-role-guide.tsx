type RaceRoleGuideProps = {
  tone: "dark" | "light";
};

const ROLE_GUIDE_ENTRIES = [
  {
    label: "Leader",
    detail:
      "Protégé par les équipiers : il économise de l’énergie et résiste mieux aux cassures. Il ne reçoit aucun avantage propre au sprint.",
  },
  {
    label: "Sprinteur",
    detail:
      "Prioritaire pour le train, les sprints intermédiaires et l’arrivée massive. Il ne bénéficie pas de la protection énergétique du leader.",
  },
  {
    label: "Leader / sprinteur",
    detail:
      "Cumule les deux comportements : protection pendant l’étape, puis priorité au train et au sprint final. Recommandé pour le meilleur sprinteur sur le plat.",
  },
] as const;

export function RaceRoleGuide({ tone }: RaceRoleGuideProps) {
  const isDark = tone === "dark";

  return (
    <section
      className={`mt-3 rounded-xl border p-3 ${
        isDark
          ? "border-white/10 bg-white/5"
          : "border-[#315B3E]/12 bg-[#F8FBF9]"
      }`}
    >
      <p
        className={`text-[10px] font-black uppercase tracking-[0.14em] ${
          isDark ? "text-[#9BE0BC]" : "text-[#397A67]"
        }`}
      >
        Leader ou sprinteur ?
      </p>
      <div className="mt-2 grid gap-2 lg:grid-cols-3">
        {ROLE_GUIDE_ENTRIES.map((entry) => (
          <p
            key={entry.label}
            className={`rounded-lg border px-3 py-2 text-[11px] font-semibold leading-5 ${
              isDark
                ? "border-white/10 bg-black/10 text-[#BFD1C6]"
                : "border-[#315B3E]/10 bg-white text-[#66877C]"
            }`}
          >
            <span
              className={`block font-black ${
                isDark ? "text-white" : "text-[#0B302B]"
              }`}
            >
              {entry.label}
            </span>
            {entry.detail}
          </p>
        ))}
      </div>
      <p
        className={`mt-2 text-[10px] font-bold leading-4 ${
          isDark ? "text-[#9FB5A8]" : "text-[#66877C]"
        }`}
      >
        Un seul sprinteur, simple ou protégé, est autorisé. Un leader distinct
        peut rester désigné pour défendre le classement général.
      </p>
    </section>
  );
}
