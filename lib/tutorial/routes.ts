const DYNAMIC_SEGMENT_PATTERN = /^\[[a-zA-Z][a-zA-Z0-9_]*\]$/;

type ParsedTutorialRoute = {
  segments: string[];
  searchEntries: Array<[string, string]>;
};

export function matchesTutorialRoute(
  routePattern: string,
  resolvedRoute: string,
): boolean {
  const pattern = parseTutorialRoute(routePattern);
  const resolved = parseTutorialRoute(resolvedRoute);

  if (
    !pattern ||
    !resolved ||
    pattern.segments.length !== resolved.segments.length ||
    pattern.searchEntries.length !== resolved.searchEntries.length
  ) {
    return false;
  }

  const pathMatches = pattern.segments.every((segment, index) => {
    const resolvedSegment = resolved.segments[index];

    if (!resolvedSegment) {
      return false;
    }

    return (
      DYNAMIC_SEGMENT_PATTERN.test(segment) ||
      segment === resolvedSegment
    );
  });

  return (
    pathMatches &&
    pattern.searchEntries.every(([key, value], index) => {
      const resolvedEntry = resolved.searchEntries[index];
      return resolvedEntry?.[0] === key && resolvedEntry[1] === value;
    })
  );
}

export function hasDynamicTutorialRouteSegment(route: string): boolean {
  const parsed = parseTutorialRoute(route);

  return Boolean(
    parsed?.segments.some((segment) => DYNAMIC_SEGMENT_PATTERN.test(segment)),
  );
}

export function materializeTutorialRoute({
  routePattern,
  segmentValues,
}: {
  routePattern: string;
  segmentValues: Readonly<Record<string, string | null | undefined>>;
}): string | null {
  const parsed = parseTutorialRoute(routePattern);

  if (!parsed) {
    return null;
  }

  const materializedSegments: string[] = [];

  for (const segment of parsed.segments) {
    if (!DYNAMIC_SEGMENT_PATTERN.test(segment)) {
      materializedSegments.push(segment);
      continue;
    }

    const key = segment.slice(1, -1);
    const value = segmentValues[key]?.trim();

    if (!value) {
      return null;
    }

    materializedSegments.push(encodeURIComponent(value));
  }

  const pathname = `/${materializedSegments.join("/")}`;
  const search = new URLSearchParams(parsed.searchEntries).toString();

  return search ? `${pathname}?${search}` : pathname;
}

export function resolveTutorialProgressRoute({
  routePattern,
  savedRoute,
  preserveSavedRoute,
}: {
  routePattern: string;
  savedRoute: string | null;
  preserveSavedRoute: boolean;
}): string {
  return preserveSavedRoute &&
    savedRoute &&
    !hasDynamicTutorialRouteSegment(savedRoute) &&
    matchesTutorialRoute(routePattern, savedRoute)
    ? savedRoute
    : routePattern;
}

function parseTutorialRoute(route: string): ParsedTutorialRoute | null {
  if (!route.startsWith("/") || route.includes("#")) {
    return null;
  }

  const questionMarkIndex = route.indexOf("?");
  const pathname =
    questionMarkIndex >= 0 ? route.slice(0, questionMarkIndex) : route;
  const search =
    questionMarkIndex >= 0 ? route.slice(questionMarkIndex + 1) : "";
  const normalized = pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  const segments = normalized.split("/").filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  const searchEntries = [...new URLSearchParams(search).entries()].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
  );

  return { segments, searchEntries };
}
