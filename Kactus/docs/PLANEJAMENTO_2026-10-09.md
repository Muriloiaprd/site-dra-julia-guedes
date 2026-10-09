# Planejamento 2026-10-09 — ideias de melhorias

Origem: [IDEIAS_DE_MELHORIAS_2026-10-07.md](./IDEIAS_DE_MELHORIAS_2026-10-07.md). O Murilo pediu para executar tudo, **menos as ideias 10 (frase da Duni como Story), 16 (mapa do Stadia no iPhone), 22 (Kactus na nuvem) e 23 (App Store)**, que ficam descartadas.

Regras deste plano:
- Custo R$ 0, sem cartão.
- Uma fase de cada vez, na ordem abaixo; cada fase termina com testes, commit e push (origin + espelho `kactus`).
- Toda fase que muda o funcionamento atualiza o fluxograma (`docs/fluxograma`) no mesmo commit e republica o Artifact.
- Migração nova é aplicada na branch `test` (pelos testes) e depois no banco principal; só migrações que acrescentam.
- O Kactus no modo rápido só pega o código novo depois de **Reiniciar** no Kactus Controle.

## Fases

### Fase 1 — Correções vindas do fluxograma
- Editar a atividade não apaga mais a descrição: a API devolve `description` e o formulário abre preenchido.
- Excluir atividade e excluir equipamento passam a conferir a resposta da API (erro aparece em vez de sumir da tela).
- Erros da API com `detail` em objeto (500) ou lista (422) viram texto legível.
- Gerar plano do objetivo trata resposta fora do formato como os outros planos (`invalid_plan_response`).
- Texto do excluir no detalhe: "Mover para a lixeira…".
- Códigos de erro da Duni sem texto (`no_free_week`, `not_editable`, `past_date`, `not_swappable`, `invalid_suggestion`, `internal_error`) ganham título e explicação.

### Fase 2 — Tênis padrão por esporte (ideia 3)
- Equipamento ganha "Usar como padrão em" (Corrida, Trail, Esteira, Caminhada…); um esporte só tem um padrão por vez.
- Treino importado entra com o equipamento padrão do esporte (só se não vier com outro).
- Botão para aplicar o padrão aos treinos antigos sem equipamento.

### Fase 3 — Planejado × feito com comentário da Duni (ideia 4)
- No dia seguinte a um treino planejado, o dashboard e a Duni mostram o planejado ao lado do feito (km, ritmo, FC, duração) com um selo (cumpriu, fez a mais, fez a menos, pulou).
- "Pedir comentário" chama a Duni uma vez para aquele par (sob demanda, para não gastar cota).

### Fase 4 — Importar sozinho do relógio (ideia 5)
- O Kactus Controle vigia a chegada de um relógio Garmin no USB (pasta `GARMIN/Activity`) e manda os `.fit` novos para a API (os duplicados já são ignorados).
- Aviso no Windows com quantos treinos entraram; opção liga/desliga no menu e na janela.

### Fase 5 — Story do último treino em 1 toque (ideia 6)
- Botão "Story do último treino" no dashboard (no iPhone e no PC) que abre o gerador direto no treino mais recente.

### Fase 6 — Meta de km por semana (ideia 7)
- Meta no Perfil; dashboard mostra "X de Y km" na semana e Desempenho avisa se a meta está fora da faixa segura.

### Fase 7 — Contagem regressiva e calendário de provas (ideia 8)
- O cartão "Meta principal" do dashboard vira "Próxima prova": nome, data, dias que faltam, fase e semana do plano do objetivo e as outras provas cadastradas.

### Fase 8 — Backup automático semanal (ideia 9)
- O Kactus Controle salva o export JSON numa pasta do PC uma vez por semana e guarda as últimas 8 cópias; "Fazer backup agora" no menu.

### Fase 9 — Resumo do mês (ideia 11)
- Seção em Desempenho com mês a mês (km, horas, treinos, por esporte, maior treino, recordes, comparação com o mês anterior) e um Story do mês.

### Fase 10 — Ritmo × calor (ideia 13)
- Em Desempenho: ritmo e FC das corridas por faixa de temperatura, com a frase de quanto o calor pesa.

### Fase 11 — Evolução da técnica de corrida (ideia 14)
- Em Desempenho: cadência, contato com o solo, oscilação e passada mês a mês.

### Fase 12 — Comparar dois treinos (ideia 15)
- Escolher dois treinos na lista e ver lado a lado: métricas, splits e as curvas de ritmo e FC sobrepostas.

### Fase 13 — Stories 4:5 para o feed (ideia 17)
- Formato 4:5 (1080×1350) no gerador para os modelos que cabem nesse formato.

### Fase 14 — Capa de revista (ideia 18)
- Novo modelo de Story em formato de capa de revista.

### Fase 15 — Acessibilidade (ideia 20)
- Contraste AA nos textos apagados, foco visível em tudo, gráficos e calendário usáveis pelo teclado.

### Fase 16 — Notificações no iPhone (ideia 12)
- Web Push (iOS 16.4+, com o app na Tela de Início e o PC ligado): treino de hoje de manhã, recorde novo, dias sem treinar. Liga e desliga no Perfil.

### Fase 17 — Último painel offline no iPhone (ideia 21)
- Com o PC desligado, o app abre o último dashboard visto, com a faixa "Sem conexão com o PC · dados de …" e o botão de ligar.

