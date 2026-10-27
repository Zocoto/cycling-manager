const weekdays: Record<string, string> = {
  lundi: "Monday", mardi: "Tuesday", mercredi: "Wednesday", jeudi: "Thursday",
  vendredi: "Friday", samedi: "Saturday", dimanche: "Sunday",
};
const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const datePattern = /^(?:(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+)?(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)(?:\s+(\d{4}))?$/i;

/** Recognise a complete date, never replace a weekday inside a player/race name. */
export function translateFrenchUiDate(value: string): string | null {
  const match = datePattern.exec(value);
  if (!match) return null;
  const [, weekday, dayText, monthText, year] = match;
  const month = months.indexOf(monthText.toLowerCase());
  const day = Number(dayText);
  const maximumDay = new Date(Date.UTC(year ? Number(year) : 2000, month + 1, 0)).getUTCDate();
  if (day < 1 || day > maximumDay) return null;
  return `${weekday ? `${weekdays[weekday.toLowerCase()]} ` : ""}${day} ${englishMonths[month]}${year ? ` ${year}` : ""}`;
}
