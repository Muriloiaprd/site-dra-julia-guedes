const TOKEN_KEY = "ondilow_token";

// ---------- token helpers ----------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// Varias paginas e o Sidebar buscam o usuario/perfil atual de forma independente no
// mesmo carregamento. Como layout e page hidratam em chunks JS separados, os efeitos nem
// sempre disparam no mesmo tick — por isso cacheia por um TTL curto (nao so o "em voo"),
// o suficiente pra colapsar as chamadas de um unico carregamento de pagina numa so.
const DEDUPE_TTL_MS = 3000;
const _cache = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();

function dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const cached = _cache.get(key) as { promise: Promise<T>; expiresAt: number } | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const promise = factory();
  _cache.set(key, { promise, expiresAt: Date.now() + DEDUPE_TTL_MS });
  promise.catch(() => _cache.delete(key)); // nao cacheia falha
  return promise;
}

// ---------- tipos ----------

export interface User {
  id: string;
  email: string;
}

export interface ActivitySummary {
  id: string;
  sport: string;
  start_time: string;
  duration_s: number;
  distance_m: number | null;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  avg_pace_s_per_km: number | null;
  avg_speed_kmh: number | null;
  title: string | null;
  source: string;
}

export interface ActivityPoint {
  elapsed_time_s: number;
  lat: number | null;
  lon: number | null;
  altitude_m: number | null;
  distance_m: number | null;
  hr: number | null;
  cadence: number | null;
  power_w: number | null;
  speed_ms: number | null;
}

export interface ActivityLap {
  lap_index: number;
  duration_s: number | null;
  distance_m: number | null;
  avg_pace_s_per_km: number | null;
  avg_hr: number | null;
  avg_power_w: number | null;
}

export interface ActivityDetail extends ActivitySummary {
  equipment_id: string | null;
  moving_time_s: number | null;
  elevation_loss_m: number | null;
  max_hr: number | null;
  avg_power_w: number | null;
  max_power_w: number | null;
  avg_cadence: number | null;
  calories: number | null;
  location_start_lat: number | null;
  location_start_lon: number | null;
  laps: ActivityLap[];
  points: ActivityPoint[];
}

export interface ActivityUpdate {
  title?: string | null;
  description?: string | null;
  sport?: string;
  equipment_id?: string | null;
}

export interface Split {
  index: number;
  distance_m: number;
  duration_s: number;
  pace_s_per_km: number | null;
  avg_hr: number | null;
  elevation_gain_m: number | null;
}

export interface ZoneBucket {
  zone: number;
  seconds: number;
  percent: number;
}

export interface PersonalRecord {
  sport: string;
  record_type: string;
  value: number;
  unit: string;
  achieved_at: string;
  activity_id: string | null;
}

export interface HrZones {
  z1: [number, number];
  z2: [number, number];
  z3: [number, number];
  z4: [number, number];
  z5: [number, number];
}

export interface Profile {
  full_name: string | null;
  avatar_data_url: string | null;
  logo_data_url: string | null;
  dob: string | null;
  sex: string | null;
  height_cm: number | null;
  max_hr: number | null;
  hr_zones: HrZones | null;
  ftp_watts: number | null;
  css_pace_s_per_100m: number | null;
  weight_kg: number | null;
  resting_hr: number | null;
  vo2max_estimated: number | null;
}

// ---------- helper de fetch ----------

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------- auth ----------

export async function login(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error((detail as { detail?: string }).detail || "Falha no login");
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function fetchMe(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  return dedupe("me", async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json() as Promise<User>;
    } catch {
      return null;
    }
  });
}

// ---------- atividades ----------

export async function fetchActivities(
  limit = 50,
  offset = 0,
  sport?: string,
  days?: string,
): Promise<ActivitySummary[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (sport) params.set("sport", sport);
  if (days) params.set("days", days);
  return apiFetch<ActivitySummary[]>(`/activities?${params}`);
}

export async function fetchActivity(id: string): Promise<ActivityDetail> {
  return apiFetch<ActivityDetail>(`/activities/${id}`);
}

export async function updateActivity(id: string, data: ActivityUpdate): Promise<ActivityDetail> {
  return apiFetch<ActivityDetail>(`/activities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteActivity(id: string): Promise<void> {
  const token = getToken();
  await fetch(`/api/activities/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function fetchSplits(id: string, splitM = 1000): Promise<Split[]> {
  return apiFetch<Split[]>(`/activities/${id}/splits?split_m=${splitM}`);
}

export async function fetchZones(id: string): Promise<ZoneBucket[]> {
  return apiFetch<ZoneBucket[]>(`/activities/${id}/zones`);
}

// ---------- perfil & recordes ----------

export async function fetchProfile(): Promise<Profile> {
  return dedupe("profile", () => apiFetch<Profile>("/profile"));
}

export async function updateProfile(data: Partial<Profile>): Promise<Profile> {
  return apiFetch<Profile>("/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchRecords(): Promise<PersonalRecord[]> {
  return apiFetch<PersonalRecord[]>("/records");
}

// ---------- metricas de carga ----------

export interface DailyMetric {
  date: string;
  daily_load: number | null;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  acwr: number | null;
}

export async function fetchLoadMetrics(days = 90): Promise<DailyMetric[]> {
  return apiFetch<DailyMetric[]>(`/metrics/load?days=${days}`);
}

// ---------- upload ----------

export interface UploadResult {
  filename: string;
  imported: {
    activity_id: string;
    duplicate: boolean;
    sport: string;
    distance_m: number | null;
    points_stored: number;
  }[];
  error?: string | null;
}

// ---------- previsoes ----------

export interface RacePrediction {
  distance: string;
  distance_m: number;
  predicted_s: number;
  confidence: number;
  source: string;
  vdot: number;
}

export interface RiskAssessment {
  level: "low" | "moderate" | "high" | "unknown";
  reasons: string[];
  recommendation: string;
}

export interface TrainingRecommendation {
  type: "hard" | "moderate" | "easy" | "rest" | "unknown";
  label: string;
  color: string;
  detail: string | null;
}

export interface PredictionsOverview {
  race_predictions: RacePrediction[];
  risk: RiskAssessment;
  recommendation: TrainingRecommendation;
}

export interface SimulatedDay {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  planned_tss: number;
}

export async function fetchPredictionsOverview(): Promise<PredictionsOverview> {
  return apiFetch<PredictionsOverview>("/predictions/overview");
}

export async function simulateTsb(
  plannedTss: number[],
  currentCtl?: number,
  currentAtl?: number
): Promise<SimulatedDay[]> {
  return apiFetch<SimulatedDay[]>("/predictions/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planned_tss: plannedTss,
      current_ctl: currentCtl ?? null,
      current_atl: currentAtl ?? null,
    }),
  });
}


