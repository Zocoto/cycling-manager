import { AchievementTrophyMark } from "@/components/game/achievement-trophy-mark";
import { AlphaTesterTrophyGift } from "@/components/game/alpha-tester-trophy-gift";
import { AlphaTesterTrophyMark } from "@/components/game/alpha-tester-trophy-mark";
import { HiddenSwitchbackLink } from "@/components/game/hidden-switchback-egg";
import Link from "@/components/ui/app-link";
import type {
  CareerTrophy,
  TrophyGallery as TrophyGalleryData,
} from "@/lib/game/trophy-gallery";

export function TrophyGallery({ gallery }: { gallery: TrophyGalleryData }) {
  const specialTrophies = gallery.trophies.filter(
    (trophy) => trophy.kind === "special",
  );
  const achievementTrophies = gallery.trophies.filter(
    (trophy) => trophy.kind === "achievement",
  );
  const uciTrophies = gallery.trophies.filter(
    (trophy) => trophy.kind === "uci_team" || trophy.kind === "uci_rider",
  );
  const raceTrophies = gallery.trophies.filter(
    (trophy) => trophy.kind === "grand_tour" || trophy.kind === "monument",
  );
  const championshipTrophies = gallery.trophies.filter(
    (trophy) =>
      trophy.kind === "world_championship" ||
      trophy.kind === "continental_championship",
  );
  const attendanceTrophies = gallery.trophies.filter(
    (trophy) => trophy.kind === "attendance",
  );
  const referralTrophies = gallery.trophies.filter(
    (trophy) => trophy.kind === "referral",
  );

  return (
    <div className="mt-8">
      <section
        aria-labelledby="trophy-gallery-title"
        className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,#071A17_0%,#0D2D28_60%,#163F35_100%)] text-white shadow-[0_28px_80px_rgba(7,26,23,0.22)]"
      >
        <header className="relative overflow-hidden border-b border-white/10 px-6 py-7 sm:px-9">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-24 h-64 w-64 rounded-full border-[42px] border-[#F2C94C]/7"
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
                Palmarès du Directeur Sportif
              </p>
              <h2
                id="trophy-gallery-title"
                className="mt-2 text-3xl font-black tracking-tight sm:text-4xl"
              >
                Galerie des trophées
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#BED1C8]">
                Chaque pièce correspond à un résultat officiel de votre équipe.
                Les trophées restent exposés saison après saison et portent le
                nom du coureur qui a signé la victoire.
              </p>
            </div>

            <div
              data-trophy-metrics
              className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/12 bg-white/7 p-2 backdrop-blur-sm sm:grid-cols-4 sm:gap-2 sm:p-3 xl:grid-cols-8"
            >
              <GalleryMetric label="Total" value={gallery.counts.total} />
              <GalleryMetric
                label="Grands Tours"
                value={gallery.counts.grandTours}
              />
              <GalleryMetric
                label="Monuments"
                value={gallery.counts.monuments}
              />
              <GalleryMetric
                label="CM & CC"
                value={gallery.counts.championships}
              />
              <GalleryMetric
                label="Titres UCI"
                value={gallery.counts.uciTitles}
              />
              <GalleryMetric
                label="Défis"
                value={gallery.counts.achievements}
              />
              <GalleryMetric
                label="Assiduité"
                value={gallery.counts.attendance}
              />
              <GalleryMetric label="Parrain" value={gallery.counts.referrals} />
            </div>
          </div>
        </header>

        {gallery.trophies.length > 0 || gallery.claimableTrophies.length > 0 ? (
          <div className="px-5 py-7 sm:px-8 sm:py-9">
            {gallery.claimableTrophies.map((reward) => (
              <AlphaTesterTrophyGift key={reward.key} reward={reward} />
            ))}

            {specialTrophies.length > 0 ? (
              <TrophyShelf
                eyebrow="Distinctions de carrière"
                title="Pionniers de Cyclostratège"
                description="Les distinctions spéciales racontent les étapes fondatrices de votre carrière de DS."
                trophies={specialTrophies}
                epic
              />
            ) : null}

            {achievementTrophies.length > 0 ? (
              <TrophyShelf
                eyebrow="Objectifs maîtres"
                title="Cabinet des accomplissements"
                description="Ces pièces uniques récompensent les défis de carrière les plus exigeants et les découvertes les mieux cachées."
                trophies={achievementTrophies}
                epic
              />
            ) : null}
            {referralTrophies.length > 0 ? (
              <TrophyShelf
                eyebrow="Transmission"
                title="Cercle des Parrains"
                description="Chaque rang distingue les Directeurs Sportifs qui font grandir le peloton."
                trophies={referralTrophies}
                epic
              />
            ) : null}

            {attendanceTrophies.length > 0 ? (
              <TrophyShelf
                eyebrow="Fidélité"
                title="Assiduité parfaite"
                description="Une saison complète sans manquer un seul jour de connexion."
                trophies={attendanceTrophies}
                epic
              />
            ) : null}

            {uciTrophies.length > 0 ? (
              <TrophyShelf
                eyebrow="Pièces maîtresses"
                title="Sommets mondiaux"
                description="Les titres UCI occupent la place d’honneur du musée."
                trophies={uciTrophies}
                epic
              />
            ) : null}

            {championshipTrophies.length > 0 ? (
              <TrophyShelf
                eyebrow="Maillots suprêmes"
                title="Championnats du monde & continentaux"
                description="Chaque titre en ligne ou contre-la-montre reste associé au DS, à son équipe et au coureur vainqueur."
                trophies={championshipTrophies}
                epic
              />
            ) : null}

            {raceTrophies.length > 0 ? (
              <TrophyShelf
                eyebrow="Courses de légende"
                title="Grands Tours & Monuments"
                description="Une coupe est ajoutée pour chaque victoire, même si une même épreuve est remportée plusieurs fois."
                trophies={raceTrophies}
              />
            ) : null}
          </div>
        ) : (
          <EmptyTrophyRoom />
        )}
      </section>

      <LongTermChallenges />
    </div>
  );
}

function GalleryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div
      data-trophy-metric
      className="min-w-0 rounded-xl bg-black/15 px-1 py-3 text-center sm:px-2.5"
    >
      <span className="block text-lg font-black text-[#F2C94C]">{value}</span>
      <span className="mt-1 block text-[7px] font-black uppercase leading-3 tracking-[0.04em] text-[#BDD1C7] min-[390px]:text-[8px] min-[390px]:tracking-[0.06em] sm:text-[9px] sm:tracking-[0.1em]">
        {label}
      </span>
    </div>
  );
}

