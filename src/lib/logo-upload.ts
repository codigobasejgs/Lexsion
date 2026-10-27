// Validação de logotipo enviado pelo escritório (QA-049..056).
// Política: SVG enviado NÃO é renderizado (pode conter script); aceita-se PNG/JPEG/WebP verificados pela ASSINATURA
// dos bytes (não pela extensão nem pelo MIME declarado), até 2 MB, de 64 a 4096 px. O arquivo é reencodado em PNG
// por <canvas> (descarta metadados e qualquer conteúdo extra) antes de virar data: URL salva na demo.
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export type LogoKind = "png" | "jpeg" | "webp" | "svg" | "desconhecido";

export function sniff(bytes: Uint8Array): LogoKind {
  const b = (i: number) => bytes[i];
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "png";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpeg";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  const head = new TextDecoder().decode(bytes.slice(0, 512)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return "desconhecido";
}

/** Regras sobre bytes + nome (puro, testável). Dimensões são checadas depois da decodificação. */
export function validateLogoBytes(bytes: Uint8Array, fileName: string): string | null {
  if (bytes.length === 0) return "Arquivo vazio.";
  if (bytes.length > MAX_LOGO_BYTES) return "Arquivo maior que 2 MB. Exporte o logotipo em tamanho menor.";
  const kind = sniff(bytes);
  if (kind === "svg") return "SVG não é aceito no envio (pode conter código). Envie PNG, JPEG ou WebP; a equipe LexSion converte vetores na fase com backend.";
  if (kind === "desconhecido") return "Formato não reconhecido. Envie PNG, JPEG ou WebP.";
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const ok = { png: ["png"], jpeg: ["jpg", "jpeg"], webp: ["webp"] }[kind];
  if (!ok.includes(ext)) return `O conteúdo é ${kind.toUpperCase()}, mas a extensão é “.${ext}”. Renomeie corretamente e envie de novo.`;
  return null;
}

export function validateLogoSize(w: number, h: number): string | null {
  if (w < 64 || h < 64) return "Imagem muito pequena (mínimo 64 × 64 px). Para o ícone do aplicativo, use 512 × 512 px.";
  if (w > 4096 || h > 4096) return "Imagem muito grande (máximo 4096 px por lado).";
  return null;
}

/** Navegador: valida, decodifica e reencoda em PNG (máx. 512 px no lado maior). */
export async function processLogo(file: File): Promise<{ dataUrl: string; width: number; height: number } | { error: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const err = validateLogoBytes(bytes, file.name);
  if (err) return { error: err };
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([bytes]));
  } catch {
    return { error: "Arquivo corrompido ou incompleto: não foi possível abrir a imagem." };
  }
  const sizeErr = validateLogoSize(bmp.width, bmp.height);
  if (sizeErr) return { error: sizeErr };
  const scale = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/png"), width: bmp.width, height: bmp.height };
}
