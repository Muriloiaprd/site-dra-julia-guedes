# Ondilow — Planejamento por fases (2026-09-18)

**Criado em**: 2026-09-18
**Status**: Aprovado, execução não iniciada (Fase 0 concluída ao criar este documento).
**Relacionados**: [`BACKLOG.md`](./BACKLOG.md) · [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md) · [`PLANEJAMENTO.md`](./PLANEJAMENTO.md) (fechado em 2026-09-15) · [`PLANEJAMENTO_ATIVIDADES.md`](./PLANEJAMENTO_ATIVIDADES.md) (fechado em 2026-09-17)

## Como retomar
Quando o usuário pedir para retomar este planejamento:
1. Ler este documento inteiro.
2. Conferir no código se algo mudou desde a data acima (commits novos, itens já resolvidos).
3. Apresentar um resumo com análise: o que continua válido, o que mudou e por qual fase seguir.
4. Só executar depois da confirmação do usuário, fase por fase.

**Combinado válido a partir deste documento**: todo planejamento pedido pelo usuário vira um documento próprio em `Ondilow/docs/`, nomeado pela data do dia (`PLANEJAMENTO_AAAA-MM-DD.md`; um segundo no mesmo dia vira `_2`, etc.). Documentos antigos não são editados — um novo planejamento é sempre um novo arquivo. Cada fase executada termina em commit local **e** push para o GitHub.

---

## Contexto

O Ondilow fechou todos os itens P0 e P1 do backlog em 2026-09-15. O que sobrou são as 4 frentes que o usuário escolheu levar até o fim: a rota que invade os ícones no gerador de Stories (combinado para a noite de 17/09), acessibilidade + PWA, o perfil incompleto e o deploy público. Este plano ordena essas frentes pelo caminho de menor risco, com cada fase fechando em um commit que funciona sozinho.

Duas decisões do usuário já incorporadas: no modelo "Rota + ícones" a caixa de projeção encolhe (em vez de halo nos ícones), e unidades km/mi ficam fora do escopo em definitivo.

## O que a investigação mudou no plano

Três achados que alteraram decisões:

1. **A rota não estoura a caixa.** `projectRoute()` já garante que os vértices fiquem dentro da box. O que invade os ícones é a tinta: linha de 9px + glow. O sangramento real é **39,6px** por borda (`4,4 × lineWidth`), não os ~28px calculados inicialmente — a sombra do Canvas se espalha para além do valor de `shadowBlur`. A conta da caixa nova usa o número conservador.
2. **Existe um bloqueador de deploy que ninguém tinha visto: memória, não tempo.** `recompute_all_records()` carrega todas as atividades **com todos os pontos GPS** de uma vez. Com ~300 atividades isso é da ordem de 360 mil objetos vivos, 200–400MB — dentro de um container de 512MB é OOM provável. Nunca apareceu porque a máquina de desenvolvimento tem RAM sobrando. A otimização de 57s→8,6s (ver `PLANEJAMENTO.md`, Fase 4) atacou o número de consultas, não a memória.
3. **PWA deve vir depois do deploy, não antes.** "Instalável" só se verifica de verdade num celular apontando para uma URL HTTPS pública. Antes do deploy, manifest e ícone seriam escritos no escuro.

---

## Fase 1 — Rota dos Stories

O problema: em `regions.ts`, a constante `route` acumula dois papéis conflitantes — é a área que se **apaga** da arte e também a área onde a rota é **projetada**. Como os 4 ícones do modelo `rota-icones` ficam 100% dentro dela, a rota tem licença para chegar até eles.

**A mudança:** separar os dois papéis.

- `route` continua sendo só a área apagada. Não renomear: a ferramenta `app/(dev)/story-art-probe` emite literais com esse nome, e um rename criaria divergência silenciosa na próxima medição.
- Novo campo `routePlot` = área de projeção, declarado **explicitamente nos 3 layouts com rota**, mesmo onde for igual a `route`. Nada de `?? R.route` como fallback — isso esconderia quais layouts foram conferidos.

**Números** (`apps/web/lib/story/regions.ts`):

| Layout | `route` (apagar) | `routePlot` (projetar) | Tinta máx. | Folga |
|---|---|---|---|---|
| `rota-icones` | `{74, 572, 622, 886}` (inalterado) | **`{74, 572, 488, 886}`** | x=562,6 | ícones em x=574 → **+11,4px** |
| `rota-faixa` | `{250, 509, 636, 899}` | igual a `route` | x=874,7 | sem vizinho à direita |
| `stats-direita` | `{577, 1006, 405, 572}` | igual a `route` | y=1563,0 | logo em y=1573,7 → +10,7px |

