import type { DistrictId } from "../lib/types";
import { districtColor } from "../lib/palette";

interface Props {
  nDistricts: number;
  current: DistrictId;
  onPick: (d: DistrictId) => void;
  labels?: (d: DistrictId) => string;
}

export function DistrictPicker({ nDistricts, current, onPick, labels }: Props) {
  const items = Array.from({ length: nDistricts }, (_, i) => i + 1);
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((d) => (
        <button
          key={d}
          onClick={() => onPick(d)}
          className={`px-3 py-1 rounded border text-sm font-medium transition ${
            current === d
              ? "ring-2 ring-offset-1 ring-black"
              : "hover:brightness-110"
          }`}
          style={{
            background: districtColor(d),
            color: "#111",
            borderColor: "#999",
          }}
        >
          {labels ? labels(d) : d}
        </button>
      ))}
    </div>
  );
}
