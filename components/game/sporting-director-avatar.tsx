export const SPORTING_DIRECTOR_AVATARS = [
  {
    key: "director_m_01",
    label: "Directeur classique",
  },
  {
    key: "director_m_02",
    label: "Directeur expérimenté",
  },
  {
    key: "director_m_03",
    label: "Directeur moderne",
  },
  {
    key: "director_m_04",
    label: "Directeur décontracté",
  },
  {
    key: "director_m_05",
    label: "Directeur élégant",
  },
  {
    key: "director_m_06",
    label: "Directeur vétéran",
  },
  {
    key: "director_f_01",
    label: "Directrice classique",
  },
  {
    key: "director_f_02",
    label: "Directrice expérimentée",
  },
  {
    key: "director_f_03",
    label: "Directrice moderne",
  },
  {
    key: "director_f_04",
    label: "Directrice décontractée",
  },
  {
    key: "director_f_05",
    label: "Directrice élégante",
  },
  {
    key: "director_f_06",
    label: "Directrice dynamique",
  },
] as const;

export type SportingDirectorAvatarKey =
  (typeof SPORTING_DIRECTOR_AVATARS)[number]["key"];

type SportingDirectorAvatarProps = {
  avatarKey?: string | null;
  size?: "small" | "medium" | "large";
  label?: string;
  className?: string;
};

type AvatarDefinition = {
  background: string;
  skin: string;
  skinShadow: string;
  hair: string;
  jacket: string;
  shirt: string;
  hairStyle:
    | "short"
    | "side"
    | "buzz"
    | "curly"
    | "long"
    | "bun"
    | "bob"
    | "ponytail";
  glasses?: boolean;
  beard?: boolean;
};

const avatarDefinitions: Record<
  SportingDirectorAvatarKey,
  AvatarDefinition
> = {
  director_m_01: {
    background: "#DDF3EC",
    skin: "#E9B58B",
    skinShadow: "#D79567",
    hair: "#49352B",
    jacket: "#176951",
    shirt: "#FFFDF4",
    hairStyle: "side",
  },

  director_m_02: {
    background: "#E8E1D1",
    skin: "#D89A70",
    skinShadow: "#B97851",
    hair: "#D4D1C7",
    jacket: "#253B38",
    shirt: "#E7C75E",
    hairStyle: "short",
    glasses: true,
    beard: true,
  },

  director_m_03: {
    background: "#DCE9F5",
    skin: "#8C5A3C",
    skinShadow: "#70442D",
    hair: "#1F1A18",
    jacket: "#315B3E",
    shirt: "#F3F5EF",
    hairStyle: "buzz",
  },

  director_m_04: {
    background: "#F4E3D7",
    skin: "#F0C19B",
    skinShadow: "#D99B70",
    hair: "#A34E29",
    jacket: "#C78E28",
    shirt: "#173F37",
    hairStyle: "curly",
    beard: true,
  },

  director_m_05: {
    background: "#E8E4F4",
    skin: "#B97854",
    skinShadow: "#94583C",
    hair: "#211B19",
    jacket: "#263B5A",
    shirt: "#F2C94C",
    hairStyle: "short",
    glasses: true,
  },

  director_m_06: {
    background: "#E2EEE3",
    skin: "#E5AE83",
    skinShadow: "#C9855D",
    hair: "#5F625F",
    jacket: "#6C4B32",
    shirt: "#FFF8E5",
    hairStyle: "buzz",
    beard: true,
  },

  director_f_01: {
    background: "#E4F2E1",
    skin: "#EAB18B",
    skinShadow: "#D38D64",
    hair: "#4A3027",
    jacket: "#176951",
    shirt: "#FFFDF4",
    hairStyle: "long",
  },

  director_f_02: {
    background: "#EEE3D1",
    skin: "#C7835D",
    skinShadow: "#A96747",
    hair: "#26201E",
    jacket: "#0B302B",
    shirt: "#F2C94C",
    hairStyle: "bun",
    glasses: true,
  },

  director_f_03: {
    background: "#DCECF1",
    skin: "#7C4D34",
    skinShadow: "#613824",
    hair: "#181515",
    jacket: "#315B3E",
    shirt: "#F7F3E8",
    hairStyle: "bob",
  },

  director_f_04: {
    background: "#F5E2E1",
    skin: "#F0C09D",
    skinShadow: "#D99C73",
    hair: "#C16A34",
    jacket: "#B86E3A",
    shirt: "#163F37",
    hairStyle: "ponytail",
  },

  director_f_05: {
    background: "#ECE3F3",
    skin: "#C88966",
    skinShadow: "#A9684B",
    hair: "#3C2823",
    jacket: "#694565",
    shirt: "#FFF8EB",
    hairStyle: "curly",
    glasses: true,
  },

  director_f_06: {
    background: "#DDEDF2",
    skin: "#75472F",
    skinShadow: "#593220",
    hair: "#171313",
    jacket: "#14736A",
    shirt: "#F2C94C",
    hairStyle: "long",
  },
};

