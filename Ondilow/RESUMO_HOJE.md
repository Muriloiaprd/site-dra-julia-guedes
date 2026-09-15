# O que rolou hoje no Ondilow (e o que falta)

> **Aviso:** esse arquivo é temporário. Mais pra frente vamos criar uma pasta só pra
> guardar esse tipo de resumo/anotação, e esse arquivo vai ser movido pra lá. Por
> enquanto ele tá aqui na raiz do projeto mesmo, junto com os outros `.md`.

---

## TL;DR (resumo bem rápido)

Hoje eu (a IA) arrumei **4 coisas** do app, uma atrás da outra, testando cada uma de
verdade antes de ir pra próxima. Tudo já foi salvo e mandado pro GitHub — você pode
puxar de qualquer computador. Nada quebrou, os testes automáticos continuam passando.

Pra continuar depois, é só falar "continua o plano do Ondilow" numa conversa nova.

---

## O que foi feito (em português claro)

### 1. O app agora "conta" quando alguma coisa dá erro
Antes, se desse algum erro escondido no app (tipo gerar uma imagem de atividade e
falhar), ele simplesmente ficava quieto e ninguém ficava sabendo. Agora ele anota
o erro num arquivo de log, tipo um diário de "coisas que deram ruim". Isso ajuda a
descobrir problema antes de virar dor de cabeça.

Também arrumei uma tela (`/profile`) que, se a internet caísse por um segundo,
mandava você direto pra tela de login como se sua sessão tivesse expirado — mentira,
era só um problema de rede. Agora ela mostra "Tentar de novo" em vez de te chutar.

### 2. Login agora tem limite de tentativas
Antes dava pra tentar a senha errada infinitas vezes seguidas. Agora, depois de 5
tentativas erradas num minuto, o app bloqueia por um tempinho. É uma proteção básica
contra alguém tentando "adivinhar" sua senha.

### 3. Achei e consertei um desperdício de internet escondido
Toda vez que você abria qualquer página do app, ele buscava seus dados de perfil
**duas vezes** sem precisar — uma vez pro menu lateral, outra vez pra página em si.
Isso é um desperdício bobo de internet/tempo. Achei a causa e consertei: agora ele
busca uma vez só e reaproveita, em vez de pedir de novo.

### 4. Agora dá pra editar e apagar uma atividade
Antes, se você importasse uma corrida errada ou quisesse mudar o título de um treino,
não tinha jeito — ficava preso pra sempre. Agora tem botões de **"Editar"** e
**"Excluir"** na página de cada atividade, e um botão de excluir na listagem também.

**Bônus:** enquanto eu testava isso de verdade (não só "no papel"), descobri que se
você tivesse muitas atividades (tipo 100+, que é o seu caso), trocar a modalidade de
uma atividade podia travar por quase **1 minuto** e às vezes dar erro. Achei a causa
(o app tava perguntando pro banco de dados a mesma coisa várias vezes sem precisar) e
consertei — agora leva menos de 9 segundos.

---

## O que ainda falta (das 9 fases planejadas)

Fizemos as **Fases 1 a 4**. Faltam as **Fases 5 a 9**:

| Fase | O que é, em bom português |
|---|---|
| **5** | Fazer o app somar de verdade a quilometragem de cada tênis/bike cadastrado (hoje é só um número fixo que você digitou, não conta os km reais das corridas) |
| **6** | Criar testes automáticos pro app inteiro — hoje só uma parte pequena é testada |
| **7** | Ligar um "robô" no GitHub que roda esses testes sozinho toda vez que algo muda no código |
| **8** | Criar a função de "definir uma meta" (tipo "quero correr 10km em 50 minutos até dezembro") com contagem regressiva no painel |
| **9** | Conectar direto com o Strava, pra suas corridas entrarem no Ondilow sozinhas, sem precisar exportar/importar arquivo na mão |

Essa última (Fase 9) é a maior e mais trabalhosa, por isso ficou por último.

Tem também uma lista de APIs (tipo "serviços externos grátis") que você achou
interessantes mas ainda não decidiu se quer usar — tipo pegar a previsão do tempo,
registrar o que você comeu no treino, ou receber notificação no celular quando bater
um recorde. Isso tá anotado, mas **não é compromisso**, só ideia pra avaliar depois.

---

## Onde ver os detalhes técnicos (se quiser)

- [`PLANEJAMENTO.md`](./PLANEJAMENTO.md) — a versão completa e técnica de tudo isso,
  com nome de arquivo, função, e o que cada fase muda no código.
- [`BACKLOG.md`](./BACKLOG.md) — lista de tudo que já foi resolvido e o que ainda tá
  pendente, sem estar organizado em fases.

## Está tudo salvo?

Sim. Cada fase virou um commit separado no Git, e tudo foi enviado pro GitHub
(`github.com/Muriloiaprd/Ondilow`). Se você abrir o projeto em outro computador ou
perder esse, é só baixar de novo de lá que está tudo lá.
