import os from "node:os";
import path from "node:path";

export const APP_NAME = "ChatGPT Trackable";
export const BUNDLE_ID = "com.jonparker.chatgpt-trackable";
export const EXECUTABLE_NAME = "ChatGPTTrackable";
export const REAL_EXECUTABLE_NAME = "ChatGPTTrackable.real";
export const INSPECTOR_PORT = 49281;

export const SOURCE_APP = process.env.CHATGPT_TRACKABLE_SOURCE_APP
  ?? "/Applications/ChatGPT.app";
export const TARGET_APP = process.env.CHATGPT_TRACKABLE_TARGET_APP
  ?? path.join(os.homedir(), "Applications", `${APP_NAME}.app`);
export const SHARED_PROFILE = process.env.CHATGPT_TRACKABLE_PROFILE
  ?? path.join(os.homedir(), "Library", "Application Support", "Codex");
export const LAUNCH_AGENT_PATH = path.join(
  os.homedir(),
  "Library",
  "LaunchAgents",
  `${BUNDLE_ID}.sync.plist`,
);
export const LOG_PATH = path.join(
  os.homedir(),
  "Library",
  "Logs",
  `${APP_NAME}.log`,
);

export function appPaths(appPath = TARGET_APP) {
  const contents = path.join(appPath, "Contents");
  return {
    appPath,
    contents,
    infoPlist: path.join(contents, "Info.plist"),
    macos: path.join(contents, "MacOS"),
    resources: path.join(contents, "Resources"),
    codex: path.join(contents, "Resources", "codex"),
    wrapper: path.join(contents, "MacOS", EXECUTABLE_NAME),
    realExecutable: path.join(contents, "MacOS", REAL_EXECUTABLE_NAME),
  };
}