const avatarSizeClasses = {
  small: "h-10 w-10",
  medium: "h-16 w-16",
  large: "h-24 w-24",
};

export function SportingDirectorAvatar({
  avatarKey,
  size = "medium",
  label = "Avatar du Directeur Sportif",
  className = "",
}: SportingDirectorAvatarProps) {
  const normalizedAvatarKey =
    isSportingDirectorAvatarKey(avatarKey)
      ? avatarKey
      : "director_m_01";

  const avatar =
    avatarDefinitions[normalizedAvatarKey];

  return (
    <span
      role="img"
      aria-label={label}
      className={[
        "inline-flex shrink-0 overflow-hidden rounded-full",
        "border-2 border-white/80 shadow-md",
        avatarSizeClasses[size],
        className,
      ].join(" ")}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 120 120"
        className="h-full w-full"
      >
        <circle
          cx="60"
          cy="60"
          r="60"
          fill={avatar.background}
        />

        <AvatarHairBack avatar={avatar} />

        <path
          d="M14 120C17 91 33 78 60 78C87 78 103 91 106 120Z"
          fill={avatar.jacket}
        />

        <path
          d="M42 83L60 103L78 83C73 79 67 77 60 77C53 77 47 79 42 83Z"
          fill={avatar.shirt}
        />

        <path
          d="M52 69H68V84C66 89 54 89 52 84Z"
          fill={avatar.skinShadow}
        />

        <ellipse
          cx="38"
          cy="50"
          rx="6"
          ry="9"
          fill={avatar.skinShadow}
        />

        <ellipse
          cx="82"
          cy="50"
          rx="6"
          ry="9"
          fill={avatar.skinShadow}
        />

        <ellipse
          cx="60"
          cy="49"
          rx="24"
          ry="30"
          fill={avatar.skin}
        />

        <AvatarHairFront avatar={avatar} />

        <ellipse
          cx="51"
          cy="49"
          rx="2.4"
          ry="2.8"
          fill="#17211E"
        />

        <ellipse
          cx="69"
          cy="49"
          rx="2.4"
          ry="2.8"
          fill="#17211E"
        />

        <path
          d="M59 52L56.5 60H62"
          fill="none"
          stroke={avatar.skinShadow}
          strokeLinecap="round"
          strokeWidth="2"
        />

        <path
          d="M52 66C56 69 64 69 68 66"
          fill="none"
          stroke="#874E46"
          strokeLinecap="round"
          strokeWidth="2.2"
        />

        {avatar.beard ? (
          <path
            d="M43 61C45 76 53 82 60 82C67 82 75 76 77 61C72 70 67 74 60 74C53 74 48 70 43 61Z"
            fill={avatar.hair}
            opacity="0.82"
          />
        ) : null}

        {avatar.glasses ? (
          <>
            <rect
              x="42"
              y="43"
              width="15"
              height="11"
              rx="4"
              fill="none"
              stroke="#263936"
              strokeWidth="2.4"
            />

            <rect
              x="63"
              y="43"
              width="15"
              height="11"
              rx="4"
              fill="none"
              stroke="#263936"
              strokeWidth="2.4"
            />

            <path
              d="M57 48H63"
              stroke="#263936"
              strokeWidth="2.4"
            />
          </>
        ) : null}
      </svg>
    </span>
  );
}

