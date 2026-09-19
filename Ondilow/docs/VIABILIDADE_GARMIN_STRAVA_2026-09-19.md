# Viabilidade: importar treinos do Garmin/Strava sem arquivo manual

**Data:** 2026-09-19 · **Origem:** Fase 9 do `PLANEJAMENTO_2026-09-18.md` (investigação, não entrega)
**Status:** investigação concluída. Endpoint validado; solução recomendada definida; **nada instalado, nada autenticado**.

---

## Resumo

O caminho recomendado **não é um MCP**. É um script de sync local que baixa o `.FIT` original do
Garmin e o entrega ao parser que o projeto já usa. O MCP é a ferramenta errada para mover séries
de GPS, pelo motivo explicado em "Por que não MCP".

Duas premissas registradas no projeto estavam **erradas** e foram corrigidas aqui (ver "Correções").

---

## 1. Endpoint `POST /activities/import-normalized` — VALIDADO

Existia desde o Sprint de import e **nunca tinha sido exercitado**. Agora tem 9 testes
(`apps/api/tests/test_import_normalized_router.py`). Resultado: **funciona, sem bugs encontrados.**

Confirmado por teste:

| Comportamento | Resultado |
|---|---|
| Cria atividade com pontos e voltas | OK |
| Normaliza nome de esporte da fonte (`running`→`run`, `TrailRun`→`trail_run`) | OK |
| Dedup por `source_activity_id` (reimportar não duplica) | OK |
| Deriva distância, FC média/máxima e elevação quando a fonte só manda streams | OK |
| Derivação lê a série **completa**, antes do downsample | OK (pico em `t=1`, que o downsample descarta, é capturado) |
| Resumo explícito da fonte tem precedência sobre a série | OK (documentado em teste) |
| Alimenta PRs (`fastest_5k`, `longest_run`) e carga diária | OK |
| Recusa `source` fora de `garmin_api`/`strava_api`/`manual` | 422 |
| Exige autenticação | 401 |
| Payload mínimo sem GPS (esteira) | OK |

**Custo medido** (12 atividades de 5 km a 1 Hz, sequenciais, branch Neon `test`):
~0,9 s por atividade, **sem degradar** com o volume — 12 em 11,4 s. Um backfill de 50 atividades
levaria ~45 s. Não precisa de endpoint de lote.

Ressalva não medida: importar atividade **antiga** recalcula a carga daquela data até hoje. Na conta
real (298 atividades) isso é mais caro que no teste. O caso normal de sync (atividades recentes)
não sofre disso.

---

## 2. Por que não MCP

Um MCP devolve dados **para dentro do contexto da conversa**. Uma corrida de 5 km a 1 Hz são ~1500
pontos; trazer isso como JSON e depois reemitir tudo num POST significa mover a série inteira
através da janela de contexto, ponto a ponto. Para uma atividade já é caro e sujeito a erro de
transcrição; para um backfill de 50, é inviável.

MCP de Garmin é ótimo para **perguntar** ("como foi meu sono na semana passada?"). É ruim como
**pipeline de dados** de GPS. São usos diferentes, e o plano original tratava os dois como um só.

Existem vários MCPs de Garmin no GitHub (`Taxuspt/garmin_mcp`, `eddmann/garmin-connect-mcp`,
`Nicolasvegam/garmin-connect-mcp`, `jaounial/garmin_mcp` e outros). **Todos envolvem a mesma
biblioteca por baixo** (`python-garminconnect`). A escolha entre eles é irrelevante para importar
treinos — o que importa é a biblioteca, que dá para usar direto.

---

## 3. Solução recomendada: script de sync local

```
python-garminconnect  →  download_activity(id, ORIGINAL)  →  .zip
                      →  extrai o .fit  →  parse_file()  →  import_activity()
```

Por que é melhor que normalizar o JSON do Garmin:

- **Reusa o parser de FIT que já existe** e já processou todo o histórico do usuário. Zero código
  novo de normalização, zero classe nova de bug.
- **Dedup sai de graça**: o `.fit` original tem `file_hash`, exatamente como no upload manual. Uma
  atividade já subida à mão não duplica.
- **Nada passa pelo contexto.** Roda headless, sem Claude no meio.
- Um comando, e dá para agendar.

Verificado na biblioteca (inspeção local, sem login):

```
download_activity(activity_id, dl_fmt=ActivityDownloadFormat.ORIGINAL) -> bytes
  # "For 'Original' will return the zip file content, up to user to extract it"
ActivityDownloadFormat: CSV, GPX, KML, ORIGINAL, TCX
get_activities(start=0, limit=20, ...)
get_activities_by_date(startdate, enddate=None, ...)
```

