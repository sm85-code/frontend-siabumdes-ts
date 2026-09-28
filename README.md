# frontend-siabumdes-ts

Private **TypeScript** port of the live SIA BUMDes frontend.

| | |
|---|---|
| **Live FE (JS)** | [sm85-code/frontend-siabumdes](https://github.com/sm85-code/frontend-siabumdes) |
| **API** | [sm85-code/sm85-arch](https://github.com/sm85-code/sm85-arch) (`/api` BUMDes tenant) |
| **Stack** | Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router 7 · yarn |

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

## F0 scaffold status

**Ported:** Auth, Theme/Appearance (defaults: Ripple wallpaper, Biru theme, Plus Jakarta Sans), Layout + BottomNav shell, Login, centralized `src/config/roles.ts`, stub pages for all routes.

**Not in F0:** full Inventory / Transactions / Reports / Dashboard / COA / etc. page ports — see F1+.

## Defaults

Appearance matches live: **Biru** color theme, **Ripple** wallpaper, **Plus Jakarta Sans**, light mode.
