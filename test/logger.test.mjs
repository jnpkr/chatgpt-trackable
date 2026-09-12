import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { RotatingLogger } from "../src/logger.mjs";

test("rotates a log and retains only the configured backups", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "chatgpt-trackable-log-"));
  const logPath = path.join(directory, "service.log");
  const logger = new RotatingLogger(logPath, { maxBytes: 120, backups: 2 });

  try {
    for (let index = 0; index < 5; index += 1) {
      await logger.info(`${index}:${"x".repeat(80)}`);
    }

    const files = (await fs.readdir(directory)).sort();
    assert.deepEqual(files, ["service.log", "service.log.1", "service.log.2"]);
    assert.match(await fs.readFile(logPath, "utf8"), /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
