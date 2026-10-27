// Contrato de autenticação. Nesta fase o adaptador é "não configurado": nunca cria sessão, nunca guarda senha,
// nunca afirma ter verificado credencial ou enviado e-mail. A fase backend troca por SupabaseAuthRepository.
import type { Result } from "./contracts";

export type AuthAudience = "escritorio" | "cliente";
export type AuthStatus = "not_configured" | "available" | "degraded";

export interface AuthRepository {
  status(): AuthStatus;
  signIn(input: { email: string; password: string; audience: AuthAudience }): Promise<Result<{ redirectTo: string }>>;
  requestPasswordReset(input: { email: string }): Promise<Result<{ accepted: true }>>;
  signOut(): Promise<Result<true>>;
}

const cid = () => crypto.randomUUID().slice(0, 8);
const unavailable = (message: string): Result<never> => ({ ok: false, error: { code: "auth_not_configured", message, retryable: false }, correlationId: cid() });

/** Adaptador desta fase: estado honesto, sem sessão e sem armazenamento de credenciais. */
export const notConfiguredAuth: AuthRepository = {
  status: () => "not_configured",
  signIn: async () => {
    await new Promise((r) => setTimeout(r, 400)); // mesmo tempo de resposta para qualquer e-mail (não revela existência de conta)
    return unavailable("O acesso com e-mail e senha ainda não está ativo nesta versão. Nenhuma senha foi verificada nem guardada. Você pode explorar a demonstração com perfis fictícios.");
  },
  requestPasswordReset: async () => unavailable("A recuperação de acesso ainda não está ativa nesta versão. Nenhum e-mail foi enviado."),
  signOut: async () => ({ ok: true, data: true, correlationId: cid() }),
};

export const authRepository: AuthRepository = notConfiguredAuth;
