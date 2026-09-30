"use client";

import { useEffect, useRef, useState } from "react";

import { KitBody, DRAW_ORDER, PALETTE, SLOT_DEFS, pieceShape, type SlotKey } from "@/components/equipment/kitShapes";
import { Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import {
  fetchKits, saveKit,
  type EquipmentItem, type EquipmentKit, type EquipmentRecommendations, type KitPreset, type KitSlot,
} from "@/lib/api";

type SaveState = "idle" | "saving" | "saved" | "error";

const km = (m: number) => `${(m / 1000).toFixed(m >= 100000 ? 0 : 1)} km`;

/**
 * "Meu kit": boneco para montar por preset (corrida, prova, calor, chuva/frio). Cada encaixe tem
 * peca + cor e pode ser ligado a um equipamento cadastrado (mostra foto e km; tenis na hora de
 * trocar pisca no boneco). Salva sozinho, com debounce.
 */
export function KitBuilder({ items, alerts }: { items: EquipmentItem[]; alerts: EquipmentRecommendations["alertas"] }) {
  const [kits, setKits] = useState<EquipmentKit[] | null>(null);
  const [preset, setPreset] = useState<KitPreset>("corrida");
  const [open, setOpen] = useState<SlotKey | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // edicao ainda nao enviada: sai na hora se o atleta troca de preset ou sai da pagina
  const pending = useRef<{ preset: KitPreset; slots: Record<string, KitSlot> } | null>(null);

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p) saveKit(p.preset, p.slots).then(() => setSave("saved")).catch(() => setSave("error"));
  }

  useEffect(() => {
    fetchKits().then(setKits).catch(() => setKits([]));
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (kits === null) return <Skeleton className="mb-6 h-[420px]" />;
  const kit = kits.find((k) => k.preset === preset);
  if (!kit) return null; // API fora do ar: a pagina segue sem o boneco

  const byId = new Map(items.map((i) => [i.id, i]));
  const alertFor = (id: string | null) => (id ? alerts.find((a) => a.equipamento_id === id) : undefined);

  function update(slot: SlotKey, patch: Partial<KitSlot>) {
    const slots = { ...kit!.slots, [slot]: { ...kit!.slots[slot], ...patch } };
    setKits((prev) => prev!.map((k) => (k.preset === preset ? { ...k, slots, saved: true } : k)));
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    pending.current = { preset, slots };
    timer.current = setTimeout(flush, 700);
  }

  const toggle = (slot: SlotKey) => setOpen((o) => (o === slot ? null : slot));

  return (
    <Panel className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="od-label od-label-accent">Meu kit</h2>
          <p className="mt-1 text-[0.72rem] text-brand-muted">Monte o que você veste em cada tipo de treino. Toque numa peça para mudar.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[0.7rem] text-brand-muted" role="status">
            {save === "saving" ? "Salvando…" : save === "saved" ? "Salvo ✓" : save === "error" ? "Não salvou, tente de novo" : ""}
          </span>
          <Segmented
            options={kits.map((k) => ({ value: k.preset, label: k.label }))}
            value={preset}
            onChange={(p) => { flush(); setPreset(p); setOpen(null); }}
            ariaLabel="Tipo de treino"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,240px)_1fr]">
        {/* boneco */}
        <div className="flex justify-center">
          <svg viewBox="0 0 240 420" className="h-[360px] w-auto md:h-[400px]" role="img" aria-label={`Boneco com o kit ${kit.label}`}>
            <defs>
              <radialGradient id="kit-glow" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor="rgba(0,255,102,0.12)" />
                <stop offset="100%" stopColor="rgba(0,255,102,0)" />
              </radialGradient>
            </defs>
            <ellipse cx={120} cy={210} rx={115} ry={205} fill="url(#kit-glow)" />
            <ellipse cx={120} cy={406} rx={60} ry={6} fill="rgba(0,0,0,0.5)" />
            <KitBody />
            {DRAW_ORDER.map((slot) => {
              const s = kit.slots[slot];
              const shape = s && pieceShape(slot, s.piece, s.color);
              if (!shape) return null;
              const alert = alertFor(s.equipment_id);
              return (
                // clique no desenho e atalho de mouse; o caminho acessivel e a lista de encaixes ao lado
                <g
                  key={slot}
                  onClick={() => toggle(slot)}
                  className={`cursor-pointer ${alert?.nivel === "trocar" ? "animate-od-pulse" : ""}`}
                  style={{
                    filter: open === slot ? "drop-shadow(0 0 6px rgba(0,255,102,0.9))"
                      : alert ? `drop-shadow(0 0 5px ${alert.nivel === "trocar" ? "#F85149" : "#FFC145"})` : undefined,
                  }}
                >
                  {shape}
                </g>
              );
            })}
          </svg>
        </div>

        {/* encaixes */}
        <ul className="divide-y divide-white/5 self-start rounded-xl" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
          {SLOT_DEFS.map((def) => {
            const s = kit.slots[def.key];
            const linked = s.equipment_id ? byId.get(s.equipment_id) : undefined;
            const alert = alertFor(s.equipment_id);
            const pieceLabel = def.pieces.find((p) => p.value === s.piece)?.label ?? s.piece;
            const options = items.filter((i) => def.types.includes(i.type) && !i.retired_at);
            const isOpen = open === def.key;
            return (
              <li key={def.key}>
                <button
                  type="button"
                  onClick={() => toggle(def.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="h-5 w-5 shrink-0 rounded-md" style={{ background: s.piece === "none" ? "transparent" : s.color, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)" }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.7rem] uppercase tracking-wider text-brand-muted">{def.label}</span>
                    <span className="block truncate text-sm font-semibold">
                      {pieceLabel}
                      {linked && <span className="font-normal text-brand-textSecondary"> · {linked.name}</span>}
                    </span>
                  </span>
                  {linked && (
                    <span className="flex shrink-0 items-center gap-2">
                      {alert && <span className="text-[0.66rem] font-semibold" style={{ color: alert.nivel === "trocar" ? "#F85149" : "#FFC145" }}>{alert.nivel === "trocar" ? "trocar" : "atenção"}</span>}
                      {(linked.type === "shoe" || linked.total_distance_m > 0) && <span className="od-num text-[0.72rem] text-brand-muted">{km(linked.total_distance_m)}</span>}
                      {linked.photo_data_url && <img src={linked.photo_data_url} alt="" className="h-8 w-8 rounded-md object-cover" />}
                    </span>
                  )}
                  <span className={`text-brand-muted transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden>▾</span>
                </button>

                {isOpen && (
                  <div className="space-y-3 px-3 pb-4 pt-1">
                    {def.pieces.length > 1 && (
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Peça: ${def.label}`}>
                        {def.pieces.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => update(def.key, { piece: p.value, ...(p.value === "none" ? { equipment_id: null } : {}) })}
                            aria-pressed={s.piece === p.value}
                            className={`od-btn od-btn-sm !px-2.5 !py-1 ${s.piece === p.value ? "od-btn-secondary !text-brand-accent" : "od-btn-ghost"}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {s.piece !== "none" && (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Cor: ${def.label}`}>
                          {PALETTE.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => update(def.key, { color: c })}
                              aria-label={`Cor ${c}`}
                              aria-pressed={s.color.toUpperCase() === c}
                              className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                              style={{ background: c, boxShadow: s.color.toUpperCase() === c ? "0 0 0 2px #0A0A0A, 0 0 0 4px #00FF66" : "inset 0 0 0 1px rgba(255,255,255,0.25)" }}
                            />
                          ))}
                          <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full" title="Outra cor" style={{ background: "conic-gradient(#F85149, #F2C94C, #00FF66, #00CFFF, #8B5CF6, #F85149)" }}>
                            <span className="sr-only">Outra cor</span>
                            <input type="color" value={s.color} onChange={(e) => update(def.key, { color: e.target.value.toUpperCase() })} className="absolute inset-0 cursor-pointer opacity-0" />
                          </label>
                        </div>

                        <label className="block">
                          <span className="od-field-label">Qual é a sua?</span>
                          <select
                            value={s.equipment_id ?? ""}
                            onChange={(e) => update(def.key, { equipment_id: e.target.value || null })}
                            className="od-input !py-2"
                          >
                            <option value="">Nenhuma cadastrada</option>
                            {options.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </select>
                          {options.length === 0 && (
                            <span className="mt-1 block text-[0.7rem] text-brand-muted">Cadastre a peça em &quot;+ Adicionar&quot; (com foto) para ligar aqui.</span>
                          )}
                        </label>

                        {linked && (
                          <div className="flex items-center gap-3 rounded-xl p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                            {linked.photo_data_url
                              ? <img src={linked.photo_data_url} alt={linked.name} className="h-20 w-20 rounded-lg object-cover" />
                              : <div className="od-icon-tile !h-20 !w-20 text-[0.66rem] text-brand-muted">sem foto</div>}
                            <div className="min-w-0 text-sm">
                              <div className="truncate font-semibold">{linked.name}</div>
                              <div className="text-[0.72rem] text-brand-muted">{[linked.brand, linked.model].filter(Boolean).join(" ") || "—"}</div>
                              <div className="od-num mt-1 text-[0.8rem]">{km(linked.total_distance_m)}</div>
                              {alert && <div className="mt-1 text-[0.72rem]" style={{ color: alert.nivel === "trocar" ? "#F85149" : "#FFC145" }}>{alert.texto}</div>}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
