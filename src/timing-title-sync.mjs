#!/usr/bin/env node

import { AppServerClient } from "./app-server-client.mjs";
import { INSPECTOR_PORT, REAL_EXECUTABLE_NAME, appPaths } from "./config.mjs";
import {
  activeStateExpression,
  applyStateExpression,
  inspect,
} from "./inspector.mjs";
import { activityKey, normalizeActivity } from "./state.mjs";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const port = Number(process.env.CHATGPT_TRACKABLE_INSPECTOR_PORT ?? INSPECTOR_PORT);
const intervalMs = Number(process.env.CHATGPT_TRACKABLE_INTERVAL_MS ?? 750);
const refreshMs = Number(process.env.CHATGPT_TRACKABLE_REFRESH_MS ?? 30_000);
const codexPath = process.env.CHATGPT_TRACKABLE_CODEX_PATH ?? appPaths().codex;
const expectedExecutableName = process.env.CHATGPT_TRACKABLE_EXPECTED_EXECUTABLE
  ?? REAL_EXECUTABLE_NAME;

let appServer = null;
let previousKey = null;
let previousError = null;
let lastRefresh = 0;
let stopped = false;

async function getAppServer() {
  if (appServer) return appServer;
  const client = new AppServerClient(codexPath);
  try {
    await client.initialize();
    appServer = client;
    return client;
  } catch (error) {
    client.close();
    throw error;
  }
}

function reportError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === previousError) return;
  previousError = message;
  console.error(`[chatgpt-trackable] ${message}`);
}

function stop() {
  stopped = true;
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

try {
  while (!stopped) {
    try {
      const active = await inspect(port, activeStateExpression(expectedExecutableName));
      if (active?.error) throw new Error(active.error);

      let thread = null;
      if (active.threadId) {
        try {
          thread = await (await getAppServer()).readThread(active.threadId);
        } catch (error) {
          appServer?.close();
          appServer = null;
          throw error;
        }
      }

      const activity = normalizeActivity(active, thread);
      const key = activityKey(activity);
      const now = Date.now();
      if (key !== previousKey || now - lastRefresh >= refreshMs) {
        const applied = await inspect(port, applyStateExpression(activity));
        if (applied?.error) throw new Error(applied.error);
        previousKey = key;
        lastRefresh = now;
        console.log(JSON.stringify({
          title: applied.title,
          threadId: activity.threadId,
          representedFilename: applied.representedFilename,
        }));
      }
      previousError = null;
    } catch (error) {
      reportError(error);
      previousKey = null;
    }

    if (!stopped) await delay(intervalMs);
  }
} finally {
  appServer?.close();
}
