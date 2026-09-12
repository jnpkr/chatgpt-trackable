#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { APP_NAME, LAUNCH_AGENT_PATH } from "./config.mjs";
import { SERVICE_DOMAIN, SERVICE_TARGET } from "./service-config.mjs";

const execFileAsync = promisify(execFile);
const action = process.argv[2];

if (!new Set(["disable", "enable", "uninstall"]).has(action)) {
  console.error("Usage: node src/manage-service.mjs <disable|enable|uninstall>");
  process.exit(2);
}

async function exists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function run(command, args) {
  return execFileAsync(command, args, { maxBuffer: 10 * 1024 * 1024 });
}

async function isLoaded() {
  try {
    await run("/bin/launchctl", ["print", SERVICE_TARGET]);
    return true;
  } catch {
    return false;
  }
}

async function stopIfLoaded() {
  if (await isLoaded()) {
    await run("/bin/launchctl", ["bootout", SERVICE_DOMAIN, LAUNCH_AGENT_PATH]);
  }
}

async function disable() {
  if (!(await exists(LAUNCH_AGENT_PATH))) {
    throw new Error(`Service is not installed: ${LAUNCH_AGENT_PATH}`);
  }
  await stopIfLoaded();
  await run("/bin/launchctl", ["disable", SERVICE_TARGET]);
  console.log(JSON.stringify({ status: "disabled", launchAgent: LAUNCH_AGENT_PATH }, null, 2));
}

async function enable() {
  if (!(await exists(LAUNCH_AGENT_PATH))) {
    throw new Error(`Service is not installed: ${LAUNCH_AGENT_PATH}`);
  }
  await run("/bin/launchctl", ["enable", SERVICE_TARGET]);
  if (!(await isLoaded())) {
    await run("/bin/launchctl", ["bootstrap", SERVICE_DOMAIN, LAUNCH_AGENT_PATH]);
  }
  await run("/bin/launchctl", ["kickstart", "-k", SERVICE_TARGET]);
  console.log(JSON.stringify({ status: "enabled", launchAgent: LAUNCH_AGENT_PATH }, null, 2));
}

async function uninstall() {
  await stopIfLoaded();
  await run("/bin/launchctl", ["enable", SERVICE_TARGET]);

  if (!(await exists(LAUNCH_AGENT_PATH))) {
    console.log(JSON.stringify({ status: "already-uninstalled" }, null, 2));
    return;
  }

  const trashDirectory = path.join(os.homedir(), ".Trash");
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const trashedPath = path.join(trashDirectory, `${APP_NAME} service ${timestamp}.plist`);
  await fs.mkdir(trashDirectory, { recursive: true });
  await fs.rename(LAUNCH_AGENT_PATH, trashedPath);
  console.log(JSON.stringify({
    status: "uninstalled",
    trashedLaunchAgent: trashedPath,
  }, null, 2));
}

const actions = { disable, enable, uninstall };
actions[action]().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
