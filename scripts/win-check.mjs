import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

const colors = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

const results = [];

function color(text, value) {
  return `${value}${text}${colors.reset}`;
}

function pass(label, detail) {
  results.push({ status: "pass", blocking: false });
  console.log(`${color("✔ PASS", colors.green)} ${label}${detail ? ` - ${detail}` : ""}`);
}

function warn(label, detail, blocking = true) {
  results.push({ status: "warning", blocking });
  console.log(`${color("⚠ WARNING", colors.yellow)} ${label}${detail ? ` - ${detail}` : ""}`);
}

function fail(label, detail) {
  results.push({ status: "fail", blocking: true });
  console.log(`${color("✖ FAIL", colors.red)} ${label}${detail ? ` - ${detail}` : ""}`);
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: isWindows,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function relativePath(path) {
  return path.replace(`${repoRoot}${isWindows ? "\\" : "/"}`, "");
}

function checkNodeVersion() {
  const version = process.versions.node;
  const major = Number(version.split(".")[0]);

  if (major === 20 || major === 22) {
    pass("Node.js version", `v${version}`);
    return;
  }

  fail("Node.js version", `v${version} is unsupported. Install Node.js LTS 20.x or 22.x.`);
}

function checkCommand(label, command, args, successDetail) {
  const result = run(command, args);
  if (result.status === 0) {
    const output = result.stdout.trim() || result.stderr.trim();
    pass(label, successDetail ?? output);
    return true;
  }

  const message = (result.stderr || result.stdout || "").trim();
  fail(label, message || `${command} ${args.join(" ")} failed or was not found.`);
  return false;
}

function checkPath(label, path, missingDetail, options = {}) {
  if (existsSync(path)) {
    pass(label, relativePath(path));
    return true;
  }

  if (options.warning) {
    warn(label, missingDetail);
  } else {
    fail(label, missingDetail);
  }
  return false;
}

function checkPrismaClient() {
  const candidates = [
    join(repoRoot, "apps", "backend", "node_modules", "@prisma", "client"),
    join(repoRoot, "apps", "backend", "node_modules", ".prisma", "client"),
    join(repoRoot, "node_modules", "@prisma", "client"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      pass("Prisma Client", relativePath(candidate));
      return;
    }
  }

  fail("Prisma Client", "not found. Run scripts\\win\\Setup.cmd or corepack pnpm db:generate.");
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        fail(`Port ${port}`, "already in use. Stop Cafe POS or the process using this port before startup.");
      } else {
        fail(`Port ${port}`, error.message);
      }
      resolve();
    });

    server.once("listening", () => {
      server.close(() => {
        pass(`Port ${port}`, "free");
        resolve();
      });
    });

    server.listen(port, "127.0.0.1");
  });
}

async function main() {
  console.log(color("Cafe POS Windows Installation Check", colors.bold));
  console.log("");

  checkNodeVersion();
  const hasCorepack = checkCommand("Corepack", "corepack", ["--version"]);
  if (hasCorepack) {
    checkCommand("pnpm", "corepack", ["pnpm", "--version"]);
  } else {
    checkCommand("pnpm", "pnpm", ["--version"]);
  }

  checkPrismaClient();
  checkPath(
    "Backend environment",
    join(repoRoot, "apps", "backend", ".env"),
    "apps\\backend\\.env is missing. Run scripts\\win\\Setup.cmd.",
  );
  checkPath(
    "POS environment",
    join(repoRoot, "apps", "pos", ".env.local"),
    "apps\\pos\\.env.local is missing. Run scripts\\win\\Setup.cmd.",
  );
  checkPath(
    "Admin environment",
    join(repoRoot, "apps", "admin", ".env.local"),
    "apps\\admin\\.env.local is missing. Run scripts\\win\\Setup.cmd.",
  );
  checkPath(
    "SQLite database",
    join(repoRoot, "apps", "backend", "data", "cafe.db"),
    "database not found. Setup has not been executed successfully yet.",
    { warning: true },
  );
  checkPath(
    "Backend build",
    join(repoRoot, "apps", "backend", "dist"),
    "apps\\backend\\dist is missing. Run scripts\\win\\Setup.cmd.",
  );
  checkPath(
    "POS standalone build",
    join(repoRoot, "apps", "pos", ".next", "standalone"),
    "apps\\pos\\.next\\standalone is missing. Run scripts\\win\\Setup.cmd.",
  );
  checkPath(
    "Admin standalone build",
    join(repoRoot, "apps", "admin", ".next", "standalone"),
    "apps\\admin\\.next\\standalone is missing. Run scripts\\win\\Setup.cmd.",
  );

  await checkPort(3000);
  await checkPort(3001);
  await checkPort(3002);

  console.log("");
  const blockingIssues = results.filter((result) => result.blocking);
  if (blockingIssues.length === 0) {
    console.log(color("READY FOR STARTUP", colors.green));
  } else {
    console.log(color("SETUP INCOMPLETE", colors.red));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  fail("Unexpected check error", error instanceof Error ? error.message : String(error));
  console.log("");
  console.log(color("SETUP INCOMPLETE", colors.red));
  process.exitCode = 1;
});
