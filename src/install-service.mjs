#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  LAUNCH_AGENT_PATH,
  LOG_PATH,
  TARGET_APP,
  appPaths,
} from "./config.mjs";
import {
  NODE_PATH,
  SERVICE_DOMAIN,
  SERVICE_NAME,
  SERVICE_TARGET,
  SYNC_SCRIPT,
} from "./service-config.mjs";

const execFileAsync = promisify(execFile);

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(NODE_PATH)}</string>
    <string>${escapeXml(SYNC_SCRIPT)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>${escapeXml(LOG_PATH)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(LOG_PATH)}</string>
</dict>
</plist>
`;

async function run(command, args) {
  return execFileAsync(command, args, { maxBuffer: 10 * 1024 * 1024 });
}

async function install() {
  await fs.access(appPaths(TARGET_APP).codex);
  await fs.mkdir(path.dirname(LAUNCH_AGENT_PATH), { recursive: true });
  await fs.writeFile(LAUNCH_AGENT_PATH, plist, "utf8");
  await run("/usr/bin/plutil", ["-lint", LAUNCH_AGENT_PATH]);

  await run("/bin/launchctl", ["bootout", SERVICE_DOMAIN, LAUNCH_AGENT_PATH]).catch(() => {});
  await run("/bin/launchctl", ["enable", SERVICE_TARGET]);
  await run("/bin/launchctl", ["bootstrap", SERVICE_DOMAIN, LAUNCH_AGENT_PATH]);
  await run("/bin/launchctl", ["kickstart", "-k", SERVICE_TARGET]);

  console.log(JSON.stringify({
    status: "installed",
    launchAgent: LAUNCH_AGENT_PATH,
    log: LOG_PATH,
  }, null, 2));
}

install().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
