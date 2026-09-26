import type { ReactNode } from "react";

/**
 * Renderizador markdown minimo e seguro (sem HTML injetado) para respostas do
 * Treinador IA: titulos, listas, negrito, italico, codigo inline e paragrafos.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={`${keyBase}-${i}`} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
    if (p.length > 2 && p.startsWith("*") && p.endsWith("*")) return <em key={`${keyBase}-${i}`} className="italic text-white/80">{p.slice(1, -1)}</em>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={`${keyBase}-${i}`} className="rounded bg-white/5 px-1 py-0.5 font-mono text-[0.85em] text-brand-lime">{p.slice(1, -1)}</code>;
    return <span key={`${keyBase}-${i}`}>{p}</span>;
  });
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  // `num` guarda o numero que veio no texto: a IA costuma separar os itens de uma
  // lista numerada com paragrafos ou sublistas, e contar pelo indice zeraria em "1."
  let list: { ordered: boolean; items: { num: string; text: string }[] } | null = null;

  const flush = () => {
    if (!list) return;
    const k = `l${blocks.length}`;
    const items = list.items.map((it, i) => (
      <li key={i} className="flex gap-2.5">
        <span className={list!.ordered ? "od-num min-w-[1.1rem] text-[0.8em] text-brand-accent" : "mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent"}>
          {list!.ordered ? `${it.num}.` : ""}
        </span>
        <span className="min-w-0">{inline(it.text, `${k}-${i}`)}</span>
      </li>
    ));
    blocks.push(<ul key={k} className="my-2 space-y-1.5">{items}</ul>);
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      blocks.push(
        level <= 2
          ? <h3 key={idx} className="mb-2 mt-5 font-display text-[1.05rem] font-bold text-white first:mt-0">{inline(h[2], `h${idx}`)}</h3>
          : <h4 key={idx} className="mb-1.5 mt-4 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-brand-accent first:mt-0">{inline(h[2], `h${idx}`)}</h4>,
      );
    } else if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push(ol ? { num: ol[1], text: ol[2] } : { num: "", text: ul![1] });
    } else if (line.trim() === "") {
      flush();
    } else if (/^-{3,}$/.test(line.trim())) {
      flush();
      blocks.push(<hr key={idx} className="my-4 border-white/5" />);
    } else {
      flush();
      blocks.push(<p key={idx} className="my-2 first:mt-0">{inline(line, `p${idx}`)}</p>);
    }
  });
  flush();

  return <div className={`text-sm leading-relaxed text-brand-textSecondary ${className}`}>{blocks}</div>;
}
