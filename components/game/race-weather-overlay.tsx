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
  const palette = {
    clear: "border-[#FFE79A]/30 bg-[#FFE79A]/10 text-[#FFF4C7]",
    cloudy: "border-white/20 bg-white/10 text-[#E6EFEC]",
    rain: "border-[#9DD7E5]/35 bg-[#7BB8C8]/15 text-[#D8F4FA]",
    storm: "border-[#B6B4E5]/40 bg-[#4E4A78]/25 text-[#ECEBFF]",
    snow: "border-white/40 bg-white/15 text-white",
  }[weather.condition];

  return (
    <span
      className={`rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${palette}`}
    >
      {getRaceWeatherLabel(weather)} · {weather.temperatureC} °C ·{" "}
      {getRaceWindLabel(weather.windDirection)} {weather.windSpeedKph} km/h
    </span>
  );
}

export function RaceWeatherOverlay({
  weather,
}: {
  weather: RaceWeather;
}) {
  if (weather.condition === "clear") return null;

  if (weather.condition === "cloudy") {
    return (
      <div
        aria-label={`${getRaceWeatherLabel(weather)}, ${getRaceWindLabel(weather.windDirection)} à ${weather.windSpeedKph} kilomètres par heure`}
        className="pointer-events-none absolute inset-0 z-[12] overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="cm-race-clouds absolute inset-x-[-12%] top-0 h-[52%] opacity-55"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[#D8E1DF]/[0.06]"
        />
      </div>
    );
  }

  if (weather.condition === "snow") {
    return (
      <div
        aria-label={`${getRaceWeatherLabel(weather)}, ${getRaceWindLabel(weather.windDirection)} à ${weather.windSpeedKph} kilomètres par heure`}
        className="pointer-events-none absolute inset-0 z-[12] overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[#E7F1F3]/10"
        />
        <div
          aria-hidden="true"
          className="cm-race-snow absolute -inset-[20%] opacity-80"
        />
      </div>
    );
  }

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
      {weather.condition === "storm" ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[#17243A]/25"
          />
          <div
            aria-hidden="true"
            className="cm-race-lightning absolute inset-0 bg-white opacity-0"
          />
        </>
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[44%] bg-[linear-gradient(180deg,transparent,rgba(165,211,220,0.1)_38%,rgba(216,239,242,0.16))] mix-blend-screen"
      />
    </div>
  );
}
