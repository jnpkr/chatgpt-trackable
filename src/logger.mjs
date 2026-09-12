import fs from "node:fs/promises";
import path from "node:path";

export class RotatingLogger {
  constructor(logPath, { maxBytes = 1024 * 1024, backups = 3 } = {}) {
    this.logPath = logPath;
    this.maxBytes = maxBytes;
    this.backups = backups;
  }

  async info(message) {
    await this.#write(message, console.log);
  }

  async error(message) {
    await this.#write(message, console.error);
  }

  async #write(message, fallback) {
    if (!this.logPath) {
      fallback(message);
      return;
    }

    const line = `${new Date().toISOString()} ${message}\n`;
    try {
      await fs.mkdir(path.dirname(this.logPath), { recursive: true });
      await this.#rotateIfNeeded(Buffer.byteLength(line));
      await fs.appendFile(this.logPath, line, "utf8");
    } catch (error) {
      fallback(`[chatgpt-trackable] Unable to write log: ${error.message}`);
    }
  }

  async #rotateIfNeeded(incomingBytes) {
    let currentBytes = 0;
    try {
      currentBytes = (await fs.stat(this.logPath)).size;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    if (currentBytes + incomingBytes <= this.maxBytes) return;

    for (let index = this.backups; index >= 1; index -= 1) {
      const destination = `${this.logPath}.${index}`;
      const source = index === 1 ? this.logPath : `${this.logPath}.${index - 1}`;
      if (index === this.backups) await fs.rm(destination, { force: true });
      try {
        await fs.rename(source, destination);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
}
