// Gera src/domain/tables/official.json a partir de FONTES OFICIAIS (versionado no Git = cálculo reprodutível).
// Uso: node scripts/tabelas-oficiais.mjs   (rede com túnel: NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:1081)
// Nada é inventado: série que não vier da fonte falha o script. O teto do salário de contribuição não tem API:
// cada valor traz a portaria e a marca "verificado" só quando conferido na página oficial do INSS.
import fs from "node:fs";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const BCB = (code) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=01/07/1994`;
const SERIES = {
  inpc: { code: 188, label: "INPC (IBGE), variação mensal %", },
  ipca: { code: 433, label: "IPCA (IBGE), variação mensal %" },
  ipcae: { code: 10764, label: "IPCA-15/IPCA-E (IBGE), variação mensal %" },
  igpm: { code: 189, label: "IGP-M (FGV), variação mensal %" },
  igpdi: { code: 190, label: "IGP-DI (FGV), variação mensal %" },
  selic: { code: 4390, label: "Selic acumulada no mês %" },
  tr: { code: 7811, label: "TR (primeiro dia do mês) %" },
  taxaLegal: { code: 29543, label: "Taxa legal (art. 406 do Código Civil, Res. CMN 5.171/2024) % ao mês" },
  salarioMinimo: { code: 1619, label: "Salário mínimo (R$)" },
};

// curl em vez de fetch: a API do BCB demora a aceitar conexão (passa do limite de 10 s do undici).
const PROXY = process.env.HTTPS_PROXY ? ["--proxy", process.env.HTTPS_PROXY, "--ssl-no-revoke"] : [];
function get(url, binary = false) {
  for (let i = 0; i < 3; i++) {
    try { return execFileSync("curl", ["-sSfL", "--max-time", "120", ...PROXY, url], { encoding: binary ? "buffer" : "utf8", maxBuffer: 64 * 1024 * 1024 }); } catch { /* nova tentativa */ }
  }
  throw new Error("falha ao buscar " + url);
}
const json = async (url) => JSON.parse(get(url));
const month = (d) => `${d.slice(6, 10)}-${d.slice(3, 5)}`;

const out = { generatedAt: new Date().toISOString(), sources: {}, series: {}, ceiling: [], lifeTables: {} };
for (const [id, s] of Object.entries(SERIES)) {
  const rows = await json(BCB(s.code));
  if (!Array.isArray(rows) || !rows.length) throw new Error(`série ${id} vazia`);
  const m = {};
  for (const r of rows) m[month(r.data)] = Number(r.valor);
  out.series[id] = m;
  out.sources[id] = { label: s.label, url: `https://www3.bcb.gov.br/sgspub/consultarvalores/telaCvsSelecionarSeries.paint?codigoSerie=${s.code}`, api: BCB(s.code), publisher: "Banco Central do Brasil — SGS", license: "Dados abertos (Lei 12.527/2011)" };
}
// Salário mínimo: a série do BCB inclui jun/1994 em cruzeiros reais; só vale a partir de jul/1994 (Real).
delete out.series.salarioMinimo["1994-06"];

// IPC-r (jul/1994–jun/1995): IBGE SIDRA, tabela 86 (série encerrada), índice geral.
const ipcr = await json("https://apisidra.ibge.gov.br/values/t/86/n1/all/v/103/p/all/c72/2640");
out.series.ipcr = Object.fromEntries(ipcr.slice(1).map((r) => [`${r.D3C.slice(0, 4)}-${r.D3C.slice(4)}`, Number(r.V)]));
if (Object.keys(out.series.ipcr).length !== 12) throw new Error("IPC-r incompleto");
out.sources.ipcr = { label: "IPC-r (IBGE), variação mensal %", url: "https://sidra.ibge.gov.br/tabela/86", api: "https://apisidra.ibge.gov.br/values/t/86/n1/all/v/103/p/all/c72/2640", publisher: "IBGE — SIDRA", license: "Dados abertos" };

