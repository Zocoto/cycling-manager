import type { ReactNode } from "react";

const palette = [
  { name: "Fond principal", value: "#102238" },
  { name: "Fond secondaire", value: "#18324D" },
  { name: "Panneau", value: "#234563" },
  { name: "Panneau clair", value: "#2D5675" },
  { name: "Bordure", value: "#86A6BC" },
  { name: "Accent menthe", value: "#69D5AE" },
  { name: "Succès", value: "#55BE86" },
  { name: "Alerte", value: "#E5B84B" },
  { name: "Danger", value: "#DF6672" },
  { name: "Texte principal", value: "#F6F8FA" },
  { name: "Texte secondaire", value: "#C5D3DD" },
];

const riders = [
  {
    rank: 1,
    name: "Julien Martin",
    team: "Cycling Manager Team",
    specialty: "Puncheur",
    level: 78,
    form: 92,
    salary: "850 000 €",
    status: "Titulaire",
  },
  {
    rank: 2,
    name: "Thomas Bernard",
    team: "Cycling Manager Team",
    specialty: "Grimpeur",
    level: 74,
    form: 88,
    salary: "450 000 €",
    status: "Titulaire",
  },
  {
    rank: 3,
    name: "Lucas Robert",
    team: "Cycling Manager Team",
    specialty: "Sprinteur",
    level: 72,
    form: 75,
    salary: "350 000 €",
    status: "Remplaçant",
  },
  {
    rank: 7,
    name: "Nicolas Petit",
    team: "Cycling Manager Team",
    specialty: "Polyvalent",
    level: 70,
    form: 80,
    salary: "300 000 €",
    status: "Remplaçant",
  },
];

