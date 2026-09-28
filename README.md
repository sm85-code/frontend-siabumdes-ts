# frontend-siabumdes-ts

Private **TypeScript** port of the live SIA BUMDes frontend.

| | |
|---|---|
| **Live FE (JS)** | [sm85-code/frontend-siabumdes](https://github.com/sm85-code/frontend-siabumdes) |
| **API** | [sm85-code/sm85-arch](https://github.com/sm85-code/sm85-arch) (`/api` BUMDes tenant) |
| **Stack** | Vite · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query · React Router 7 · Vitest · yarn |

Business menus and roles match the live app; this repo is the TypeScript production frontend. Public landing matches live transparency copy (no scaffold branding). Keep [frontend-siabumdes](https://github.com/sm85-code/frontend-siabumdes) available for rollback until smoke is solid.

## Quick start

```bash
cp .env.example .env
yarn install
yarn dev      # http://localhost:3000 — proxies /api → sm85-arch :8000
yarn test
yarn lint
yarn build
```

### Env & proxy

- `VITE_BACKEND_URL` (see `.env.example`) — origin of sm85-arch (default `http://localhost:8000`). Auth uses the HttpOnly cookie from `POST /api/auth/login`.
- Vite `server.proxy` forwards `/api` → `http://localhost:8000` in local dev (same-origin cookies).
- Transactions list uses **B3** `GET /transactions?meta=true` (`{ items, total, limit, offset, has_more }`). Live JS FE still defaults to the bare array; do not remove the array path on the API until live is retired.

### Compare to live `frontend-siabumdes`

| | Live (JS) | This repo (TS) |
|---|---|---|
| Status | **Production** | Private port — not cut over |
| Language | JSX | TypeScript (strict) |
| Data | Axios + local state | Axios + TanStack Query |
| Tx list | Client-heavy / array | Server pagination via `meta=true` |
| Unit tabs | Hardcoded UU01–UU06 | `buildUnitGroupTabs()` from `GET /unit-usaha` |

## Status

**Ported (F0–F3 + public landing + forms/typing):** Auth, Theme/Appearance, Layout + BottomNav, Login, roles/nav config, typed `src/api/*`, TanStack Query hooks, **public Landing / transparency** (`GET /api/public/summary`), **Dashboard**, **Transactions** (server pagination `meta=true`), **Reports** + per-unit + Tutup Buku, **Ledger**, **COA**, **Inventory (UU05)**, Unit Usaha, Org Profile, Users, Audit Log, Profile, Change Password. F3 adds vitest (role matrix + pure helpers), Login `htmlFor` a11y, StubPage removal, README cutover notes.

Unit group tabs come from `GET /unit-usaha` via `buildUnitGroupTabs()` — no hardcoded UU01–UU06.

## Defaults

Appearance matches live: **Biru** color theme, **Ripple** wallpaper, **Plus Jakarta Sans**, light mode.

## Forms & typing

- **zod + react-hook-form** on Login, Change Password, Users create, and COA account create/edit (`src/schemas/*`). Indonesian validation messages; live business rules unchanged.
- **`@ts-nocheck` cleared** on Accounts, Inventory, InventorySummary, OrgProfile, Users — incremental domain types in `src/types` (inventory + expanded OrgProfile/Account). Prefer real types over `any`.
- Utility `cn` remains `clsx` + `tailwind-merge` in `src/lib/utils.ts` (wrong npm `cn` package removed).

## Cutover checklist (do **not** run until ready)

Use this when swapping production from live JS FE → this TS FE. **Do not cut over as part of F3.**

1. **Env**
   - Set `VITE_BACKEND_URL` (or same-origin) to the production sm85-arch origin.
   - Confirm build embeds the correct API base (`yarn build` + inspect).
2. **CORS / cookies**
   - sm85-arch allows the new FE origin with credentials.
   - Cookie `Secure` / `SameSite` still works for the deploy host (HttpOnly session).
3. **API contract**
   - Confirm B3 `meta=true` on `GET /transactions` in prod.
   - `GET /unit-usaha` returns active units used for group tabs.
4. **Deploy swap**
   - Deploy this repo’s `dist/` behind the FE host (or new host + DNS).
   - Keep live `frontend-siabumdes` rollback-ready until smoke passes.
5. **Smoke test by role** (login each; check BottomNav / sidebar)
   - **admin** — Dashboard, COA, Transaksi, Laporan, Buku Besar, Inventory, Unit Usaha, Profil BUMDES, Audit Log, Users, Profil Saya.
   - **direktur** — same minus COA / Users / Audit (per `src/config/nav.ts` + roles).
   - **bendahara** — Dashboard, Transaksi, Laporan, Ledger, Inventory; no COA/Users/Audit/Unit/Org.
   - **pengelola** — core read menus; Inventory **only** if unit is perdagangan/manufaktur.
   - **pengawas / penasihat** — reports + unit/org profile; no Inventory / COA / Users.
6. **Functional smoke**
   - Login + forced change-password path.
   - Transactions: period filter, unit tabs, next/prev page (`meta` totals).
   - One report export / Tutup Buku (staging only if possible).
7. **Rollback**
   - Re-point host to previous live FE artifact if anything fails; API stays sm85-arch.