// ---------- equipamentos ----------

export interface EquipmentItem {
  id: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  retired_at: string | null;
  initial_distance_m: number;
  total_distance_m: number;
  notes: string | null;
  created_at: string;
}

export interface EquipmentCreate {
  name: string;
  type: string;
  brand?: string | null;
  model?: string | null;
  purchase_date?: string | null;
  initial_distance_m?: number;
  notes?: string | null;
}

export interface EquipmentUpdate {
  name?: string;
  type?: string;
  brand?: string | null;
  model?: string | null;
  purchase_date?: string | null;
  retired_at?: string | null;
  initial_distance_m?: number;
  notes?: string | null;
}

export async function fetchEquipment(): Promise<EquipmentItem[]> {
  return apiFetch<EquipmentItem[]>("/equipment");
}

export async function createEquipment(data: EquipmentCreate): Promise<EquipmentItem> {
  return apiFetch<EquipmentItem>("/equipment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateEquipment(id: string, data: EquipmentUpdate): Promise<EquipmentItem> {
  return apiFetch<EquipmentItem>(`/equipment/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteEquipment(id: string): Promise<void> {
  const token = getToken();
  await fetch(`/api/equipment/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// ---------- heatmap ----------

export interface HeatmapDay {
  date: string;
  sport: string | null;
  daily_load: number;
}

export async function fetchHeatmap(days = 90): Promise<HeatmapDay[]> {
  return apiFetch<HeatmapDay[]>(`/metrics/heatmap?days=${days}`);
}

// ---------- treinador de IA ----------

export interface PlannedWorkout {
  id: string;
  date: string;
  sport: string;
  title: string;
  description: string | null;
  target_duration_s: number | null;
  target_distance_m: number | null;
  target_tss: number | null;
  target_intensity: string | null;
  status: string;
  activity_id: string | null;
}

export interface CoachChatMessage {
  role: string | null;
  content: string;
  created_at: string;
}

export interface CoachErrorDetail {
  error: "not_configured" | "llm_unavailable" | "insufficient_data" | "invalid_plan_response";
  weeks_available?: number;
  message?: string;
}

export class CoachApiError extends Error {
  detail: CoachErrorDetail;
  constructor(detail: CoachErrorDetail) {
    super(detail.error);
    this.detail = detail;
  }
}

async function coachFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: CoachErrorDetail }).detail;
    if (detail?.error) throw new CoachApiError(detail);
    throw new Error(`Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCoachPlan(daysAhead = 14): Promise<PlannedWorkout[]> {
  return coachFetch<PlannedWorkout[]>(`/coach/plan?days_ahead=${daysAhead}`);
}

export async function postCoachGeneratePlan(days = 7): Promise<PlannedWorkout[]> {
  return coachFetch<PlannedWorkout[]>("/coach/plan/generate", {
    method: "POST",
    body: JSON.stringify({ days }),
  });
}

export async function postCoachAnalyze(): Promise<{ report: string; model_used: string; generated_at: string }> {
  return coachFetch("/coach/analyze", { method: "POST" });
}

export async function postCoachChat(message: string): Promise<{ reply: string; model_used: string }> {
  return coachFetch("/coach/chat", { method: "POST", body: JSON.stringify({ message }) });
}

export async function fetchCoachHistory(): Promise<CoachChatMessage[]> {
  return coachFetch<CoachChatMessage[]>("/coach/chat/history");
}

// ---------- limpar dados ----------

export async function deleteAllActivities(): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>("/activities", { method: "DELETE" });
}

// ---------- conta ----------

async function voidFetch(path: string, options: RequestInit): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `Erro ${res.status}`);
  }
  // 204 No Content — sem corpo pra ler.
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return voidFetch("/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function deleteAccount(): Promise<void> {
  return voidFetch("/auth/account", { method: "DELETE" });
}

/** Baixa todos os dados do usuario em JSON e dispara o download no navegador. */
export async function exportData(): Promise<void> {
  const token = getToken();
  const res = await fetch("/api/profile/export", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `Erro ${res.status}`);
  }
  const blob = await res.blob();
  const filename = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1]
    ?? "ondilow_export.json";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- upload ----------

export async function uploadActivity(file: File): Promise<UploadResult> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/activities/upload", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `Erro ${res.status}`);
  }
  return res.json() as Promise<UploadResult>;
}

export async function uploadActivitiesBatch(files: File[]): Promise<UploadResult[]> {
  const token = getToken();
  const form = new FormData();
  for (const file of files) form.append("files", file);
  const res = await fetch("/api/activities/upload/batch", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `Erro ${res.status}`);
  }
  return res.json() as Promise<UploadResult[]>;
}
