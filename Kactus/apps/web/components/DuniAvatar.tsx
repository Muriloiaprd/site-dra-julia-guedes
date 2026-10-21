/**
 * A cara da Duni: o cacto rainha. Animado (balança, pisca, acena) quando ela está ativa;
 * parado quando não. Quem pede menos movimento no aparelho vê sempre parado (regra do próprio SVG).
 */
export function DuniAvatar({ size = 48, active = true }: { size?: number; active?: boolean }) {
  return (
    <img
      src={active ? "/duni/duni.svg" : "/duni/duni-parada.svg"}
      alt=""
      aria-hidden
      draggable={false}
      width={size}
      height={size}
      className="shrink-0 select-none"
      style={{ width: size, height: size }}
    />
  );
}
