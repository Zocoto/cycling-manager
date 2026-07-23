import {
  getRaceWeatherLabel,
  getRaceWindLabel,
  type RaceWeather,
} from "@/lib/game/race-weather";

export function RaceWeatherBadge({
  weather,
}: {
  weather: RaceWeather;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${
        weather.isWet
          ? "border-[#9DD7E5]/35 bg-[#7BB8C8]/15 text-[#D8F4FA]"
          : "border-white/15 bg-white/10 text-[#DCE9E3]"
      }`}
    >
      {weather.isWet ? "Pluie" : "Sec"} · {weather.temperatureC} °C ·{" "}
      {getRaceWindLabel(weather.windDirection)} {weather.windSpeedKph} km/h
    </span>
  );
}

export function RaceWeatherOverlay({
  weather,
}: {
  weather: RaceWeather;
}) {
  if (!weather.isWet) return null;

  const opacity = {
    none: "opacity-0",
    light: "opacity-35",
    steady: "opacity-55",
    heavy: "opacity-75",
  }[weather.rainIntensity];

  return (
    <div
      aria-label={`${getRaceWeatherLabel(weather)}, ${getRaceWindLabel(weather.windDirection)} à ${weather.windSpeedKph} kilomètres par heure`}
      className="pointer-events-none absolute inset-0 z-[12] overflow-hidden"
    >
      <div
        aria-hidden="true"
        className={`cm-race-rain absolute -inset-[20%] ${opacity}`}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[44%] bg-[linear-gradient(180deg,transparent,rgba(165,211,220,0.1)_38%,rgba(216,239,242,0.16))] mix-blend-screen"
      />
    </div>
  );
}
