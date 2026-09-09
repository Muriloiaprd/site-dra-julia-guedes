# Ondilow — Próximas Sprints

**Último commit**: Sprint 3 — CTL/ATL/TSB/ACWR  
**Branch**: master  
**Data**: 2026-09-09

---

## Estado Atual do Projeto

### ✅ Sprint 0 — Setup
- Monorepo: `apps/api` (FastAPI + uv) + `apps/web` (Next.js 14 + pnpm)
- Neon Postgres (projeto `wispy-mountain-04630520`, região `aws-sa-east-1`)
- Auth: Argon2id + JWT + Fernet para credenciais Garmin
- Migrations: 001 (users/profile), 002 (activities), 003 (personal_records), 004 (daily_metrics)

### ✅ Sprint 1 — Import + Parsers
- Parsers: FIT (fitparse), GPX (gpxpy), TCX (ElementTree), CSV histórico
- Endpoint `POST /activities/upload` com dedup SHA-256 + proximidade temporal
- Downsample GPS: 1 ponto a cada N segundos (GPS_DOWNSAMPLE_SECONDS)
- 25 testes unitários passando

### ✅ Sprint 2 — Métricas básicas + Dashboard v1
- Métricas: splits por km, zonas FC, best efforts, recordes pessoais
- Frontend: dashboard com lista de atividades + filtros + upload in-page
- Página de detalhe: mapa Leaflet (OSM), gráficos Recharts (elevação, pace/FC, zonas)
- Splits table, página de perfil (max_hr, FTP, CSS, peso)

### ✅ Sprint 3 — Métricas de Carga
- TSS por modalidade (bike+FTP, HR-based, fallback 50/h)
- CTL/ATL/TSB: EMA 42d/7d recalculado em cada import
- ACWR: razão carga aguda/crônica com alertas (>1.5 risco, <0.8 subutilizado)
- Endpoint `GET /metrics/load?days=N` + página `/metrics` com gráficos

---

## Para Iniciar uma Sessão de Trabalho

### Pré-requisitos
```powershell
# Iniciar API (rodar no diretório do projeto)
$uvPath = "C:\Users\muril\.local\bin\uv.exe"
Start-Process -FilePath $uvPath -ArgumentList "run", "uvicorn", "ondilow_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload" -WorkingDirectory "C:\Cloude Code\Ondilow\apps\api" -WindowStyle Hidden

# Frontend já inicia via .claude/launch.json (ondilow-web, porta 3003)
```

### Credenciais (NÃO commitar)
- `.env` em `C:\Cloude Code\Ondilow\.env`
- Login: `muriloiaprd@hotmail.com` / senha no .env (INITIAL_USER_PASSWORD)
- Neon project: `wispy-mountain-04630520`

---

## Sprint 4 — Previsões ⬅ PRÓXIMO

**Objetivo**: Prever tempo de prova + risco de lesão + forma futura projetada

### Backend

#### 4.1 Previsão de Tempo de Prova
Arquivo: `apps/api/ondilow_api/metrics/predictions.py`
```python
# Fórmula de Riegel: T2 = T1 × (D2/D1)^1.06
def predict_race_time(best_effort_s: float, effort_dist_m: float, target_dist_m: float) -> float

# VDOT de Jack Daniels (refina a previsão com VO2max estimado)
def estimate_vdot(time_s: float, dist_m: float) -> float
def predict_from_vdot(vdot: float, dist_m: float) -> float
```

**Endpoint**: `GET /predictions/race?target_km=10`
- Pega os melhores esforços (1k, 5k, 10k) do usuário
- Projeta tempo para 5k, 10k, 21k, 42k
- Retorna com `confidence` (1.0 = esforço exato, 0.7 = projetado)

#### 4.2 Risco de Lesão / Overtraining
Arquivo: `apps/api/ondilow_api/metrics/predictions.py`
```python
def injury_risk(recent_metrics: list[DailyMetric]) -> dict:
    # ACWR > 1.5 por 3+ dias = ALTO
    # TSB < -30 por 3+ dias = ALTO  
    # Aumento súbito de carga (>30% em 7 dias) = MODERADO
```

**Endpoint**: `GET /predictions/risk`

#### 4.3 TSB Projetado (simulação)
Arquivo: `apps/api/ondilow_api/routers/predictions.py`
```
POST /predictions/simulate
body: { planned_workouts: [{date, tss}] }
returns: [{date, ctl, atl, tsb}] para 14 dias
```

### Frontend
- Página `/predictions` (nova)
- Card "Hoje" no dashboard: recomendação (duro/moderado/leve) baseada em TSB
- Widget de previsão de prova: insere distância → vê tempo estimado
- Gráfico de TSB projetado

### Checklist Sprint 4
- [ ] `metrics/predictions.py` (Riegel + VDOT + risco)
- [ ] `routers/predictions.py` (GET /predictions/race, GET /predictions/risk, POST /predictions/simulate)
- [ ] `schemas/predictions.py` (RacePrediction, RiskAssessment, SimulationResult)
- [ ] `app/predictions/page.tsx`
- [ ] Card de recomendação no dashboard
- [ ] Commit

---

## Sprint 5 — Garmin Connect Sync

**Objetivo**: Botão "Sincronizar Garmin" que puxa atividades recentes automaticamente

### Backend
```
pip install garminconnect
```