const riderRatings = [
  { abbreviation: "MO", name: "Montagne", value: 84 },
  { abbreviation: "VAL", name: "Vallon", value: 77 },
  { abbreviation: "PLA", name: "Plaine", value: 62 },
  { abbreviation: "PAV", name: "Pavé", value: 43 },
  { abbreviation: "CLM", name: "Contre-la-montre", value: 71 },
  { abbreviation: "END", name: "Endurance", value: 88 },
  { abbreviation: "DES", name: "Descente", value: 66 },
  { abbreviation: "REC", name: "Récupération", value: 92 },
];

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-[#102238] text-[#F6F8FA]">
      <Hero />

      <div className="mx-auto max-w-[1500px] space-y-12 px-5 py-10 sm:px-8">
        <section>
          <SectionTitle icon="◌" title="Palette" />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {palette.map((color) => (
              <ColorSwatch
                key={color.name}
                name={color.name}
                value={color.value}
              />
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[0.8fr_1fr_1.6fr]">
          <TypographyPanel />
          <ButtonsPanel />
          <CardsPanel />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
          <RidersTable />

          <div className="space-y-5">
            <RatingsPanel />
            <PodiumPanel />
          </div>
        </div>

        <PhilosophyPanel />
      </div>
    </main>
  );
}

function Hero() {
  return (
    <header className="relative min-h-[390px] overflow-hidden border-b border-[#86A6BC]/30 bg-[#18324D]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-[72%_center] bg-no-repeat"
        style={{
          backgroundImage: "url('/images/peloton-header.png')",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(16,34,56,0.98) 0%, rgba(16,34,56,0.90) 38%, rgba(16,34,56,0.50) 69%, rgba(16,34,56,0.18) 100%)",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(24,50,77,0.04) 0%, rgba(16,34,56,0.10) 65%, rgba(16,34,56,0.88) 100%)",
        }}
      />

      <LargeWheel />

      <div className="relative mx-auto flex min-h-[390px] max-w-[1500px] flex-col justify-center px-5 py-12 sm:px-8">
        <div className="flex items-center gap-3 text-[#69D5AE]">
          <WheelLogo />

          <span className="text-sm font-semibold uppercase tracking-[0.25em]">
            Peloton UI
          </span>

          <span className="rounded-md border border-[#86A6BC]/50 bg-[#102238]/60 px-2 py-1 text-xs text-[#C5D3DD] backdrop-blur-sm">
            v0.2
          </span>
        </div>

        <h1 className="mt-5 max-w-4xl text-4xl font-bold tracking-tight drop-shadow-lg sm:text-6xl">
          Cycling Manager Design System
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-[#C5D3DD] drop-shadow-md sm:text-lg">
          Une interface moderne, sobre et orientée données, inspirée des jeux de
          management cycliste des années 2000.
        </p>

        <RoadSeparator />
      </div>
    </header>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 text-[#69D5AE]">
      <span className="text-2xl">{icon}</span>
      <h2 className="text-sm font-semibold uppercase tracking-[0.25em]">
        {title}
      </h2>
    </div>
  );
}

function ColorSwatch({
  name,
  value,
}: {
  name: string;
  value: string;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#86A6BC]/45 bg-[#18324D]/80 shadow-lg shadow-[#07111F]/15 transition hover:-translate-y-1 hover:border-[#69D5AE]/70">
      <div
        className="h-20 border-b border-white/5"
        style={{
          background: `linear-gradient(145deg, ${value}, ${value}cc)`,
        }}
      />

      <div className="p-4">
        <h3 className="font-semibold">{name}</h3>
        <p className="mt-1 text-sm text-[#C5D3DD]">{value}</p>
      </div>
    </article>
  );
}

function TypographyPanel() {
  return (
    <Panel>
      <PanelTitle icon="Aa" title="Typographie" />

      <div className="relative mt-7 space-y-5 overflow-hidden">
        <WheelCorner />

        <TypographyRow label="H1">
          <span className="text-2xl font-bold">Direction sportive</span>
        </TypographyRow>

        <TypographyRow label="H2">
          <span className="text-xl font-semibold">Prochaine course</span>
        </TypographyRow>

        <TypographyRow label="H3">
          <span className="text-base font-semibold">
            Sélection de l’étape
          </span>
        </TypographyRow>

        <TypographyRow label="Corps">
          <span className="text-sm leading-6 text-[#C5D3DD]">
            Gérez votre effectif, préparez les objectifs de vos sponsors et
            sélectionnez les coureurs adaptés au profil de la course.
          </span>
        </TypographyRow>

        <TypographyRow label="Petit texte">
          <span className="text-xs text-[#C5D3DD]">
            Mise à jour il y a 4 minutes
          </span>
        </TypographyRow>
      </div>
    </Panel>
  );
}

function TypographyRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative grid grid-cols-[56px_1fr] gap-4 border-b border-dashed border-[#86A6BC]/20 pb-4 last:border-0">
      <span className="text-[#69D5AE]">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function ButtonsPanel() {
  return (
    <Panel>
      <PanelTitle icon="✣" title="Boutons" />

      <div className="mt-7">
        <p className="mb-3 text-sm text-[#C5D3DD]">États principaux</p>

        <div className="flex flex-wrap gap-3">
          <PrimaryButton>Bouton principal</PrimaryButton>
          <SecondaryButton>Bouton secondaire</SecondaryButton>
          <DangerButton>Supprimer</DangerButton>
          <DisabledButton>Désactivé</DisabledButton>
        </div>

        <p className="mb-3 mt-8 text-sm text-[#C5D3DD]">
          Icônes et texte
        </p>

        <div className="flex flex-wrap gap-3">
          <SecondaryButton>▣ Planifier</SecondaryButton>
          <PrimaryButton>✓ Valider</PrimaryButton>
          <SecondaryButton>⇩ Exporter</SecondaryButton>
        </div>
      </div>
    </Panel>
  );
}

function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-md bg-[#55BE86] px-4 py-2.5 text-sm font-semibold text-[#102238] shadow-md shadow-[#07111F]/20 transition hover:bg-[#69D5AE] focus:outline-none focus:ring-2 focus:ring-[#69D5AE]"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-md border border-[#69D5AE] bg-[#102238]/20 px-4 py-2.5 text-sm font-semibold transition hover:bg-[#69D5AE]/10 focus:outline-none focus:ring-2 focus:ring-[#69D5AE]"
    >
      {children}
    </button>
  );
}

function DangerButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-md border border-[#DF6672] px-4 py-2.5 text-sm font-semibold text-[#DF6672] transition hover:bg-[#DF6672]/10"
    >
      {children}
    </button>
  );
}

function DisabledButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      disabled
      className="cursor-not-allowed rounded-md border border-[#86A6BC]/30 bg-[#234563]/50 px-4 py-2.5 text-sm font-semibold text-[#86A6BC]"
    >
      {children}
    </button>
  );
}

