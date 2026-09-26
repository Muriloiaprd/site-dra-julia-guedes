import { sportColor, sportLabel } from "@/lib/utils";

export function SportBadge({ sport }: { sport: string }) {
  const color = sportColor(sport);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {sportLabel(sport)}
    </span>
  );
}
