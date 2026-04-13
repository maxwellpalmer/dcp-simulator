// Color-blind-safe palettes, up to 20 districts.
// Tol's bright/vibrant + Okabe-Ito picked for contrast at small patch sizes.
const PALETTE_20 = [
  "#4477AA", "#EE6677", "#228833", "#CCBB44", "#66CCEE",
  "#AA3377", "#BBBBBB", "#117733", "#882255", "#DDCC77",
  "#999933", "#332288", "#88CCEE", "#CC6677", "#44AA99",
  "#AA4499", "#DDDDDD", "#661100", "#6699CC", "#888888",
];

export function districtColor(district: number): string {
  if (district <= 0) return "#f3f4f6";
  return PALETTE_20[(district - 1) % PALETTE_20.length];
}

export const VOTER_COLORS: Record<"A" | "B", string> = {
  A: "#1f2937",
  B: "#ffffff",
};
