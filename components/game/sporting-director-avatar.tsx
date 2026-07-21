import {
  SPORTING_DIRECTOR_AVATARS,
  getAvatarBackground,
  getAvatarEyeColor,
  getAvatarHairColor,
  getAvatarOutfit,
  getAvatarSkinTone,
  isSportingDirectorAvatarKey,
  resolveSportingDirectorAvatar,
  type SportingDirectorAvatarConfig,
} from "@/lib/sporting-director-avatar";

export { SPORTING_DIRECTOR_AVATARS, isSportingDirectorAvatarKey };

type SportingDirectorAvatarProps = {
  avatarKey?: string | null;
  size?: "small" | "medium" | "large" | "xlarge";
  label?: string;
  className?: string;
};

const avatarSizeClasses = {
  small: "h-10 w-10",
  medium: "h-16 w-16",
  large: "h-24 w-24",
  xlarge: "h-44 w-44",
};

export function SportingDirectorAvatar({
  avatarKey,
  size = "medium",
  label = "Avatar du Directeur Sportif",
  className = "",
}: SportingDirectorAvatarProps) {
  const avatar = resolveSportingDirectorAvatar(avatarKey);
  const skin = getAvatarSkinTone(avatar.skinTone);
  const hair = getAvatarHairColor(avatar.hairColor);
  const eyes = getAvatarEyeColor(avatar.eyeColor);
  const outfit = getAvatarOutfit(avatar.outfit);
  const background = getAvatarBackground(avatar.background);

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
      <svg aria-hidden="true" viewBox="0 0 120 120" className="h-full w-full">
        <circle cx="60" cy="60" r="60" fill={background.color} />
        <path
          d="M-8 89C19 64 33 70 53 50C75 28 90 31 128 7V-5H-8Z"
          fill={background.accent}
          opacity="0.28"
        />
        <circle cx="99" cy="28" r="20" fill="#FFFFFF" opacity="0.15" />

        <AvatarHairBack avatar={avatar} color={hair.color} />

        <path
          d="M11 121C14 93 31 78 60 78C89 78 106 93 109 121Z"
          fill={outfit.jacket}
        />
        <path
          d="M40 84L60 105L80 84C74 79 68 77 60 77C52 77 46 79 40 84Z"
          fill={outfit.shirt}
        />
        <path d="M51 67H69V85C66 91 54 91 51 85Z" fill={skin.shadow} />

        <AvatarEars avatar={avatar} skin={skin.color} shadow={skin.shadow} />
        <AvatarFace avatar={avatar} skin={skin.color} />
        <AvatarCheeks avatar={avatar} blush={skin.blush} shadow={skin.shadow} />
        <AvatarHairFront avatar={avatar} color={hair.color} />
        <AvatarEyebrows avatar={avatar} color={hair.color} />
        <AvatarEyes avatar={avatar} irisColor={eyes.color} />
        <AvatarNose avatar={avatar} color={skin.shadow} />
        <AvatarMouth avatar={avatar} />
        <AvatarFacialHair avatar={avatar} color={hair.color} />
        <AvatarGlasses avatar={avatar} />
      </svg>
    </span>
  );
}

function AvatarFace({
  avatar,
  skin,
}: {
  avatar: SportingDirectorAvatarConfig;
  skin: string;
}) {
  switch (avatar.faceShape) {
    case "round":
      return <ellipse cx="60" cy="49" rx="25" ry="27" fill={skin} />;
    case "square":
      return (
        <path
          d="M37 29C42 20 50 17 60 17C70 17 78 20 83 29L82 61C79 74 70 80 60 80C50 80 41 74 38 61Z"
          fill={skin}
        />
      );
    case "heart":
      return (
        <path
          d="M35 37C36 23 45 17 60 17C75 17 84 23 85 37C84 58 78 72 60 81C42 72 36 58 35 37Z"
          fill={skin}
        />
      );
    case "long":
      return <ellipse cx="60" cy="49" rx="22" ry="32" fill={skin} />;
    default:
      return <ellipse cx="60" cy="49" rx="24" ry="30" fill={skin} />;
  }
}

