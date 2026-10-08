/** Shared SVG/canvas palette. Presentation only: no change to pickup bounds or scoring. */
export const DEMONIC_WHEEL_COLORS = {
  tire: "#131116",
  center: "#26151D",
  rim: "#D83935",
  spoke: "#F06455",
} as const;

export const DEMONIC_WHEEL_SPOKES = [
  [0, -1], [.707, -.707], [1, 0], [.707, .707],
  [0, 1], [-.707, .707], [-1, 0], [-.707, -.707],
] as const;
