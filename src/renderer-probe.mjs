export const RENDERER_PROBE = `(() => {
  const fallbackTitle = "ChatGPT Trackable";
  const title = document.title?.trim() || fallbackTitle;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Only the Work/Codex task title in the top bar is eligible. Sidebar items can
  // have the same text, and inspecting them would leak a stale path into Settings
  // or another non-task screen.
  const candidates = [...document.querySelectorAll("button")].filter((element) =>
    element.classList.contains("no-drag")
    && element.textContent?.trim() === title
  );

  for (const element of candidates) {
    const roots = Object.getOwnPropertyNames(element)
      .filter((key) => key.startsWith("__reactFiber$"))
      .map((key) => element[key]);
    const queue = roots.map((value) => ({ value, depth: 0 }));
    const seen = new WeakSet();

    while (queue.length) {
      const { value, depth } = queue.shift();
      if (!value || (typeof value !== "object" && typeof value !== "function")) continue;
      if (seen.has(value) || depth > 6) continue;
      seen.add(value);

      let descriptors;
      try { descriptors = Object.getOwnPropertyDescriptors(value); } catch { continue; }
      for (const [key, descriptor] of Object.entries(descriptors).slice(0, 200)) {
        if (!("value" in descriptor)) continue;
        if (key === "threadId" && typeof descriptor.value === "string" && uuid.test(descriptor.value)) {
          return { title, threadId: descriptor.value };
        }
        queue.push({ value: descriptor.value, depth: depth + 1 });
      }
    }
  }

  return { title, threadId: null };
})()`;
