/**
 * Marca Kactus. O wordmark é imagem, não texto: a fonte do "ACTUS" (TT Lakes
 * Neue) é comercial e não é embutida, e o "K" do wordmark é o próprio símbolo.
 * `compactBelowLg` mostra só o símbolo abaixo de `lg` (sidebar recolhida).
 */
export function Logo({ size = 32, compactBelowLg = false }: { size?: number; compactBelowLg?: boolean }) {
  return (
    <div className="flex items-center">
      {compactBelowLg && (
        <img src="/brand/kactus-simbolo.png" alt="Kactus" height={size} style={{ height: size, width: "auto" }} className="lg:hidden" />
      )}
      <div className={`flex-col items-start leading-none ${compactBelowLg ? "hidden lg:flex" : "flex"}`}>
        <img src="/brand/kactus-wordmark.png" alt="Kactus" height={size * 0.8} style={{ height: size * 0.8, width: "auto" }} />
        <span
          className="tracking-widest uppercase"
          style={{ fontSize: Math.max(7, size * 0.2), color: "#888", letterSpacing: "0.18em", marginTop: size * 0.12 }}
        >
          corrida sem limites
        </span>
      </div>
    </div>
  );
}
