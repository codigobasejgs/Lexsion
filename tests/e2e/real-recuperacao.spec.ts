import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Recuperação de acesso REAL: o Auth gera o mesmo token_hash que vai no e-mail (generateLink, sem enviar e-mail),
// a pessoa abre /redefinir-senha com ele, define nova senha e entra com ela. A senha antiga deixa de valer.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const SLOW = Number(process.env.SLOW ?? 30_000);
test.skip(!ON, "Supabase não configurado neste ambiente");
test.describe.configure({ timeout: 3 * SLOW + 30_000 });

test("REC-01: link de recuperação define nova senha; antiga deixa de valer; link não pode ser reutilizado", async ({ page }) => {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const tag = crypto.randomBytes(3).toString("hex");
  const email = `qa-rec-${tag}@lexsion-qa.invalid`, old = `Qa${crypto.randomBytes(10).toString("base64url")}1a`, nova = `Nova${crypto.randomBytes(8).toString("hex")}9z`;
  const { data: u } = await admin.auth.admin.createUser({ email, password: old, email_confirm: true });
  const { data: o } = await admin.from("organizations").insert({ slug: `qa-rec-${tag}`, name: "QA Recuperação" }).select("id").single();
  await admin.from("organization_memberships").insert({ organization_id: o!.id, user_id: u.user!.id, role: "admin" });
  try {
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    expect(error).toBeNull();
    const url = `/redefinir-senha?token_hash=${link.properties!.hashed_token}&type=recovery`;
    await page.goto(url);
    await expect(page).not.toHaveURL(/token_hash/, { timeout: SLOW }); // token sai da barra de endereço
    const fields = page.locator('input[type="password"]');
    await fields.nth(0).fill(nova);
    if ((await fields.count()) > 1) await fields.nth(1).fill(nova);
    await page.getByRole("button", { name: /Salvar|Definir|Redefinir/ }).click();
    await page.waitForURL(/\/entrar\?senha=definida/, { timeout: SLOW });

    const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    expect((await c.auth.signInWithPassword({ email, password: old })).error).not.toBeNull();
    expect((await c.auth.signInWithPassword({ email, password: nova })).error).toBeNull();

    const reuse = await c.auth.verifyOtp({ token_hash: link.properties!.hashed_token, type: "recovery" });
    expect(reuse.error).not.toBeNull(); // uso único

    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(nova);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(/\/app\/inicio/, { timeout: SLOW });
  } finally {
    await admin.from("organizations").delete().eq("id", o!.id);
    await admin.from("audit_logs").delete().eq("organization_id", o!.id);
    await admin.auth.admin.deleteUser(u.user!.id);
  }
});