## Com você (não dá para fazer sem o Murilo)
- **Ideia 1:** testar no iPhone o plano de 2026-10-07.
- **Ideia 2:** teste ao vivo do plano até a Maratona (Fase 6 do plano de 2026-10-05).
- **Ideia 19:** a última tentativa do sync do Garmin pelo 4G (login com senha e MFA é seu). Com a Fase 4 pronta, ela perde a importância.

## Para verificar depois (com o Murilo)
Itens que o código e os testes cobrem, mas que só dá para confirmar com o aparelho, a conta real ou a tela de verdade. Ir riscando conforme for conferido.
- [ ] **Fase 2:** na tela de Equipamentos com a conta real, marcar o tênis padrão e usar "Aplicar aos treinos antigos" (testado só na página de exemplo `/equipment-preview`).
- [ ] **Fase 3:** ver o "Planejado × feito" no dashboard e na Duni com treinos reais (testado só em `/coach-preview`).
- [ ] **Fase 4:** fechar o Kactus Controle (Sair → Não), abrir de novo e ligar o relógio no USB: os treinos novos devem entrar sozinhos e aparecer o aviso no Windows. O caminho por MTP (Forerunner/Fenix atuais) nunca foi testado com relógio de verdade.
- [ ] **Fase 5:** Reiniciar no Kactus Controle e tocar em "📤 Story" no cartão Última atividade, no PC e no iPhone (na página de exemplo `/dashboard-preview` o gerador abre).
- [ ] **Fase 6:** pôr a meta no Perfil (salvar com a conta real) e ver a barra "Meta de corrida" na Visão semanal do dashboard e o bloco "Sua meta" em Desempenho.
- [ ] **Fase 7:** com a conta real, conferir o cartão "Próxima prova" (Maratona do Rio, dias, fase e semana do plano, alvo).
- [ ] **Hook do fluxograma:** numa conversa nova, conferir que o lembrete aparece depois de um commit que mexe em `apps/` sem mexer em `docs/fluxograma/`.

## Andamento
- **Fase 0 — feita:** este documento.
- **Fase 1 — feita:** descrição volta no detalhe (`ActivityDetail.description`) e o formulário abre preenchido; `deleteActivity`/`deleteEquipment` usam `voidFetch` e mostram o erro; `apiErrorMessage` em `lib/api.ts` transforma `detail` texto/objeto/lista em frase; `POST /coach/goal-plan/generate` trata `CoachPlanParseError` (502 `invalid_plan_response`); textos novos em `lib/coachErrors.ts`. Testes: 273 da API passando (+2 novos).
- **Fase 2 — feita:** migração `024_equipment_default_sports` (coluna `equipment.default_sports`, aplicada na `test` e na principal); "Usar como padrão em" no formulário (tênis: corrida, trail, esteira, caminhada; bicicleta: bike, MTB, gravel, indoor), um padrão por esporte (`_claim_sports`), aposentar zera; import liga o treino ao padrão ativo (`import_service._default_equipment`); `POST /equipment/{id}/apply-default` e o botão "Aplicar aos treinos antigos". Página de teste `/equipment-preview`. Testes: `tests/test_equipment_default.py`.
- **Fase 3 — feita:** `ai/adherence.py` + `GET /coach/plan/adherence?days=N` (sem IA: selo de volume ±15% e de ritmo contra a faixa do alvo, ±5 s/km); `components/coach/AdherencePanel.tsx` no dashboard (3 dias, 2 itens) e na Duni (14 dias); o comentário é o da atividade (`POST /coach/activities/{id}/analyze`), só quando pedido. `/coach-preview` ganhou exemplos. Testes: `tests/test_adherence.py`.
- **Fase 4 — feita (falta o teste com o relógio de verdade):** `apps/controle/kactus_controle/relogio.py` + `relogio.ps1` vigiam o USB a cada 15 s (pendrive com letra ou MTP pelo Shell do Windows), copiam só os `.fit` novos (`relogio_vistos.json`) e chamam `kactus_api.scripts.import_files --json` (conta = `INITIAL_USER_EMAIL`); aviso no Windows, seção "Relógio no USB" na janela, opção e "Importar do relógio agora" no menu. A importação em lote saiu do router para `services/batch_import.py` (tela /import e relógio pelo mesmo caminho). **Para ativar: fechar o Kactus Controle (Sair → Não) e abrir de novo.** Testes: 281 da API e 29 do Controle.
- **Fase 5 — feita (sem conferência visual):** botão "📤 Story" no cartão Última atividade do dashboard abre o `StoryGenerator` do treino mais recente (busca detalhe, splits e zonas). Typecheck ok; falta ver na tela.
- **Fase 6 — feita (sem conferência visual):** migração `025_weekly_km_goal` (aplicada na `test` e na principal); campo no Perfil; `meta_semanal` em `GET /metrics/summary` (`summary._weekly_goal`: feito de segunda até hoje, situação contra a faixa segura); barra na Visão semanal e bloco "Sua meta" em Desempenho. Testes em `tests/test_load_summary.py`.
- **Fase 7 — feita:** `components/dashboard/GoalCard.tsx` virou "Próxima prova" (plano do objetivo + provas das memórias; o dashboard passou a buscar `/coach/goal-plan` e `/coach/memories`). Página de teste `/dashboard-preview` (também cobre as Fases 3, 5 e 6) conferida no navegador, com e sem prova (`?sem-prova`). O achado do cartão "Meta principal" saiu da lista.
