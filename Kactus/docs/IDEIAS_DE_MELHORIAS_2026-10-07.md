# Ideias de melhorias — Kactus

Levantadas em 2026-10-07, revisadas em 2026-10-09 (nenhuma estava feita). Em 2026-10-09 o Murilo aprovou todas, **menos a 10, a 16, a 22 e a 23** (descartadas: não fazem sentido para ele). As aprovadas estão em [PLANEJAMENTO_2026-10-09.md](./PLANEJAMENTO_2026-10-09.md).

Tudo com custo R$ 0. Escalas:

- **Prioridade**: quanto ajuda no dia a dia (Alta, Média, Baixa).
- **Dificuldade**: tempo de trabalho (Baixa = horas, Média = um dia, Alta = vários dias).
- **Complexidade**: quantas partes mexe e quanto pode quebrar (Baixa, Média, Alta).

| # | Ideia | Prioridade | Dificuldade | Complexidade | O que é |
|---|---|---|---|---|---|
| 1 | Fechar o plano do iPhone | Alta | Baixa | Baixa | Testar no aparelho o que já está no código (Tela de Início, Stories, importar .fit e foto, Kactus desligado) e ajustar a Fase 4 (dicas que só abrem com o mouse). Depende de você com o iPhone. |
| 2 | Teste ao vivo do plano até a Maratona | Alta | Baixa | Baixa | Fase 6 do PLANEJAMENTO_2026-10-05: gerar o plano do objetivo e o da semana com a sua conta e conferir. Depende de você. |
| 3 | Tênis padrão por esporte | Alta | Baixa | Baixa | Escolher um tênis padrão para corrida (e outro para trail/esteira); todo treino importado já entra com ele e a quilometragem fica certa sem editar treino a treino. |
| 4 | Planejado × feito + comentário da Duni | Alta | Baixa | Média | No dia seguinte, o treino planejado aparece ao lado do que foi feito (km, ritmo, FC) com um comentário curto da Duni. Usa IA sob demanda. |
| 5 | Importar sozinho do relógio | Alta | Média | Média | O Kactus Controle vigia a pasta GARMIN/Activity quando o relógio é ligado no USB e importa os .fit novos (duplicados já são ignorados). Substitui o sync do Garmin travado. |
| 6 | Story do último treino em 1 toque | Média | Baixa | Baixa | Botão no painel do iPhone que abre direto o Compartilhar do treino mais recente. |
| 7 | Meta de km por semana | Média | Baixa | Baixa | Você define a meta; o painel mostra quanto falta e avisa se ela sai da faixa segura da carga. |
| 8 | Contagem regressiva e calendário de provas | Média | Média | Baixa | Dias até a Maratona do Rio e a fase do plano no dashboard, no lugar do cartão "Meta principal" (que hoje diz que não existe meta). |
| 9 | Backup automático semanal | Média | Baixa | Baixa | O Controle salva o export JSON numa pasta do PC toda semana, guardando as últimas N cópias. |
| 10 | ~~Frase da Duni como Story~~ (descartada) | Média | Baixa | Baixa | Novo modelo de Story com a frase do resumo da Duni sobre a semana. |
| 11 | Resumo do mês | Média | Média | Média | Tela e Story com km, horas, treinos, recordes e evolução do mês. |
| 12 | Notificações no iPhone | Média | Média | Alta | Web Push (iOS 16.4+, app na Tela de Início): treino de hoje, recorde, sem treinar há dias. Só funciona com o PC ligado. |
| 13 | Ritmo × calor | Média | Média | Média | Mostra quanto o calor pesou no ritmo e na FC, usando a temperatura do relógio. |
| 14 | Evolução da técnica de corrida | Baixa | Média | Média | Gráfico mensal de cadência, contato com o solo e oscilação no mesmo ritmo. |
| 15 | Comparar dois treinos | Baixa | Média | Média | Dois treinos lado a lado: métricas, splits e curvas. |
| 16 | ~~Mapa igual ao do PC no iPhone~~ (descartada) | Baixa | Baixa | Baixa | Conta grátis no Stadia com o endereço .ts.net liberado. Você cria a conta; o Kactus só usa a chave. |
| 17 | Stories 4:5 para o feed | Baixa | Média | Média | Os modelos em formato de post do feed, além do Story 9:16. |
| 18 | Capa de revista | Baixa | Média | Baixa | Novo modelo de Story com o treino como capa de revista. |
| 19 | Destravar o sync do Garmin | Baixa | Média | Alta | Última tentativa pelo 4G; se falhar, apagar o código (combinado de 2026-09-20). Perde sentido se a ideia 5 for feita. |
| 20 | Acessibilidade | Baixa | Média | Média | Contraste AA e gráficos usáveis pelo teclado. |
| 21 | Último painel offline no iPhone | Baixa | Alta | Alta | Guardar o último painel para ver com o PC desligado. Mexe no service worker e em cache de dados com login. |
| 22 | ~~Kactus na nuvem 24h~~ (descartada) | Baixa | Alta | Alta | Vercel + Render grátis. Contraria a decisão de uso local; servidor grátis dorme e acorda devagar. |
| 23 | ~~App na App Store~~ (descartada) | Baixa | Alta | Alta | US$ 99 por ano: quebra o custo zero. |

## Correções vindas do fluxograma (opcional)

Achados do mapeamento de 2026-10-09 (`docs/fluxograma/areas/meta.js`) que valem entrar junto com a primeira leva:

| Correção | Dificuldade | Complexidade |
|---|---|---|
| Editar a atividade apaga a descrição | Baixa | Baixa |
| Excluir atividade ou equipamento ignora erro da API | Baixa | Baixa |
| Erros 500 e 422 aparecem como "[object Object]" | Baixa | Baixa |
| Plano do objetivo com resposta inválida vira erro interno | Baixa | Baixa |
