import type {
  YouthTrainingDomain,
  YouthTrainingMode,
} from "@/lib/game/youth-training";

export type YouthTrainingSettingsValue = {
  academyRiderId: string;
  trainingPriority: YouthTrainingDomain;
  trainingMode: YouthTrainingMode;
};

export type YouthTrainingSettingsByRiderId = Record<
  string,
  Omit<YouthTrainingSettingsValue, "academyRiderId">
>;

export function indexYouthTrainingSettings(
  settings: readonly YouthTrainingSettingsValue[],
): YouthTrainingSettingsByRiderId {
  return Object.fromEntries(
    settings.map((setting) => [
      setting.academyRiderId,
      {
        trainingPriority: setting.trainingPriority,
        trainingMode: setting.trainingMode,
      },
    ]),
  );
}

export function getChangedYouthTrainingSettings(
  initialByRiderId: YouthTrainingSettingsByRiderId,
  currentByRiderId: YouthTrainingSettingsByRiderId,
): YouthTrainingSettingsValue[] {
  return Object.entries(currentByRiderId).flatMap(
    ([academyRiderId, current]) => {
      const initial = initialByRiderId[academyRiderId];
      if (
        initial &&
        initial.trainingPriority === current.trainingPriority &&
        initial.trainingMode === current.trainingMode
      ) {
        return [];
      }

      return [
        {
          academyRiderId,
          trainingPriority: current.trainingPriority,
          trainingMode: current.trainingMode,
        },
      ];
    },
  );
}