function AvatarEars({
  avatar,
  skin,
  shadow,
}: {
  avatar: SportingDirectorAvatarConfig;
  skin: string;
  shadow: string;
}) {
  const dimensions = {
    small: { rx: 4, ry: 7, offset: 0 },
    round: { rx: 5.5, ry: 8, offset: 0 },
    long: { rx: 5, ry: 10, offset: 1 },
    pronounced: { rx: 7, ry: 9, offset: 2 },
  }[avatar.earShape];

  return (
    <>
      <ellipse cx={37 - dimensions.offset} cy="51" rx={dimensions.rx} ry={dimensions.ry} fill={skin} />
      <ellipse cx={83 + dimensions.offset} cy="51" rx={dimensions.rx} ry={dimensions.ry} fill={skin} />
      <path d="M35 49C39 47 40 52 37 56" fill="none" stroke={shadow} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M85 49C81 47 80 52 83 56" fill="none" stroke={shadow} strokeWidth="1.2" strokeLinecap="round" />
    </>
  );
}

function AvatarCheeks({
  avatar,
  blush,
  shadow,
}: {
  avatar: SportingDirectorAvatarConfig;
  blush: string;
  shadow: string;
}) {
  if (avatar.cheekStyle === "none") {
    return null;
  }

  if (avatar.cheekStyle === "freckles") {
    return (
      <g fill={shadow} opacity="0.62">
        {[44, 48, 51, 69, 72, 76].map((cx, index) => (
          <circle key={cx} cx={cx} cy={index < 3 ? 58 + (index % 2) : 59 - (index % 2)} r="0.8" />
        ))}
      </g>
    );
  }

  const cheekY = avatar.cheekStyle === "high" ? 55 : 59;
  const radiusX = avatar.cheekStyle === "defined" ? 7 : 6;

  return (
    <>
      <ellipse cx="45" cy={cheekY} rx={radiusX} ry="3.4" fill={blush} opacity={avatar.cheekStyle === "defined" ? 0.34 : 0.22} />
      <ellipse cx="75" cy={cheekY} rx={radiusX} ry="3.4" fill={blush} opacity={avatar.cheekStyle === "defined" ? 0.34 : 0.22} />
      {avatar.cheekStyle === "defined" ? (
        <>
          <path d="M40 62C44 64 48 64 51 62" fill="none" stroke={shadow} strokeWidth="1.1" opacity="0.5" />
          <path d="M69 62C72 64 76 64 80 62" fill="none" stroke={shadow} strokeWidth="1.1" opacity="0.5" />
        </>
      ) : null}
    </>
  );
}

function AvatarEyebrows({
  avatar,
  color,
}: {
  avatar: SportingDirectorAvatarConfig;
  color: string;
}) {
  const styles = {
    soft: { left: "M43 43C47 41 51 41 55 43", right: "M65 43C69 41 73 41 77 43", width: 2 },
    straight: { left: "M43 42.5L55 42.5", right: "M65 42.5L77 42.5", width: 2.2 },
    arched: { left: "M43 44C47 38.5 52 39 55 42", right: "M65 42C68 39 73 38.5 77 44", width: 2 },
    bold: { left: "M42 43C47 39.5 52 40 56 42", right: "M64 42C68 40 73 39.5 78 43", width: 3.3 },
    angled: { left: "M43 44L55 40", right: "M65 40L77 44", width: 2.4 },
  }[avatar.eyebrowStyle];

  return (
    <>
      <path d={styles.left} fill="none" stroke={color} strokeWidth={styles.width} strokeLinecap="round" />
      <path d={styles.right} fill="none" stroke={color} strokeWidth={styles.width} strokeLinecap="round" />
    </>
  );
}

function AvatarEyes({
  avatar,
  irisColor,
}: {
  avatar: SportingDirectorAvatarConfig;
  irisColor: string;
}) {
  return (
    <>
      <AvatarEye x={50} shape={avatar.eyeShape} irisColor={irisColor} mirrored={false} />
      <AvatarEye x={70} shape={avatar.eyeShape} irisColor={irisColor} mirrored />
    </>
  );
}

