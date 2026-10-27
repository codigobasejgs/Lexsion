import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { qrMatrix, qrSvg } from "@/lib/qr";

// Decodificação real dos QR é feita por scripts/verify-qr.py (pyzbar/OpenCV) sobre os SVGs gravados aqui.
const CASES = ["http://localhost:3000/demo/tenant/aurora-advocacia", "https://atlas-juridico.lexsion.com.br/app/inicio?origem=qr", "LexSion — ação", "x".repeat(200), "y".repeat(130), "http://192.168.1.135:3000/demo/tenant/novo-escritorio?origem=qr&passo=instalar-no-celular-agora"];

describe("QR Code (QA-085)", () => {
  it("tamanhos por versão e erro acima da capacidade", () => {
    expect(qrMatrix("a").length).toBe(21);
    expect(qrMatrix("x".repeat(200)).length).toBe(57); // versão 10
    expect(() => qrMatrix("x".repeat(400))).toThrow();
  });
  it("grava amostras para verificação externa", () => {
    if (!process.env.QR_SAMPLES) return;
    fs.mkdirSync(process.env.QR_SAMPLES, { recursive: true });
    CASES.forEach((t, i) => fs.writeFileSync(`${process.env.QR_SAMPLES}/qr-${i}.svg`, qrSvg(t, 8)));
    fs.writeFileSync(`${process.env.QR_SAMPLES}/expected.json`, JSON.stringify(CASES));
  });
});
