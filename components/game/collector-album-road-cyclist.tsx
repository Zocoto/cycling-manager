type RoadPerspectiveCyclistProps = {
  x: number;
  y: number;
  scale?: number;
  jersey: string;
  aero?: boolean;
  headingDeg?: number;
};

const INK = {
  blue: "#294b59",
  sage: "#8aa694",
  brick: "#b95542",
  yellow: "#dfb756",
  paper: "#f1ecd9",
};

/**
 * Four-ink rear view, riding towards local -Y. The rear tyre touches (0, 0).
 * Height is 198 units on the hoods, 180 on the aero bars; width is 70 units.
 * Heading turns the bicycle towards the road's vanishing point. The torso
 * counter-rotates around the saddle to keep its vertical axis upright in view.
 */
export function RoadPerspectiveCyclist({
  x,
  y,
  scale = 1,
  jersey,
  aero = false,
  headingDeg = 0,
}: RoadPerspectiveCyclistProps) {
  const bodyLeanDeg = Number((headingDeg * .15).toFixed(3));
  const bodyCounterRotationDeg = Number((bodyLeanDeg - headingDeg).toFixed(3));

  return (
    <g
      transform={`translate(${x} ${y}) rotate(${headingDeg}) scale(${scale})`}
      data-art-cyclist-view="rear-three-quarter"
      data-art-heading-deg={headingDeg}
      data-art-riding-posture={aero ? "aero" : "hoods"}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The front wheel recedes towards the horizon, not across the road. */}
      <ellipse cx="5" cy="-75" rx="8" ry="22" fill={INK.blue} />
      <ellipse cx="5" cy="-75" rx="5.3" ry="18.8" fill={INK.sage} stroke={INK.paper} strokeWidth="1" />
      <path d="M5-94v38M0-90l10 30M0-62l10-27" fill="none" stroke={INK.paper} strokeWidth=".8" />
      <path d="m5-75-2-30m-2 0h8" fill="none" stroke={INK.blue} strokeWidth="4" />

      {/* Narrow frame triangles and stays, visible between the moving legs. */}
      <path d="m0-28 1-64 9 35-10 29m1-64 4 17 5 18M0-28l10-29" fill="none" stroke={INK.paper} strokeWidth="6" />
      <path d="m0-28 1-64 9 35-10 29m1-64 4 17 5 18M0-28l10-29" fill="none" stroke={INK.yellow} strokeWidth="3" />
      <path d="M1-89v-11m-11 0h22" stroke={INK.blue} strokeWidth="4" />
      <path d={aero ? "M-16-106q21-6 38-1m-18 0-5-14m11 14 3-14" : "M-29-107q11-9 32-8t28 10m-59-2 2 10m55-7-2 9"} fill="none" stroke={INK.blue} strokeWidth="5" />

      {/* Unequal pedal positions keep the figure human, rather than mirrored. */}
      <path d="m-10-91-12 31 9 26m24-58 14 21-10 13" fill="none" stroke={INK.blue} strokeWidth="14" />
      <path d="m-22-60 9 26m38-37-10 13" fill="none" stroke={INK.paper} strokeWidth="9" />
      <path d="m-18-43 8-2m8-10 9 4" stroke={INK.brick} strokeWidth="5" />
      <path d="m-14-34 12 3-1 6-16-3Zm28-24 13 4-3 6-14-4Z" fill={INK.blue} stroke={INK.paper} strokeWidth="1.5" />
      <path d="m10-57-7 16m-7 0h16m-2-16h15" fill="none" stroke={INK.blue} strokeWidth="3" />

      {/* Rear wheel is closest to the viewer; its contact remains exactly zero. */}
      <ellipse cx="0" cy="-28" rx="11" ry="28" fill={INK.blue} />
      <ellipse cx="0" cy="-28" rx="7.5" ry="24" fill={INK.sage} stroke={INK.paper} strokeWidth="1.1" />
      <path d="M0-51v46m-6-42 12 38m-12-1L6-47m-13 19H7" fill="none" stroke={INK.paper} strokeWidth=".9" />
      <path d="M0-46v35" stroke={INK.blue} strokeWidth="2" />
      <circle cy="-28" r="2.5" fill={INK.yellow} />

      {/* Back, shoulders and elbow shapes establish the rear-facing anatomy. */}
      <g
        transform={`rotate(${bodyCounterRotationDeg} 0 -95)`}
        data-art-body-lean-deg={bodyLeanDeg}
      >
      <path
        d={aero ? "M-13-141q15-9 32 1l9 35-13 13-28-2-11-14Z" : "M-19-158q18-9 39 1l9 42-15 22-30-2-12-25Z"}
        fill={jersey}
        stroke={INK.blue}
        strokeWidth="2.5"
      />
      <path
        d={aero ? "m-13-139-12 17 10 13m34-31 14 19-14 12" : "m-19-154-15 24 8 24m46-48 15 24-9 24"}
        fill="none"
        stroke={INK.blue}
        strokeWidth="12"
      />
      <path
        d={aero ? "m-14-139-10 17 9 13m34-31 13 19-13 12" : "m-19-154-14 24 7 24m46-48 14 24-8 24"}
        fill="none"
        stroke={INK.paper}
        strokeWidth="8"
      />
      <path
        d={aero ? "m-15-109 9-9m25 9-9-10" : "m-26-106-1 6m53-6 1 6"}
        fill="none"
        stroke={INK.blue}
        strokeWidth="5"
      />
      <path d={aero ? "M-16-114q15 7 34 0l-4 24-14 8-15-10Z" : "M-20-115q20 8 41 0l-7 25-14 8-16-11Z"} fill={INK.blue} />
      <path d={aero ? "M-9-133q11-5 22 0M-12-124q14-4 28 0" : "M-12-148q13-5 26 0M-16-137q16-4 33 0"} fill="none" stroke={INK.paper} strokeWidth="2" opacity=".8" />
      <path d={aero ? "m1-138 2 21" : "m1-155 2 28"} stroke={INK.blue} strokeWidth="1.5" opacity=".35" />
      <path d={aero ? "M-5-146v8q6 5 13 0v-8" : "M-5-166v9q7 5 13-1v-8"} fill={INK.paper} stroke={INK.blue} strokeWidth="1.5" />
      <path
        d={aero ? "M-10-159q1-18 15-19 15 1 15 18l-6 19-13-5-9-3Z" : "M-12-181q2-16 16-16 15 1 16 17l-5 16-13 3-13-6Z"}
        fill={INK.paper}
        stroke={INK.blue}
        strokeWidth="2.5"
      />
      <path
        d={aero ? "M-9-161q13-6 28 1l-3 8-13-4-11 2Z" : "M-10-180q13-7 27 0l-2 7-12-2-12 3Z"}
        fill={jersey}
      />
      <path d={aero ? "M1-173v12m7-11 2 11" : "M-1-191v10m8-10 1 10"} stroke={INK.blue} strokeWidth="2" />
      </g>
    </g>
  );
}