function AvatarEye({
  x,
  shape,
  irisColor,
  mirrored,
}: {
  x: number;
  shape: SportingDirectorAvatarConfig["eyeShape"];
  irisColor: string;
  mirrored: boolean;
}) {
  const transform = mirrored ? `translate(${x} 49) scale(-1 1)` : `translate(${x} 49)`;

  return (
    <g transform={transform}>
      {shape === "round" ? <ellipse cx="0" cy="0" rx="4.2" ry="3.6" fill="#FFFDF8" /> : null}
      {shape === "almond" ? <path d="M-5 0C-2-3 2-3 5 0C2 3-2 3-5 0Z" fill="#FFFDF8" /> : null}
      {shape === "narrow" ? <path d="M-5 0C-2-1.8 2-1.8 5 0C2 1.6-2 1.6-5 0Z" fill="#FFFDF8" /> : null}
      {shape === "upturned" ? <path d="M-5 1C-1-2.6 2-2.5 5-1C2 2-2 2.8-5 1Z" fill="#FFFDF8" /> : null}
      {shape === "relaxed" ? <path d="M-5-1C-1 1 2 1 5-1C3 3-2 3-5-1Z" fill="#FFFDF8" /> : null}
      <circle cx="0" cy="0" r={shape === "narrow" ? 1.8 : 2.25} fill={irisColor} />
      <circle cx="0" cy="0" r="1" fill="#17211E" />
      <circle cx="-0.6" cy="-0.7" r="0.45" fill="#FFFFFF" opacity="0.9" />
    </g>
  );
}

function AvatarNose({
  avatar,
  color,
}: {
  avatar: SportingDirectorAvatarConfig;
  color: string;
}) {
  const paths = {
    straight: "M59 51L57 60C59 61 61 61 63 60",
    fine: "M60 51L58.5 60L62 60",
    round: "M59 52L57 59C58 62 62 62 64 59",
    wide: "M58 52L55 60C58 63 64 63 67 60",
    aquiline: "M59 51C60 55 56 58 57 61C60 62 63 62 65 60",
  }[avatar.noseShape];

  return <path d={paths} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />;
}

function AvatarMouth({ avatar }: { avatar: SportingDirectorAvatarConfig }) {
  const mouth = {
    neutral: { path: "M53 68C57 68.5 63 68.5 67 68", width: 2 },
    smile: { path: "M52 66C56 71 64 71 68 66", width: 2.1 },
    soft: { path: "M53 67C57 69 63 69 67 67", width: 2 },
    full: { path: "M52 67C56 64.5 64 64.5 68 67C64 71 56 71 52 67Z", width: 1.4 },
    determined: { path: "M52 69C56 67 64 67 68 69", width: 2.2 },
  }[avatar.mouthShape];

  return (
    <path
      d={mouth.path}
      fill={avatar.mouthShape === "full" ? "#9C5559" : "none"}
      stroke="#8B4E4D"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={mouth.width}
    />
  );
}

function AvatarFacialHair({
  avatar,
  color,
}: {
  avatar: SportingDirectorAvatarConfig;
  color: string;
}) {
  switch (avatar.facialHair) {
    case "stubble":
      return <path d="M43 61C45 76 52 81 60 81C68 81 75 76 77 61C72 71 67 75 60 75C53 75 48 71 43 61Z" fill={color} opacity="0.23" />;
    case "moustache":
      return <path d="M60 64C56 61 50 63 49 67C54 67 57 68 60 66C63 68 66 67 71 67C70 63 64 61 60 64Z" fill={color} />;
    case "goatee":
      return (
        <>
          <path d="M60 64C56 62 52 64 51 67C55 67 58 68 60 66C62 68 65 67 69 67C68 64 64 62 60 64Z" fill={color} />
          <path d="M55 70C56 78 64 78 65 70C63 73 57 73 55 70Z" fill={color} opacity="0.9" />
        </>
      );
    case "short":
      return <path d="M42 59C44 75 51 82 60 82C69 82 76 75 78 59C73 69 68 74 60 75C52 74 47 69 42 59Z" fill={color} opacity="0.72" />;
    case "full":
      return <path d="M40 56C41 76 49 86 60 87C71 86 79 76 80 56C75 68 69 75 60 77C51 75 45 68 40 56Z" fill={color} opacity="0.9" />;
    default:
      return null;
  }
}