function CardsPanel() {
  return (
    <Panel>
      <PanelTitle icon="▢" title="Cartes" />

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <DashboardCard title="Sponsor principal">
          <div className="py-3 text-center">
            <p className="text-lg font-bold tracking-[0.3em]">VÉLO</p>
            <p className="text-xs tracking-[0.45em] text-[#C5D3DD]">
              HORIZON
            </p>
          </div>

          <Metric label="Confiance" value="85 %" accent />
          <ProgressBar value={85} />

          <div className="mt-6 space-y-3">
            <Metric label="Objectif" value="Top 5" />
            <Metric label="Contrat" value="1,2 M€ / an" />
          </div>
        </DashboardCard>

        <DashboardCard title="Effectif">
          <FaintJersey />

          <div className="relative space-y-4">
            <Metric label="Coureurs" value="28" />
            <Metric label="Moyenne" value="75" accent />
            <Metric label="Jeunes talents" value="6" warning />
          </div>

          <CardAction>Voir l’effectif →</CardAction>
        </DashboardCard>

        <DashboardCard title="Prochaine course">
          <div className="space-y-4">
            <Metric label="Nom" value="Tour de Provence" />
            <Metric label="Étape" value="2 / 5" />
            <Metric label="Profil" value="" />
            <StageProfile />
            <Metric label="Distance" value="167 km" />
          </div>

          <CardAction>Voir l’étape →</CardAction>
        </DashboardCard>
      </div>
    </Panel>
  );
}

function DashboardCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="relative overflow-hidden rounded-lg border border-[#86A6BC]/45 bg-[#102238]/45 p-4 shadow-lg shadow-[#07111F]/20 transition hover:-translate-y-1 hover:border-[#69D5AE]/65">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-[#69D5AE]" />
      <h3 className="relative text-sm font-semibold">{title}</h3>
      <div className="relative mt-4">{children}</div>
    </article>
  );
}

function CardAction({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="mt-6 w-full rounded-md border border-[#69D5AE]/65 px-3 py-2 text-sm font-semibold transition hover:bg-[#69D5AE]/10"
    >
      {children}
    </button>
  );
}

