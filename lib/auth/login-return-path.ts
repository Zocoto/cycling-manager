const loginReturnPaths = new Set([
  "/apercus/noel/index.html",
  "/apercus/noel/index.html#tournee",
  "/apercus/gala-saison-5",
]);

export function getLoginReturnPath(value: unknown): string {
  return typeof value === "string" && loginReturnPaths.has(value)
    ? value
    : "/jeu";
}
