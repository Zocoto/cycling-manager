import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(
  process.cwd(),
  ".next/server/app-paths-manifest.json",
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const routes = Object.keys(manifest);
const canonicalRoute = "/jeu/courses/[slug]/page";
const interceptedCourseRoutes = routes.filter(
  (route) =>
    route.startsWith("/jeu/calendrier/@modal/") &&
    route.includes("courses"),
);

if (!routes.includes(canonicalRoute)) {
  throw new Error(
    `Route canonique d'inscription absente du build : ${canonicalRoute}`,
  );
}

if (interceptedCourseRoutes.length > 0) {
  throw new Error(
    [
      "Une route de course interceptee a ete reintroduite sous le calendrier.",
      "Les inscriptions doivent rester des navigations documentaires vers la route canonique.",
      ...interceptedCourseRoutes,
    ].join("\n"),
  );
}

console.log(
  "Routes d'inscription validees : page canonique presente, aucune interception calendrier.",
);