Arquivo: `apps/api/ondilow_api/integrations/garmin.py`
```python
from garminconnect import Garmin

def sync_garmin(db, user_id, encrypted_creds_bytes) -> SyncResult:
    # descriptografa credenciais (Fernet)
    # login no Garmin Connect
    # lista últimas N atividades
    # para cada atividade: baixa FIT, chama import_activity()
    # retorna {imported: N, skipped: N, errors: []}
```

Endpoints:
- `POST /integrations/garmin/credentials` — salva credenciais criptografadas
- `POST /integrations/garmin/sync` — executa sync agora
- `GET /integrations/garmin/status` — último sync, próxima tentativa

### Frontend
- Página `/integrations` ou seção em `/profile`
- Formulário de email/senha Garmin (só enviados, nunca armazenados em texto)
- Botão "Sincronizar Agora" com feedback (spinner, "N atividades importadas")

### Checklist Sprint 5
- [ ] `pyproject.toml`: adicionar `garminconnect`
- [ ] `integrations/garmin.py`
- [ ] `routers/integrations.py`
- [ ] Frontend: seção Garmin na página de perfil ou página dedicada
- [ ] Testar com conta Garmin real do usuário
- [ ] Commit

---

## Sprint 6 — Gerador Visual (Card/Story/Overlay)

**Objetivo**: Gerar imagens para compartilhar no Instagram com stats da atividade

### Backend
```
pip install Pillow staticmap
```

Arquivo: `apps/api/ondilow_api/rendering/`

**Templates**:
1. `card_1080.py` — Card 1080×1080 (feed Instagram)
2. `story_1920.py` — Story 1080×1920 (stories/TikTok)
3. `photo_overlay.py` — Foto do usuário + stats por cima

**Mapa estático** (sem API paga):
```python
from staticmap import StaticMap, Line
def render_route_map(points, width=600, height=400) -> bytes:
    # tiles OSM via staticmap (baixa localmente)
```

**Fontes**: Baixar Inter/Roboto em `apps/api/assets/fonts/` (OFL, grátis)
**Logo**: Placeholder em `apps/api/assets/brand/logo.png` (trocar quando o usuário enviar)

**Endpoint**:
```
GET /activities/{id}/export?template=card|story
POST /activities/{id}/export/photo  # upload da foto + retorna PNG
```

**Cache**: salva PNG em `apps/api/data/exports/{activity_id}_{template}.png`

### Frontend
- Botão "Compartilhar" na página de detalhe da atividade
- Preview dos 3 templates
- Botão de download do PNG

### Checklist Sprint 6
- [ ] `pyproject.toml`: adicionar `Pillow`, `staticmap`
- [ ] `rendering/static_map.py` (mapa PNG com route)
- [ ] `rendering/card.py` (1080×1080)
- [ ] `rendering/story.py` (1080×1920)
- [ ] `rendering/overlay.py` (foto + stats)
- [ ] `routers/exports.py`
- [ ] Frontend: botão compartilhar + modal de preview
- [ ] Commit

---

## Sprint 7 — Polimento

**Objetivo**: Refinar UX e completar funcionalidades menores

### Checklist
- [ ] Heatmap semanal (calendário de dias × TSS)
- [ ] Filtro por período no dashboard (7d, 30d, 90d, este ano, tudo)
- [ ] Página de equipamentos (`/equipment`): listar tênis/bikes com km acumulados
- [ ] Trocar logo placeholder pelas imagens reais (quando usuário enviar)
- [ ] Responsividade mobile completa (testar em 375px)
- [ ] Modo claro/escuro (já preparado no Tailwind com tokens)
- [ ] Testar com FIT real do Garmin (validar parser)
- [ ] Verificar zonas FC vs Garmin Connect (tolerância ±5%)
- [ ] Commit final de polimento

---

## Notas Técnicas Importantes

### API sempre em:
- `http://localhost:8000`
- Frontend proxy: `next.config.mjs` rewrite `/api/*` → `http://localhost:8000/*`

### Banco de dados:
- Neon Postgres (`wispy-mountain-04630520`)
- Migrations: `uv run alembic upgrade head` (rodar do diretório `apps/api`)
- IDs de migration: `001_initial`, `002_activities`, `003_records`, `004_daily_metrics`

### Arquivos NÃO commitados:
- `.env` (credenciais reais)
- `apps/api/data/` (uploads, exports, logs)
- `.venv/`, `node_modules/`, `.next/`

### Modelos SQLAlchemy existentes:
- `User`, `AthleteProfile`, `UserIntegration` → `models/user.py`
- `Activity`, `ActivityPoint`, `ActivityLap` → `models/activity.py`
- `PersonalRecord` → `models/record.py`
- `DailyMetric` → `models/daily_metric.py`

### Dependências Python instaladas:
```toml
fastapi, uvicorn, sqlalchemy, alembic, pydantic-settings
fitparse, gpxpy, python-multipart
argon2-cffi, cryptography (Fernet), python-jose
structlog, psycopg[binary]
```

### Dependências Frontend instaladas:
```json
next@14.2.33, react@18, tailwindcss@3
recharts@2.13.0, react-leaflet@4.2.1, leaflet@1.9.4
@types/leaflet
```

---

## Custo: R$ 0 (regra absoluta)
Nenhuma decisão pode exigir cartão de crédito. Tudo no free tier:
- Neon (500MB, 191h compute/mês)
- OSM tiles (uso pessoal, sem API key)
- garminconnect lib (login normal, sem developer account)
- Pillow + staticmap (100% local, sem serviço pago)
