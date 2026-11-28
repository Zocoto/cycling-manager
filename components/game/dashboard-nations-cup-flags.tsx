import {
  getDashboardNationsCupLeaders,
  type DashboardNationsCupLeader,
} from "@/services/dashboard-nations-cup";

export async function DashboardNationsCupFlags({ seasonId }: { seasonId: string }) {
  let countries: DashboardNationsCupLeader[] = [];
  try {
    countries = await getDashboardNationsCupLeaders(seasonId);
  } catch {
    // A cosmetic enhancement must never prevent opening the DS office.
  }

  return countries.map((country) => (
    <span
      key={country.countryCode}
      role="img"
      aria-label={country.countryName}
      title={country.countryName}
      className={`fi fi-${country.countryCode} shrink-0 text-sm shadow-sm sm:text-base`}
    />
  ));
}
