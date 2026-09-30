/**
 * Marca Kactus. O wordmark é imagem, não texto: a fonte do "ACTUS" (TT Lakes
 * Neue) é comercial e não é embutida, e o "K" do wordmark é o próprio símbolo.
 * `compactBelowLg` mostra só o símbolo abaixo de `lg` (sidebar recolhida).
 * `stacked` usa a logo empilhada (símbolo grande sobre o wordmark): é a de
 * destaque da sidebar; `size` vira a altura da imagem.
 */
export function Logo({ size = 32, compactBelowLg = false, stacked = false }: { size?: number; compactBelowLg?: boolean; stacked?: boolean }) {
  const slogan = (fontSize: number, marginTop: number) => (
    <span className="tracking-widest uppercase" style={{ fontSize, color: "#888", letterSpacing: "0.18em", marginTop }}>
      corrida sem limites
    </span>
  );
  return (
    <div className="flex items-center">
      {compactBelowLg && (
        <img
          src="/brand/kactus-simbolo.png" alt="Kactus"
          height={stacked ? 40 : size} style={{ height: stacked ? 40 : size, width: "auto" }} className="lg:hidden"
        />
      )}
      {stacked ? (
        <div className={`flex-col items-center leading-none ${compactBelowLg ? "hidden lg:flex" : "flex"}`}>
          <img
            src="/brand/kactus-empilhada.png" alt="Kactus" height={size}
            style={{ height: size, width: "auto", filter: "drop-shadow(0 0 22px rgba(0,255,102,0.22))" }}
          />
          {slogan(Math.max(8, size * 0.085), size * 0.12)}
        </div>
      ) : (
        <div className={`flex-col items-start leading-none ${compactBelowLg ? "hidden lg:flex" : "flex"}`}>
          <img src="/brand/kactus-wordmark.png" alt="Kactus" height={size * 0.8} style={{ height: size * 0.8, width: "auto" }} />
          {slogan(Math.max(7, size * 0.2), size * 0.12)}
        </div>
      )}
    </div>
  );
}
