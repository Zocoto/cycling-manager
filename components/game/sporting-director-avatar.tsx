import {
  ALPHA_TESTER_AVATAR_FRAME_KEY,
  type SportingDirectorAvatarFrameKey,
} from "@/lib/game/trophy-gallery";
import {
  AMBULANCIER_AVATAR_OUTFIT_KEY,
  ASSIDU_AVATAR_GLASSES_KEY,
  EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY,
  HIDDEN_SWITCHBACK_AVATAR_GLASSES_KEY,
  INVETERATE_PLAYER_AVATAR_OUTFIT_KEY,
  PATRON_HAT_AVATAR_OUTFIT_KEY,
  SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY,
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
  frameKey?: SportingDirectorAvatarFrameKey | null;
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
  frameKey = null,
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
      data-avatar-frame={frameKey ?? undefined}
      className={[
        "relative inline-flex shrink-0 rounded-full",
        avatarSizeClasses[size],
        className,
      ].join(" ")}
    >
      {frameKey === ALPHA_TESTER_AVATAR_FRAME_KEY ? (
        <AlphaTesterAvatarFrame />
      ) : null}
      <span className="relative z-10 flex h-full w-full overflow-hidden rounded-full border-2 border-white/80 shadow-md">
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

        {avatar.outfit === "patron" ||
        avatar.outfit === PATRON_HAT_AVATAR_OUTFIT_KEY ? (
          <AvatarPatronOutfit />
        ) : null}
        {avatar.outfit === SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY ? (
          <AvatarSponsorAmbassadorOutfit />
        ) : null}
        {avatar.outfit === AMBULANCIER_AVATAR_OUTFIT_KEY ? (
          <AvatarNurseOutfit />
        ) : null}
        {avatar.outfit === EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY ? (
          <AvatarEmergencyDoctorOutfit />
        ) : null}
        {avatar.outfit === INVETERATE_PLAYER_AVATAR_OUTFIT_KEY ? (
          <AvatarPokerChipsOutfit />
        ) : null}

        <AvatarEars avatar={avatar} skin={skin.color} shadow={skin.shadow} />
        <AvatarFace avatar={avatar} skin={skin.color} />
        <AvatarCheeks avatar={avatar} blush={skin.blush} shadow={skin.shadow} />
        <AvatarHairFront avatar={avatar} color={hair.color} />
        {avatar.outfit === PATRON_HAT_AVATAR_OUTFIT_KEY ? (
          <AvatarPatronHat />
        ) : null}
        {avatar.outfit === AMBULANCIER_AVATAR_OUTFIT_KEY ? (
          <AvatarNurseCap />
        ) : null}
        <AvatarEyebrows avatar={avatar} color={hair.color} />
        <AvatarEyes avatar={avatar} irisColor={eyes.color} />
        <AvatarNose avatar={avatar} color={skin.shadow} />
        <AvatarMouth avatar={avatar} />
        <AvatarFacialHair avatar={avatar} color={hair.color} />
        <AvatarGlasses avatar={avatar} />
        </svg>
      </span>
    </span>
  );
}

