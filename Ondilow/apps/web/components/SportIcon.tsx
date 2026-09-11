import { sportColor } from "@/lib/utils";

const SPORT_EMOJI: Record<string, string> = {
  run: "🏃", trail_run: "🏔️", treadmill: "🏃", bike: "🚴", mtb: "🚵",
  gravel: "🚴", indoor_bike: "🚴", swim: "🏊", open_water_swim: "🏊",
  strength: "🏋️", pilates: "🧘", rest: "💤", other: "⚡",
};

const SPORT_ICON_SRC: Record<string, string> = {
  run: "/icons/run.png", trail_run: "/icons/run.png", treadmill: "/icons/run.png",
  bike: "/icons/bike.png", mtb: "/icons/bike.png", gravel: "/icons/bike.png", indoor_bike: "/icons/bike.png",
  swim: "/icons/swim.png", open_water_swim: "/icons/swim.png",
};

export function SportIcon({ sport, size = "70%" }: { sport: string; size?: string }) {
  const src = SPORT_ICON_SRC[sport];
  if (src) return <img src={src} alt="" style={{ width: size, height: size, objectFit: "contain" }} />;
  return <span aria-hidden>{SPORT_EMOJI[sport] ?? "⚡"}</span>;
}

/** Icone do esporte dentro de um "tile" com a cor da modalidade. */
export function SportTile({ sport, size = 36, radius = 10 }: { sport: string; size?: number; radius?: number }) {
  const color = sportColor(sport);
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size, height: size, borderRadius: radius, fontSize: size * 0.45,
        background: `radial-gradient(circle at 50% 30%, ${color}30, ${color}0d 70%)`,
        boxShadow: `inset 0 0 0 1px ${color}33`,
      }}
    >
      <SportIcon sport={sport} size="66%" />
    </div>
  );
}
