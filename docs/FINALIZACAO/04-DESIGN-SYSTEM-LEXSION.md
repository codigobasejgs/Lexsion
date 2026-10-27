# 04 — Design system LexSion

Fonte de verdade: `src/app/globals.css` (tokens) e `LEXSION/GUIA_IDENTIDADE_LEXSION.md` (guia da marca). Vitrine viva: `/design-system`.

## Tokens de marca
`--brand-obsidian #090a0d` · `--brand-onyx #14171d` · `--brand-graphite #232934` · `--brand-gold #c59a4a` · `--brand-gold-radiant #f6d88c` · `--brand-champagne #f7f2e8` · `--brand-ivory #fcfaf6` · `--brand-ink #18202b`.

## Tokens semânticos (escuro e claro)
`--canvas`, `--surface`, `--surface-muted`, `--surface-raised`, `--text-primary`, `--text-secondary`, `--border(-strong)`, `--brand(-hover)`, `--on-brand`, `--accent`, `--focus`, `--selection`, `--scrim`, estados `--success|warning|danger|info|ai` (+ `-bg`). Raio: `--radius-control|panel|dialog`.
- Tema claro: `--accent #855e1c`, sucesso `#0f6b59` (contraste ≥ 4,5:1 medido em todas as superfícies, unit `contrast`).
- Escritório (white-label) sobrescreve só `--brand`/`--accent`/fundos via `data-tenant`; cor ilegível é ajustada automaticamente (`lib/tenant-tokens.ts`).
- Preferências: densidade (`compacta|confortavel|espacosa`), tamanho do texto, movimento reduzido.

## Logos e hierarquia
- Plataforma: `public/brand/lexsion/*` (SVG originais da pasta LEXSION, sem redesenho). Componentes `LexSionLogo`, `LexSionEmblem` (`components/brand.tsx`).
- Escritório: `TenantLogo` com fallback de iniciais. Nunca mistura marca do escritório no Super Admin.
- “Tecnologia LexSion” discreto opcional (`showPoweredBy`).

## Componentes
`components/ui.tsx`: `PageHeader`, `Badge`, `Stat`, `Dialog` (corpo rolável, foco preso), `EmptyState`; `components/form.tsx`; classes `.btn`, `.field`, `.panel`, `.label`, `.num`.
