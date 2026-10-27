import { describe, expect, it } from "vitest";
import { simplify } from "@/domain/plain-language";

describe("linguagem simples no portal", () => {
  it("explica termos técnicos sem reescrever o texto do escritório", () => {
    expect(simplify("Pedido protocolado no INSS, aguardando análise.")).toBe("Pedido protocolado (entregue oficialmente) no INSS (órgão que paga aposentadorias e benefícios), aguardando análise.");
  });
  it("explica cada termo uma vez e é idempotente", () => {
    const once = simplify("Perícia marcada. Leve exames à perícia.");
    expect(once.match(/exame com médico/g)).toHaveLength(1);
    expect(simplify(once)).toBe(once);
  });
  it("explicação nunca recebe explicação dentro dela", () => {
    const r = simplify("Aguardando perícia do INSS e audiência.");
    expect(r).toBe("Aguardando perícia (exame com médico ou especialista indicado pelo juiz ou pelo órgão) do INSS (órgão que paga aposentadorias e benefícios) e audiência (encontro marcado com o juiz).");
    expect(simplify(r)).toBe(r);
  });
  it("texto sem termos técnicos fica igual", () => {
    expect(simplify("Nenhuma ação sua no momento.")).toBe("Nenhuma ação sua no momento.");
  });
});