function AvatarGlasses({ avatar }: { avatar: SportingDirectorAvatarConfig }) {
  if (avatar.glasses === "none") {
    return null;
  }

  const frame = "#263936";

  if (avatar.glasses === "round") {
    return (
      <g fill="none" stroke={frame} strokeWidth="2.1">
        <circle cx="50" cy="49" r="7" />
        <circle cx="70" cy="49" r="7" />
        <path d="M57 49H63M43 48L36 46M77 48L84 46" />
      </g>
    );
  }

  if (avatar.glasses === "aviator") {
    return (
      <g fill="#6E8C8A" fillOpacity="0.12" stroke={frame} strokeWidth="2">
        <path d="M41 44H57L56 50C55 56 46 57 43 52Z" />
        <path d="M79 44H63L64 50C65 56 74 57 77 52Z" />
        <path d="M57 47H63M41 46L36 44M79 46L84 44" fill="none" />
      </g>
    );
  }

  const catEye = avatar.glasses === "cat-eye";

  return (
    <g fill="none" stroke={frame} strokeWidth="2.2">
      <path d={catEye ? "M41 44L57 46L56 54H44Z" : "M42 44H57V54H43Z"} />
      <path d={catEye ? "M79 44L63 46L64 54H76Z" : "M63 44H78L77 54H63Z"} />
      <path d="M57 49H63M42 47L36 45M78 47L84 45" />
    </g>
  );
}

function AvatarHairBack({
  avatar,
  color,
}: {
  avatar: SportingDirectorAvatarConfig;
  color: string;
}) {
  switch (avatar.hairStyle) {
    case "long":
      return (
        <>
          <ellipse cx="38" cy="58" rx="13" ry="36" fill={color} />
          <ellipse cx="82" cy="58" rx="13" ry="36" fill={color} />
        </>
      );
    case "bun":
      return (
        <>
          <circle cx="60" cy="14" r="13" fill={color} />
          <ellipse cx="60" cy="43" rx="29" ry="31" fill={color} />
        </>
      );
    case "bob":
      return <ellipse cx="60" cy="51" rx="31" ry="37" fill={color} />;
    case "ponytail":
      return (
        <>
          <ellipse cx="60" cy="42" rx="28" ry="29" fill={color} />
          <ellipse cx="87" cy="53" rx="12" ry="29" fill={color} transform="rotate(-12 87 53)" />
        </>
      );
    case "afro":
      return <circle cx="60" cy="38" r="35" fill={color} />;
    case "braids":
      return (
        <>
          <ellipse cx="60" cy="39" rx="29" ry="27" fill={color} />
          <path d="M38 40C30 55 34 75 38 87M46 34C39 54 42 74 45 91M74 34C81 54 78 74 75 91M82 40C90 55 86 75 82 87" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

function AvatarHairFront({
  avatar,
  color,
}: {
  avatar: SportingDirectorAvatarConfig;
  color: string;
}) {
  switch (avatar.hairStyle) {
    case "bald":
      return <path d="M40 31C47 21 73 21 80 31" fill="none" stroke={color} strokeWidth="1.2" opacity="0.18" />;
    case "buzz":
      return <path d="M37 37C39 23 47 18 60 18C73 18 81 23 83 37C75 32 68 29 60 29C52 29 45 32 37 37Z" fill={color} />;
    case "crop":
      return <path d="M36 40C38 22 47 16 61 16C75 16 83 24 84 40L76 34L71 37L64 32L57 36L50 32L43 38Z" fill={color} />;
    case "side":
      return <path d="M35 42C36 23 47 15 64 17C77 18 84 27 84 42C76 34 69 30 58 30C49 30 42 35 35 42Z" fill={color} />;
    case "waves":
      return <path d="M34 42C34 24 44 16 59 16C73 15 84 24 86 41C78 34 73 34 67 29C61 35 54 28 47 35C42 36 38 39 34 42Z" fill={color} />;
    case "curls":
      return (
        <g fill={color}>
          <circle cx="39" cy="33" r="10" /><circle cx="47" cy="24" r="11" /><circle cx="59" cy="21" r="12" /><circle cx="72" cy="24" r="11" /><circle cx="81" cy="33" r="10" />
        </g>
      );
    case "afro":
      return <path d="M34 42C36 20 47 11 60 11C73 11 84 20 86 42C78 33 70 29 60 29C50 29 42 33 34 42Z" fill={color} />;
    case "braids":
      return <path d="M34 41C36 22 46 14 60 14C74 14 84 22 86 41C77 33 69 29 60 29C51 29 43 33 34 41Z" fill={color} />;
    case "bob":
      return <path d="M33 45C33 24 44 15 60 15C76 15 87 24 87 45C78 34 70 29 60 29C50 29 42 34 33 45Z" fill={color} />;
    case "long":
    case "bun":
    case "ponytail":
      return <path d="M34 43C35 24 45 15 61 15C77 15 85 26 86 43C77 34 69 29 59 29C49 29 42 34 34 43Z" fill={color} />;
  }
}
