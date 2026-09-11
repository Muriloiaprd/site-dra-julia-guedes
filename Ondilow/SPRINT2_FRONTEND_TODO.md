> ⚠️ **Doc obsoleto.** Este checklist já foi totalmente implementado (Sprint 2 está ✅ em `ESTADO_DO_PROJETO.md`) e nunca foi marcado. Mantido só como histórico de decisões técnicas (ex. "importar `leaflet/dist/leaflet.css`"). Para o que falta hoje, veja [`BACKLOG.md`](./BACKLOG.md).

# Sprint 2 Frontend — Dashboard v1 (histórico)

**Status**: Concluído (não refletido nos checkboxes abaixo)  
**Libs instaladas**: recharts@2.13.0, react-leaflet@4.2.1, leaflet@1.9.4, Next.js 14.2.33

---

## Checklist de Implementação

### 1️⃣ Expandir `lib/api.ts`
- [ ] Função `fetchActivities(limit, offset, sport?)` → chama `GET /activities`
- [ ] Função `fetchActivity(id)` → chama `GET /activities/{id}`
- [ ] Função `fetchSplits(activityId, splitM?)` → chama `GET /activities/{id}/splits`
- [ ] Função `fetchZones(activityId)` → chama `GET /activities/{id}/zones`
- [ ] Função `fetchRecords()` → chama `GET /records`
- [ ] Função `fetchProfile()` → chama `GET /profile`

### 2️⃣ Dashboard Page (`app/dashboard/page.tsx`)
- [ ] Layout: header com logout + seção de atividades
- [ ] Lista paginada de atividades (50 por página)
  - [ ] Cards de cada atividade (data, sport, distância, duração, elevação)
  - [ ] Filtro por modalidade (dropdown ou tabs)
  - [ ] Paginação (prev/next)
- [ ] Resumo de recordes (últimos 5 PRs quebrados)
- [ ] Estatísticas rápidas (total km mês, atividades semana, etc.)
- [ ] Botão de upload de atividade (link para `/upload` — para Sprint futuro)

### 3️⃣ Activity Detail Page (`app/activities/[id]/page.tsx`)
- [ ] Layout: breadcrumb + back button + activity header
- [ ] Seção de metadados (data, hora, duração, distância, elevação, modalidade)
- [ ] **Mapa Leaflet** (react-leaflet)
  - [ ] Importar CSS do Leaflet (crítico!)
  - [ ] Renderizar traçado GPS (polyline ou GeoJSON dos pontos)
  - [ ] Marker de início/fim
  - [ ] Tiles OSM (OpenStreetMap)
- [ ] **Gráficos com Recharts**
  - [ ] Pace/Velocidade vs tempo (LineChart)
  - [ ] HR vs tempo (LineChart com área)
  - [ ] Elevação vs distância (AreaChart)
- [ ] **Splits table**
  - [ ] Coluna: km, tempo, pace/velocidade, HR médio, elevação
- [ ] **Zonas de FC** (se max_hr configurado no perfil)
  - [ ] BarChart com distribuição (Z1, Z2, Z3, Z4, Z5)

### 4️⃣ Componentes UI (shadcn/ui)
- [ ] Button (em vários lugares)
- [ ] Card (activity cards, sections)
- [ ] Table (splits, records)
- [ ] Skeleton (loading states enquanto busca API)
- [ ] Alert (mensagens de erro)
- [ ] Tabs (filtros, seções de gráficos)
- [ ] Badge (sport badge, zone badges)

### 5️⃣ Estilo & Layout
- [ ] Tailwind aplicado (tema escuro conforme `tailwind.config.ts`)
- [ ] Responsividade mobile (telas pequenas)
- [ ] Loading skeleton enquanto dados chegam da API

### 6️⃣ Validação
- [ ] ✅ Login funciona, JWT salvado no localStorage
- [ ] ✅ Dashboard lista atividades corretamente (chama GET /activities)
- [ ] ✅ Detalhe carrega atividade + splits + zonas (3 chamadas API independentes)
- [ ] ✅ Mapa renderiza corretamente (não aparece em branco = CSS carregado)
- [ ] ✅ Gráficos aparecem e são responsivos
- [ ] ✅ Filtro por modalidade funciona (recarrega lista)
- [ ] ✅ Paginação avança/retrocede
- [ ] ✅ Sem erros no console do navegador

### 7️⃣ Git & Commit
- [ ] Verificar se backend está rodando (`uvicorn` ou em background já)
- [ ] Verificar se frontend conecta ao backend (Network tab do DevTools)
- [ ] Fazer commit de toda a Sprint 2:
  ```bash
  git add Ondilow/
  git commit -m "feat: Sprint 2 Frontend — Dashboard v1 com mapa e gráficos
  
  - Expandir API client (fetchActivities, fetchActivity, fetchSplits, fetchZones)
  - Dashboard com lista paginada, filtro por sport, resumo de recordes
  - Activity detail com Leaflet map (OSM tiles) e Recharts graphs
  - Splits table e zonas de FC se max_hr configurado
  - Componentes shadcn/ui (Button, Card, Table, Badge)
  - Loading skeletons e responsividade mobile
  
  Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
  ```

---

## Decisões técnicas (já validadas)

- **Mapa**: Leaflet + react-leaflet + tiles OSM (gratuito, uso pessoal ok)
- **Gráficos**: Recharts (leve, interativo)
- **API calls**: SWR ou fetch direto com useState (simples pro MVP)
- **Leaflet CSS**: **CRÍTICO** — sem isso o mapa aparece em branco
  - Importar em `app/layout.tsx` ou no componente Leaflet:
    ```tsx
    import 'leaflet/dist/leaflet.css'
    ```

---

## Próximas fases

- **Sprint 3**: Métricas de carga (CTL/ATL/TSB/ACWR)
- **Sprint 4**: Previsões (tempo de prova, risco de lesão)
- **Sprint 5**: Garmin Connect sync
- **Sprint 6**: Gerador visual (card/story/overlay com Pillow)

---

## API disponível (confirmado no Sprint 1)

Todos os endpoints já existem e retornam dados corretos:

```
POST   /auth/login
GET    /auth/me
GET    /activities
GET    /activities/{id}
GET    /activities/{id}/splits?split_m=1000
GET    /activities/{id}/zones
GET    /profile
PUT    /profile
GET    /records
POST   /activities/upload  (para Sprint 3)
```

---

**Próximo passo**: Abrir o editor, expandir `lib/api.ts` com as 6 funções → depois construir dashboard → depois detalhe com mapa e gráficos.
