#!/usr/bin/env node
// Confere o fluxograma (docs/fluxograma) contra o código.
//
//   node scripts/checar-fluxograma.mjs --cobertura
//     Lista telas (apps/web/app/**/page.tsx) e rotas da API (routers/*.py + main.py)
//     que não aparecem no mapa, e blocos de diagrama citados no inventário que não
//     existem. Sai com 1 se faltar algo.
//
//   node scripts/checar-fluxograma.mjs --hook
//     Para o hook PostToolUse do Claude Code: lê o JSON da ferramenta na entrada.
//     Se o comando acabou de fazer um commit que mexe em apps/web, apps/api ou
//     apps/controle sem mexer em docs/fluxograma (e sem "[fluxograma: sem mudança]"
//     na mensagem), sai com 2 e um lembrete em português.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const KACTUS = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAPA_DIR = join(KACTUS, "docs", "fluxograma");
const ESCAPE = "[fluxograma: sem mudança]";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".next")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Carrega os arquivos de áreas como o navegador faria. */
function carregarMapa() {
  const html = readFileSync(join(MAPA_DIR, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="(areas\/[^"]+)"/g)].map((m) => m[1]);
  const ctx = { KACTUS_MAPA: { areas: [], meta: null } };
  vm.createContext(ctx);
  for (const s of scripts) vm.runInContext(readFileSync(join(MAPA_DIR, s), "utf8"), ctx, { filename: s });
  return ctx.KACTUS_MAPA;
}

/** "/activities/{activity_id}?x=1" → "/activities/{}" */
function normPath(p) {
  return p.split("?")[0].split("#")[0].replace(/\{[^}]*\}/g, "{}").replace(/\[[^\]]*\]/g, "{}").replace(/\/+$/, "") || "/";
}

function telasDoCodigo() {
  const app = join(KACTUS, "apps", "web", "app");
  return walk(app)
    .filter((f) => f.endsWith(`${sep}page.tsx`))
    .map((f) => {
      const segs = relative(app, dirname(f)).split(sep).filter((s) => s && !/^\(.*\)$/.test(s));
      return "/" + segs.join("/");
    })
    .map((r) => (r === "/" ? "/" : r));
}

function rotasDaApi() {
  const base = join(KACTUS, "apps", "api", "kactus_api");
  const out = [];
  const arquivos = [...walk(join(base, "routers")).filter((f) => f.endsWith(".py")), join(base, "main.py")];
  for (const f of arquivos) {
    const src = readFileSync(f, "utf8");
    const prefix = /APIRouter\(\s*prefix="([^"]*)"/.exec(src)?.[1] ?? "";
    for (const m of src.matchAll(/@(?:router|app)\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)) {
      out.push({ metodo: m[1].toUpperCase(), caminho: normPath(prefix + m[2]), onde: relative(KACTUS, f).split(sep).join("/") });
    }
  }
  return out;
}

