/**
 * Encaixes, pecas e o desenho (SVG) do boneco do "Meu kit".
 * Espelho de SLOTS em apps/api/kactus_api/services/equipment_kits.py: mudou la, muda aqui.
 * viewBox 0 0 240 420, boneco de frente centrado em x=120.
 */
import type { ReactNode } from "react";

export type SlotKey = "head" | "eyes" | "torso" | "chest" | "wrist" | "hydration" | "waist" | "socks" | "feet";

export const SLOT_DEFS: { key: SlotKey; label: string; pieces: { value: string; label: string }[]; types: string[] }[] = [
  { key: "head", label: "Cabeça", pieces: [{ value: "none", label: "Nada" }, { value: "cap", label: "Boné" }, { value: "visor", label: "Viseira" }], types: ["cap"] },
  { key: "eyes", label: "Óculos", pieces: [{ value: "none", label: "Sem óculos" }, { value: "sunglasses", label: "Óculos de sol" }], types: ["sunglasses"] },
  { key: "torso", label: "Tronco", pieces: [{ value: "singlet", label: "Regata" }, { value: "tshirt", label: "Camiseta" }, { value: "longsleeve", label: "Manga longa" }, { value: "jacket", label: "Corta-vento" }], types: ["top"] },
  { key: "chest", label: "Cinta cardíaca", pieces: [{ value: "none", label: "Sem cinta" }, { value: "hr_strap", label: "Cinta" }], types: ["hr_strap"] },
  { key: "wrist", label: "Pulso", pieces: [{ value: "none", label: "Nada" }, { value: "watch", label: "Relógio" }], types: ["watch"] },
  { key: "hydration", label: "Hidratação", pieces: [{ value: "none", label: "Nada" }, { value: "belt", label: "Cinto" }, { value: "vest", label: "Colete" }], types: ["hydration"] },
  { key: "waist", label: "Cintura", pieces: [{ value: "shorts", label: "Short" }, { value: "tights", label: "Legging" }], types: ["bottom"] },
  { key: "socks", label: "Meias", pieces: [{ value: "low", label: "Cano baixo" }, { value: "high", label: "Cano alto" }], types: ["socks"] },
  { key: "feet", label: "Pés", pieces: [{ value: "shoe", label: "Tênis" }], types: ["shoe"] },
];

export const PALETTE = ["#0A0A0A", "#FFFFFF", "#00FF66", "#C6FF00", "#FF6A00", "#F85149", "#2563EB", "#00CFFF", "#8B5CF6", "#F2C94C"];

// ordem de desenho (de baixo pra cima): a camiseta cobre o cós, a meia cobre a barra da legging etc.
export const DRAW_ORDER: SlotKey[] = ["waist", "socks", "feet", "torso", "chest", "hydration", "wrist", "head", "eyes"];

const BODY = "#262626";
const OUTLINE = "rgba(0,255,102,0.45)";
const EDGE = "rgba(255,255,255,0.22)"; // contorno das pecas: roupa preta ainda aparece sobre o corpo grafite

const LEGS = ["M106 214 L101 300 L99 384", "M134 214 L139 300 L141 384"];
const ARMS = ["M84 100 L66 158 L58 214", "M156 100 L174 158 L182 214"];
const SLEEVES_LONG = ["M84 100 L66 158 L59 204", "M156 100 L174 158 L181 204"];
const TORSO = "M84 92 C100 84 140 84 156 92 L160 150 Q159 185 156 214 L84 214 Q81 185 80 150 Z";