export function isSportingDirectorAvatarKey(
  value: string | null | undefined
): value is SportingDirectorAvatarKey {
  return SPORTING_DIRECTOR_AVATARS.some(
    (avatar) => avatar.key === value
  );
}

function AvatarHairBack({
  avatar,
}: {
  avatar: AvatarDefinition;
}) {
  switch (avatar.hairStyle) {
    case "long":
      return (
        <>
          <ellipse
            cx="39"
            cy="57"
            rx="12"
            ry="33"
            fill={avatar.hair}
          />

          <ellipse
            cx="81"
            cy="57"
            rx="12"
            ry="33"
            fill={avatar.hair}
          />
        </>
      );

    case "bun":
      return (
        <>
          <circle
            cx="60"
            cy="17"
            r="12"
            fill={avatar.hair}
          />

          <ellipse
            cx="60"
            cy="44"
            rx="28"
            ry="31"
            fill={avatar.hair}
          />
        </>
      );

    case "bob":
      return (
        <ellipse
          cx="60"
          cy="50"
          rx="30"
          ry="35"
          fill={avatar.hair}
        />
      );

    case "ponytail":
      return (
        <>
          <ellipse
            cx="60"
            cy="43"
            rx="28"
            ry="29"
            fill={avatar.hair}
          />

          <ellipse
            cx="87"
            cy="51"
            rx="12"
            ry="27"
            fill={avatar.hair}
            transform="rotate(-12 87 51)"
          />
        </>
      );

    default:
      return null;
  }
}

function AvatarHairFront({
  avatar,
}: {
  avatar: AvatarDefinition;
}) {
  switch (avatar.hairStyle) {
    case "short":
      return (
        <path
          d="M37 42C38 24 47 17 61 17C75 17 82 25 83 42C75 35 69 32 60 32C51 32 45 35 37 42Z"
          fill={avatar.hair}
        />
      );

    case "side":
      return (
        <path
          d="M36 43C37 24 47 16 63 17C76 18 83 27 83 42C76 35 68 31 57 31C49 31 43 35 36 43Z"
          fill={avatar.hair}
        />
      );

    case "buzz":
      return (
        <path
          d="M37 39C39 24 47 18 60 18C73 18 81 24 83 39C75 34 68 31 60 31C52 31 45 34 37 39Z"
          fill={avatar.hair}
        />
      );

    case "curly":
      return (
        <>
          <circle
            cx="40"
            cy="33"
            r="10"
            fill={avatar.hair}
          />

          <circle
            cx="48"
            cy="24"
            r="11"
            fill={avatar.hair}
          />

          <circle
            cx="60"
            cy="22"
            r="12"
            fill={avatar.hair}
          />

          <circle
            cx="72"
            cy="25"
            r="11"
            fill={avatar.hair}
          />

          <circle
            cx="80"
            cy="34"
            r="10"
            fill={avatar.hair}
          />
        </>
      );

    case "long":
      return (
        <path
          d="M35 44C36 25 46 16 61 16C76 16 84 27 84 44C76 33 70 29 60 29C50 29 43 34 35 44Z"
          fill={avatar.hair}
        />
      );

    case "bun":
      return (
        <path
          d="M35 43C36 25 46 17 60 17C74 17 83 25 84 43C76 34 68 30 60 30C52 30 44 34 35 43Z"
          fill={avatar.hair}
        />
      );

    case "bob":
      return (
        <path
          d="M34 45C34 25 44 16 60 16C76 16 86 25 86 45C78 34 70 30 60 30C50 30 42 34 34 45Z"
          fill={avatar.hair}
        />
      );

    case "ponytail":
      return (
        <path
          d="M35 43C36 25 46 16 61 16C76 16 84 26 84 43C76 34 69 30 59 30C50 30 43 34 35 43Z"
          fill={avatar.hair}
        />
      );
  }
}