/** Senha mínima para acessos criados pelo escritório: 10 a 72 caracteres, com letra e número; recusa as óbvias. */
export const weakPassword = (p: string) => p.length < 10 || p.length > 72 || !/[A-Za-z]/.test(p) || !/\d/.test(p) || /senha|123456|password|lexsion/i.test(p);