/** Corpo base: grafite com contorno verde (membros sao tracos grossos). */
export function KitBody() {
  return (
    <g>
      {[...LEGS.map((d) => ({ d, w: 24 })), ...ARMS.map((d) => ({ d, w: 17 }))].map(({ d, w }) => (
        <g key={d}>
          <path d={d} stroke={OUTLINE} strokeWidth={w + 3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={d} stroke={BODY} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      ))}
      <path d={TORSO} fill={BODY} stroke={OUTLINE} strokeWidth={1.5} />
      <rect x={111} y={68} width={18} height={22} rx={6} fill={BODY} stroke={OUTLINE} strokeWidth={1.5} />
      <circle cx={120} cy={50} r={25} fill={BODY} stroke={OUTLINE} strokeWidth={1.5} />
    </g>
  );
}

/** Desenho de uma peca; null quando o encaixe esta vazio ("none"). */
export function pieceShape(slot: SlotKey, piece: string, color: string): ReactNode {
  const fill = { fill: color, stroke: EDGE, strokeWidth: 1 };
  const line = (d: string, w: number, c = color) => <path key={d} d={d} stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />;

  switch (`${slot}:${piece}`) {
    case "torso:singlet":
      return <path d="M94 90 C104 97 136 97 146 90 L156 104 Q150 122 158 150 Q158 186 156 208 L84 208 Q82 186 82 150 Q90 122 84 104 Z" {...fill} />;
    case "torso:tshirt":
    case "torso:longsleeve":
    case "torso:jacket": {
      const long = piece !== "tshirt";
      return (
        <g>
          {long ? SLEEVES_LONG.map((d) => line(d, 19)) : (
            <>
              <path d="M84 94 L69 134 L83 140 L92 112 Z" {...fill} />
              <path d="M156 94 L171 134 L157 140 L148 112 Z" {...fill} />
            </>
          )}
          <path d="M84 92 C100 86 140 86 156 92 L160 150 Q159 185 157 208 L83 208 Q81 185 80 150 Z" {...fill} />
          {piece === "jacket" ? (
            <>
              <path d="M120 93 L120 208" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
              <path d="M106 85 L120 97 L134 85" stroke={EDGE} strokeWidth={2} fill="none" />
            </>
          ) : <path d="M110 89 Q120 97 130 89" stroke="rgba(0,0,0,0.45)" strokeWidth={2} fill="none" />}
        </g>
      );
    }
    case "waist:shorts":
      return <path d="M83 200 L157 200 L161 262 L127 262 L120 228 L113 262 L79 262 Z" {...fill} />;
    case "waist:tights":
      return <path d="M83 200 L157 200 L153 380 L129 380 L121 240 L119 240 L111 380 L87 380 Z" {...fill} />;
    case "socks:low":
      return <g>{line("M99 368 L99 386", 25)}{line("M141 368 L141 386", 25)}</g>;
    case "socks:high":
      return <g>{line("M100 326 L99 386", 25)}{line("M140 326 L141 386", 25)}</g>;
    case "feet:shoe":
      return (
        <g>
          <path d="M80 392 Q82 377 100 377 L110 379 Q115 390 112 401 L82 401 Q76 399 80 392 Z" {...fill} />
          <path d="M160 392 Q158 377 140 377 L130 379 Q125 390 128 401 L158 401 Q164 399 160 392 Z" {...fill} />
          <path d="M81 397 L112 397 M128 397 L159 397" stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
        </g>
      );
    case "chest:hr_strap":
      return (
        <g>
          <rect x={82} y={128} width={76} height={7} rx={3.5} {...fill} />
          <rect x={110} y={125} width={20} height={13} rx={5} {...fill} />
        </g>
      );
    case "wrist:watch":
      return (
        <g>
          <rect x={50} y={196} width={17} height={12} rx={3} {...fill} />
          <rect x={54} y={199} width={9} height={6} rx={1.5} fill="#0A0A0A" stroke="#00FF66" strokeWidth={0.8} />
        </g>
      );
    case "hydration:belt":
      return (
        <g>
          <rect x={82} y={198} width={76} height={13} rx={5} {...fill} />
          <rect x={90} y={192} width={10} height={19} rx={3} {...fill} />
          <rect x={140} y={192} width={10} height={19} rx={3} {...fill} />
        </g>
      );
    case "hydration:vest":
      return (
        <g>
          {line("M97 90 L103 172", 10)}
          {line("M143 90 L137 172", 10)}
          <rect x={95} y={118} width={15} height={24} rx={4} {...fill} />
          <rect x={130} y={118} width={15} height={24} rx={4} {...fill} />
        </g>
      );
    case "head:cap":
      return (
        <g>
          <path d="M95 44 Q96 20 120 20 Q144 20 145 44 Z" {...fill} />
          <ellipse cx={120} cy={45} rx={31} ry={6} {...fill} />
        </g>
      );
    case "head:visor":
      return (
        <g>
          <rect x={95} y={35} width={50} height={9} rx={4} {...fill} />
          <ellipse cx={120} cy={45} rx={31} ry={6} {...fill} />
        </g>
      );
    case "eyes:sunglasses":
      return (
        <g>
          <rect x={100} y={46} width={17} height={9} rx={4} {...fill} />
          <rect x={123} y={46} width={17} height={9} rx={4} {...fill} />
          <path d="M117 49 L123 49" stroke={color} strokeWidth={2} />
        </g>
      );
    default:
      return null;
  }
}