Só o `rota-icones` muda de número. A rota fica 21,5% mais estreita **apenas em rotas landscape** — para percurso quadrado ou vertical (a maioria: loop de bairro, ida-e-volta), a altura continua sendo o eixo limitante e a rota sai idêntica à de hoje.

**Não mexer em `marginRatio`.** Chegar ao mesmo resultado por margem exigiria 27,9%, o que encolheria a altura em 34% também. Encolher a caixa é estritamente superior.

**Guard-rail estrutural:** `drawRoute()` em `engine.ts` ganha um `clip?: Box` opcional, aplicado logo após o `ctx.save()` que já existe (o `restore()` da linha 160 já desfaz). O clip usa a **área apagada**, não a `routePlot` — clipar na `routePlot` cortaria o glow com aresta dura, visualmente pior que o problema original. Na área apagada o clip fica a ≥5,4px da tinta em todas as bordas, ou seja, **nunca dispara em operação normal**: é uma rede que só age se alguém no futuro re-alargar a caixa ou aumentar a espessura da linha. Exportar `ART_CLEAR_PAD = 6` de `art.ts` (hoje é um `const PAD` local) para derivar o clip sem duplicar o número.

**Dois micro-fixes de carona, no mesmo arquivo:**
- A chave de cache de `buildArtLayer` (`art.ts:106`) ignora o array `noTint`. Hoje é latente; vira bug real no primeiro layout que passar `noTint` diferente com `rects` iguais. Uma linha.
- Registrar no backlog (não corrigir agora) que `layerCache` não tem limite: cada entrada é um canvas de ~8,3MB e o Map sobrevive ao fechamento do modal. Em Safari iOS o sintoma de estouro é canvas em branco sem erro no console.

**Arquivos:** `lib/story/regions.ts`, `lib/story/engine.ts`, `lib/story/art.ts`, `lib/story/layouts/{rotaIcones,rotaFaixa,statsDireita}.ts`.

**Commit:** `fix(ondilow): separa caixa de projecao da rota da area apagada`

---

## Fase 2 — Contraste AA (micro-fase)

Puxada da frente de acessibilidade de propósito, para que a UI nova das Fases 3–4 não nasça já reprovada.

`textTertiary #6E6E6E` é o **único** token de texto que falha AA (~3,7:1). Trocá-lo por um tom ≥4,5:1 faz as 31 ocorrências em 18 arquivos herdarem. `muted #888888` já passa e não muda.

Atenção: o token vive duplicado em `tailwind.config.ts` e `lib/theme.ts` (confirmar se `globals.css` também o define antes de assumir 3 arquivos). Tratar individualmente os hex inline em `WeekStrip.tsx:105,128,131` e `predictions/page.tsx:203`.

Isto **não** é busca e substituição cega: em alguns pontos o texto está sobre superfície clara ou sobre o acento, onde clarear *piora* o contraste. Revisar as telas afetadas no browser.

**Commit:** `fix(ondilow): textTertiary atinge contraste AA`

---

## Fase 3 — Perfil, backend

Vem antes da acessibilidade porque adiciona superfície de UI nova — auditar a11y antes disso seria retrabalho garantido.

Boa notícia: **provavelmente não precisa de migration nenhuma.** `hr_zones` já existe como coluna JSONB, já está em `ProfileOut`/`ProfileUpdate`, e `GET /activities/{id}/zones` já dá precedência a ela sobre `default_hr_zones(max_hr)`. O backend de zonas customizadas está pronto.

1. **Validar `hr_zones`.** Hoje é `dict | None` sem schema, e o `PUT /profile` faz `setattr` cego — o frontend pode gravar qualquer JSON e a explosão acontece depois, em `hr_zone_distribution`, virando "Erro interno". É o maior risco silencioso desta frente. Criar um modelo Pydantic: 5 faixas, monotônicas, cobrindo 0→max, bpm inteiros.
2. **`POST /auth/change-password`.** Reaproveita `hash_password`/`verify_password` de `security.py`. Enquanto estiver no arquivo: `verify_password` só captura `VerifyMismatchError`, então um hash corrompido vira 500 em vez de 401 — adicionar `VerificationError` ao except. Avisar na UI que trocar a senha **não** derruba sessões em outros aparelhos (não há blacklist; o token vale 7 dias).
3. **`DELETE /auth/account`.** Confirmado cascade para `profile` e `integrations`, mas **não** para `Activity`, `Point`, `PersonalRecord`, `DailyMetric`, `Equipment` e as tabelas do coach. Medir isso antes de escrever código. Preferir **delete explícito e ordenado dentro de uma transação** em vez de migration alterando FKs: não depende do estado do schema, dispensa a migration 011 e é auditável.
4. **Exportar todos os dados.** Do zero (o `routers/exports.py` antigo foi removido). Armadilha conhecida: `StreamingResponse` + sessão do SQLAlchemy — a dependency com `yield` fecha a sessão no teardown, e o body do stream é consumido depois, dando "Session is closed" no meio do arquivo. Testar com as 300 atividades reais, não com 3.

