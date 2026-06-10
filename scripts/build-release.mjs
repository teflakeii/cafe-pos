// Assembles a self-contained `release/` folder for the Windows installer.
// RUN THIS ON THE WINDOWS BUILD MACHINE, after: `pnpm install` && `pnpm build`.
//
// Produces:
//   release/server/backend   backend (dist + prisma + flat prod node_modules)
//   release/server/pos        POS Next.js standalone server
//   release/server/admin      admin Next.js standalone server
//   release/data/seed.db      template DB (migrated + seeded)
//   release/run.mjs, first-run.mjs, Start.vbs   runtime launcher
//   release/node/node.exe     bundled Node (if vendor/node/node.exe is provided)
//
// Then point Inno Setup (installer/cafepos.iss) at release/ to build the .exe.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const release = join(repoRoot, "release");
const backendDir = join(repoRoot, "apps", "backend");
const isWindows = process.platform === "win32";

function log(message) {
  process.stdout.write(`[release] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[release] ERROR: ${message}\n`);
  process.exit(1);
}

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: isWindows,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) fail(`command failed: ${command} ${args.join(" ")}`);
}

function copyDir(src, dst) {
  if (!existsSync(src)) fail(`expected folder is missing: ${src}`);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
}

// --- 0. sanity checks -------------------------------------------------------
if (!existsSync(join(backendDir, "dist", "main.js")))
  fail("backend is not built. Run `pnpm build` first.");
for (const app of ["pos", "admin"]) {
  if (!existsSync(join(repoRoot, "apps", app, ".next", "standalone")))
    fail(`apps/${app} standalone output missing. Run \`pnpm build\` first.`);
}

// --- 1. clean ---------------------------------------------------------------
if (existsSync(release)) rmSync(release, { recursive: true, force: true });
mkdirSync(join(release, "server"), { recursive: true });
mkdirSync(join(release, "data"), { recursive: true });

// --- 2. backend (flat, production-only deps) --------------------------------
log("deploying backend (pnpm deploy --prod)...");
run("pnpm", ["--filter", "@cafe/backend", "--prod", "deploy", join(release, "server", "backend")], repoRoot);
// Make sure the build output and Prisma schema/migrations are present.
if (!existsSync(join(release, "server", "backend", "dist")))
  copyDir(join(backendDir, "dist"), join(release, "server", "backend", "dist"));
if (!existsSync(join(release, "server", "backend", "prisma")))
  copyDir(join(backendDir, "prisma"), join(release, "server", "backend", "prisma"));

// --- 3. POS + admin standalone ---------------------------------------------
for (const app of ["pos", "admin"]) {
  log(`assembling ${app} standalone...`);
  const appSrc = join(repoRoot, "apps", app);
  const dst = join(release, "server", app);
  copyDir(join(appSrc, ".next", "standalone"), dst);
  copyDir(join(appSrc, ".next", "static"), join(dst, "apps", app, ".next", "static"));
  if (existsSync(join(appSrc, "public")))
    copyDir(join(appSrc, "public"), join(dst, "apps", app, "public"));
}

// --- 4. template database (migrated + seeded) -------------------------------
log("building template database...");
const seedDbUrl = `file:${join(release, "data", "seed.db").replace(/\\/g, "/")}`;
run("pnpm", ["exec", "prisma", "migrate", "deploy"], backendDir, { DATABASE_URL: seedDbUrl });
run("node", [join(backendDir, "dist", "seed", "seed.service.js")], backendDir, {
  DATABASE_URL: seedDbUrl,
  NODE_ENV: "production",
});

// --- 5. runtime launcher ----------------------------------------------------
log("copying runtime launcher...");
for (const file of ["run.mjs", "first-run.mjs", "Start.vbs", "Stop.cmd"]) {
  cpSync(join(repoRoot, "installer", "runtime", file), join(release, file));
}

// --- 6. bundled Node (optional but recommended) -----------------------------
const vendorNode = join(repoRoot, "vendor", "node", "node.exe");
if (existsSync(vendorNode)) {
  mkdirSync(join(release, "node"), { recursive: true });
  cpSync(vendorNode, join(release, "node", "node.exe"));
  log("bundled Node runtime included");
} else {
  log("NOTE: vendor/node/node.exe not found — installer will rely on system Node.");
  log("      To bundle Node, see BUILD-INSTALLER.md.");
}

log("release/ assembled. Next: build the installer with Inno Setup (installer/cafepos.iss).");
