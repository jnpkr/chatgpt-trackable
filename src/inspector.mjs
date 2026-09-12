import { RENDERER_PROBE } from "./renderer-probe.mjs";

export async function inspectorTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Inspector returned HTTP ${response.status}`);
  const targets = await response.json();
  const target = targets.find((item) => item.webSocketDebuggerUrl);
  if (!target) throw new Error("No Electron main-process inspector target found");
  return target;
}

export async function inspect(port, expression) {
  const target = await inspectorTarget(port);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  try {
    return await new Promise((resolve, reject) => {
      const id = 1;
      const timer = setTimeout(() => reject(new Error("Inspector evaluation timed out")), 5_000);
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timer);
        if (message.error) return reject(new Error(message.error.message));
        if (message.result?.exceptionDetails) {
          return reject(new Error(message.result.exceptionDetails.text ?? "Inspector evaluation failed"));
        }
        resolve(message.result?.result?.value);
      });
      socket.send(JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: { expression, returnByValue: true, awaitPromise: true },
      }));
    });
  } finally {
    socket.close();
  }
}

export function activeStateExpression(expectedExecutableName) {
  return `(async () => {
  const electron = process.getBuiltinModule?.("electron") ?? process.mainModule?.require("electron");
  const actualExecutableName = process.execPath.split("/").pop();
  if (actualExecutableName !== ${JSON.stringify(expectedExecutableName)}) {
    return { error: "Inspector belongs to an unexpected executable: " + actualExecutableName };
  }
  const windows = electron.BrowserWindow.getAllWindows().filter((window) =>
    !window.isDestroyed() && window.isVisible()
  );
  const window = windows.find((candidate) => candidate.isFocused()) ?? windows[0];
  if (!window) return { error: "No visible BrowserWindow found" };
  const renderer = await window.webContents.executeJavaScript(${JSON.stringify(RENDERER_PROBE)});
  return { windowId: window.id, ...renderer };
})()`;
}

export function applyStateExpression({ windowId, title, representedFilename }) {
  return `(() => {
    const electron = process.getBuiltinModule?.("electron") ?? process.mainModule?.require("electron");
    const window = electron.BrowserWindow.fromId(${JSON.stringify(windowId)});
    if (!window || window.isDestroyed()) return { error: "BrowserWindow disappeared" };
    window.setTitle(${JSON.stringify(title)});
    window.setRepresentedFilename(${JSON.stringify(representedFilename)});
    return {
      title: window.getTitle(),
      representedFilename: window.getRepresentedFilename(),
    };
  })()`;
}