**Antes de tudo isso:** `apps/api/tests/` não tem `conftest.py` nem um único teste de router. Vale gastar ~40 min criando um `conftest.py` com `TestClient` contra o Postgres do `docker-compose.yml` (que já existe) — senão tudo desta fase nasce sem rede de segurança.

**Commit:** `feat(ondilow): troca de senha, exclusao de conta, zonas validadas e export de dados`

---

## Fase 4 — Perfil, frontend

UI para os quatro endpoints da Fase 3, em `app/profile/page.tsx`.

- Editor de zonas de FC. Hoje `profile/page.tsx:215-219` **re-implementa as faixas em JS** só para exibição — resolver a duplicação ao permitir edição.
- Troca de senha e exclusão de conta entram na "zona de perigo" que já existe, seguindo o padrão de confirmação por digitação de `deleteAllActivities()`.
- Botão de exportar dados.
- De carona: o tipo `Profile` em `lib/api.ts` está defasado — faltam `dob`, `sex`, `height_cm`, `hr_zones`, `vo2max_estimated`.

**Commit:** `feat(ondilow): UI de zonas de FC, senha, exclusao de conta e export`

---

## Fase 5 — Acessibilidade

Agora que a superfície parou de mudar. É a frente de maior raio de alcance.

- **Landmarks:** `AppShell.tsx` (11 linhas) não usa `<main>`. Adicionar `<main id="conteudo">` + skip-link. Não existe `sr-only` no projeto.
- **Foco nos gráficos:** `globals.css:704-708` remove ativamente o outline dentro do Recharts. Reverter **antes** de qualquer outra coisa — mas revisar ao vivo, porque o outline volta a aparecer em 8 gráficos, em situações que nunca foram testadas (tooltip ativo, hover em célula).
- **`accessibilityLayer`** nos 4 arquivos com Recharts (o projeto está no 2.13, o recurso existe desde o 2.10). Não é só um atributo: liga navegação por setas e muda o comportamento do tooltip. **Ligar um gráfico por vez** e verificar — dentro de `ResponsiveContainer` em container com scroll pode causar scroll-jump ao focar.
- **Sheet "Mais"** (`Sidebar.tsx:230-250`): sem `role="dialog"`, focus trap nem Escape. O padrão já existe em `ActivityModal.tsx` — copiar de lá, que já lida com o fechamento por `pathname`.
- **Dois `<nav aria-label="Navegação principal">`** simultâneos no DOM (desktop + mobile). Diferenciar os nomes.
- **Não mexer** na atribuição do Leaflet (`globals.css:676`, 9px) para "resolver" contraste: é obrigação legal do OSM/Stadia e aumentá-la quebra o layout do mini-mapa.

**Commit:** `fix(ondilow): acessibilidade - landmarks, foco e navegacao nos graficos`

---

## Fase 6 — API pronta para deploy (só código)

Separada da Fase 7 de propósito: é 100% local e testável, e se a plataforma travar por motivo externo, este trabalho já está commitado e melhora o app local.

