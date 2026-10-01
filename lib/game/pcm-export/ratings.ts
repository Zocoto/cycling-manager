export const CS_RATING_KEYS = [
  "mountain",
  "hills",
  "flat",
  "time_trial",
  "cobbles",
  "sprint",
  "acceleration",
  "downhill",
  "endurance",
  "resistance",
  "recovery",
  "breakaway",
  "prologue",
] as const;

export type CsRatingKey = (typeof CS_RATING_KEYS)[number];

export const PCM_RATING_COLUMNS: Record<CsRatingKey, string> = {
  mountain: "charac_i_mountain",
  hills: "charac_i_hill",
  flat: "charac_i_plain",
  time_trial: "charac_i_timetrial",
  cobbles: "charac_i_cobble",
  sprint: "charac_i_sprint",
  acceleration: "charac_i_acceleration",
  downhill: "charac_i_downhilling",
  endurance: "charac_i_endurance",
  resistance: "charac_i_resistance",
  recovery: "charac_i_recuperation",
  breakaway: "charac_i_baroudeur",
  prologue: "charac_i_prologue",
};

export type RatingSource = Record<CsRatingKey, number>;

export type RatingScale = {
  version: 2;
  method: "fixed-linear-absolute";
  population: "theoretical Cyclostratege scale from 0 to 100";
  csMinimum: number;
  csMaximum: number;
  pcmMinimum: number;
  pcmMaximum: number;
  coefficient: number;
};

export function deriveGlobalRatingScale(
  ratings: RatingSource[],
  { pcmMinimum = 45, pcmMaximum = 85 } = {},
): RatingScale {
  const values = ratings.flatMap((rating) =>
    CS_RATING_KEYS.map((key) => Number(rating[key])).filter(Number.isFinite),
  );

  if (values.length === 0) {
    throw new Error("Impossible de calculer l'echelle PCM sans notes CS.");
  }

  const csMinimum = 0;
  const csMaximum = 100;

  return {
    version: 2,
    method: "fixed-linear-absolute",
    population: "theoretical Cyclostratege scale from 0 to 100",
    csMinimum,
    csMaximum,
    pcmMinimum,
    pcmMaximum,
    coefficient: (pcmMaximum - pcmMinimum) / (csMaximum - csMinimum),
  };
}

export function convertCsRatingToPcm(value: number, scale: RatingScale) {
  const source = Number(value);
  if (!Number.isFinite(source)) {
    throw new Error(`Note CS invalide : ${String(value)}`);
  }

  const converted =
    scale.pcmMinimum + (source - scale.csMinimum) * scale.coefficient;

  return Math.max(
    scale.pcmMinimum,
    Math.min(scale.pcmMaximum, Math.round(converted)),
  );
}

export function convertCsRatingDeltaToPcm(
  delta: number,
  scale: RatingScale,
) {
  const source = Number(delta);
  if (!Number.isFinite(source)) {
    throw new Error(`Ecart de note CS invalide : ${String(delta)}`);
  }
  return Math.round(source * scale.coefficient);
}

export function convertRiderRatings(
  rating: RatingSource,
  scale: RatingScale,
) {
  return Object.fromEntries(
    CS_RATING_KEYS.map((key) => [
      PCM_RATING_COLUMNS[key],
      convertCsRatingToPcm(rating[key], scale),
    ]),
  ) as Record<string, number>;
}
