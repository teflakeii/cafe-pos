# Cafe POS — Windows install & packaging guide

This app is a single‑PC café point‑of‑sale. Three local services run on the
same Windows machine and staff use them through the browser:

| Service | Port  | URL                     | Purpose                    |
| ------- | ----- | ----------------------- | -------------------------- |
| backend | 3000  | http://localhost:3000   | API + database (SQLite)    |
| POS     | 3001  | http://localhost:3001   | cashier / table workspace  |
| admin   | 3002  | http://localhost:3002   | management panel           |

Because everything is on `localhost`, no network or IP configuration is needed.

There are two ways to get it onto a Windows PC:

- **Path A — run it directly** (fastest; great for the VM test and for getting
  running tonight).
- **Path B — build a real `.exe` installer** (double‑click setup, Start‑menu /
  desktop shortcuts, uninstaller).

---

## Prerequisites

- **Node.js LTS** (20 or 22) — https://nodejs.org
- **pnpm** — after Node: `npm install -g pnpm`
- For Path B only: **Inno Setup 6** — https://jrsoftware.org/isdl.php
- **Microsoft Edge** is used for the app window (preinstalled on Windows; the
  launcher falls back to the default browser if it is missing).

> Testing in a VM: a Windows 11 VM (Parallels / VMware / UTM on Apple Silicon,
> or any on Intel) is a perfect place to build and test the installer. If the VM
> is ARM, install the ARM64 build of Node.

---

## Path A — run it directly

From a terminal in the project folder:

```bat
scripts\win\Setup.cmd
```

This installs dependencies, builds all three apps, then creates and seeds the
database (it generates a random JWT secret into `apps\backend\.env`).

Then launch:

```bat
scripts\win\Start.cmd
```

The backend, POS and admin start, and once the backend is healthy the POS opens
in an Edge app window. Keep the console window open while using the app; run
`scripts\win\Stop.cmd` (or close the window) to quit.

For a clean desktop shortcut, make a shortcut to `scripts\win\CafePOS.vbs`
(it launches everything with no console window).

**Default login:** `owner@cafe.local` / `Owner123!` — change the password after
first sign‑in. (Other seeded roles: `manager@cafe.local`, `cashier@cafe.local`,
`accountant@cafe.local`, all with `<Role>123!`.)

---

## Path B — build the `.exe` installer

Run these **on the Windows machine**, in the project folder:

```bat
pnpm install
pnpm build
node scripts\build-release.mjs
```

`build-release.mjs` assembles a self‑contained `release\` folder:

- `release\server\backend` — backend with production‑only dependencies
- `release\server\pos`, `release\server\admin` — Next.js standalone servers
- `release\data\seed.db` — a ready‑made template database (schema + accounts +
  menu + users); the live `cafe.db` is created from it on first launch
- `release\run.mjs`, `first-run.mjs`, `Start.vbs`, `Stop.cmd` — the launcher

### (Recommended) bundle Node so the café PC needs nothing installed

Download the Windows x64 Node runtime zip (matching the target architecture),
and place **just** `node.exe` at:

```
vendor\node\node.exe
```

`build-release.mjs` copies it into `release\node\` and the launcher uses it
automatically. Without it, the installed app falls back to a system‑wide Node.

### Compile the installer

Open `installer\cafepos.iss` in the **Inno Setup Compiler** and click *Compile*
(or run `iscc installer\cafepos.iss`). The result is:

```
installer\dist\CafePOS-Setup-1.0.0.exe
```

Run that on the café PC. It installs to `%LOCALAPPDATA%\Programs\CafePOS`
(no admin rights needed), adds **Cafe POS** / **Stop Cafe POS** shortcuts, and
can launch immediately. First launch initialises the database and JWT secret.

> The installer is unsigned, so Windows SmartScreen may warn on first run
> ("More info → Run anyway"). Code signing is optional and out of scope here.

---

## Data, backups & updates

- The live database is a single file: `…\CafePOS\data\cafe.db` (Path B) or
  `apps\backend\data\cafe.db` (Path A). **Back up this file** to back up all
  sales, shifts and ledger data.
- Uninstalling leaves `data\cafe.db` in place; reinstalling/upgrading reuses it.
- To update: build a new installer with a higher `MyAppVersion` in
  `cafepos.iss` and run it — app code is replaced, the database is preserved.

---

## Troubleshooting

- **Port already in use (3000/3001/3002):** another instance is running. Run
  `Stop.cmd`, or `taskkill /F /IM node.exe`, then start again.
- **App window doesn’t open but services run:** open http://localhost:3001
  manually; Edge may be absent.
- **`prisma` errors during build:** run `pnpm db:generate` and rebuild. The
  Prisma engine is platform‑specific, so always build the release on Windows.
- **`pnpm deploy` issues:** ensure you are on pnpm 9+ and ran `pnpm build`
  first; `build-release.mjs` also copies `dist` and `prisma` as a fallback.
- **Login fails right after install:** the database seeds on first launch; give
  the backend a few seconds, then retry with the default owner credentials.
