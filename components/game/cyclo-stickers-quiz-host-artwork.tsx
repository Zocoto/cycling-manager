/**
 * Print pose of the real chat mascot. The head geometry and inks come from
 * public/images/chat/quizz-o-stratege.svg; only the jacket pose and cue card
 * differ. Coordinates occupy 120 × 150 for composition inside another SVG.
 */
export function CycloStickersQuizHostArtwork() {
  return <g data-quiz-host="quizz-o-stratege" data-quiz-host-source="/images/chat/quizz-o-stratege.svg">
    <g data-quiz-host-jacket="" strokeLinejoin="round">
      <path d="M12 147V116C12 91 29 78 60 78C88 78 107 91 108 116L110 147Z" fill="#275950" />
      <path d="M63 88C79 91 87 111 84 147H110L108 113C105 91 85 80 63 78Z" fill="#214B43" />
      <path d="M40 84L60 105L80 84C74 79 68 77 60 77C52 77 46 79 40 84Z" fill="#F4E6C9" />
      <path d="M42 84L60 102L51 108L34 87ZM78 84L60 102L69 108L86 87Z" fill="#367568" />
      <path d="M52 73H68V85C65 91 55 91 52 85Z" fill="#CBB682" />
      <path d="M20 99C11 108 11 122 21 133L41 140L48 127L32 121L34 108Z" fill="#367568" />
      <path d="M88 93C104 99 116 114 111 129L101 137L94 125L99 116L83 107Z" fill="#367568" />
      <path d="M19 142H109" fill="none" stroke="#448778" strokeWidth="1.2" />
      <path d="M57 108V145" fill="none" stroke="#163E37" strokeWidth="1.2" />
    </g>

    <g data-quiz-host-face="">
      <path d="M44 24H76V31C76 34 83 36 83 43V76C83 82 77 85 69 85H51C43 85 37 82 37 76V43C37 36 44 34 44 31Z" fill="#EFE1B8" />
      <path d="M71 32H76C78 35 83 37 83 43V76C83 82 77 85 69 85H52C47 85 43 84 41 82H67C75 82 77 79 77 74V44C77 39 74 36 71 32Z" fill="#D8C38A" />
      <path d="M41 45V63M41 70V75" fill="none" stroke="#FFF7DF" strokeWidth="2.1" strokeLinecap="round" />
      <rect x="54" y="10" width="12" height="13" rx="3" fill="#176951" />
      <rect x="52" y="8" width="16" height="5" rx="2.3" fill="#24594D" />
      <rect x="43" y="21" width="34" height="11" rx="3.5" fill="#24594D" />
      <path d="M49 24V28M55 24V28M61 24V28M67 24V28M73 24V28" fill="none" stroke="#448778" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M29 31C30 19 43 15 54 20L60 32Z" fill="#176951" />
      <path d="M38 21C42 19 45 18.5 48 18.8L51 30L44 31Z" fill="#D7B15A" />
      <path d="M29 30C39 30 49 30 59 31C55 35 40 37 27 34C25 33 26 31 29 30Z" fill="#24594D" />
      <path d="M43 43C47 41 51 41 55 43M65 43C69 41 73 41 77 43" fill="none" stroke="#3B2821" strokeWidth="2" strokeLinecap="round" />
      <g transform="translate(50 49)">
        <path d="M-5 0C-2-3 2-3 5 0C2 3-2 3-5 0Z" fill="#FFFDF8" />
        <circle r="2.25" fill="#70452F" /><circle r="1" fill="#17211E" />
        <circle cx="-.6" cy="-.7" r=".45" fill="#FFFFFF" opacity=".9" />
      </g>
      <g transform="translate(70 49) scale(-1 1)">
        <path d="M-5 0C-2-3 2-3 5 0C2 3-2 3-5 0Z" fill="#FFFDF8" />
        <circle r="2.25" fill="#70452F" /><circle r="1" fill="#17211E" />
        <circle cx="-.6" cy="-.7" r=".45" fill="#FFFFFF" opacity=".9" />
      </g>
      <path d="M60 52L57.5 59Q60 61 63 59.5" fill="none" stroke="#BEA76C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M54 69C57 72 63 72 67 68" fill="none" stroke="#8B4E4D" strokeWidth="2" strokeLinecap="round" />
      <path d="M60 64C56 61 50 63 49 67C54 67 57 68 60 66C63 68 66 67 71 67C70 63 64 61 60 64Z" fill="#3B2821" />
    </g>

    <g transform="rotate(-8 77 120)" data-quiz-cue-card="held">
      <rect x="45.5" y="102" width="67" height="39" rx="2" fill="#163E37" opacity=".24" />
      <rect x="44" y="100" width="67" height="39" rx="2" fill="#EBC54C" stroke="#A48236" strokeWidth=".8" />
      <rect x="47" y="103" width="61" height="33" rx=".6" fill="none" stroke="#FFF0A4" strokeWidth=".6" />
      <text x="52" y="112" fill="#224A41" fontFamily="Georgia, serif" fontSize="7" fontWeight="700" letterSpacing=".6" data-i18n-skip="">QUIZZ</text>
      <path d="M52 119H75M52 123H69M52 127H73" fill="none" stroke="#79652F" strokeWidth=".7" />
      <text x="89" y="130" textAnchor="middle" fill="#224A41" fontFamily="Georgia, serif" fontSize="25" fontWeight="700" data-i18n-skip="">?</text>
      <path d="M52 132H62" fill="none" stroke="#A48236" strokeWidth=".6" />
      <g data-quiz-card-hand="left">
        <path d="M39 124C41 121 45 122 47 125L51 126C54 127 54 132 51 133L46 132L44 135L38 132Z" fill="#D8C38A" />
        <path d="M45 126L50 128M44 129L49 131" fill="none" stroke="#B7A16B" strokeWidth=".7" strokeLinecap="round" />
        <path d="M31 124L40 122L43 134L35 136Z" fill="#275950" />
      </g>
      <g data-quiz-card-hand="right">
        <path d="M112 118C113 115 109 113 107 116L103 120C101 121 102 125 105 125L107 123L106 131L111 132L114 125Z" fill="#EFE1B8" />
        <path d="M108 120L112 122M108 123L112 125" fill="none" stroke="#BEA76C" strokeWidth=".7" strokeLinecap="round" />
        <path d="M108 131L115 129L117 139L109 141Z" fill="#275950" />
      </g>
    </g>
  </g>;
}