1. **Memória — o bloqueador real.** `recompute_all_records()` (`metrics/records.py`) usa `selectinload(Activity.points)` e materializa tudo. Duas correções: **(a)** tirar do caminho do request, movendo para `BackgroundTasks` com uma `SessionLocal()` própria (não reusar a sessão da dependency, que é fechada no fim do response) — o request passa a responder em ~50ms; **(b)** não materializar pontos: `_record_candidates` só precisa de `elapsed_time_s` e `distance_m`, então trocar por `select` de tuplas. A (a) sempre; a (b) é o que faz caber em 512MB.
2. **Disco, 3 pontos.** `main.py:30-31` → **apagar as duas linhas** (são redundantes: `_persist_raw` e `configure_logging` já fazem seus próprios `mkdir`). `logging_setup.py` → nova setting `log_to_file: bool = True`, movendo o `mkdir` **e** o handler para dentro do branch; o `StreamHandler(sys.stdout)` fica sempre. `_persist_raw` → nova setting `persist_raw_uploads: bool = False`. `file_path` é **write-only**: é gravado e nunca lido por nenhum código. Não mandar para o Postgres (o Neon free tem ~0,5GB e os pontos GPS já ocupam uma fatia) e não apagar o código (local, o arquivo original tem valor de arquivo morto).
3. **Fail-fast dos segredos.** `@model_validator(mode="after")` em `Settings`: fora de `dev`, recusar `JWT_SECRET_KEY` igual ao default ou com menos de 32 caracteres, e `DATABASE_URL` apontando para localhost. Melhor um deploy que não sobe do que uma API pública com segredo conhecido. Não quebra dev nem os 33 testes (o default de `app_env` é `dev`).
4. **`apiFetch` sem timeout** (`lib/api.ts:147`): adicionar `AbortSignal.timeout(60000)` e um estado "acordando o servidor…" após 3s, para o cold start não virar skeleton infinito.
5. **Higiene:** apagar os 7 PNGs órfãos de `apps/api/data/exports/`, atualizar o `.env.example` da raiz (faltam as 5 chaves de IA) e criar `apps/web/.env.example`.

**Commit:** `refactor(ondilow): API sem dependencia de disco, com fail-fast e recompute em background`

---

## Fase 7 — Deploy público

```
Browser → Vercel Hobby (Next.js, runtime Node, root apps/web)
            │ rewrite /api/:path*  (next.config.mjs inalterado)
            ▼
          Render Free (FastAPI, root apps/api)
            ▼
          Neon (Postgres, já existe)
```

**Por que assim:** Vercel Hobby tem timeout de 10s por request, o que elimina a API (há uma operação medida em 8,6s), mas é irrelevante para o Next.js, cujas páginas são client-side. Render free não pede cartão, aceita `uv`, e não tem timeout curto de request. Koyeb foi descartado por poder exigir cartão — viola a regra dura do projeto. Hugging Face Spaces fica como plano B documentado (16GB de RAM resolveria a memória de vez, mas o Space é público por padrão e sem garantia de uptime).

Manter o rewrite mantém **CORS irrelevante** (o browser nunca fala com a API direto) e não cria origem cruzada por onde o token vaze.

**Cold start resolvido, não tolerado:** Render free dorme após 15min, e "algumas visitas por dia" significa pagar 30–50s em praticamente toda visita. A quota é de **750h/mês e o mês tem 720h** — dá para manter acordado 24/7 de graça com um ping em `GET /health` a cada ~10 min via **cron-job.org** (gratuito, sem cartão). Não usar GitHub Actions para isso: o cron atrasa 15+ min sob carga e workflows agendados são desativados após 60 dias sem atividade no repo.

**Build:** `pip install uv && uv sync --frozen --no-dev`, start com `uv run uvicorn ... --host 0.0.0.0 --port $PORT`. Mantém `uv.lock` como fonte única, sem risco de drift. Fallback se o build brigar com uv: `uv export` para um `requirements.txt` commitado e marcado como gerado. **Criar `apps/api/.python-version` com `3.12`** — `requires-python` não fixa o runtime e o default do Render pode ser 3.11.

**Checklist de coisas que só existem por ser público:**
- `NEXT_PUBLIC_STADIA_API_KEY` vai no bundle do cliente (sempre foi, mas em localhost ninguém via). Configurar allowlist de domínio no painel da Stadia **antes** de publicar.
- Vercel com monorepo pnpm: root `apps/web` + "include files outside root directory", senão o `pnpm-workspace.yaml` não é enxergado.
- O free tier do Render não tem pre-deploy hook: `alembic upgrade head` continua rodando da máquina local contra o mesmo Neon. Esquecer disso faz a API subir e quebrar com `UndefinedColumn`, que o handler global converte em "Erro interno" — falha silenciosa. Vai para o runbook.
- Gerar `JWT_SECRET_KEY` novo **invalida todos os tokens** — logout em todos os aparelhos no primeiro deploy.
- Não configurar `INITIAL_USER_EMAIL`/`INITIAL_USER_PASSWORD` no Render se forem só de seed.
- **Medir, não assumir:** não está documentado de forma inequívoca se o rewrite da Vercel para URL externa passa pela camada de roteamento (sem limite) ou por uma função (10s). Depois do deploy, medir com `curl -w '%{time_total}'` contra `/api/health` durante um cold start. Se cortar em 10s, o plano B é o front chamar a origem do Render direto — e aí CORS volta a importar.

**Commit:** `chore(ondilow): configuracao de deploy Vercel + Render`

---

## Fase 8 — PWA

Depois do deploy, para que cada ajuste seja verificável no celular em minutos.

