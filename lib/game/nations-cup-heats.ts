export const PROFESSIONAL_NATIONS_CUP_EVENTS = [
  {
    slotKey: "nc-mountain",
    slug: "nations-cup-montagne",
    name: "Montagne",
    profileType: "mountain",
  },
  {
    slotKey: "nc-hills",
    slug: "nations-cup-vallons",
    name: "Vallons",
    profileType: "hilly",
  },
  {
    slotKey: "nc-sprint",
    slug: "nations-cup-sprint",
    name: "Sprint",
    profileType: "sprint",
  },
  {
    slotKey: "nc-cobbles",
    slug: "nations-cup-paves",
    name: "Pavés",
    profileType: "cobbles",
  },
  {
    slotKey: "nc-time-trial",
    slug: "nations-cup-contre-la-montre",
    name: "Contre-la-montre",
    profileType: "time_trial",
  },
] as const;

// Three cron packs can absorb all eight tables of the five very short races
// before their shared departure. Ordinary races retain their smaller batch.
export const PROFESSIONAL_NATIONS_CUP_HEAT_BATCH_SIZE = 16;

export function getNationsCupPoolKey(
  division: number,
  groupCode: string | null,
) {
  return `d${division}${groupCode ? `-${groupCode.toLowerCase()}` : ""}`;
}

export function isSecondaryProfessionalNationsCupHeatSlug(slug: string) {
  return /-d[2-4]-[a-c]$/.test(slug);
}