**Lacuna conhecida:** `parse_file()` aceita `.fit`, `.gpx`, `.tcx`, `.csv` e `.gz`, mas **não `.zip`**.
O script precisa extrair o `.fit` de dentro do zip (~3 linhas com `zipfile`). É o único ponto de
adaptação.

### Autenticação — o ponto que exige o usuário

- Login usa o mesmo fluxo SSO do app Android oficial.
- **MFA é suportado** e é um passo **interativo único**. Os tokens ficam em
  `~/.garminconnect/garmin_tokens.json` (modo 0600) e **renovam sozinhos indefinidamente** enquanto
  o refresh token valer. Só há novo login com senha se o refresh expirar ou for revogado.
- O handshake de MFA é ligado a **um cliente em memória**: `login(return_on_mfa=True)` estaciona a
  sessão e o CSRF, e `resume_login()` submete o código **naquele mesmo objeto**. Criar um cliente
  novo entre as duas etapas invalida o código — foi exatamente o bug de um app de terceiros que
  circulou como se fosse quebra do Garmin (ver "Correções").

**Claude não pode executar este passo**: exige a senha do Garmin e o código de MFA. É do usuário.

---

## 4. Strava

Para o Strava o caminho **continua sendo** o `/activities/import-normalized`, porque a API do Strava
não entrega o arquivo original — só o resumo e as streams em JSON. Ou seja, a validação do endpoint
(item 1) é exatamente a fundação do caminho Strava.

O custo de entrada não mudou e é o mesmo já descartado em 2026-09-15: registrar app, client
id/secret, callback OAuth. **Recomendação: manter descartado** enquanto o Garmin resolver, já que o
relógio é a fonte primária e o Strava seria dado de segunda mão.

---

## 5. Correções a premissas registradas no projeto

Duas afirmações do projeto não se sustentaram na verificação de hoje:

1. **`PLANEJAMENTO.md:153` — "Garmin (bloqueia API não oficial)" → desatualizado.**
   `cyberjunky/python-garminconnect` está ativo (834 commits, releases recentes, 2 issues abertas,
   nenhuma de autenticação). O acesso funciona pelo fluxo SSO do app Android.

2. **`PLANEJAMENTO_2026-09-18.md`, Fase 9 — "Com MFA na conta, o login não oficial morre" → errado.**
   MFA é suportado e é interativo **uma vez**; depois os tokens renovam sozinhos. MFA não impede o
   sync, apenas exige um passo manual inicial.

**Alarme falso investigado e descartado:** circulou que em 16/09/2026 a autenticação do Garmin teria
quebrado ("Widget MFA failed"). Verificado na fonte: era **bug do próprio app de terceiros**
(`mcbeebe/Broken-Arrow-Training` PR #440), que criava um cliente novo entre o pedido do código e o
envio dele. Não houve quebra do lado do Garmin.

---

## 6. Riscos que permanecem

- **API não oficial.** O Garmin pode mudar o fluxo a qualquer momento e quebrar a biblioteca. É
  dependência externa sem contrato. Mitigação: o upload manual continua funcionando como sempre, e
  o script é um atalho, não a única via.
- **Adiciona dependência** (`garminconnect` + `garth`) à API. Decisão do usuário.
- **Credenciais em máquina local.** Os tokens ficam no `~` do usuário, fora do repositório. Nada de
  senha no código nem no `.env` commitado.

---

## 7. Saída da fase

Das três saídas previstas no plano, esta é a segunda, com uma correção: **o caminho vira fase real
com escopo conhecido, mas sem MCP.**

Escopo proposto para uma eventual fase de entrega (~1 dia, não executada):

1. `scripts/sync_garmin.py`: lista atividades desde a última importada, baixa `ORIGINAL`, extrai o
   `.fit` do zip, chama `parse_file` + `import_activity`, chama `update_daily_metrics` uma única vez
   ao final (o próprio `import_service` recomenda isso para lote).
2. Login interativo único feito **pelo usuário**; script detecta token ausente e orienta.
3. Testes da parte local (zip → fit → import) com fixture, sem rede.
4. O `import-normalized` fica como está, servindo Strava e qualquer fonte sem arquivo.

**Não fazer sem decisão explícita:** instalar MCP de Garmin, registrar app no Strava, ou guardar
credenciais em qualquer arquivo do repositório.
