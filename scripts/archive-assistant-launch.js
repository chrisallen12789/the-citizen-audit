#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const assistantUrl = "http://127.0.0.1:4175/archive-assistant.html";
const helperHealthUrl = "http://127.0.0.1:4317/health";

async function isReachable(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    return response.ok;
  } catch {
    return false;
  }
}

function startProcess(label, scriptPath, args = []) {
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd: rootDir,
    stdio: "inherit",
    windowsHide: true
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.stdout.write(`${label} stopped (${signal}).\n`);
      return;
    }
    if (code !== 0) {
      process.stderr.write(`${label} exited with code ${code}.\n`);
    }
  });

  return child;
}

async function waitFor(url, label, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isReachable(url)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become reachable at ${url} within ${timeoutMs / 1000} seconds.`);
}

async function main() {
  const startedChildren = [];

  const helperAlreadyRunning = await isReachable(helperHealthUrl);
  if (helperAlreadyRunning) {
    process.stdout.write("Archive helper already running on http://127.0.0.1:4317.\n");
  } else {
    process.stdout.write("Starting archive helper on http://127.0.0.1:4317...\n");
    startedChildren.push(startProcess("Archive helper", path.join("scripts", "archive-assistant-helper.js")));
    await waitFor(helperHealthUrl, "Archive helper");
  }

  const assistantAlreadyRunning = await isReachable(assistantUrl);
  if (assistantAlreadyRunning) {
    process.stdout.write(`Archive Assistant already running at ${assistantUrl}.\n`);
  } else {
    process.stdout.write(`Starting archive assistant server at ${assistantUrl}...\n`);
    startedChildren.push(startProcess("Archive Assistant server", path.join("scripts", "archive-assistant-serve.js"), ["4175"]));
    await waitFor(assistantUrl, "Archive Assistant server");
  }

  process.stdout.write("\nArchive Assistant ready.\n");
  process.stdout.write(`Open ${assistantUrl}\n`);
  process.stdout.write("Press Ctrl+C to stop any processes started by this command.\n");

  if (!startedChildren.length) {
    return;
  }

  const stopChildren = () => {
    startedChildren.forEach((child) => {
      if (!child.killed) {
        child.kill();
      }
    });
  };

  process.on("SIGINT", () => {
    stopChildren();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    stopChildren();
    process.exit(0);
  });

  await new Promise(() => {});
}

main().catch((error) => {
  process.stderr.write(`archive-assistant-launch failed: ${error.message}\n`);
  process.exit(1);
});