function TrophyShelf({
  eyebrow,
  title,
  description,
  trophies,
  epic = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  trophies: CareerTrophy[];
  epic?: boolean;
}) {
  return (
    <section className="[&+&]:mt-10" aria-label={title}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#73C9A6]">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-2xl font-black">{title}</h3>
        </div>
        <p className="max-w-xl text-xs font-semibold leading-5 text-[#9EB8AD] sm:text-right">
          {description}
        </p>
      </div>

      <div
        className={`mt-5 grid gap-4 ${
          epic ? "lg:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"
        }`}
      >
        {trophies.map((trophy) => (
          <TrophyCard key={trophy.id} trophy={trophy} epic={epic} />
        ))}
      </div>
    </section>
  );
}

function TrophyCard({ trophy, epic }: { trophy: CareerTrophy; epic: boolean }) {
  const frameClassName = getTrophyFrameClassName(trophy, epic);
  const content = (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-x-8 bottom-0 h-16 rounded-[50%] blur-2xl"
        style={{ backgroundColor: trophy.palette.glow }}
      />
      <div
        data-trophy-visual={trophy.visualVariant ?? "classic"}
        className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/20 ${frameClassName}`}
      >
        <TrophyIllustration trophy={trophy} epic={epic} />
      </div>

      <div className="relative min-w-0 flex-1">
        <span
          className="inline-flex rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em]"
          style={{
            borderColor: `${trophy.palette.primary}66`,
            backgroundColor: `${trophy.palette.primary}1F`,
            color: trophy.palette.secondary,
          }}
        >
          {getTrophyKindLabel(trophy.kind)}
        </span>
        <h4
          className={`mt-3 font-black leading-tight ${epic ? "text-2xl" : "text-xl"}`}
        >
          {trophy.title}
        </h4>
        <p className="mt-2 text-sm font-bold text-[#BBD0C6]">
          {trophy.competitionName}
        </p>
        {trophy.description ? (
          <p className="mt-2 text-xs font-semibold leading-5 text-[#9EB8AD]">
            {trophy.description}
          </p>
        ) : null}
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#789B8C]">
            Gravure
          </p>
          <p
            className="mt-1 truncate text-sm font-black"
            style={{ color: trophy.palette.secondary }}
            title={trophy.inscription}
          >
            {trophy.inscription}
          </p>
          <p className="mt-1 text-xs font-bold text-[#8FA99E]">
            {trophy.seasonName}
          </p>
        </div>
      </div>
      {trophy.href ? (
        <span
          aria-hidden="true"
          className="absolute right-4 top-4 text-sm font-black text-white/45 transition group-hover/trophy:translate-x-1 group-hover/trophy:text-white"
        >
          →
        </span>
      ) : null}
    </>
  );

  const className = `group/trophy relative flex min-h-full flex-col gap-5 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/6 p-5 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/9 sm:flex-row sm:items-center ${
    epic ? "sm:p-6" : ""
  }`;

  return trophy.href ? (
    <Link
      href={trophy.href}
      className={className}
      aria-label={`${trophy.title}, ${trophy.seasonName}, ${trophy.inscription}`}
    >
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  );
}

function TrophyIllustration({
  trophy,
  epic,
}: {
  trophy: CareerTrophy;
  epic: boolean;
}) {
  if (trophy.kind === "achievement" && trophy.visualVariant) {
    return (
      <AchievementTrophyMark
        variant={trophy.visualVariant}
        palette={trophy.palette}
        className={epic ? "h-44 w-44" : "h-36 w-36"}
      />
    );
  }

  if (trophy.kind === "special") {
    return (
      <AlphaTesterTrophyMark className={epic ? "h-40 w-40" : "h-36 w-36"} />
    );
  }

  if (trophy.kind === "attendance") {
    return (
      <AssiduTrophyMark
        trophyId={trophy.id}
        className={epic ? "h-40 w-40" : "h-36 w-36"}
      />
    );
  }

  const isUci = trophy.kind === "uci_team" || trophy.kind === "uci_rider";
  const isMonument = trophy.kind === "monument";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 190"
      className={epic ? "h-40 w-40" : "h-36 w-36"}
      fill="none"
    >
      <defs>
        <linearGradient
          id={`cup-${trophy.id}`}
          x1="50"
          y1="30"
          x2="130"
          y2="160"
        >
          <stop stopColor={trophy.palette.secondary} />
          <stop offset="0.45" stopColor={trophy.palette.primary} />
          <stop offset="1" stopColor={trophy.palette.accent} />
        </linearGradient>
        <radialGradient id={`shine-${trophy.id}`}>
          <stop stopColor="#FFFFFF" stopOpacity="0.78" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <filter
          id={`glow-${trophy.id}`}
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <feGaussianBlur stdDeviation={isUci ? "8" : "5"} />
        </filter>
      </defs>

      <ellipse
        cx="90"
        cy="164"
        rx={isUci ? "60" : "48"}
        ry="13"
        fill={trophy.palette.primary}
        opacity="0.3"
        filter={`url(#glow-${trophy.id})`}
      />

      {isUci ? (
        <>
          <path
            d="m56 34 12-21 22 14 22-14 12 21"
            stroke={trophy.palette.secondary}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="90" cy="15" r="4" fill={trophy.palette.primary} />
          <path
            d="M37 79C15 75 14 46 35 42h18M143 79c22-4 23-33 2-37h-18"
            stroke={trophy.palette.primary}
            strokeWidth="9"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d="M43 78C24 75 21 51 41 47h15M137 78c19-3 22-27 2-31h-15"
          stroke={trophy.palette.primary}
          strokeWidth="8"
          strokeLinecap="round"
        />
      )}

      <path
        d={
          isUci
            ? "M46 34h88l-8 52c-3 23-19 38-36 38S57 109 54 86L46 34Z"
            : "M52 40h76l-7 46c-3 21-16 33-31 33S62 107 59 86l-7-46Z"
        }
        fill={`url(#cup-${trophy.id})`}
        stroke={trophy.palette.secondary}
        strokeWidth="3"
      />
      <path
        d={isUci ? "M47 36h86" : "M53 42h74"}
        stroke={trophy.palette.secondary}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <ellipse
        cx="72"
        cy="60"
        rx="23"
        ry="35"
        fill={`url(#shine-${trophy.id})`}
        opacity="0.45"
        transform="rotate(-18 72 60)"
      />
      <path
        d="M84 118h12v30H84z"
        fill={trophy.palette.primary}
        stroke={trophy.palette.secondary}
        strokeWidth="2"
      />
      <path
        d="M66 148h48l10 15H56l10-15Z"
        fill={`url(#cup-${trophy.id})`}
        stroke={trophy.palette.secondary}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x={isUci ? "47" : "53"}
        y="163"
        width={isUci ? "86" : "74"}
        height="14"
        rx="5"
        fill={trophy.palette.accent}
        stroke={trophy.palette.primary}
        strokeWidth="3"
      />

      {isUci ? (
        <>
          <circle
            cx="90"
            cy="72"
            r="23"
            fill={trophy.palette.accent}
            opacity="0.88"
          />
          <path
            d="m90 52 5.4 11 12.1 1.7-8.8 8.5 2.1 12-10.8-5.7-10.8 5.7 2.1-12-8.8-8.5L84.6 63 90 52Z"
            fill={trophy.palette.secondary}
          />
        </>
      ) : isMonument ? (
        <>
          <rect
            x="73"
            y="57"
            width="34"
            height="34"
            rx="7"
            fill={trophy.palette.accent}
            opacity="0.85"
            transform="rotate(45 90 74)"
          />
          <path
            d="m76 74 14-14 14 14-14 14-14-14Z"
            stroke={trophy.palette.secondary}
            strokeWidth="3"
          />
        </>
      ) : (
        <>
          <circle
            cx="90"
            cy="72"
            r="22"
            fill={trophy.palette.accent}
            opacity="0.88"
          />
          <path
            d="M77 72h26M90 59v26"
            stroke={trophy.palette.secondary}
            strokeWidth="5"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function AssiduTrophyMark({
  trophyId,
  className,
}: {
  trophyId: string;
  className: string;
}) {
  const gradientId = `assidu-gradient-${trophyId}`;
  const glowId = `assidu-glow-${trophyId}`;

  return (
    <svg
      data-assidu-trophy
      aria-hidden="true"
      viewBox="0 0 180 190"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="45" y1="24" x2="132" y2="164">
          <stop stopColor="#FFF2B8" />
          <stop offset="0.46" stopColor="#D7A928" />
          <stop offset="1" stopColor="#80640C" />
        </linearGradient>
        <filter id={glowId} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse
        cx="90"
        cy="165"
        rx="58"
        ry="13"
        fill="#D7A928"
        opacity="0.3"
        filter={`url(#${glowId})`}
      />
      <path
        d="M49 108C31 94 26 70 35 49M131 108c18-14 23-38 14-59"
        stroke="#D7A928"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M39 89 27 84M38 73 25 67M42 57 32 48M141 89l12-5M142 73l13-6M138 57l10-9"
        stroke="#FFF2B8"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M90 20 128 34v43c0 29-15 48-38 59-23-11-38-30-38-59V34l38-14Z"
        fill={`url(#${gradientId})`}
        stroke="#FFF2B8"
        strokeWidth="3"
      />
      <path
        d="M90 31 117 41v35c0 21-10 36-27 46-17-10-27-25-27-46V41l27-10Z"
        fill="#173F37"
        stroke="#D7A928"
        strokeWidth="2.5"
      />
      <g data-assidu-emblem>
        <path
          d="M69 59h17l-2 16H73c-4-3-5-8-4-16ZM111 59H94l2 16h11c4-3 5-8 4-16Z"
          fill="#DDF5F0"
          fillOpacity="0.2"
          stroke="#FFF2B8"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path
          d="M85 65h10"
          stroke="#D7A928"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M69 63l-8-5M111 63l8-5"
          stroke="#FFF2B8"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="m82 91 8-8 8 8"
          stroke="#D7A928"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M61 120c12-3 22 0 29 7 7-7 17-10 29-7v25c-12-3-22 0-29 7-7-7-17-10-29-7v-25Z"
        fill="#FFF8D8"
        stroke="#D7A928"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M90 127v25" stroke="#D7A928" strokeWidth="2.5" />
      <path
        d="M69 132c6-1 11 0 16 3M111 132c-6-1-11 0-16 3"
        stroke="#80640C"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.65"
      />
      <rect
        x="48"
        y="157"
        width="84"
        height="16"
        rx="5"
        fill="#173F37"
        stroke="#D7A928"
        strokeWidth="3"
      />
      <path
        d="M61 157h58l-7-11H68l-7 11Z"
        fill={`url(#${gradientId})`}
        stroke="#FFF2B8"
        strokeWidth="2"
      />
    </svg>
  );
}

function EmptyTrophyRoom() {
  return (
    <div className="px-6 py-12 text-center sm:px-10 sm:py-16">
      <div className="mx-auto flex h-32 w-32 items-end justify-center rounded-full border border-white/10 bg-white/5 pb-5">
        <span
          aria-hidden="true"
          className="h-5 w-20 rounded-[50%] bg-[#F2C94C]/15 shadow-[0_0_35px_rgba(242,201,76,0.18)]"
        />
      </div>
      <h3 className="mt-5 text-2xl font-black">Le premier socle vous attend</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#AFC3BA]">
        Remportez un championnat, un Grand Tour, un Monument ou terminez une
        saison au sommet d’un classement UCI : le trophée apparaîtra ici
        automatiquement.
      </p>
      <Link
        href="/jeu/calendrier"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#F2C94C] px-5 text-xs font-black uppercase tracking-[0.12em] text-[#332800] transition hover:bg-[#FFE17A]"
      >
        Repérer les grandes courses →
      </Link>
    </div>
  );
}

function LongTermChallenges() {
  const tracks = [
    {
      title: "Héritage du club",
      description: "Formation, fidélité et transmission",
    },
    {
      title: "Dynastie sportive",
      description: "Régularité et domination sur plusieurs saisons",
    },
    {
      title: "Manager complet",
      description: "Maîtrise durable de toutes les dimensions du club",
    },
  ];

  return (
    <section className="mt-7 rounded-[2rem] border border-[#315B3E]/14 bg-white p-6 shadow-[0_18px_50px_rgba(19,60,46,0.1)] sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
            Prochain chantier
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#183F37] sm:text-3xl">
            Challenges longue durée
          </h2>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {tracks.map((track) => (
          <article
            key={track.title}
            className="flex items-center gap-4 rounded-2xl border border-dashed border-[#315B3E]/25 bg-[#F5F9F7] p-4"
          >
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E3ECE7] text-[#60756E]"
            >
              <LockIcon />
            </span>
            <div>
              <h3 className="font-black text-[#183F37]">{track.title}</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#789087]">
                {track.description}
              </p>
              <span className="mt-2 inline-flex text-[9px] font-black uppercase tracking-[0.13em] text-[#278B70]">
                En cours de développement
              </span>
            </div>
          </article>
        ))}
      </div>
      <HiddenSwitchbackLink />
    </section>
  );
}

function getTrophyFrameClassName(trophy: CareerTrophy, epic: boolean) {
  if (trophy.kind === "achievement")
    return "h-48 w-full rounded-[1.4rem] sm:w-48";
  return epic
    ? "h-44 w-full rounded-[1.4rem] sm:h-48 sm:w-48"
    : "h-40 w-full rounded-[1.4rem] sm:w-40";
}

function getTrophyKindLabel(kind: CareerTrophy["kind"]) {
  if (kind === "special") return "Distinction Alpha";
  if (kind === "achievement") return "Trophée maître";
  if (kind === "grand_tour") return "Grand Tour";
  if (kind === "monument") return "Monument";
  if (kind === "world_championship") return "Champion du monde";
  if (kind === "continental_championship") return "Champion continental";
  if (kind === "uci_team") return "Champion UCI équipes";
  if (kind === "attendance") return "Assidu";
  if (kind === "referral") return "Parrain";
  return "Numéro 1 UCI";
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="5" y="10" width="14" height="10" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}
