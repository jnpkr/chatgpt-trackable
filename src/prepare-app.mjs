#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  APP_NAME,
  BUNDLE_ID,
  EXECUTABLE_NAME,
  REAL_EXECUTABLE_NAME,
  SOURCE_APP,
  TARGET_APP,
  appPaths,
} from "./config.mjs";

const execFileAsync = promisify(execFile);
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const launcherSource = path.join(sourceDirectory, "trackable-launcher.m");
const mode = process.argv[2] ?? "install";

if (!new Set(["install", "repair"]).has(mode)) {
  console.error("Usage: node src/prepare-app.mjs [install|repair]");
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

async function run(command, args, options = {}) {
  return execFileAsync(command, args, { maxBuffer: 10 * 1024 * 1024, ...options });
}

async function plistSet(plist, key, value) {
  await run("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, plist]);
}

async function plistRead(plist, key) {
  const { stdout } = await run("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plist]);
  return stdout.trim();
}

async function patchApp(appPath) {
  const paths = appPaths(appPath);
  const currentExecutable = await plistRead(paths.infoPlist, "CFBundleExecutable");
  const currentExecutablePath = path.join(paths.macos, currentExecutable);

  if (currentExecutable !== EXECUTABLE_NAME) {
    if (await exists(paths.realExecutable)) {
      throw new Error(`Refusing to overwrite existing ${REAL_EXECUTABLE_NAME}`);
    }
    await fs.rename(currentExecutablePath, paths.realExecutable);
  } else if (!(await exists(paths.realExecutable))) {
    throw new Error(`The app claims to be patched but ${REAL_EXECUTABLE_NAME} is missing`);
  }

  // PlistBuddy rewrites the file on every invocation, so these must be sequential.
  await plistSet(paths.infoPlist, "CFBundleIdentifier", BUNDLE_ID);
  await plistSet(paths.infoPlist, "CFBundleDisplayName", APP_NAME);
  await plistSet(paths.infoPlist, "CFBundleName", APP_NAME);
  await plistSet(paths.infoPlist, "CFBundleExecutable", EXECUTABLE_NAME);
  await plistSet(paths.infoPlist, "CFBundleIconFile", "app.icns");
  await plistSet(paths.infoPlist, "CrProductDirName", BUNDLE_ID);

  // CFBundleIconName can override CFBundleIconFile. It is optional, so absence is fine.
  await run("/usr/libexec/PlistBuddy", ["-c", "Delete :CFBundleIconName", paths.infoPlist])
    .catch(() => {});

  await run("/usr/bin/clang", [
    "-fobjc-arc",
    "-framework",
    "AppKit",
    launcherSource,
    "-o",
    paths.wrapper,
  ]);
  await fs.chmod(paths.wrapper, 0o755);
  await run("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", appPath]);

  return {
    appPath,
    bundleId: await plistRead(paths.infoPlist, "CFBundleIdentifier"),
    displayName: await plistRead(paths.infoPlist, "CFBundleDisplayName"),
    executable: await plistRead(paths.infoPlist, "CFBundleExecutable"),
    version: await plistRead(paths.infoPlist, "CFBundleShortVersionString"),
    build: await plistRead(paths.infoPlist, "CFBundleVersion"),
  };
}

async function prepare() {
  if (!(await exists(SOURCE_APP))) {
    throw new Error(`Source app not found: ${SOURCE_APP}`);
  }

  await fs.mkdir(path.dirname(TARGET_APP), { recursive: true });

  const targetExists = await exists(TARGET_APP);
  if (mode === "install" && targetExists) {
    const identity = await plistRead(appPaths(TARGET_APP).infoPlist, "CFBundleIdentifier");
    if (identity === BUNDLE_ID) {
      console.log(JSON.stringify({ status: "already-installed", appPath: TARGET_APP }));
      return;
    }
    throw new Error(`Target exists but is not ${APP_NAME}; run repair-app after checking it`);
  }
  if (mode === "repair" && !targetExists) {
    throw new Error(`Nothing to repair at ${TARGET_APP}; run install-app first`);
  }

  const inputApp = mode === "repair" ? TARGET_APP : SOURCE_APP;
  const stagingApp = path.join(
    path.dirname(TARGET_APP),
    `.${APP_NAME}.staging-${process.pid}.app`,
  );

  if (await exists(stagingApp)) {
    throw new Error(`Staging path already exists: ${stagingApp}`);
  }

  console.log(`Cloning ${inputApp} to a staging app...`);
  await run("/bin/cp", ["-cR", inputApp, stagingApp]);

  try {
    const result = await patchApp(stagingApp);
    if (targetExists) {
      const timestamp = new Date().toISOString().replaceAll(":", "-");
      const backup = path.join(
        path.dirname(TARGET_APP),
        `.${APP_NAME}.previous-${timestamp}.app`,
      );
      await fs.rename(TARGET_APP, backup);
      try {
        await fs.rename(stagingApp, TARGET_APP);
      } catch (error) {
        await fs.rename(backup, TARGET_APP);
        throw error;
      }
      result.previousApp = backup;
    } else {
      await fs.rename(stagingApp, TARGET_APP);
    }
    result.appPath = TARGET_APP;
    console.log(JSON.stringify({ status: "installed", ...result }, null, 2));
  } catch (error) {
    await fs.rm(stagingApp, { recursive: true, force: true });
    throw error;
  }
}

prepare().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
