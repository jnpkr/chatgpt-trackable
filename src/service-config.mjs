import path from "node:path";
import { fileURLToPath } from "node:url";

import { BUNDLE_ID } from "./config.mjs";

export const PROJECT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SYNC_SCRIPT = path.join(PROJECT_ROOT, "src", "timing-title-sync.mjs");
export const NODE_PATH = "/opt/homebrew/bin/node";
export const SERVICE_NAME = `${BUNDLE_ID}.sync`;
export const SERVICE_DOMAIN = `gui/${process.getuid()}`;
export const SERVICE_TARGET = `${SERVICE_DOMAIN}/${SERVICE_NAME}`;