function AlphaTesterAvatarFrame() {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute -inset-[4px] rounded-full bg-[conic-gradient(from_35deg,#48D9C0,#D7FFF8_20%,#342A64_43%,#48D9C0_68%,#163F3B)] opacity-90 shadow-[0_0_13px_rgba(72,217,192,0.3)]"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 120 120"
        className="pointer-events-none absolute -inset-[7px] z-20 h-[calc(100%+14px)] w-[calc(100%+14px)] overflow-visible"
        fill="none"
      >
        <path d="M19 23h12M89 23h12M13 88h13M94 88h13" stroke="#D7FFF8" strokeWidth="1.6" opacity="0.85" />
        <circle cx="17" cy="23" r="2.4" fill="#48D9C0" />
        <circle cx="103" cy="23" r="2.4" fill="#D7FFF8" />
        <circle cx="11" cy="88" r="2.4" fill="#D7FFF8" />
        <circle cx="109" cy="88" r="2.4" fill="#48D9C0" />
      </svg>
    </>
  );
}

function AvatarPatronOutfit() {
  return (
    <g>
      <path d="M39 84L57 106L44 114L29 91Z" fill="#292624" />
      <path d="M81 84L63 106L76 114L91 91Z" fill="#292624" />
      <path d="M55 86L60 91L65 86L63 96L60 101L57 96Z" fill="#171514" />
      <path d="M58 99H62L64 118H56Z" fill="#171514" />
      <circle cx="84" cy="94" r="3.6" fill="#A61B32" />
      <circle cx="80.8" cy="92.2" r="2.2" fill="#C62A3D" />
      <circle cx="85.8" cy="90.8" r="2" fill="#8D1428" />
      <path d="M83 97l-2 8" stroke="#2C7A4B" strokeWidth="1.4" />
    </g>
  );
}

function AvatarPatronHat() {
  return (
    <g data-avatar-headwear="patron-fedora">
      <path
        d="M30 27C35 23 44 21 60 21C76 21 85 23 90 27C82 31 73 33 60 33C47 33 38 31 30 27Z"
        fill="#11100F"
        stroke="#3B3733"
        strokeWidth="1.4"
      />
      <path
        d="M41 24L45 9C48 4 72 4 75 9L79 24C69 27 51 27 41 24Z"
        fill="#1B1917"
        stroke="#3B3733"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M43 19C53 22 68 22 77 19L79 24C69 27 51 27 41 24Z" fill="#8F1730" />
      <path d="M60 7C68 7 72 8 75 10" fill="none" stroke="#4A4641" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  );
}

function AvatarSponsorAmbassadorOutfit() {
  return (
    <g data-avatar-outfit="sponsor-ambassador">
      <path
        d="M39 83 57 106 47 120H20c2-14 8-25 19-37Z"
        fill="#0A2E29"
      />
      <path
        d="m81 83-18 23 10 14h27c-2-14-8-25-19-37Z"
        fill="#0A2E29"
      />
      <path
        d="m39 83 18 23-8 7-18-24 8-6Zm42 0-18 23 8 7 18-24-8-6Z"
        fill="#D6AE3B"
      />
      <path
        d="M54 86 60 92l6-6-3 12-3 5-3-5-3-12Z"
        fill="#FFF8DE"
      />
      <path
        d="M58 99h4l2 21h-8l2-21Z"
        fill="#B88B23"
      />
      <path
        d="M58.5 102h3l1 7h-5l1-7Z"
        fill="#FFF0A8"
      />
      <g transform="translate(82 94)">
        <circle r="6.2" fill="#FFF8DE" stroke="#D6AE3B" strokeWidth="1.5" />
        <path
          d="M0 3.6C-4.5.8-4-3.5 0-4.3c4 .8 4.5 5.1 0 7.9Z"
          fill="#278B70"
        />
        <path d="M0-2.5v5" stroke="#FFF8DE" strokeWidth="1" strokeLinecap="round" />
      </g>
      <path
        d="M22 116h76"
        stroke="#D6AE3B"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.9"
      />
    </g>
  );
}

function AvatarNurseOutfit() {
  return (
    <g data-avatar-outfit="medical-nurse">
      <path d="M24 120c2-15 8-27 18-37l18 23 18-23c10 10 16 22 18 37H24Z" fill="#F6F3E9" />
      <path d="m42 83 18 23-10 8-17-25 9-6Zm36 0-18 23 10 8 17-25-9-6Z" fill="#CDEDE5" />
      <path d="M57 104h6v16h-6z" fill="#E1535B" />
      <path d="M52 109h16v6H52z" fill="#E1535B" />
    </g>
  );
}

function AvatarNurseCap() {
  return (
    <g data-avatar-headwear="nurse-cap">
      <path
        d="M39 25c5-15 37-21 42-3l-3 10c-12-5-25-5-37 0l-2-7Z"
        fill="#FFF9ED"
        stroke="#D7CDB8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M57 16h7v14h-7z" fill="#E1535B" />
      <path d="M53 20h15v7H53z" fill="#E1535B" />
    </g>
  );
}

function AvatarEmergencyDoctorOutfit() {
  return (
    <g data-avatar-outfit="emergency-doctor">
      <path d="M21 120c2-15 8-27 20-38l19 25 19-25c12 11 18 23 20 38H21Z" fill="#F7FAF8" />
      <path d="m41 82 19 25-12 8-16-26 9-7Zm38 0-19 25 12 8 16-26-9-7Z" fill="#DDEBE7" />
      <path d="M56 101h8v19h-8z" fill="#5BB7A8" />
      <path
        d="M47 88v7c0 10 6 16 13 16s13-6 13-16v-7"
        stroke="#293C3B"
        strokeWidth="2.7"
        strokeLinecap="round"
      />
      <circle cx="47" cy="88" r="2.8" fill="#B62F46" />
      <circle cx="73" cy="88" r="2.8" fill="#B62F46" />
      <path d="M60 111v3c0 4 3 6 8 6" stroke="#293C3B" strokeWidth="2.7" strokeLinecap="round" />
      <circle cx="72" cy="119" r="4.4" fill="#B62F46" stroke="#F7FAF8" strokeWidth="1.5" />
      <path d="M82 94h5M84.5 91.5v5" stroke="#B62F46" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

function AvatarPokerChipsOutfit() {
  return (
    <g data-avatar-outfit="poker-chips">
      <path d="M34 86 53 108l-9 12H20c2-14 7-25 14-34Z" fill="#202A40" />
      <path d="m86 86-19 22 9 12h24c-2-14-7-25-14-34Z" fill="#202A40" />
      <path d="m48 85 12 18 12-18-5 24H53l-5-24Z" fill="#F6E7C7" />
      <g stroke="#FFF4D6" strokeWidth="1.3">
        <g fill="#A52840">
          <ellipse cx="35" cy="114" rx="13" ry="4" />
          <path d="M22 102h26v12c0 5-26 5-26 0v-12Z" />
          <ellipse cx="35" cy="102" rx="13" ry="4" />
          <path d="M25 102h4M33 99v5M41 101l4 2" />
        </g>
        <g fill="#176951">
          <ellipse cx="60" cy="117" rx="14" ry="4" />
          <path d="M46 98h28v19c0 5-28 5-28 0V98Z" />
          <ellipse cx="60" cy="98" rx="14" ry="4" />
          <path d="M49 98h5M59 95v6M67 96l4 3" />
        </g>
        <g fill="#D7A928">
          <ellipse cx="86" cy="115" rx="13" ry="4" />
          <path d="M73 105h26v10c0 5-26 5-26 0v-10Z" />
          <ellipse cx="86" cy="105" rx="13" ry="4" />
          <path d="M76 105h4M85 102v6M93 103l4 3" />
        </g>
      </g>
      <circle cx="82" cy="91" r="5" fill="#684DA0" stroke="#FFF4D6" strokeWidth="1.2" />
      <path d="M82 87v8M78 91h8" stroke="#FFF4D6" strokeWidth="1" />
    </g>
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
  if (avatar.glasses === HIDDEN_SWITCHBACK_AVATAR_GLASSES_KEY) {
    return (
      <g data-avatar-accessory="spy-glasses">
        <g
          fill="#182526"
          fillOpacity="0.88"
          stroke="#080D0E"
          strokeWidth="2.7"
          strokeLinejoin="round"
        >
          <path d="M39 43L57 45L55 54H44C41 52 39 48 39 43Z" />
          <path d="M81 43L63 45L65 54H76C79 52 81 48 81 43Z" />
        </g>
        <path d="M56 48H64" stroke="#8057B5" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M39 46L34 43M81 46L86 43" stroke="#080D0E" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M44 46L51 45M67 46L75 45" stroke="#BDA7E8" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
      </g>
    );
  }

  if (avatar.glasses === ASSIDU_AVATAR_GLASSES_KEY) {
    return (
      <g data-avatar-accessory="assidu-glasses">
        <g
          fill="#DDF5F0"
          fillOpacity="0.22"
          stroke="#173F37"
          strokeWidth="3.4"
          strokeLinejoin="round"
        >
          <path d="M40 43H57L56 54H44C41 52 40 48 40 43Z" />
          <path d="M80 43H63L64 54H76C79 52 80 48 80 43Z" />
        </g>
        <path d="M57 48H63" stroke="#D7A928" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 46L35 43M80 46L85 43" stroke="#173F37" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M44 46L51 44M66 46L73 44" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity="0.72" />
        <circle cx="60" cy="48" r="1.8" fill="#FFF2B8" />
      </g>
    );
  }


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
