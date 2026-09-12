import { spawn } from "node:child_process";
import readline from "node:readline";

export class AppServerClient {
  constructor(executablePath) {
    this.nextId = 1;
    this.pending = new Map();
    this.child = spawn(executablePath, ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.stderr = "";
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => {
      this.stderr = `${this.stderr}${chunk}`.slice(-4_000);
    });
    this.lines = readline.createInterface({ input: this.child.stdout });
    this.lines.on("line", (line) => this.#handleLine(line));
    this.child.on("error", (error) => this.#rejectAll(error));
    this.child.on("exit", (code, signal) => {
      const detail = this.stderr.trim();
      this.#rejectAll(new Error(
        `app-server exited (code=${code}, signal=${signal})${detail ? `: ${detail}` : ""}`,
      ));
    });
  }

  #handleLine(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.id === undefined) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
    else pending.resolve(message.result);
  }

  #rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  #send(message) {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #request(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 10_000);
      this.pending.set(id, { resolve, reject, timer });
      this.#send({ method, id, params });
    });
  }

  async initialize() {
    await this.#request("initialize", {
      clientInfo: {
        name: "chatgpt_trackable",
        title: "ChatGPT Trackable",
        version: "0.1.0",
      },
    });
    this.#send({ method: "initialized", params: {} });
  }

  async readThread(threadId) {
    const result = await this.#request("thread/read", {
      threadId,
      includeTurns: false,
    });
    return result.thread;
  }

  close() {
    this.lines.close();
    this.child.kill("SIGTERM");
  }
}
