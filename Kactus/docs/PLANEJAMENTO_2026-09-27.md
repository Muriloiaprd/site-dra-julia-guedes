# Kactus — Planejamento: logos, tempo em movimento e check-in (2026-09-27)

**Criado em**: 2026-09-27
**Status**: ABERTO. Nenhuma fase além da 0 foi executada.
**Relacionados**: [`BACKLOG.md`](./BACKLOG.md) · [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md) · [`PLANEJAMENTO_2026-09-26.md`](./PLANEJAMENTO_2026-09-26.md) (rebrand, fechado)

## Como retomar
Quando o usuário pedir para retomar este planejamento:
1. Ler este documento inteiro.
2. Conferir no código se algo mudou desde a data acima.
3. Apresentar um resumo com análise: o que continua válido, o que mudou e por qual fase seguir.
4. Só executar depois da confirmação do usuário, fase por fase.

Cada fase termina em commit local **e** push para o GitHub (origin + espelho `kactus`).

---

## Contexto
Depois do rebrand, o usuário pediu três ajustes:
1. **Duas artes de Story têm fundo preto atrás da logo Kactus:** a 17 (Desafio, badge retangular) e a 4 (Logo lateral, faixa vertical). A logo deve ficar direto sobre a foto. Favicon e ícone do iPhone ficam como estão (decisão do usuário).
2. **Tempo:** a captação deve usar sempre o **tempo em movimento**, não o tempo decorrido.
3. **Check-in "Como foi o treino?":** ganhar opções prontas em botões por categoria, salvas como etiquetas que a Duni lê. O texto livre fica só para o que for fora do normal.

Pela regra de planejamento por data, o plano vira `Kactus/docs/PLANEJAMENTO_2026-09-27.md`. Cada fase termina em commit, `git push` e sincronização do espelho `kactus`, usando o commit-ponte (ver `PLANEJAMENTO_2026-09-26.md`, Fase 7).

## O que a investigação mostrou

**Fundo preto** (pixels opacos com RGB < 60):
- `public/story-art/desafio.png`: badge em x62 y1797 335x94.
- `public/story-art/logo-lateral.png`: faixa em x960 y108 120x459.
- As outras 17 artes e os PNGs de `public/brand/` não têm preto.
- Na era Ondilow, o badge do Desafio já tinha sido removido por chroma key a pedido do usuário. É o mesmo pedido de novo.

**Tempo em movimento hoje:**
- O banco tem `duration_s` (decorrido) e `moving_time_s`. Ritmo e velocidade médios já usam `moving_time_s or duration_s` (`services/import_service.py:229,238`).
- **O `moving_time_s` só existe para FIT**, e mesmo lá é o `total_timer_time`, que só desconta pausas do relógio. Conferido em 5 FITs reais: em 3 deles timer = decorrido (27m57s nos dois), ou seja, paradas sem auto-pause não são descontadas. Os FITs não trazem `total_moving_time`.
- **GPX e TCX não calculam nada**: `moving_time_s` fica nulo e tudo cai no decorrido. Uploads atuais: 176 GPX, 42 TCX, 5 FIT e 422 `.gz` (FIT do Strava). Os arquivos originais ficam em `apps/api/data/uploads/`, então dá para recalcular.
- **Usam o decorrido e precisam mudar:**
  - **Carga (TSS)** (`metrics/load.py:44`, `duration_h = activity.duration_s / 3600`, que alimenta CTL/ATL/TSB).
  - **Telas do web:**
    - lista de atividades e totais (`app/activities/page.tsx:178,194,368,408`);
    - detalhe da atividade (`app/activities/[id]/page.tsx:266,348`: "Duração" grande, com "Em movimento" como secundário);
    - blocos do dashboard (`LastActivity.tsx:81`, `RecentActivities.tsx:110`, `ActivityModal.tsx:24,67`, `PerformanceChart.tsx:60`);
    - totais da semana (`lib/athlete.ts:59`);
    - Stories (`lib/story/metrics.ts:20`).
