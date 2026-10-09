const TOKEN_KEY = "kactus_token";
/** Chave de antes do rebrand (Ondilow → Kactus): migrada na primeira leitura, pra ninguém ser deslogado. */
const LEGACY_TOKEN_KEY = "ondilow_token";

// ---------- token helpers ----------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy !== null) {
      if (localStorage.getItem(TOKEN_KEY) === null) localStorage.setItem(TOKEN_KEY, legacy);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
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
  /** Tempo decorrido (do início ao fim, com paradas). Para exibir e somar, usar `activeSeconds`. */
  duration_s: number;
  /** Tempo em movimento; nulo quando não dá pra calcular (ex.: musculação, natação em piscina). */
  moving_time_s: number | null;
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
  /** Tempo em movimento acumulado ate o ponto (para nas pausas); ausente quando nao da pra saber. */
  moving_s?: number | null;
  lat: number | null;
  lon: number | null;
  altitude_m: number | null;
  distance_m: number | null;
  hr: number | null;
  cadence: number | null;
  power_w: number | null;
  speed_ms: number | null;
  /** Dinamica de corrida (so FIT do Garmin). */
  vertical_oscillation_mm?: number | null;
  stance_time_ms?: number | null;
  vertical_ratio_pct?: number | null;
  step_length_mm?: number | null;
}

export interface ActivityLap {
  lap_index: number;
  duration_s: number | null;
  distance_m: number | null;
  avg_pace_s_per_km: number | null;
  gap_pace_s_per_km: number | null;
  avg_hr: number | null;
  avg_power_w: number | null;
}

export interface ActivityDetail extends ActivitySummary {
  description: string | null;
  equipment_id: string | null;
  elevation_loss_m: number | null;
  max_hr: number | null;
  avg_power_w: number | null;
  max_power_w: number | null;
  /** Passos/min em esportes de passada (ja corrigido do "por perna" do FIT). */
  avg_cadence: number | null;
  /** Ritmo ajustado a inclinacao, estimado (s/km). */
  gap_pace_s_per_km: number | null;
  /** Deriva cardiaca (%), so em corrida continua de 30+ min. */
  hr_decoupling_pct: number | null;
  /** Check-in pos-treino (opcional). */
  rpe: number | null;
  /** Carga interna: PSE x minutos em movimento. */
  srpe: number | null;
  pain_level: number | null;
  pain_location: string | null;
  feeling: Feeling | null;
  checkin_notes: string | null;
  checkin_tags: string[] | null;
  checkin_at: string | null;
  calories: number | null;
  /** O que so o FIT do Garmin traz (nulo nas outras fontes). */
  max_speed_kmh: number | null;
  normalized_power_w: number | null;
  elevation_min_m: number | null;
  elevation_max_m: number | null;
  avg_temperature_c: number | null;
  min_temperature_c: number | null;
  max_temperature_c: number | null;
  /** Efeito de treino, 0 a 5. */
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  primary_benefit: number | null;
  primary_benefit_label: string | null;
  /** Quanto a FC caiu logo depois de parar (bpm). */
  hr_recovery: number | null;
  sweat_loss_ml: number | null;
  resting_calories: number | null;
  avg_vertical_oscillation_mm: number | null;
  avg_stance_time_ms: number | null;
  avg_vertical_ratio_pct: number | null;
  avg_step_length_m: number | null;
  total_strides: number | null;
  /** Tempo andando dentro da corrida (estimado pela cadencia). */
  walk_time_s: number | null;
  /** Autoavaliacao do relogio, 0-100. Nao e o check-in. */
  watch_feel: number | null;
  watch_rpe: number | null;
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

/** A aba Carga em linguagem simples (GET /metrics/summary). */
export interface LoadSummary {
  hoje: { type: string; label: string; color: string; detail: string };
  semana: { corrida_km: number; horas: number; treinos: number };
  media_4_semanas: { corrida_km: number; horas: number; treinos: number };
  faixa_segura:
    | { disponivel: true; min_km: number; max_km: number; feito_7d_km: number }
    | { disponivel: false; motivo: "base_baixa" | "sem_corrida"; feito_7d_km: number };
  /** Meta de corrida da semana contra a faixa segura (null sem meta no Perfil). */
  meta_semanal: { km: number; feito_km: number; falta_km: number; situacao: "dentro" | "acima_da_faixa" | "abaixo_da_faixa" | "sem_faixa" } | null;
  intensidade_28d:
    | { disponivel: true; percentual: { leve_z1_z2: number; moderado_z3: number; forte_z4_z5: number } }
    | { disponivel: false }
    | null;
  efeito_treino_7d: { media_aerobico: number; treinos: number; beneficios: Record<string, number> } | null;
  semanas: { semana: string; em_andamento: boolean; corrida_km: number; bike_km: number; caminhada_km: number; horas: number; treinos: number }[];
}

export async function fetchLoadSummary(): Promise<LoadSummary> {
  return apiFetch<LoadSummary>("/metrics/summary");
}

export interface Split {
  index: number;
  distance_m: number;
  duration_s: number;
  pace_s_per_km: number | null;
  avg_hr: number | null;
  elevation_gain_m: number | null;
  gap_pace_s_per_km: number | null;
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
  /** Meta de km de corrida por semana (segunda a domingo). */
  weekly_km_goal: number | null;
}

// ---------- helper de fetch ----------

/**
 * Texto do erro da API. `detail` pode ser texto (HTTPException), objeto
 * ({error, message}: erro interno e erros da Duni) ou lista (validacao 422).
 */
export function apiErrorMessage(body: unknown, status: number, fallback = `Erro ${status}`): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    const msgs = detail.map((d) => (d as { msg?: string })?.msg).filter(Boolean);
    if (msgs.length) return `Dados inválidos: ${msgs.join("; ")}`;
  }
  if (detail && typeof detail === "object") {
    const d = detail as { message?: string; error?: string };
    if (d.message) return d.message;
    if (d.error) return d.error;
  }
  return fallback;
}