function Metric({
  label,
  value,
  accent = false,
  warning = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
}) {
  let valueColor = "text-[#F6F8FA]";

  if (accent) {
    valueColor = "text-[#69D5AE]";
  }

  if (warning) {
    valueColor = "text-[#E5B84B]";
  }

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[#C5D3DD]">{label}</span>
      <span className={`font-semibold ${valueColor}`}>{value}</span>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#102238]">
      <div
        className="h-full rounded-full bg-[#69D5AE]"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function RidersTable() {
  return (
    <Panel>
      <PanelTitle icon="▦" title="Tableau" />

      <div className="mt-6 overflow-x-auto rounded-lg border border-[#86A6BC]/40">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#102238]/55">
            <tr className="text-xs uppercase tracking-wide text-[#C5D3DD]">
              <th className="px-4 py-3 font-medium">Coureur</th>
              <th className="px-4 py-3 font-medium">Équipe</th>
              <th className="px-4 py-3 font-medium">Spécialité</th>
              <th className="px-4 py-3 font-medium">Niveau</th>
              <th className="px-4 py-3 font-medium">Forme</th>
              <th className="px-4 py-3 font-medium">Salaire</th>
              <th className="px-4 py-3 font-medium">État</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#86A6BC]/20">
            {riders.map((rider) => (
              <tr
                key={rider.name}
                className="transition hover:bg-[#2D5675]/25"
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-3">
                    <RankBadge rank={rider.rank} />
                    <span className="font-semibold">{rider.name}</span>
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[#C5D3DD]">
                  {rider.team}
                </td>

                <td className="px-4 py-3">{rider.specialty}</td>
                <td className="px-4 py-3">{rider.level}</td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{rider.form} %</span>

                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#102238]">
                      <div
                        className="h-full rounded-full bg-[#69D5AE]"
                        style={{ width: `${rider.form}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  {rider.salary}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-1 text-xs ${
                      rider.status === "Titulaire"
                        ? "bg-[#55BE86]/15 text-[#69D5AE]"
                        : "bg-[#2D5675]/40 text-[#9CCFEA]"
                    }`}
                  >
                    {rider.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function RankBadge({ rank }: { rank: number }) {
  let classes = "bg-[#F6F8FA] text-[#102238]";

  if (rank === 1) {
    classes = "bg-[#E5B84B] text-[#102238]";
  } else if (rank === 2) {
    classes = "bg-[#C5D3DD] text-[#102238]";
  } else if (rank === 3) {
    classes = "bg-[#B88564] text-white";
  }

  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ${classes}`}
    >
      {rank}
    </span>
  );
}

function RatingsPanel() {
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PanelTitle icon="☆" title="Notes coureur" />
        <RatingLegend />
      </div>

      <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-8">
        {riderRatings.map((rating) => (
          <RatingItem
            key={rating.abbreviation}
            abbreviation={rating.abbreviation}
            name={rating.name}
            value={rating.value}
          />
        ))}
      </div>
    </Panel>
  );
}

function RatingLegend() {
  const items = [
    { label: "0–49", color: "#F4F7FA" },
    { label: "50–59", color: "#B9E4CE" },
    { label: "60–69", color: "#69D5AE" },
    { label: "70–79", color: "#2FA373" },
    { label: "80–89", color: "#F0A443" },
    { label: "90–100", color: "#EF5B62" },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-[#C5D3DD]">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function RatingItem({
  abbreviation,
  name,
  value,
}: {
  abbreviation: string;
  name: string;
  value: number;
}) {
  const color = getRatingColor(value);

  return (
    <div
      title={name}
      className="border-r border-[#86A6BC]/20 pr-3 text-center last:border-0"
    >
      <p className="text-sm font-semibold text-[#C5D3DD]">
        {abbreviation}
      </p>

      <p className="mt-1 text-2xl font-bold" style={{ color }}>
        {value}
      </p>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#102238]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

function getRatingColor(value: number) {
  if (value >= 90) return "#EF5B62";
  if (value >= 80) return "#F0A443";
  if (value >= 70) return "#2FA373";
  if (value >= 60) return "#69D5AE";
  if (value >= 50) return "#B9E4CE";
  return "#F4F7FA";
}

function PodiumPanel() {
  return (
    <Panel className="relative overflow-hidden">
      <FaintRoad />

      <PanelTitle icon="♕" title="Podium" />

      <div className="relative mt-6 flex items-end justify-center gap-3">
        <PodiumStep
          place={2}
          name="T. Bernard"
          points="32 pts"
          height="h-20"
          background="#9FB4C4"
        />

        <PodiumStep
          place={1}
          name="J. Martin"
          points="45 pts"
          height="h-28"
          background="#E5B84B"
        />

        <PodiumStep
          place={3}
          name="L. Robert"
          points="20 pts"
          height="h-16"
          background="#B88564"
        />
      </div>
    </Panel>
  );
}

function PodiumStep({
  place,
  name,
  points,
  height,
  background,
}: {
  place: number;
  name: string;
  points: string;
  height: string;
  background: string;
}) {
  return (
    <div className="w-28 text-center">
      <p className="text-sm font-semibold">{name}</p>
      <p className="mb-2 text-xs text-[#C5D3DD]">{points}</p>

      <div
        className={`${height} flex items-center justify-center rounded-t-lg border border-white/25 text-3xl font-bold text-white shadow-lg`}
        style={{ backgroundColor: background }}
      >
        {place}
      </div>
    </div>
  );
}

function PhilosophyPanel() {
  return (
    <section className="relative overflow-hidden rounded-xl border border-[#86A6BC]/40 bg-[#18324D]/70 p-7 shadow-xl shadow-[#07111F]/15">
      <FaintRoad />

      <div className="relative max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#E5B84B]">
          Notre philosophie
        </p>

        <h2 className="mt-3 text-2xl font-semibold">
          Le cockpit du directeur sportif
        </h2>

        <p className="mt-4 leading-7 text-[#C5D3DD]">
          Offrir au joueur une expérience claire, stratégique et immersive, où
          l’information reste belle, immédiatement compréhensible et utile à la
          prise de décision.
        </p>
      </div>
    </section>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[#86A6BC]/40 bg-[#18324D]/70 p-5 shadow-xl shadow-[#07111F]/15 ${className}`}
    >
      {children}
    </section>
  );
}

function PanelTitle({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 text-[#69D5AE]">
      <span className="text-xl">{icon}</span>
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">
        {title}
      </h2>
    </div>
  );
}

function RoadSeparator() {
  return (
    <div className="mt-8 flex items-center gap-3 opacity-80">
      <div className="h-px flex-1 bg-[#86A6BC]/40" />

      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className="h-px w-8 bg-[#C5D3DD]/50" />
      ))}

      <span className="h-0.5 w-16 bg-[#69D5AE]" />

      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={`road-${index}`}
          className="h-px w-8 bg-[#C5D3DD]/50"
        />
      ))}

      <div className="h-px flex-1 bg-[#86A6BC]/40" />
    </div>
  );
}

function WheelLogo() {
  return (
    <span className="relative block h-7 w-7 rounded-full border-2 border-[#69D5AE]">
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#69D5AE]/70" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#69D5AE]/70" />
      <span className="absolute left-[14%] top-[14%] h-[72%] w-px rotate-45 bg-[#69D5AE]/60" />
      <span className="absolute right-[14%] top-[14%] h-[72%] w-px -rotate-45 bg-[#69D5AE]/60" />
      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#69D5AE]" />
    </span>
  );
}

function LargeWheel() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-24 -top-28 hidden h-80 w-80 rounded-full border-4 border-[#C5D3DD]/20 lg:block"
      style={{
        background:
          "repeating-conic-gradient(from 0deg, transparent 0deg 11deg, rgba(197,211,221,0.22) 11deg 12deg)",
      }}
    >
      <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#C5D3DD]/25 bg-[#18324D]/70" />
    </div>
  );
}

function WheelCorner() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-20 -right-20 h-48 w-48 rounded-full border border-[#86A6BC]/15"
      style={{
        background:
          "repeating-conic-gradient(transparent 0deg 17deg, rgba(134,166,188,0.13) 17deg 18deg)",
      }}
    />
  );
}

function FaintJersey() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 120"
      className="pointer-events-none absolute bottom-10 right-2 h-28 w-24 opacity-[0.08]"
      fill="none"
      stroke="#F6F8FA"
      strokeWidth="2"
    >
      <path d="M35 12 L20 20 L7 42 L23 52 L28 43 L28 105 L72 105 L72 43 L77 52 L93 42 L80 20 L65 12 C60 22 40 22 35 12 Z" />
    </svg>
  );
}

function StageProfile() {
  return (
    <svg
      aria-label="Profil vallonné de la course"
      viewBox="0 0 180 45"
      className="h-10 w-full"
    >
      <path
        d="M0 40 L18 37 L34 25 L52 34 L70 20 L91 31 L112 13 L132 24 L151 8 L180 2 L180 45 L0 45 Z"
        fill="#69D5AE"
        opacity="0.75"
      />

      <path
        d="M0 40 L18 37 L34 25 L52 34 L70 20 L91 31 L112 13 L132 24 L151 8 L180 2"
        fill="none"
        stroke="#B9E4CE"
        strokeWidth="2"
      />
    </svg>
  );
}

function FaintRoad() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 500 200"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
    >
      <path
        d="M500 170 C410 85 315 230 220 135 C130 45 65 120 0 80"
        fill="none"
        stroke="#69D5AE"
        strokeWidth="4"
      />

      <path
        d="M500 160 C410 75 315 220 220 125 C130 35 65 110 0 70"
        fill="none"
        stroke="#F6F8FA"
        strokeWidth="2"
        strokeDasharray="12 12"
      />
    </svg>
  );
}