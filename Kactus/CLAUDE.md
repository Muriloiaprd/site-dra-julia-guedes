# Kactus

## Documentação

Toda documentação do projeto (estado, backlog, planejamento, resumos, specs) fica em [`docs/`](./docs/). Não criar `.md` de documentação na raiz — a única exceção é o `README.md`, que fica na raiz por convenção do Git/GitHub.

## Fluxograma

O mapa funcional do Kactus fica em [`docs/fluxograma/`](./docs/fluxograma/): `index.html` (visualizador) e um arquivo de dados por área em `areas/` (inventário com `arquivo:linha` e diagramas Mermaid). Publicado como Artifact privado: https://claude.ai/artifact/8tBaZFL5jDRcip3dr4itHs

- Toda mudança que altera o funcionamento em `apps/web`, `apps/api` ou `apps/controle` (tela, botão, campo, mensagem, estado, rota da API, cálculo, uso da Duni) atualiza o fluxograma **no mesmo commit**: o item do inventário (e a linha `arquivo:linha`), o diagrama se o caminho mudou, e em `areas/meta.js` a data, o commit de referência e uma linha no histórico. Depois, republicar o Artifact com o mesmo `index.html` e os arquivos de `areas/`.
- Commit sem mudança funcional (refatoração, teste, texto interno) leva `[fluxograma: sem mudança]` na mensagem.
- Antes de commitar, rodar `node scripts/checar-fluxograma.mjs --cobertura`: ele lista tela ou rota da API fora do mapa e bloco de diagrama citado que não existe.
- Um hook `PostToolUse` (em `.claude/settings.json`, local, fora do Git) roda `checar-fluxograma.mjs --hook` depois de cada `git commit` e lembra quando o commit mexeu em `apps/` sem mexer em `docs/fluxograma/`.
- Achados registrados no mapa (`meta.js`) não são tarefas: só se corrigem quando o usuário pedir.
