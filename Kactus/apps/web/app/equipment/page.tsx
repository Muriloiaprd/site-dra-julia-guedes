"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Recommendations, ShoeAlerts } from "@/components/equipment/Recommendations";
import { Alert, EmptyState, PageContainer, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { resizePhotoToJpegDataUrl } from "@/lib/image";
import {
  createEquipment,
  deleteEquipment,
  fetchEquipment,
  fetchEquipmentRecommendations,
  fetchMe,
  updateEquipment,
  type EquipmentCreate,
  type EquipmentItem,
  type EquipmentRecommendations,
  type RecommendedItem,
} from "@/lib/api";

// `type` e texto livre no banco: tipo novo nao pede migracao.
const EQUIPMENT_TYPES = [
  { value: "shoe", label: "Tênis", icon: "👟" },
  { value: "top", label: "Camiseta / regata", icon: "👕" },
  { value: "bottom", label: "Short / legging", icon: "🩳" },
  { value: "socks", label: "Meia", icon: "🧦" },
  { value: "cap", label: "Boné / viseira", icon: "🧢" },
  { value: "sunglasses", label: "Óculos", icon: "🕶️" },
  { value: "watch", label: "Relógio", icon: "⌚" },
  { value: "hr_strap", label: "Cinta cardíaca", icon: "💓" },
  { value: "hydration", label: "Hidratação", icon: "💧" },
  { value: "bike", label: "Bicicleta", icon: "🚴" },
  { value: "swimsuit", label: "Roupa de nado", icon: "🩱" },
  { value: "wetsuit", label: "Wetsuit", icon: "🤿" },
  { value: "other", label: "Outro", icon: "🎽" },
];

const TYPE_ICON: Record<string, string> = Object.fromEntries(EQUIPMENT_TYPES.map((t) => [t.value, t.icon]));
const TYPE_LABEL: Record<string, string> = Object.fromEntries(EQUIPMENT_TYPES.map((t) => [t.value, t.label]));

const INITIAL_FORM: EquipmentCreate = {
  name: "",
  type: "shoe",
  brand: "",
  model: "",
  purchase_date: null,
  initial_distance_m: 0,
  notes: "",
  photo_data_url: null,
};

export default function EquipmentPage() {
  const router = useRouter();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EquipmentCreate>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [recs, setRecs] = useState<EquipmentRecommendations | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    fetchEquipmentRecommendations().then(setRecs).catch(() => {});
  }, [items.length]);

  useEffect(() => {
    fetchMe().then((u) => {
      if (!u) { router.push("/login"); return; }
    });
    fetchEquipment()
      .then(setItems)
      .catch(() => setError("Erro ao carregar equipamentos"))
      .finally(() => setLoading(false));
  }, [router]);

  function openNew() {
    setEditId(null);
    setForm(INITIAL_FORM);
    setShowForm(true);
  }

  /** "Ja tenho": abre o formulario com o item recomendado preenchido. */
  function openFromRecommendation(it: RecommendedItem) {
    setEditId(null);
    setForm({ ...INITIAL_FORM, name: `${it.brand} ${it.model}`, type: it.equipment_type, brand: it.brand, model: it.model });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEdit(item: EquipmentItem) {
    setEditId(item.id);
    setForm({
      name: item.name,
      type: item.type,
      brand: item.brand ?? "",
      model: item.model ?? "",
      purchase_date: item.purchase_date,
      initial_distance_m: item.initial_distance_m / 1000,
      notes: item.notes ?? "",
      photo_data_url: item.photo_data_url,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        brand: form.brand || null,
        model: form.model || null,
        notes: form.notes || null,
        initial_distance_m: Number(form.initial_distance_m) * 1000,
        // na edicao, "" apaga a foto que existia
        photo_data_url: form.photo_data_url || (editId ? "" : null),
      };
      if (editId) {
        const updated = await updateEquipment(editId, payload);
        setItems((prev) => prev.map((i) => (i.id === editId ? updated : i)));
      } else {
        const created = await createEquipment(payload);
        setItems((prev) => [created, ...prev]);
      }
      setShowForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await resizePhotoToJpegDataUrl(file, 480);
      setForm((f) => ({ ...f, photo_data_url: dataUrl }));
    } catch {
      setError("Não foi possível ler essa imagem");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRetire(item: EquipmentItem) {
    const today = new Date().toISOString().split("T")[0];
    try {
      const updated = await updateEquipment(item.id, { retired_at: today });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch {
      setError("Erro ao aposentar equipamento");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir equipamento? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    try {
      await deleteEquipment(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError("Erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  }

  const active = items.filter((i) => !i.retired_at);
  const retired = items.filter((i) => i.retired_at);
  const activeKm = active.reduce((s, i) => s + i.total_distance_m, 0) / 1000;

  return (
    <PageContainer width="medium">
      <PageHeader
        kicker="Gestão"
        title="Equipamentos"
        description="Tênis, bikes e acessórios — acompanhe a quilometragem de cada item."
        icon={<span className="text-xl" aria-hidden>👟</span>}
        actions={<button onClick={openNew} className="od-btn od-btn-primary">+ Adicionar</button>}
      />

      {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { k: "Em uso", v: active.length, u: "" },
          { k: "Distância acumulada", v: activeKm.toFixed(0), u: "km" },
          { k: "Aposentados", v: retired.length, u: "" },
        ].map((t) => (
          <Panel key={t.k} className="!p-4">
            <div className="od-metric-label truncate">{t.k}</div>
            {loading ? <Skeleton className="mt-2 h-7 w-14" /> : (
              <div className="od-num mt-1.5 text-[1.6rem] leading-none">{t.v}{t.u && <span className="ml-1 font-sans text-xs text-brand-muted">{t.u}</span>}</div>
            )}
          </Panel>
        ))}
      </div>

      {recs && <ShoeAlerts data={recs} />}

      {/* formulario */}
      {showForm && (
        <Panel variant="accent" className="mb-6 animate-od-fade-up">
          <h2 className="od-label od-label-accent mb-5">{editId ? "Editar equipamento" : "Novo equipamento"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="od-field-label">Nome *</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Nike Vaporfly 3"
                className="od-input"
              />
            </label>
            <label>
              <span className="od-field-label">Tipo *</span>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="od-input"
              >
                {EQUIPMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="od-field-label">Marca</span>
              <input
                type="text"
                value={form.brand ?? ""}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Nike"
                className="od-input"
              />
            </label>
            <label>
              <span className="od-field-label">Modelo</span>
              <input
                type="text"
                value={form.model ?? ""}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="Vaporfly 3"
                className="od-input"
              />
            </label>
            <label>
              <span className="od-field-label">Data de compra</span>
              <input
                type="date"
                value={form.purchase_date ?? ""}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value || null })}
                className="od-input"
              />
            </label>
            <label>
              <span className="od-field-label">Distância inicial (km)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={Number(form.initial_distance_m)}
                onChange={(e) => setForm({ ...form, initial_distance_m: parseFloat(e.target.value) || 0 })}
                className="od-input"
              />
            </label>
            <div className="sm:col-span-2">
              <span className="od-field-label">Foto da peça</span>
              <div className="flex items-center gap-3">
                <div className="od-icon-tile !h-16 !w-16 overflow-hidden text-2xl" aria-hidden>
                  {form.photo_data_url ? <img src={form.photo_data_url} alt="" className="h-full w-full object-cover" /> : (TYPE_ICON[form.type] ?? "🎽")}
                </div>
                <label className="od-btn od-btn-secondary od-btn-sm cursor-pointer">
                  {photoBusy ? "Lendo…" : form.photo_data_url ? "Trocar foto" : "Enviar foto"}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { handlePhoto(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {form.photo_data_url && (
                  <button type="button" onClick={() => setForm({ ...form, photo_data_url: null })} className="od-btn od-btn-ghost od-btn-sm">Remover</button>
                )}
              </div>
              <p className="mt-1.5 text-[0.7rem] text-brand-muted">Uma foto sua da peça. Ela aparece no card.</p>
            </div>
            <label className="sm:col-span-2">
              <span className="od-field-label">Notas</span>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="od-input resize-none"
              />
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="od-btn od-btn-primary"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="od-btn od-btn-ghost"
            >
              Cancelar
            </button>
          </div>
        </Panel>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : active.length === 0 && !showForm ? (
        <Panel>
          <EmptyState
            icon={<span className="text-2xl">👟</span>}
            title="Nenhum equipamento cadastrado"
            description="Adicione tenis, bikes e outros para rastrear quilometragem."
            action={<button onClick={openNew} className="od-btn od-btn-primary">Adicionar primeiro equipamento</button>}
          />
        </Panel>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-8">
              <h2 className="od-label mb-3 px-1">Em uso ({active.length})</h2>
              <div className="od-stagger grid gap-3 sm:grid-cols-2">
                {active.map((item) => (
                  <EquipmentCard
                    key={item.id}
                    item={item}
                    onEdit={() => openEdit(item)}
                    onRetire={() => handleRetire(item)}
                    onDelete={() => handleDelete(item.id)}
                    deleting={deletingId === item.id}
                  />
                ))}
              </div>
            </section>
          )}

          {retired.length > 0 && (
            <section>
              <button
                onClick={() => setShowRetired(!showRetired)}
                className="od-label od-label-plain mb-3 px-1 transition-colors hover:text-brand-accent"
                aria-expanded={showRetired}
              >
                {showRetired ? "▾" : "▸"} Aposentados ({retired.length})
              </button>
              {showRetired && (
                <div className="grid gap-3 opacity-60 sm:grid-cols-2">
                  {retired.map((item) => (
                    <EquipmentCard
                      key={item.id}
                      item={item}
                      onEdit={() => openEdit(item)}
                      onDelete={() => handleDelete(item.id)}
                      deleting={deletingId === item.id}
                      retired
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {recs && <Recommendations data={recs} onAdd={openFromRecommendation} />}
    </PageContainer>
  );
}

function EquipmentCard({
  item,
  onEdit,
  onRetire,
  onDelete,
  deleting,
  retired,
}: {
  item: EquipmentItem;
  onEdit: () => void;
  onRetire?: () => void;
  onDelete: () => void;
  deleting: boolean;
  retired?: boolean;
}) {
  const icon = TYPE_ICON[item.type] ?? "🎽";
  const typeLabel = TYPE_LABEL[item.type] ?? item.type;
  const total = item.total_distance_m;

  return (
    <Panel className="flex flex-col !p-5">
      <div className="flex items-start gap-3.5">
        <div className="od-icon-tile !h-14 !w-14 shrink-0 overflow-hidden text-2xl" aria-hidden>
          {item.photo_data_url ? <img src={item.photo_data_url} alt="" className="h-full w-full object-cover" /> : icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{item.name}</span>
            {retired && <span className="od-badge od-badge-muted">Aposentado</span>}
          </div>
          <p className="truncate text-xs text-brand-muted">
            {typeLabel}
            {item.brand && ` · ${item.brand}`}
            {item.model && ` ${item.model}`}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <div className="od-metric-label">Distância total</div>
          <div className="od-num mt-1 text-[2rem] leading-none text-white">
            {(total / 1000).toFixed(total >= 100000 ? 0 : 1)}<span className="ml-1 font-sans text-sm font-semibold text-brand-accent">km</span>
          </div>
        </div>
        {item.purchase_date && (
          <div className="text-right text-[0.7rem] text-brand-muted">
            desde<br /><span className="text-brand-textSecondary">{new Date(item.purchase_date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span>
          </div>
        )}
      </div>

      {item.notes && <p className="mt-3 line-clamp-2 text-xs text-brand-muted">{item.notes}</p>}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/5 pt-4">
        <button onClick={onEdit} className="od-btn od-btn-ghost od-btn-sm">Editar</button>
        {!retired && onRetire && (
          <button onClick={onRetire} className="od-btn od-btn-ghost od-btn-sm">Aposentar</button>
        )}
        <button onClick={onDelete} disabled={deleting} className="od-btn od-btn-danger od-btn-sm ml-auto">
          {deleting ? "…" : "Excluir"}
        </button>
      </div>
    </Panel>
  );
}