async function errorFromResponse(res: Response, fallback?: string): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  return new Error(apiErrorMessage(body, res.status, fallback));
}

const REQUEST_TIMEOUT_MS = 60_000;
const UPLOAD_TIMEOUT_MS = 300_000;
const WAKING_AFTER_MS = 3_000;

/** Avisa a UI (WakingBanner) que a API esta demorando -- cold start em hospedagem gratuita. */
function emitWaking(waking: boolean) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("kactus:waking", { detail: waking }));
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const timeoutMs = options?.body instanceof FormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  let waking = false;
  const wakingTimer = setTimeout(() => { waking = true; emitWaking(true); }, WAKING_AFTER_MS);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { signal: AbortSignal.timeout(timeoutMs), ...options, headers });
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error("O servidor demorou demais para responder. Tente novamente.");
    }
    throw e;
  } finally {
    clearTimeout(wakingTimer);
    if (waking) emitWaking(false);
  }
  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }
  if (!res.ok) throw await errorFromResponse(res);
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
  if (!res.ok) throw await errorFromResponse(res, "Falha no login");
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

export type Feeling = "otimo" | "bem" | "normal" | "cansado" | "pernas_pesadas" | "sem_energia";

export interface CheckinInput {
  rpe: number | null;
  pain_level: number | null;
  pain_location: string | null;
  feeling: Feeling | null;
  notes: string | null;
  tags: string[];
}

export interface CheckinTagGroup {
  group: string;
  tags: { code: string; label: string }[];
}

let checkinTagsCache: Promise<CheckinTagGroup[]> | null = null;

/** Catalogo das etiquetas do check-in (vem da API; muda so com deploy, entao fica em cache). */
export function getCheckinTags(): Promise<CheckinTagGroup[]> {
  checkinTagsCache ??= apiFetch<CheckinTagGroup[]>("/activities/checkin-tags").catch((e) => {
    checkinTagsCache = null;
    throw e;
  });
  return checkinTagsCache;
}

