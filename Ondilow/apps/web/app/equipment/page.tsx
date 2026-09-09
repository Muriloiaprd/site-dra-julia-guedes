"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  createEquipment,
  deleteEquipment,
  fetchEquipment,
  fetchMe,
  updateEquipment,
  type EquipmentCreate,
  type EquipmentItem,
} from "@/lib/api";
import { formatDistance } from "@/lib/utils";

const EQUIPMENT_TYPES = [
  { value: "shoe", label: "Tenis" },
  { value: "bike", label: "Bicicleta" },
  { value: "swimsuit", label: "Roupa de nado" },
  { value: "wetsuit", label: "Wetsuit" },
  { value: "watch", label: "Relogio" },
  { value: "other", label: "Outro" },
];

const TYPE_ICON: Record<string, string> = {
  shoe: "👟",
  bike: "🚴",
  swimsuit: "🩱",
  wetsuit: "🤿",
  watch: "⌚",
  other: "🎽",
};

const TYPE_LABEL: Record<string, string> = {
  shoe: "Tenis",
  bike: "Bicicleta",
  swimsuit: "Roupa de nado",
  wetsuit: "Wetsuit",
  watch: "Relogio",
  other: "Outro",
};

const INITIAL_FORM: EquipmentCreate = {
  name: "",
  type: "shoe",
  brand: "",
  model: "",
  purchase_date: null,
  initial_distance_m: 0,
  notes: "",
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

  function openEdit(item: EquipmentItem) {
    setEditId(item.id);
    setForm({
      name: item.name,
      type: item.type,
      brand: item.brand ?? "",
      model: item.model ?? "",
      purchase_date: item.purchase_date,
      initial_distance_m: item.initial_distance_m,
      notes: item.notes ?? "",
    });
    setShowForm(true);
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

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b border-brand-border px-6 py-4">
        <Link href="/dashboard" className="text-sm text-brand-muted hover:text-brand-accent">
          ← Dashboard
        </Link>
        <h1 className="font-semibold">Equipamentos</h1>
        <button
          onClick={openNew}
          className="rounded-md bg-brand-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-accentHover"
        >
          + Adicionar
        </button>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {error && (
          <div className="mb-4 rounded-lg border border-brand-danger/40 bg-brand-danger/10 p-3 text-sm text-brand-danger">
            {error}
          </div>
        )}

        {/* formulario */}
        {showForm && (
          <div className="mb-8 rounded-lg border border-brand-border bg-brand-surface p-6">
            <h2 className="mb-4 font-semibold">{editId ? "Editar equipamento" : "Novo equipamento"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-brand-muted">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Nike Vaporfly 3"
                  className="w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-muted">Tipo *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent"
                >
                  {EQUIPMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-muted">Marca</label>
                <input
                  type="text"
                  value={form.brand ?? ""}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="Nike"
                  className="w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-muted">Modelo</label>
                <input
                  type="text"
                  value={form.model ?? ""}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="Vaporfly 3"
                  className="w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-muted">Data de compra</label>
                <input
                  type="date"
                  value={form.purchase_date ?? ""}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value || null })}
                  className="w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-muted">Distancia inicial (km)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={Number(form.initial_distance_m)}
                  onChange={(e) => setForm({ ...form, initial_distance_m: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-brand-muted">Notas</label>
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm outline-none focus:border-brand-accent"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:bg-brand-accentHover disabled:opacity-50"
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border border-brand-border px-4 py-2 text-sm hover:border-brand-accent hover:text-brand-accent"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-brand-surface" />
            ))}
          </div>
        ) : active.length === 0 && !showForm ? (
          <div className="rounded-lg border border-brand-border bg-brand-surface p-12 text-center text-brand-muted">
            <p className="text-4xl mb-3">👟</p>
            <p className="font-medium">Nenhum equipamento cadastrado</p>
            <p className="mt-1 text-sm">Adicione tenis, bikes e outros para rastrear quilometragem.</p>
            <button
              onClick={openNew}
              className="mt-4 rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:bg-brand-accentHover"
            >
              Adicionar primeiro equipamento
            </button>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">
                  Em uso ({active.length})
                </h2>
                <div className="space-y-3">
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
                  className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-muted hover:text-brand-accent"
                >
                  {showRetired ? "▾" : "▸"} Aposentados ({retired.length})
                </button>
                {showRetired && (
                  <div className="space-y-3 opacity-60">
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
      </div>
    </main>
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
    <div className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-surface px-4 py-4">
      <div className="flex items-center gap-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {retired && (
              <span className="rounded-full border border-brand-muted px-2 py-0.5 text-xs text-brand-muted">
                Aposentado
              </span>
            )}
          </div>
          <p className="text-xs text-brand-muted">
            {typeLabel}
            {item.brand && ` · ${item.brand}`}
            {item.model && ` ${item.model}`}
          </p>
          <p className="text-sm font-semibold text-brand-accent mt-0.5">
            {formatDistance(total)} totais
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onEdit}
          className="rounded-md border border-brand-border px-2 py-1 text-xs hover:border-brand-accent hover:text-brand-accent"
        >
          Editar
        </button>
        {!retired && onRetire && (
          <button
            onClick={onRetire}
            className="rounded-md border border-brand-border px-2 py-1 text-xs hover:border-brand-muted hover:text-brand-muted"
          >
            Aposentar
          </button>
        )}
        <button
          onClick={onDelete}
          disabled={deleting}
          className="rounded-md border border-brand-danger/40 px-2 py-1 text-xs text-brand-danger hover:bg-brand-danger/10 disabled:opacity-50"
        >
          {deleting ? "…" : "Excluir"}
        </button>
      </div>
    </div>
  );
}
