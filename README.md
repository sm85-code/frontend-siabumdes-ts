# frontend-siabumdes-ts

Private **TypeScript** port of the live SIA BUMDes frontend.

| | |
|---|---|
| **Live FE (JS)** | [sm85-code/frontend-siabumdes](https://github.com/sm85-code/frontend-siabumdes) |
| **API** | [sm85-code/sm85-arch](https://github.com/sm85-code/sm85-arch) (`/api` BUMDes tenant) |
| **Stack** | Vite · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query · React Router 7 · yarn |

Business menus and roles match the live app; this repo is a new codebase (does not replace production).

## Quick start

```bash
cp .env.example .env
yarn install
yarn dev      # http://localhost:3000
yarn build
yarn lint
```

`VITE_BACKEND_URL` points at sm85-arch (default `http://localhost:8000`). Auth uses the HttpOnly cookie from `POST /api/auth/login`.

## Status

**Ported (F0+F1):** Auth, Theme/Appearance, Layout + BottomNav, Login, roles config, typed `src/api/*` (auth, units, reports/dashboard, transactions B3 helper), TanStack Query hooks, **Dashboard** (KPIs, charts, dynamic unit count from API).

**Still stubs (F2+):** Inventory, Transactions UI, Reports, Ledger, COA, Users, Audit Log, Org Profile, Unit Usaha page, Profile, Change Password.

Unit group tabs must come from `GET /unit-usaha` via `buildUnitGroupTabs()` — no hardcoded UU01–UU06.

## Defaults

Appearance matches live: **Biru** color theme, **Ripple** wallpaper, **Plus Jakarta Sans**, light mode.
