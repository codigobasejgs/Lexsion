// Gerador de QR Code próprio (ISO/IEC 18004): modo byte, correção M, versões 1–10, máscara de menor penalidade.
// Sem dependência nova (registro de pacotes indisponível no ambiente). Validado decodificando com pyzbar/OpenCV (docs).
// ponytail: só até a versão 10 (≈ 213 bytes em M) — suficiente para URLs; ampliar tabela se precisar de textos longos.

// [total de codewords, ecc por bloco, blocos grupo 1, dados por bloco g1, blocos g2, dados por bloco g2] — nível M
const M_TABLE: [number, number, number, number, number, number][] = [
  [26, 10, 1, 16, 0, 0], [44, 16, 1, 28, 0, 0], [70, 26, 1, 44, 0, 0], [100, 18, 2, 32, 0, 0], [134, 24, 2, 43, 0, 0],
  [172, 16, 4, 27, 0, 0], [196, 18, 4, 31, 0, 0], [242, 22, 2, 38, 2, 39], [292, 22, 3, 36, 2, 37], [346, 26, 4, 43, 1, 44],
];
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++, x = (x << 1) ^ (x & 0x80 ? 0x11d : 0)) { EXP[i] = x; LOG[x] = i; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsEcc(data: number[], n: number): number[] {
  let gen = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(gen.length + 1).fill(0);
    gen.forEach((g, j) => { next[j] ^= g; next[j + 1] ^= mul(g, EXP[i]); });
    gen = next;
  }
  const res = [...data, ...new Array(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const f = res[i];
    if (f) for (let j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], f);
  }
  return res.slice(data.length);
}

function bchFormat(mask: number): number {
  const d = (0b00 << 3) | mask; // nível M = 00
  let v = d << 10;
  for (let i = 14; i >= 10; i--) if (v & (1 << i)) v ^= 0x537 << (i - 10);
  return ((d << 10) | v) ^ 0x5412;
}
function bchVersion(ver: number): number {
  let v = ver << 12;
  for (let i = 17; i >= 12; i--) if (v & (1 << i)) v ^= 0x1f25 << (i - 12);
  return (ver << 12) | v;
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (_, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function penalty(m: boolean[][]): number {
  const n = m.length;
  let p = 0;
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < n; i++) {
      let run = 1;
      for (let j = 1; j < n; j++) {
        const same = pass ? m[j][i] === m[j - 1][i] : m[i][j] === m[i][j - 1];
        if (same) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
      if (run >= 5) p += run - 2;
    }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) if (m[i][j] === m[i + 1][j] && m[i][j] === m[i][j + 1] && m[i][j] === m[i + 1][j + 1]) p += 3;
  const dark = m.flat().filter(Boolean).length;
  return p + Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
}

/** Matriz de módulos (true = escuro). Lança erro se o texto não couber na versão 10. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)];
  // 3 bytes de cabeçalho (modo + contagem de até 16 bits) — margem conservadora para todas as versões.
  const ver = M_TABLE.findIndex(([, , b1, d1, b2, d2]) => b1 * d1 + b2 * d2 >= bytes.length + 3) + 1;
  if (ver === 0) throw new Error("Texto longo demais para o QR (máx. versão 10)");
  const [, eccLen, b1, d1, b2, d2] = M_TABLE[ver - 1];
  const capacity = b1 * d1 + b2 * d2;
  // Fluxo de bits: modo byte (0100), contagem (8 bits até v9, 16 a partir da v10), dados, terminador, preenchimento.
  const bits: number[] = [];
  const put = (v: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0; data.length < capacity; pad++) data.push(pad % 2 ? 0x11 : 0xec);
  // Blocos, ECC e intercalação.
  const blocks: number[][] = [];
  let off = 0;
  for (let i = 0; i < b1 + b2; i++) { const len = i < b1 ? d1 : d2; blocks.push(data.slice(off, off + len)); off += len; }
  const eccs = blocks.map((b) => rsEcc(b, eccLen));
  const final: number[] = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.length) final.push(b[i]);
  for (let i = 0; i < eccLen; i++) for (const e of eccs) final.push(e[i]);

  const n = ver * 4 + 17;
  const m: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const fixed: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r: number, c: number, v: boolean) => { m[r][c] = v; fixed[r][c] = true; };
  const finder = (r: number, c: number) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const inside = i >= 0 && i <= 6 && j >= 0 && j <= 6;
      set(rr, cc, inside && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)));
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[ver - 1];
  for (const r of al) for (const c of al) {
    // Só pula os que colidem com os localizadores; os centrados na linha de sincronismo (v7+) existem.
    if ((r < 9 && c < 9) || (r < 9 && c > n - 10) || (r > n - 10 && c < 9)) continue;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(r + i, c + j, Math.max(Math.abs(i), Math.abs(j)) !== 1);
  }
  set(n - 8, 8, true); // módulo escuro
  // Reserva das áreas de formato e versão.
  for (let i = 0; i < 9; i++) { fixed[8][i] = fixed[i][8] = true; }
  for (let i = 0; i < 8; i++) { fixed[8][n - 1 - i] = fixed[n - 1 - i][8] = true; }
  if (ver >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { fixed[i][n - 11 + j] = fixed[n - 11 + j][i] = true; }
  // Dados em zigue-zague.
  let bit = 0;
  const all = final.flatMap((b) => [7, 6, 5, 4, 3, 2, 1, 0].map((s) => ((b >> s) & 1) === 1));
  for (let col = n - 1, up = true; col > 0; col -= 2, up = !up) {
    if (col === 6) col--;
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k;
      for (const c of [col, col - 1]) if (!fixed[r][c]) m[r][c] = all[bit++] ?? false;
    }
  }
  // Máscara de menor penalidade + formato/versão.
  let best: boolean[][] = m;
  let bestP = Infinity;
  MASKS.forEach((fn, mask) => {
    const t = m.map((row, r) => row.map((v, c) => (fixed[r][c] ? v : v !== fn(r, c))));
    const f = bchFormat(mask);
    for (let i = 0; i < 15; i++) {
      const v = ((f >> i) & 1) === 1;
      if (i < 6) t[i][8] = v; else if (i < 8) t[i + 1][8] = v; else t[n - 15 + i][8] = v;
      if (i < 8) t[8][n - 1 - i] = v; else if (i < 9) t[8][7] = v; else t[8][14 - i] = v;
    }
    if (ver >= 7) {
      const vb = bchVersion(ver);
      for (let i = 0; i < 18; i++) { const v = ((vb >> i) & 1) === 1; t[Math.floor(i / 3)][n - 11 + (i % 3)] = v; t[n - 11 + (i % 3)][Math.floor(i / 3)] = v; }
    }
    t[n - 8][8] = true;
    const p = penalty(t);
    if (p < bestP) { bestP = p; best = t; }
  });
  return best;
}

/** SVG do QR (com zona de silêncio de 4 módulos). Texto vem do app, nunca de HTML externo. */
export function qrSvg(text: string, px = 4): string {
  const m = qrMatrix(text);
  const n = m.length + 8;
  const path = m.flatMap((row, r) => row.map((v, c) => (v ? `M${c + 4} ${r + 4}h1v1h-1z` : ""))).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * px}" height="${n * px}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
