import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { unzip } from "../../src/lib/zip";

async function signIn(page: Page, who: RegExp) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app\//);
}

test("DOC-03/04/05: campo faltante bloqueia aprovação; DOCX baixado é OOXML válido com acentos", async ({ page }) => {
  await signIn(page, /Rafael Nunes/);
  await page.goto("/app/minutas/dr-lucia");
  const editor = page.getByLabel("Texto da minuta");
  const original = await editor.inputValue();

  // DOC-02/03: placeholder faltante sinalizado e aprovação bloqueada
  await editor.fill(`${original}\n\n[cliente.nis — não preenchido]`);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Minuta salva neste dispositivo.")).toBeVisible();
  await expect(page.getByText("Campos não preenchidos: cliente.nis")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar" })).toBeDisabled();

  // DOC-07: texto com marcação não vira código; vira texto escapado no DOCX
  await editor.fill(`${original}\n\n<img src=x onerror=alert(1)> “Ação” órgão 😀`);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Minuta salva neste dispositivo.")).toBeVisible();
  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByText("Aprovada.")).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Word (.docx)" }).click()]);
  expect(download.suggestedFilename()).toBe("Requerimento — pensão por morte (Lúcia).docx");
  const file = await download.path();
  const bytes = new Uint8Array(fs.readFileSync(file));
  expect(bytes.length).toBeGreaterThan(2000);
  expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK"
  const parts = unzip(bytes);
  expect(parts["[Content_Types].xml"]).toContain("wordprocessingml.document.main+xml");
  const doc = parts["word/document.xml"];
  expect(doc).toContain("Lúcia Fernanda Modelo");
  expect(doc).toContain("“Ação” órgão 😀");
  expect(doc).toContain("&lt;img src=x onerror=alert(1)&gt;");
  expect(parts["word/footer1.xml"]).toContain("Ambiente demonstrativo");
  await expect(page.getByText("Exportado", { exact: true })).toBeVisible();
});

test("DOC-07: marcação no editor não executa script na página", async ({ page }) => {
  let dialog = false;
  page.on("dialog", (d) => { dialog = true; void d.dismiss(); });
  await signIn(page, /Rafael Nunes/);
  await page.goto("/app/minutas/dr-lucia");
  await page.getByLabel("Texto da minuta").fill('<script>alert("x")</script><img src=x onerror=alert(2)>');
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Minuta salva neste dispositivo.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Texto da minuta")).toHaveValue(/<script>alert/);
  expect(dialog).toBe(false);
});
