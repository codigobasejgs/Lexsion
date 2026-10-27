// ZIP mínimo (método STORE, sem compressão) — suficiente para OOXML (.docx).
// ponytail: sem deflate; arquivos de minuta são pequenos. Se crescerem, usar CompressionStream("deflate-raw").
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Monta um .zip a partir de { caminho: conteúdo }. Data fixa (1980-01-01) para saída determinística. */
export function zip(files: Record<string, string | Uint8Array>): Uint8Array {
  const enc = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = typeof content === "string" ? enc.encode(content) : content;
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true); // versão
    h.setUint16(6, 0x0800, true); // nomes em UTF-8
    h.setUint16(8, 0, true); // STORE
    h.setUint16(10, 0, true);
    h.setUint16(12, 0x21, true); // 1980-01-01
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, nameBytes.length, true);
    local.push(new Uint8Array(h.buffer), nameBytes, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, nameBytes.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const n = Object.keys(files).length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, n, true);
  end.setUint16(10, n, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Leitor ZIP (STORE) para testes e verificação do arquivo gerado. */
export function unzip(buf: Uint8Array): Record<string, string> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder();
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 30 <= buf.length && dv.getUint32(i, true) === 0x04034b50) {
    if (dv.getUint16(i + 8, true) !== 0) throw new Error("método de compressão não suportado");
    const size = dv.getUint32(i + 18, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extra = dv.getUint16(i + 28, true);
    const name = dec.decode(buf.subarray(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extra;
    const data = buf.subarray(start, start + size);
    if (crc32(data) !== dv.getUint32(i + 14, true)) throw new Error(`CRC inválido em ${name}`);
    out[name] = dec.decode(data);
    i = start + size;
  }
  return out;
}
