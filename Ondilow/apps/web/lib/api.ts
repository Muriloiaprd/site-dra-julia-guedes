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

export interface Profile {
  full_name: string | null;
  max_hr: number | null;
  ftp_watts: number | null;
  css_pace_s_per_100m: number | null;
  weight_kg: number | null;
  resting_hr: number | null;
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
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<User>;
}

// ---------- atividades ----------

export async function fetchActivities(
  limit = 50,
  offset = 0,
  sport?: string
): Promise<ActivitySummary[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (sport) params.set("sport", sport);
  return apiFetch<ActivitySummary[]>(`/activities?${params}`);
}

export async function fetchActivity(id: string): Promise<ActivityDetail> {
  return apiFetch<ActivityDetail>(`/activities/${id}`);
}

export async function fetchSplits(id: string, splitM = 1000): Promise<Split[]> {
  return apiFetch<Split[]>(`/activities/${id}/splits?split_m=${splitM}`);
}

export async function fetchZones(id: string): Promise<ZoneBucket[]> {
  return apiFetch<ZoneBucket[]>(`/activities/${id}/zones`);
}

// ---------- perfil & recordes ----------

export async function fetchProfile(): Promise<Profile> {
  return apiFetch<Profile>("/profile");
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
