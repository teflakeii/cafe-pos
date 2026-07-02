// Production launcher for a single Windows PC (also runnable on macOS/Linux).
//
// Starts all three services in production mode, waits for the backend to become
// healthy, then opens the POS in a clean app window (Microsoft Edge --app mode,
// falling back to the default browser). Press Ctrl+C to stop everything.
//
// Run from the repo root:  node scripts/win-start.mjs
// Prereqs: `pnpm build` done and `node scripts/win-setup.mjs` run once.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const POS_URL = "http://localhost:3001";
const ADMIN_URL = "http://localhost:3002";
const HEALTH_URL = "http://localhost:3000/health";

const children = [];

function startService(filter, label) {
  const child = spawn(
    "corepack",
    ["pnpm", "--filter", filter, "run", "start:prod"],
    {
      cwd: repoRoot,
      stdio: "inherit",
      shell: isWindows,
      env: { ...process.env, NODE_ENV: "production" },
    },
  );
  child.on("exit", (code) => {
    process.stdout.write(`[launcher] ${label} exited (code ${code ?? 0})\n`);
  });
  children.push(child);
}

async function waitForBackend(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) return true;
    } catch {
      // backend not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function openApp(url) {
  if (isWindows) {
    // Try Edge in app mode for a chrome-less, kiosk-like window; fall back to default.
    const edge = spawn(
      "cmd",
      ["/c", "start", "", "msedge", `--app=${url}`],
      { stdio: "ignore", detached: true },
    );
    edge.on("error", () => {
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
    });
    return;
  }
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(opener, [url], { stdio: "ignore", detached: true });
}

function shutdown() {
  process.stdout.write("\n[launcher] shutting down services...\n");
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // already gone
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.stdout.write("[launcher] starting backend, POS and admin...\n");
startService("@cafe/backend", "backend");
startService("@cafe/pos", "POS");
startService("@cafe/admin", "admin");

const healthy = await waitForBackend();
if (healthy) {
  process.stdout.write(`[launcher] backend healthy. Opening POS at ${POS_URL}\n`);
  process.stdout.write(`[launcher] admin panel: ${ADMIN_URL}\n`);
  openApp(POS_URL);
} else {
  process.stdout.write(
    "[launcher] backend did not become healthy in time. Check the logs above.\n",
  );
}