// Teto (limite máximo do salário de contribuição), vigência a partir do mês indicado.
// Sem número de ato = valor histórico amplamente publicado, ainda não conferido no DOU (verified=false).
// verificado=true: conferido em gov.br/inss (tabela de contribuição atual e histórico) em 05/11/2026.
const C = (from, value, act, verified = false) => ({ from, value, act, verified });
out.ceiling = [
  C("1994-07", 582.86, "portaria anual — conferir número no DOU"), C("1995-05", 832.66, "portaria anual — conferir número no DOU"), C("1996-05", 957.56, "portaria anual — conferir número no DOU"),
  C("1997-06", 1031.87, "portaria anual — conferir número no DOU"), C("1998-06", 1081.50, "portaria anual — conferir número no DOU"), C("1998-12", 1200.00, "EC 20/1998, art. 14"),
  C("1999-06", 1255.32, "portaria anual — conferir número no DOU"), C("2000-06", 1328.25, "portaria anual — conferir número no DOU"), C("2001-06", 1430.00, "portaria anual — conferir número no DOU"),
  C("2002-06", 1561.56, "portaria anual — conferir número no DOU"), C("2003-06", 1869.34, "portaria anual — conferir número no DOU"), C("2004-01", 2400.00, "EC 41/2003, art. 5º"),
  C("2004-05", 2508.72, "portaria anual — conferir número no DOU"), C("2005-05", 2668.15, "portaria anual — conferir número no DOU"), C("2006-04", 2801.56, "portaria anual — conferir número no DOU"),
  C("2006-08", 2801.82, "portaria anual — conferir número no DOU"), C("2007-04", 2894.28, "portaria anual — conferir número no DOU"), C("2008-03", 3038.99, "portaria anual — conferir número no DOU"),
  C("2009-02", 3218.90, "portaria anual — conferir número no DOU"), C("2010-01", 3467.40, "portaria anual — conferir número no DOU"), C("2011-01", 3691.74, "portaria anual — conferir número no DOU"),
  C("2012-01", 3916.20, "Portaria MPS/MF 02/2012", true), C("2013-01", 4159.00, "Portaria MPS/MF 15/2013", true), C("2014-01", 4390.24, "Portaria MPS/MF 19/2014", true),
  C("2015-01", 4663.75, "Portaria MPS/MF 13/2015", true), C("2016-01", 5189.82, "Portaria MTPS/MF 1/2016", true), C("2017-01", 5531.31, "Portaria MF 8/2017", true),
  C("2018-01", 5645.80, "Portaria MF 15/2018 (citada como Portaria nº 15)", true), C("2019-01", 5839.45, "Portaria ME 9/2019", true), C("2020-01", 6101.06, "tabela INSS 2020 (ato não citado na página)", true),
  C("2021-01", 6433.57, "Portaria SEPRT 477/2021", true), C("2022-01", 7087.22, "portaria anual — conferir número no DOU"), C("2023-01", 7507.49, "portaria anual — conferir número no DOU"),
  C("2024-01", 7786.02, "portaria anual — conferir número no DOU"), C("2025-01", 8157.41, "portaria anual — conferir número no DOU"), C("2026-01", 8475.55, "Portaria MPS/MF 13/2026", true),
];
out.sources.ceiling = { label: "Limite máximo do salário de contribuição (teto)", url: "https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal/tabela-de-contribuicao-historico", publisher: "INSS / portarias interministeriais", license: "CC BY-ND 3.0 (gov.br)" };

// Tábua completa de mortalidade do IBGE (expectativa de sobrevida por idade). Vale para benefícios a partir de 1º/dez do ano seguinte.
function unzip(buf) {
  const files = {};
  let eocd = buf.length - 22;
  while (buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8");
    p += 46 + nameLen + extra + comment;
  }
  return files;
}
function lifeTable(files) {
  const strs = [...(files["xl/sharedStrings.xml"] ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
  const out = {};
  for (const r of files["xl/worksheets/sheet1.xml"].matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [...r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<f>[^<]*<\/f>)?<v>([^<]*)<\/v><\/c>/g)].map((c) => ({ col: c[1], v: /t="s"/.test(c[2]) ? strs[+c[3]] : c[3] }));
    const a = cells.find((c) => c.col === "A");
    if (!a || cells.length < 5) continue;
    const age = /^\d+$/.test(a.v.trim()) ? +a.v.trim() : /90 ou mais/.test(a.v) ? 90 : null;
    if (age !== null) out[age] = Math.round(Number(cells.at(-1).v) * 100) / 100;
  }
  if (Object.keys(out).length !== 91) throw new Error("tábua incompleta");
  return out;
}
const TABUA_YEAR = 2024;
for (const sex of ["ambos_os_sexos", "homens", "mulheres"]) {
  const url = `https://ftp.ibge.gov.br/Tabuas_Completas_de_Mortalidade/Tabuas_Completas_de_Mortalidade_${TABUA_YEAR}/xlsx/${sex}.xlsx`;
    out.lifeTables[sex] = { year: TABUA_YEAR, validFrom: `${TABUA_YEAR + 1}-12-01`, url, ex: lifeTable(unzip(get(url, true))) };
}
out.sources.lifeTables = { label: `Tábua Completa de Mortalidade ${TABUA_YEAR} (IBGE)`, url: `https://ftp.ibge.gov.br/Tabuas_Completas_de_Mortalidade/Tabuas_Completas_de_Mortalidade_${TABUA_YEAR}/`, publisher: "IBGE", license: "Dados abertos" };

fs.mkdirSync("src/domain/tables", { recursive: true });
fs.writeFileSync("src/domain/tables/official.json", JSON.stringify(out));
const last = (s) => Object.keys(out.series[s]).sort().at(-1);
console.log(`ok: ${Object.keys(out.series).map((s) => `${s} até ${last(s)}`).join(", ")}; teto ${out.ceiling.length} vigências; tábua ${TABUA_YEAR}`);
