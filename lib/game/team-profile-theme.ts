export type TeamProfileSourceColors = {
  primary: string;
  secondary: string;
  accent: string;
  background?: string;
  text?: string;
};

export type TeamProfileTheme = {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  soft: string;
  ink: string;
  muted: string;
  line: string;
  shadow: string;
};

const DARK_BASE = "#071A17";
const WHITE = "#FFFFFF";

export function createTeamProfileTheme(
  colors: TeamProfileSourceColors,
): TeamProfileTheme {
  const sourcePrimary = normalizeHex(colors.primary, "#176951");
  const sourceSecondary = normalizeHex(colors.secondary, "#278B70");
  const sourceAccent = normalizeHex(colors.accent, "#F2C94C");
  const sourceBackground = normalizeHex(colors.background ?? "", "#F5FAF7");
  const sourceText = normalizeHex(colors.text ?? "", sourcePrimary);

  const primary = ensureDark(sourcePrimary, 0.28);
  const secondary = ensureDark(sourceSecondary, 0.22);
  const ink = ensureDark(sourceText, 0.62);

  return {
    primary,
    secondary,
    accent: ensureVisibleOnDark(sourceAccent),
    surface: mixHex(sourceBackground, WHITE, 0.24),
    soft: mixHex(sourcePrimary, WHITE, 0.9),
    ink,
    muted: mixHex(ink, WHITE, 0.42),
    line: toRgba(primary, 0.16),
    shadow: toRgba(primary, 0.13),
  };
}

function ensureDark(color: string, minimumDarkMix: number) {
  const darkMix = relativeLuminance(color) > 0.48
    ? Math.max(minimumDarkMix, 0.58)
    : minimumDarkMix;
  return mixHex(color, DARK_BASE, darkMix);
}

function ensureVisibleOnDark(color: string) {
  return relativeLuminance(color) < 0.3
    ? mixHex(color, WHITE, 0.55)
    : color;
}

function normalizeHex(value: string, fallback: string) {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function mixHex(left: string, right: string, rightWeight: number) {
  const leftRgb = toRgb(left);
  const rightRgb = toRgb(right);
  const weight = Math.min(1, Math.max(0, rightWeight));
  const channel = (leftValue: number, rightValue: number) =>
    Math.round(leftValue * (1 - weight) + rightValue * weight)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();

  return `#${channel(leftRgb.r, rightRgb.r)}${channel(leftRgb.g, rightRgb.g)}${channel(leftRgb.b, rightRgb.b)}`;
}

function toRgba(color: string, alpha: number) {
  const rgb = toRgb(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function toRgb(color: string) {
  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
}

function relativeLuminance(color: string) {
  const rgb = toRgb(color);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    channel(rgb.r) * 0.2126 +
    channel(rgb.g) * 0.7152 +
    channel(rgb.b) * 0.0722
  );
}
