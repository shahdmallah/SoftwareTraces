import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const apiEnvPath = path.join(rootDir, "apps", "api", ".env");

function readApiEnv() {
  if (!existsSync(apiEnvPath)) {
    return {};
  }

  const values = {};
  const content = readFileSync(apiEnvPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = rawValue.replace(/^["']|["']$/g, "");
  }

  return values;
}

const apiEnv = readApiEnv();
const port = process.env.PORT || apiEnv.PORT || "3000";
const healthUrl = process.env.API_HEALTH_URL || `http://localhost:${port}/health`;
const intervalMs = Number(process.env.API_HEALTH_INTERVAL_MS || 10000);
const timeoutMs = Number(process.env.API_HEALTH_TIMEOUT_MS || 4000);
const maxFailures = Number(process.env.API_HEALTH_MAX_FAILURES || 3);
const restartGraceMs = Number(process.env.API_HEALTH_RESTART_GRACE_MS || 15000);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

let apiProcess = null;
let consecutiveFailures = 0;
let restartInProgress = false;
let shuttingDown = false;
let lastStartedAt = 0;

function log(message) {
  console.log(`[api-watchdog] ${message}`);
}

function startApi() {
  lastStartedAt = Date.now();
  consecutiveFailures = 0;
  log("starting API dev server");

  const child = spawn(npmCommand, ["run", "dev", "--workspace", "@traces/api"], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
  });
  apiProcess = child;

  child.on("exit", (code, signal) => {
    if (apiProcess === child) {
      apiProcess = null;
    }

    if (!restartInProgress && !shuttingDown) {
      log(`API process exited with code ${code ?? "none"} signal ${signal ?? "none"}; restarting`);
      setTimeout(startApi, 1000);
    }
  });
}

function stopProcessTree(child) {
  if (!child || child.killed) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const done = () => resolve();
    child.once("exit", done);

    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }).on("exit", done);
      return;
    }

    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 3000);
  });
}

async function checkHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(healthUrl, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function restartApi(reason) {
  if (restartInProgress) {
    return;
  }

  restartInProgress = true;
  log(`${reason}; restarting API dev server`);

  const processToStop = apiProcess;
  apiProcess = null;
  await stopProcessTree(processToStop);

  restartInProgress = false;
  startApi();
}

async function tick() {
  if (!apiProcess || restartInProgress) {
    return;
  }

  if (Date.now() - lastStartedAt < restartGraceMs) {
    return;
  }

  const healthy = await checkHealth();
  if (healthy) {
    if (consecutiveFailures > 0) {
      log("health check recovered");
    }
    consecutiveFailures = 0;
    return;
  }

  consecutiveFailures += 1;
  log(`health check failed ${consecutiveFailures}/${maxFailures}: ${healthUrl}`);

  if (consecutiveFailures >= maxFailures) {
    await restartApi("health check threshold reached");
  }
}

process.on("SIGINT", async () => {
  shuttingDown = true;
  log("stopping");
  const processToStop = apiProcess;
  apiProcess = null;
  await stopProcessTree(processToStop);
  process.exit(0);
});

process.on("SIGTERM", async () => {
  shuttingDown = true;
  log("stopping");
  const processToStop = apiProcess;
  apiProcess = null;
  await stopProcessTree(processToStop);
  process.exit(0);
});

log(`watching ${healthUrl} every ${intervalMs}ms`);
startApi();
setInterval(() => {
  void tick();
}, intervalMs);
