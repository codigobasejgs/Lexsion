# Política de offline e cache (`public/sw.js`)

| Recurso | Estratégia | Sem rede |
|---|---|---|
| `/_next/static/*`, `/icons/*`, `/help/*` | cache-first (imutável, versionado) | disponível após 1ª carga |
| `/offline`, ícones, manifest | precache na instalação do SW | disponível |
| Navegação HTML de `/app/*`, `/portal/*`, `/entrar` | network-first; cópia guardada no cache `shell` | última cópia visitada; senão `/offline` |
| Requisições RSC (`RSC: 1` / `_rsc`) | **nunca** interceptadas nem cacheadas | Next re-tenta (useOffline) |
| `/api/*`, métodos ≠ GET, outras origens | **nunca** interceptadas | falha normal |
| Dados de domínio da demo | IndexedDB (`siwiltec-demo`), fora do SW | disponíveis |

**Por que o HTML de `/app/*` pode ir para cache nesta fase:** é um shell sem dados pessoais — os dados vêm do IndexedDB no cliente.
**Em produção com backend:** HTML autenticado passa a NetworkOnly (remover `/app` e `/portal` de `SHELL_ROUTES`), e logout/troca de organização limpa caches privados.

## Atualização
- SW novo fica em `waiting`; aviso "Nova versão disponível" com **Atualizar agora** / **Depois**.
- Com edição não salva (`useDirtyGuard`), atualizar é bloqueado com explicação.
- `SKIP_WAITING` só por ação do usuário; `controllerchange` recarrega **uma** vez (guarda contra loop).
- `activate` apaga só caches com prefixo `siwiltec-` de outras versões.

## Recuperação de SW problemático
1. Publicar `public/sw.js` com nova `VERSION` (qualquer build faz isso).
2. Emergência: publicar um `sw.js` que, em `activate`, apaga todos os caches `siwiltec-*` e chama `self.registration.unregister()`.
3. No navegador: DevTools → Application → Service Workers → Unregister; Storage → Clear site data.