- **Já usam o tempo em movimento:** o contexto da Duni (`coach_service.py:354`), a análise (`athlete_analysis.py:100`) e o sRPE (`models/activity.py:123`).
- Os pontos gravados no banco são reduzidos (`GPS_DOWNSAMPLE_SECONDS`). Por isso o cálculo tem que acontecer **no parse**, com os pontos em resolução total.

**Check-in** (`components/activity/CheckinPanel.tsx`, `PUT /activities/{id}/checkin` em `routers/activities.py:307`):
- Já existem PSE, sensação (6 chips), dor com local e o texto "Observações".
- A Duni recebe `observacoes` e o resto no contexto (`coach_service.py:361-366`).
- Não há campo de etiquetas. A última migration é a `016`.

## Fases

### Fase 0: Documento
Criar `Kactus/docs/PLANEJAMENTO_2026-09-27.md` com este plano. Commit, push e espelho.

### Fase 1: Logo sem fundo preto (Stories 17 e 4)
- **Tirar o preto das duas artes:** script Pillow one-off (fica no scratchpad, não no repo) que faz "cor → alfa" do preto **só dentro da caixa da logo**. Para cada pixel: `alfa_novo = alfa × max(R,G,B)/255` e a cor dividida pelo mesmo fator. Assim a borda suavizada do texto branco não fica serrilhada nem com halo cinza.
  - Aplicar em `public/story-art/desafio.png` e `public/story-art/logo-lateral.png`.
  - Os originais em `Imagens/` não são alterados.
- **Layouts:**
  - `layouts/logoLateral.ts`: sem a faixa, o KACTUS branco fica direto na foto. Somar um escurecimento vertical suave na borda direita (`drawPhotoAndScrims`, caixa ~x900–1080, y60–620) para manter contraste em foto clara.
  - `layouts/desafio.ts`: o escurecimento de baixo (0,9) já cobre a logo.
  - `regions.ts`: atualizar os comentários ("badge preto" deixa de existir). As caixas `badge`/`logo` continuam como área protegida do recolor.
- **Conferir:**
  - `/story-calibrate?id=desafio` e `?id=logo-lateral`: a logo continua lá, sem tinta nova indevida.
  - Gerador real: com foto, sem foto e com fundo transparente.

### Fase 2: Tempo em movimento
- **Cálculo único:** `compute_moving_time_s(points, sport)` em `parsers/base.py`, com os pontos em resolução total.
  - Soma os intervalos entre pontos consecutivos em que o atleta estava se movendo.
  - Intervalo maior que 30 s conta como pausa e é descartado.
  - Velocidade: `speed_ms` do ponto ou Δdistância/Δt. Parado = abaixo de 0,5 m/s em corrida, caminhada e trilha, e abaixo de 1,0 m/s no ciclismo.
  - Sem distância nem velocidade (natação em piscina, musculação, esteira sem sensor): devolve `None`.
- **Nos parsers:**
  - FIT: `min(total_timer_time, calculado)`. O calculado sozinho quando não houver timer.
  - GPX e TCX: o calculado.
  - CSV: sem pontos, continua nulo.
  - O ritmo e a velocidade médios da importação já usam `moving_time_s`.
- **Carga:** `compute_tss` passa a usar `moving_time_s or duration_s`. O `TssInput` ganha `moving_time_s` e a query de `update_daily_metrics` passa a selecioná-lo.
- **Web:** criar `activeSeconds(a) = a.moving_time_s ?? a.duration_s` em `lib/utils.ts` e usar em todos os pontos listados acima.
  - No detalhe, o número grande vira **"Tempo em movimento"** e o decorrido vai para o secundário como "Tempo total".
  - Stories, dashboard, lista e totais mostram o tempo em movimento.
  - Conferir que o `moving_time_s` vem na listagem (`ActivitySummary` do `schemas/activity.py`) e acrescentar se faltar.