/** Grava o check-in pos-treino inteiro (campos nulos apagam o valor). */
export async function putCheckin(id: string, data: CheckinInput): Promise<ActivityDetail> {
  return apiFetch<ActivityDetail>(`/activities/${id}/checkin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteActivity(id: string): Promise<void> {
  return voidFetch(`/activities/${id}`, { method: "DELETE" });
}

/** Atividade na lixeira (excluida, ainda da para restaurar). */
export interface TrashItem {
  id: string;
  sport: string;
  title: string | null;
  start_time: string;
  duration_s: number;
  distance_m: number | null;
  deleted_at: string;
}

export async function fetchTrash(): Promise<TrashItem[]> {
  return apiFetch<TrashItem[]>("/activities/trash");
}

export async function restoreActivity(id: string): Promise<TrashItem> {
  return apiFetch<TrashItem>(`/activities/${id}/restore`, { method: "POST" });
}

/** Apaga de vez tudo o que esta na lixeira. */
export async function emptyTrash(): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>("/activities/trash", { method: "DELETE" });
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
  /** Foto real da peca (data URL JPEG ~30 KB). */
  photo_data_url: string | null;
  /** Esportes em que entra sozinho nos treinos importados. */
  default_sports: string[];
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
  photo_data_url?: string | null;
  default_sports?: string[];
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
  /** "" ou null remove a foto. */
  photo_data_url?: string | null;
  default_sports?: string[];
}

export async function fetchEquipment(): Promise<EquipmentItem[]> {
  return apiFetch<EquipmentItem[]>("/equipment");
}

export interface RecommendedItem {
  sport: string;
  category: string;
  tier: "entrada" | "intermediario" | "topo";
  brand: string;
  model: string;
  why: string;
  price_brl: string;
  equipment_type: string;
}

export interface EquipmentRecommendations {
  atualizado_em: string;
  alertas: { nivel: "trocar" | "atencao"; equipamento: string; equipamento_id: string; km: number; texto: string }[];
  esportes: {
    sport: string;
    label: string;
    praticado: boolean;
    horas_90d: number;
    categorias: { id: string; label: string; destaque: string | null; itens: RecommendedItem[] }[];
  }[];
}

export async function fetchEquipmentRecommendations(): Promise<EquipmentRecommendations> {
  return apiFetch<EquipmentRecommendations>("/equipment/recommendations");
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

/** Liga o equipamento aos treinos antigos sem equipamento dos seus esportes padrao. */
export async function applyDefaultEquipment(id: string): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>(`/equipment/${id}/apply-default`, { method: "POST" });
}

export async function deleteEquipment(id: string): Promise<void> {
  return voidFetch(`/equipment/${id}`, { method: "DELETE" });
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
  weekly_plan_id?: string | null;
  goal_plan_id?: string | null;
  /** Finalidade fisiologica do treino. */
  objective?: string | null;
  /** Por que este treino nesta semana, ligado aos dados. */
  reason?: string | null;
  steps?: WorkoutStep[] | null;
  targets?: WorkoutTargets | null;
}

export interface WorkoutStep {
  fase: "aquecimento" | "principal" | "desaquecimento";
  descricao: string;
  duracao_min: number | null;
  distancia_km: number | null;
  repeticoes: number | null;
  ritmo: string | null;
  zona_fc: string | null;
  /** So em planos antigos: a Duni nao usa mais PSE (o atleta nao entende a sigla). */
  pse?: string | null;
  recuperacao: string | null;
}

export interface WorkoutTargets {
  tipo?: string | null;
  ritmo?: string | null;
  gap?: string | null;
  zona_fc?: string | null;
  /** So em planos antigos. */
  pse?: string | null;
  cadencia?: string | null;
  terreno?: string | null;
  metrica_prioritaria?: string | null;
  observacoes?: string | null;
  ajuste_pedido?: string | null;
}

export type WeeklyStatus = "verde" | "amarelo" | "laranja" | "vermelho";

export interface WeeklyPlanReport {
  resumo: string;
  carga_semana_anterior: {
    corrida_km: number | null;
    corrida_minutos: number | null;
    corridas: number | null;
    treinos_total: number | null;
    longao_km: number | null;
    ritmo_medio: string | null;
    caminhada_km: number | null;
    complementar: Record<string, { sessoes: number; minutos: number }>;
    carga_interna_srpe: number | null;
    pse_media: number | null;
    intensidade_28d_pct: { leve_z1_z2: number; moderado_z3: number; forte_z4_z5: number } | null;
  };
  avaliacao: { positivos: string[]; fadiga: string[]; riscos: string[]; evolucao: string[] };
  proxima_semana: { km_previsto: number | null; sessoes: number; estimulo_principal: string; objetivo: string };
  criterios_ajuste: { manter: string[]; reduzir: string[]; acelerar: string[]; interromper: string[] };
  proximas_4_semanas: { semana: number; km_aproximado: number | null; foco: string }[];
}

export interface WeeklyPlan {
  id: string;
  week_start: string;
  week_end: string;
  status: WeeklyStatus;
  status_reason: string;
  report: WeeklyPlanReport;
  model_used: string | null;
  created_at: string;
}

export interface WeeklyPlanResponse {
  plan: WeeklyPlan | null;
  workouts: PlannedWorkout[];
}

export interface CoachChatMessage {
  role: string | null;
  content: string;
  created_at: string;
}

export interface CoachErrorDetail {
  error:
    | "not_configured"
    | "quota_exceeded"
    | "invalid_key"
    | "model_not_found"
    | "llm_unavailable"
    | "llm_timeout"
    | "insufficient_data"
    | "invalid_plan_response"
    | "invalid_response"
    | "date_conflict"
    | "not_editable"
    | "not_found"
    | "past_date"
    | "not_swappable"
    | "no_goal_race"
    | "race_too_close"
    | "invalid_suggestion"
    | "no_free_week"
    | "internal_error";
  weeks_available?: number;
  message?: string;
  conflict?: { id: string; title: string; status: string };
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

/** Plano da proxima semana (7 dias a partir de amanha), com status e relatorio. */
export async function postCoachGeneratePlan(): Promise<WeeklyPlanResponse> {
  return coachFetch<WeeklyPlanResponse>("/coach/plan/generate", { method: "POST" });
}

export async function fetchWeekPlan(): Promise<WeeklyPlanResponse> {
  return coachFetch<WeeklyPlanResponse>("/coach/plan/week");
}

export type GoalPhase = "base" | "construcao" | "pico" | "polimento";

/** Plano do objetivo: todas as semanas ate a prova. Paces em s/km. */
export interface GoalPlan {
  id: string;
  race_name: string;
  race_date: string;
  race_distance_km: number;
  days_per_week: number;
  vdot: number | null;
  summary: string;
  phases: { fase: GoalPhase; inicio: string; fim: string; foco: string }[];
  weeks: { semana: number; inicio: string; fim: string; fase: GoalPhase; km: number; longao_km: number; alivio: boolean }[];
  paces: { leve_rapido: number; leve_lento: number; limiar: number; intervalo: number; prova: number };
  /** O que a Duni levou em conta dos ultimos 6 meses. */
  analysis?: { tema: string; texto: string }[] | null;
  model_used: string | null;
  created_at: string;
}

export interface GoalPlanResponse {
  plan: GoalPlan | null;
  workouts: PlannedWorkout[];
}

export async function fetchGoalPlan(): Promise<GoalPlanResponse> {
  return coachFetch<GoalPlanResponse>("/coach/goal-plan");
}

export async function postGoalPlanGenerate(daysPerWeek = 3): Promise<GoalPlanResponse> {
  return coachFetch<GoalPlanResponse>("/coach/goal-plan/generate", {
    method: "POST",
    body: JSON.stringify({ days_per_week: daysPerWeek }),
  });
}

export async function regenerateWorkout(
  id: string,
  reason: string,
): Promise<{ workout: PlannedWorkout | null; explanation: string; model_used: string }> {
  return coachFetch(`/coach/plan/${id}/regenerate`, { method: "POST", body: JSON.stringify({ reason }) });
}

export interface WeekComparison {
  recomenda: "objetivo" | "semana" | "misturar";
  explicacao: string;
  dias: { data: string; escolha: "objetivo" | "semana"; motivo: string }[];
}

/** O plano da semana pelo estado de agora (proposta, nao muda a agenda) + comparacao. */
export interface FreeWeekResponse {
  plan: WeeklyPlan | null;
  workouts: PlannedWorkout[];
  comparison: WeekComparison | null;
}

export async function fetchFreeWeek(): Promise<FreeWeekResponse> {
  return coachFetch<FreeWeekResponse>("/coach/plan/free");
}

export async function postFreeWeekGenerate(): Promise<FreeWeekResponse> {
  return coachFetch<FreeWeekResponse>("/coach/plan/free/generate", { method: "POST" });
}

/** Leva dias do plano livre para a agenda (sem datas = a semana toda). */
export async function applyFreeWeek(dates?: string[]): Promise<WeeklyPlanResponse> {
  return coachFetch<WeeklyPlanResponse>("/coach/plan/free/use", { method: "POST", body: JSON.stringify({ dates: dates ?? null }) });
}

/** Analise do treino do dia pela Duni. suggestion volta no apply; preview e para mostrar. */
export interface WorkoutReview {
  verdict: "manter" | "ajustar" | "descanso";
  explanation: string;
  points: string[];
  suggestion: Record<string, unknown> | null;
  preview: Partial<PlannedWorkout> | null;
  model_used: string;
}

export async function reviewWorkout(id: string, question?: string): Promise<WorkoutReview> {
  return coachFetch(`/coach/plan/${id}/analyze`, { method: "POST", body: JSON.stringify({ question: question ?? null }) });
}

export async function applyWorkoutReview(
  id: string,
  verdict: "ajustar" | "descanso",
  suggestion: Record<string, unknown> | null,
  explanation: string,
): Promise<{ workout: PlannedWorkout | null; explanation: string }> {
  return coachFetch(`/coach/plan/${id}/apply-review`, {
    method: "POST",
    body: JSON.stringify({ verdict, suggestion, explanation }),
  });
}

export interface ActivityComment {
  comment: string | null;
  model_used?: string | null;
  generated_at?: string | null;
}

/** Planejado × feito de um treino dos ultimos dias (GET /coach/plan/adherence). */
export interface AdherenceItem {
  id: string;
  date: string;
  title: string;
  sport: string;
  status: "done" | "skipped";
  planned: { distance_m: number | null; duration_s: number | null; intensity: string | null; ritmo: string | null; zona_fc: string | null };
  actual: {
    activity_id: string; title: string | null; sport: string; distance_m: number | null; moving_s: number | null;
    pace_s_per_km: number | null; avg_hr: number | null; rpe: number | null;
  } | null;
  volume: "cumpriu" | "a_mais" | "a_menos" | null;
  ratio: number | null;
  ritmo: "no_ritmo" | "mais_rapido" | "mais_lento" | null;
  comment: { text: string; generated_at: string; model_used: string | null } | null;
}

export async function fetchAdherence(days = 7): Promise<AdherenceItem[]> {
  return apiFetch<AdherenceItem[]>(`/coach/plan/adherence?days=${days}`);
}

/** Ultimo comentario salvo da Duni sobre a atividade (nao chama a IA). */
export async function fetchActivityComment(activityId: string): Promise<ActivityComment> {
  return coachFetch<ActivityComment>(`/coach/activities/${activityId}/analyze`);
}

/** Pede um comentario novo a Duni (gasta cota do Gemini). */
export async function postActivityComment(activityId: string): Promise<ActivityComment> {
  return coachFetch<ActivityComment>(`/coach/activities/${activityId}/analyze`, { method: "POST" });
}

/** 409 com detail.error "date_conflict" quando o dia ja tem treino e on_conflict = "error". */
export async function moveWorkout(
  id: string,
  date: string,
  onConflict: "error" | "swap" | "keep_both" = "error",
): Promise<PlannedWorkout> {
  return coachFetch<PlannedWorkout>(`/coach/plan/${id}/move`, {
    method: "POST",
    body: JSON.stringify({ date, on_conflict: onConflict }),
  });
}

/** Resumo da semana (v4): pedacos curtos que a tela monta num cartao. */
export interface CoachSummary {
  status: WeeklyStatus;
  status_frase: string;
  semana: string;
  pontos: { tipo: "bom" | "atencao" | "risco"; texto: string }[];
  acoes: string[];
  pergunta: string | null;
}

/** `summary` nos resumos novos; `report` (markdown) nos antigos. */
export interface CoachReport {
  summary: CoachSummary | null;
  report: string | null;
  model_used: string;
  generated_at: string;
}

/** Ultimo resumo salvo, sem chamar a IA (null se nunca foi gerado). */
export async function fetchLastCoachReport(): Promise<CoachReport | null> {
  return coachFetch<CoachReport | null>("/coach/analyze");
}

export async function postCoachAnalyze(): Promise<CoachReport> {
  return coachFetch("/coach/analyze", { method: "POST" });
}

export type MemoryKind = "objetivo" | "prova" | "lesao" | "disponibilidade" | "preferencia" | "outro";

/** Algo que a Duni percebeu no chat; so vira memoria se o atleta confirmar. */
export interface MemorySuggestion {
  kind: MemoryKind;
  content: string;
  event_date: string | null;
}

export interface AthleteMemory {
  id: string;
  kind: MemoryKind;
  content: string;
  event_date: string | null;
  active: boolean;
  source: "manual" | "duni";
  created_at: string;
}

export async function postCoachChat(
  message: string,
): Promise<{ reply: string; model_used: string; memory_suggestions: MemorySuggestion[] }> {
  return coachFetch("/coach/chat", { method: "POST", body: JSON.stringify({ message }) });
}

export async function fetchCoachHistory(): Promise<CoachChatMessage[]> {
  return coachFetch<CoachChatMessage[]>("/coach/chat/history");
}

/** Apaga a conversa toda (as memorias e os resumos ficam). */
export async function clearCoachHistory(): Promise<void> {
  const token = getToken();
  const res = await fetch("/api/coach/chat/history", {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

export async function fetchMemories(includeArchived = false): Promise<AthleteMemory[]> {
  return coachFetch<AthleteMemory[]>(`/coach/memories${includeArchived ? "?include_archived=true" : ""}`);
}

export async function createMemory(
  data: { kind: MemoryKind; content: string; event_date: string | null; source?: "manual" | "duni" },
): Promise<AthleteMemory> {
  return coachFetch<AthleteMemory>("/coach/memories", { method: "POST", body: JSON.stringify(data) });
}

export async function updateMemory(
  id: string,
  data: Partial<Pick<AthleteMemory, "kind" | "content" | "event_date" | "active">>,
): Promise<AthleteMemory> {
  return coachFetch<AthleteMemory>(`/coach/memories/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteMemory(id: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/coach/memories/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
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
  if (!res.ok) throw await errorFromResponse(res);
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
  if (!res.ok) throw await errorFromResponse(res);
  const blob = await res.blob();
  const filename = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1]
    ?? "kactus_export.json";
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
  if (!res.ok) throw await errorFromResponse(res);
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
  if (!res.ok) throw await errorFromResponse(res);
  return res.json() as Promise<UploadResult[]>;
}
