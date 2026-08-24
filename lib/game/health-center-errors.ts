const HEALTH_CENTER_TIMEOUT_MESSAGE =
  "Le traitement a pris plus de temps que prévu et n’a pas été validé. Aucune modification partielle n’a été enregistrée ; vous pouvez relancer l’action.";

export function getHealthCenterErrorMessage(message: string): string {
  const normalized = message.trim().toLocaleLowerCase("en-US");

  if (
    normalized.includes("statement timeout") ||
    normalized.includes("canceling statement") ||
    normalized.includes("cancelling statement")
  ) {
    return HEALTH_CENTER_TIMEOUT_MESSAGE;
  }

  return message.trim().slice(0, 300);
}
