// 7 hues × 2 shades for districts 1–14, drawn from Tailwind's color
// palette. Districts 1–7 use the -700 dark shade; districts 8–14 use the
// -300 light shade of the same hue. This keeps 14 sub-districts visually
// distinct while the 7 final districts (always coloured from PALETTE_14_DARK)
// stay bold and saturated. No gray — per user preference.
const PALETTE_14_DARK = [
  "#b91c1c", // red-700
  "#c2410c", // orange-700
  "#b45309", // amber-700
  "#15803d", // green-700
  "#0f766e", // teal-700
  "#1d4ed8", // blue-700
  "#7e22ce", // purple-700
];
const PALETTE_14_LIGHT = [
  "#fca5a5", // red-300
  "#fdba74", // orange-300
  "#fcd34d", // amber-300
  "#86efac", // green-300
  "#5eead4", // teal-300
  "#93c5fd", // blue-300
  "#d8b4fe", // purple-300
];
// Fallback for districts 15–20 (only hit on grid_140 with 10 final = 20 sub).
// Tailwind pink/indigo/lime, dark then light.
const PALETTE_EXTRA = [
  "#be185d", // pink-700
  "#4338ca", // indigo-700
  "#4d7c0f", // lime-700
  "#f9a8d4", // pink-300
  "#a5b4fc", // indigo-300
  "#bef264", // lime-300
];

export function districtColor(district: number): string {
  if (district <= 0) return "#f3f4f6";
  if (district <= 7) return PALETTE_14_DARK[district - 1];
  if (district <= 14) return PALETTE_14_LIGHT[district - 8];
  return PALETTE_EXTRA[(district - 15) % PALETTE_EXTRA.length];
}

export const VOTER_COLORS: Record<"A" | "B", string> = {
  A: "#1f2937",
  B: "#ffffff",
};
