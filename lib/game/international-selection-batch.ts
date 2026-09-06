import { z } from "zod";

const submittedDecisionSchema = z.object({
  candidateId: z.string().uuid(),
  decision: z.enum(["confirm", "decline", "skip"]),
  acknowledgedConflicts: z.array(z.string().trim().min(1).max(300)).max(40),
});

const submittedDecisionBatchSchema = z
  .array(submittedDecisionSchema)
  .min(1)
  .max(100)
  .superRefine((decisions, context) => {
    const candidateIds = new Set<string>();

    for (const decision of decisions) {
      if (candidateIds.has(decision.candidateId)) {
        context.addIssue({
          code: "custom",
          message: "Une convocation ne peut apparaître qu’une fois.",
        });
      }
      candidateIds.add(decision.candidateId);
    }
  });

export type AnsweredInternationalSelectionDecision = {
  candidateId: string;
  decision: "confirm" | "decline";
  acknowledgedConflicts: string[];
};

export function parseAnsweredInternationalSelectionDecisions(input: unknown) {
  const parsed = submittedDecisionBatchSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false as const, reason: "invalid" as const };
  }

  const decisions = parsed.data.flatMap(
    (decision): AnsweredInternationalSelectionDecision[] =>
      decision.decision === "skip"
        ? []
        : [
            {
              candidateId: decision.candidateId,
              decision: decision.decision,
              acknowledgedConflicts: decision.acknowledgedConflicts,
            },
          ],
  );

  if (decisions.length === 0) {
    return { success: false as const, reason: "empty" as const };
  }

  return { success: true as const, decisions };
}
