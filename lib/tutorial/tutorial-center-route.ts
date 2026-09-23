export const TUTORIAL_CENTER_QUERY_PARAMETER = "centre-didacticiels";

export const TUTORIAL_CENTER_ROUTE =
  `/jeu?${TUTORIAL_CENTER_QUERY_PARAMETER}=1` as const;

export function shouldOpenTutorialCenter(
  searchParams: Pick<URLSearchParams, "get">,
) {
  return searchParams.get(TUTORIAL_CENTER_QUERY_PARAMETER) === "1";
}
