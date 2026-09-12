export function normalizeActivity(active, thread) {
  const title = active?.title?.trim() || "ChatGPT Trackable";
  return {
    windowId: active.windowId,
    title,
    threadId: active.threadId ?? null,
    representedFilename: active.threadId ? (thread?.cwd ?? "") : "",
  };
}

export function activityKey(activity) {
  return [
    activity.windowId,
    activity.title,
    activity.threadId ?? "",
    activity.representedFilename,
  ].join("\0");
}