/** Extrai "GET /a · /b · POST /c" e "GET e POST /x" das strings `api` do inventário. */
function rotasDoMapa(mapa) {
  const set = new Set();
  const telas = new Set();
  for (const a of mapa.areas) {
    for (const r of a.rotas || []) for (const m of String(r).matchAll(/(^|\s)(\/[^\s#?]*)/g)) telas.add(normPath(m[2]));
    for (const it of a.inventario) {
      if (!it.api) continue;
      let metodos = [];
      for (const parte of String(it.api).split("·")) {
        const t = parte.trim();
        const ms = [...t.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
        if (ms.length) metodos = ms;
        const cam = /(?:^|\s)(\/[^\s,]*)/.exec(t)?.[1];
        if (!cam || !metodos.length) continue;
        for (const met of metodos) set.add(`${met} ${normPath(cam)}`);
      }
    }
  }
  return { endpoints: set, telas };
}

function checarNos(mapa) {
  const problemas = [];
  for (const a of mapa.areas) {
    const porDiagrama = a.diagramas.map((d) => {
      const ids = new Set();
      for (const m of d.mermaid.matchAll(/(?:^|[\s>|-])([A-Za-z][A-Za-z0-9_]*)\s*(?:\[|\(|\{|>)/gm)) ids.add(m[1]);
      return ids;
    });
    const todos = new Set(porDiagrama.flatMap((s) => [...s]));
    for (const it of a.inventario) {
      for (const no of String(it.no || "").split(",").map((s) => s.trim()).filter(Boolean)) {
        if (!todos.has(no)) problemas.push(`${a.id}: o item "${it.nome}" aponta para o bloco ${no}, que não existe nos diagramas`);
        const em = porDiagrama.filter((s) => s.has(no)).length;
        if (em > 1) problemas.push(`${a.id}: o bloco ${no} existe em ${em} diagramas da área (o clique fica ambíguo)`);
      }
    }
  }
  return problemas;
}

function cobertura() {
  const mapa = carregarMapa();
  const { endpoints, telas } = rotasDoMapa(mapa);
  const faltaTela = telasDoCodigo().filter((t) => !telas.has(normPath(t)));
  const faltaApi = rotasDaApi().filter((r) => !endpoints.has(`${r.metodo} ${r.caminho}`));
  const nos = checarNos(mapa);
  return { faltaTela, faltaApi, nos, mapa };
}

function relatorio({ faltaTela, faltaApi, nos }) {
  const linhas = [];
  if (faltaTela.length) linhas.push("Telas fora do mapa:", ...faltaTela.map((t) => `  - ${t}`));
  if (faltaApi.length) linhas.push("Rotas da API fora do mapa:", ...faltaApi.map((r) => `  - ${r.metodo} ${r.caminho}  (${r.onde})`));
  if (nos.length) linhas.push("Blocos do diagrama:", ...nos.map((p) => `  - ${p}`));
  return linhas.join("\n");
}

function git(...args) {
  return execFileSync("git", args, { cwd: KACTUS, encoding: "utf8" }).trim();
}

function hook() {
  let entrada = {};
  try {
    entrada = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return 0;
  }
  const comando = String(entrada?.tool_input?.command ?? "");
  if (!/\bgit\b[^\n]*\bcommit\b/.test(comando)) return 0;

  // FLUXOGRAMA_TESTE_COMMIT=<sha> testa o lembrete contra um commit antigo (sem checar a idade)
  const teste = process.env.FLUXOGRAMA_TESTE_COMMIT;
  const ref = teste || "HEAD";
  let quando, mensagem, arquivos;
  try {
    quando = Number(git("log", "-1", "--format=%ct", ref));
    mensagem = git("log", "-1", "--format=%B", ref);
    arquivos = git("show", "--name-only", "--format=", ref).split("\n").filter(Boolean);
  } catch {
    return 0;
  }
  if (!teste && Date.now() / 1000 - quando > 120) return 0; // commit velho: o comando não commitou nada agora
  if (mensagem.includes(ESCAPE)) return 0;

  const top = git("rev-parse", "--show-toplevel");
  const prefixo = relative(top, KACTUS).split(sep).join("/");
  const p = (s) => (prefixo ? `${prefixo}/${s}` : s);
  const funcional = arquivos.filter(
    (f) => /^(apps\/(web|api|controle)\/)/.test(prefixo ? f.slice(prefixo.length + 1) : f)
      && f.startsWith(p("apps/"))
      && !/\/tests?\//.test(f) && !f.includes("/(dev)/") && !f.includes("/logs/"),
  );
  if (!funcional.length) return 0;
  if (arquivos.some((f) => f.startsWith(p("docs/fluxograma/")))) return 0;

  const cob = cobertura();
  const rel = relatorio(cob);
  process.stderr.write(
    [
      "Lembrete do fluxograma: o último commit mexeu no funcionamento do Kactus sem atualizar docs/fluxograma.",
      ...funcional.slice(0, 8).map((f) => `  · ${f}`),
      funcional.length > 8 ? `  · … e mais ${funcional.length - 8}` : "",
      "Atualize a área correspondente em Kactus/docs/fluxograma/areas/ (inventário com arquivo:linha e, se for o caso, o diagrama),",
      "a data, o commit e o histórico em areas/meta.js, e republique o Artifact.",
      `Se a mudança não muda nada que o mapa mostra, use "${ESCAPE}" na mensagem do commit.`,
      rel ? `\n${rel}` : "",
    ].filter(Boolean).join("\n") + "\n",
  );
  return 2;
}

const modo = process.argv[2];
if (modo === "--hook") {
  process.exit(hook());
} else if (modo === "--cobertura") {
  const cob = cobertura();
  const rel = relatorio(cob);
  const total = cob.mapa.areas.reduce((s, a) => s + a.inventario.length, 0);
  if (rel) {
    console.log(rel);
    process.exit(1);
  }
  console.log(`Cobertura completa: ${telasDoCodigo().length} telas e ${rotasDaApi().length} rotas da API no mapa (${cob.mapa.areas.length} áreas, ${total} itens).`);
} else {
  console.log("Uso: node scripts/checar-fluxograma.mjs --cobertura | --hook");
  process.exit(64);
}