- `manifest.webmanifest` + `metadata.manifest` e `appleWebApp` em `app/layout.tsx` (hoje o metadata tem só title e description; `viewport` com themeColor já existe).
- **Ícones:** a melhor fonte é `Ondilow/Imagens/Somente o Icone.png` (1254×1254, quadrado), que está fora de `public/` — precisa ser copiado. O ícone maskable exige **~10% de padding**: sem isso o Android corta no círculo adaptativo. É re-enquadrar, não só redimensionar — mesma classe de risco do bug de recolor que deformou a logo antes (ver `PLANEJAMENTO_ATIVIDADES.md`, Fase 4).
- **Fontes locais:** `layout.tsx` carrega Poppins **600, 700, 800, 900** do Google, mas `public/fonts/` só tem **700 e 900**. Trocar sem baixar 600 e 800 faz o browser sintetizar os pesos (faux bold) — degradação sutil que nada acusa.
- `viewportFit: "cover"`: a bottom nav já usa `env(safe-area-inset-bottom)`, mas o topo não usa `safe-area-inset-top`. Verificar em aparelho real.
- **Sem service worker.** Manifest + ícones + `appleWebApp` já entregam "instalável" nos dois sistemas. Um SW aqui é o pior modo de falha possível: serve HTML velho após deploy e, com token em localStorage, vira "app quebrado" sem sintoma diagnosticável.

**Commit:** `feat(ondilow): PWA instalavel - manifest, icones e fontes locais`

---

## Fase 9 — Garmin/Strava: investigação de 2h, não fase de entrega

Três fatos que impedem prometer isso como feature:

1. **MCP roda na máquina local, não no servidor.** Nunca vira sincronização automática — vira "o usuário pede e o Claude importa". Depois do deploy fica mais estranho ainda: a máquina local fazendo POST contra a API pública.
2. **Garmin é dependência externa hostil** (a própria doc do projeto registra o bloqueio da API não oficial). Com MFA na conta, o login não oficial morre.
3. **O MCP do Strava é o mesmo OAuth já descartado** em 2026-09-15 (ver `PLANEJAMENTO.md`), com outra embalagem: app registrado, client id/secret, callback.

**O entregável real não precisa de MCP nenhum:** validar `POST /activities/import-normalized` com um payload JSON montado à mão. O endpoint existe, o enum `strava_api`/`garmin_api` existe, e **nunca foi exercitado** — não há teste de router no projeto. Se funcionar, qualquer MCP vira adaptador trivial; se tiver bug, descobre-se em 20 minutos em vez de na quarta hora brigando com autenticação.

Três saídas aceitáveis: endpoint validado + relatório de viabilidade; um dos MCPs funciona e vira fase real com escopo conhecido; nenhum funciona e o item é fechado no backlog com o motivo registrado.

---

## Verificação

Cada fase termina com `npx tsc --noEmit` (web) e `uv run pytest` + `uv run ruff check ondilow_api` (api) passando, e verificação no browser via preview `ondilow` do `.claude/launch.json`, conta `teste@teste.com`.

**Fase 1 exige verificação específica** — o preview escalado esconde 10px, então é preciso **baixar o PNG** e inspecionar a faixa x∈[555,600] na imagem exportada:
1. Rota **landscape extrema** (ida-e-volta numa avenida): é o único caso em que o pior caso da conta acontece. Sem esse teste, a verificação não vale.
2. Rota quadrada: confirmar que **nada mudou** em relação ao build anterior.
3. Atividade de ciclismo: aciona o caminho de recolor, que é código diferente e já deformou a logo no passado.
4. Com foto arrastada e com "fundo transparente" ligado.
5. Os 3 layouts com rota, não só o `rota-icones`.
6. Bug latente a checar de carona: quando `loadArt(LOGO_HI_RES)` falha (catch silencioso em `StoryGenerator.tsx:52`), a logo não é apagada e a rota é desenhada por cima dela. Testar bloqueando `/story-art/logo.png`.

**Fase 6:** medir a memória residente do processo durante um `recompute_all_records` com as 300 atividades reais, não com a conta de teste.

**Fase 7:** `curl -w '%{time_total}'` contra `/api/health` durante um cold start, para decidir se o rewrite da Vercel aguenta.

---

## Fora de escopo (registrado para não sugerir de novo)

- **Unidades km/mi** — ~45 pontos de código em 16 arquivos, sem uso real (o usuário treina em km).
- Já descartados antes: infra de testes ampla, CI, meta/prova-alvo, Strava OAuth direto, Fase 5 do gerador de Stories.
