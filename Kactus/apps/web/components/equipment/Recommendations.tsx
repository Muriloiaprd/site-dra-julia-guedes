"use client";

import { useState } from "react";

import { Alert, Panel, Segmented } from "@/components/ui/primitives";
import type { EquipmentRecommendations, RecommendedItem } from "@/lib/api";

const TIER_LABEL: Record<RecommendedItem["tier"], string> = {
  entrada: "Entrada",
  intermediario: "Intermediário",
  topo: "Topo de linha",
};

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 15).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

/** Alertas de troca de tenis (vao no topo da pagina). */
export function ShoeAlerts({ data }: { data: EquipmentRecommendations }) {
  if (data.alertas.length === 0) return null;
  return (
    <div className="mb-4 space-y-2">
      {data.alertas.map((a) => (
        <Alert key={a.equipamento} tone={a.nivel === "trocar" ? "danger" : "accent"} title={a.nivel === "trocar" ? "Hora de trocar o tênis" : "De olho no tênis"}>
          {a.texto}
        </Alert>
      ))}
    </div>
  );
}

/** Equipamentos recomendados para os esportes que o atleta pratica. */
export function Recommendations({ data, onAdd }: { data: EquipmentRecommendations; onAdd: (item: RecommendedItem) => void }) {
  const [sport, setSport] = useState<string | null>(null);

  const practiced = data.esportes.filter((s) => s.praticado);
  const shown = practiced.length ? practiced : data.esportes;
  const current = shown.find((s) => s.sport === sport) ?? shown[0];

  return (
    <section className="mt-8">
      <Panel>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="od-label od-label-accent">Recomendados para você</h2>
          {shown.length > 1 && (
            <Segmented options={shown.map((s) => ({ value: s.sport, label: s.label }))} value={current.sport} onChange={setSport} ariaLabel="Esporte" />
          )}
        </div>
        <p className="mb-4 text-[0.72rem] text-brand-muted">
          {practiced.length
            ? "Pelos esportes que você fez nos últimos 90 dias. "
            : "Importe treinos para as sugestões seguirem o que você pratica. "}
          Lista de {monthLabel(data.atualizado_em)}; preços aproximados, confira na loja.
        </p>

        <div className="space-y-5">
          {current.categorias.map((c) => (
            <div key={c.id}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h3 className="text-sm font-semibold">{c.label}</h3>
                {c.destaque && <span className="text-[0.72rem] text-brand-accent">{c.destaque}</span>}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {c.itens.map((it) => (
                  <div key={it.model} className="od-tile flex flex-col p-3">
                    <div className="od-metric-label">{TIER_LABEL[it.tier]}</div>
                    <div className="mt-1 text-sm font-semibold">{it.brand} {it.model}</div>
                    <div className="od-num mt-0.5 text-[0.78rem] text-brand-textSecondary">{it.price_brl}</div>
                    <p className="mt-1.5 flex-1 text-[0.74rem] leading-snug text-brand-muted">{it.why}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`${it.brand} ${it.model}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="od-btn od-btn-ghost od-btn-sm !px-2 !py-1"
                      >
                        Pesquisar ↗
                      </a>
                      <button type="button" onClick={() => onAdd(it)} className="od-btn od-btn-secondary od-btn-sm !px-2 !py-1">
                        Já tenho
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}
