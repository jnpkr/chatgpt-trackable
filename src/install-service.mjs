#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  BUNDLE_ID,
  LAUNCH_AGENT_PATH,
  LOG_PATH,
  TARGET_APP,
  appPaths,
} from "./config.mjs";

const execFileAsync = promisify(execFile);
const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const syncScript = path.join(projectRoot, "src", "timing-title-sync.mjs");
// Use Homebrew's stable shim so a Node upgrade does not strand the LaunchAgent
// on a removed versioned Cellar path.
const nodePath = "/opt/homebrew/bin/node";
const serviceName = `${BUNDLE_ID}.sync`;
const domain = `gui/${process.getuid()}`;

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
  <string>${serviceName}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(nodePath)}</string>
    <string>${escapeXml(syncScript)}</string>
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

  await run("/bin/launchctl", ["bootout", domain, LAUNCH_AGENT_PATH]).catch(() => {});
  await run("/bin/launchctl", ["bootstrap", domain, LAUNCH_AGENT_PATH]);
  await run("/bin/launchctl", ["kickstart", "-k", `${domain}/${serviceName}`]);

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
