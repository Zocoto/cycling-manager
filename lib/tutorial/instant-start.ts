import type {
  TutorialDefinition,
  TutorialProgressRow,
} from "@/types/tutorial";

export function selectInstantAutoStartTutorialKey({
  autoStartTutorialKeys,
  progressRows,
  definitions,
}: {
  autoStartTutorialKeys: readonly string[];
  progressRows: readonly TutorialProgressRow[];
  definitions: readonly TutorialDefinition[];
}): string | null {
  const allowedKeys = new Set(
    autoStartTutorialKeys,
  );

  const progressByTutorialKey =
    new Map(
      progressRows.map((progress) => [
        progress.tutorial_key,
        progress,
      ]),
    );

  const definition = definitions.find(
    (candidate) => {
      if (
        !candidate.autoStart ||
        !allowedKeys.has(candidate.key)
      ) {
        return false;
      }

      const progress =
        progressByTutorialKey.get(
          candidate.key,
        );

      return (
        !progress ||
        progress.status === "not_started"
      );
    },
  );

  return definition?.key ?? null;
}