- **Recalcular o histórico:** script novo `scripts/backfill_moving_time.py`, no padrão de `backfill_derived.py` (`--dry-run`, `--email`).
  1. Relê o arquivo original de cada atividade (inclusive `.gz`, via o mesmo `parse_file`).
  2. Recalcula `moving_time_s`, `avg_pace_s_per_km` e `avg_speed_kmh`.
  3. Recalcula a carga diária (`update_daily_metrics`) e os recordes (`recompute_all_records`).
  4. Mostra antes/depois (quantas mudaram e a soma de horas).
  - Rodar primeiro com `--dry-run` na conta principal.
- **Testes:**
  - `compute_moving_time_s`: parada no meio, buraco de tempo (pausa), atividade sem GPS devolvendo `None` e limiar de bike.
  - Parsers GPX/TCX/FIT preenchendo `moving_time_s`.
  - TSS usando o tempo em movimento.
  - Rodar contra a branch Neon `test`.

### Fase 3: Opções prontas no check-in
- **Catálogo único no backend:** `CHECKIN_TAGS` em `kactus_api/checkin_tags.py`, com código → rótulo por grupo.
  - **Clima:** calor, frio, chuva, vento, umidade alta.
  - **Corpo e rotina:** dormi bem, dormi mal, estresse, em jejum, bem alimentado.
  - **Treino:** como planejado, ritmo travou, terminei forte, parei para descansar, subidas, tênis novo, em grupo, esteira.
- **Banco:** migration `017_checkin_tags.py`, com a coluna `checkin_tags` (array de texto, nula) em `activities`, e o modelo atualizado.
- **API:**
  - `CheckinInput` ganha `tags: list[str] = []`, validado contra o catálogo (código desconhecido → 422).
  - `put_checkin` grava as etiquetas, e só etiquetas já contam como check-in preenchido.
  - `ActivityDetail` devolve `checkin_tags`.
  - `GET /activities/checkin-tags` devolve o catálogo, para o web não duplicar a lista.
- **Duni:** no contexto da atividade (`coach_service.py`, perto de `observacoes`), acrescentar `"contexto": [rótulos]`. Registrar no prompt, em uma linha, que são marcações rápidas do atleta.
- **Web** (`CheckinPanel.tsx`):
  - Três grupos de chips (mesmo estilo `od-chip`/`is-active` da sensação) entre "Como o corpo respondeu" e "Observações".
  - Novo placeholder do texto: "Algo fora do normal? (opcional)".
  - O `CheckinSummary` mostra as etiquetas marcadas como chips.
  - `lib/api.ts` ganha os tipos e o fetch do catálogo.
- **Testes:** salvar com etiquetas, etiqueta inválida (422), só etiquetas contando como check-in, e o contexto da Duni trazendo os rótulos.

### Fase 4: Fechamento
Atualizar `docs/ESTADO_DO_PROJETO.md` (sessão 2026-09-27), `docs/BACKLOG.md` se algo sobrar e as memórias do gerador e do projeto. Fechar o planejamento.

## Verificação
- **API:** `uv run pytest` na branch `test`. Ruff sem erro novo (a base tem 25 avisos antigos).
- **Web:** `pnpm exec tsc --noEmit`, depois `preview_start kactus`, logado pela conta de teste com JWT gravado em `kactus_token`.
- **Logo:** `/story-calibrate` nos modelos 17 e 4, e o gerador com foto clara, com foto escura e com fundo transparente.
- **Tempo:**
  - Uma atividade com parada: o detalhe mostra o tempo em movimento menor que o total, e o ritmo bate com distância ÷ tempo em movimento.
  - Lista, dashboard e Stories mostram o mesmo tempo.
  - O backfill em `--dry-run` e depois de verdade mostra as contagens. A carga (CTL/ATL) muda de forma coerente.
- **Check-in:** marcar só chips e salvar; editar; ver no resumo; pedir um comentário da Duni e conferir que ela considera as etiquetas.
