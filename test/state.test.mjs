import assert from "node:assert/strict";
import test from "node:test";

import { activityKey, normalizeActivity } from "../src/state.mjs";

test("normal ChatGPT conversations have a title but no represented path", () => {
  assert.deepEqual(
    normalizeActivity({ windowId: 4, title: "Sussex Fish To Catch", threadId: null }),
    {
      windowId: 4,
      title: "Sussex Fish To Catch",
      threadId: null,
      representedFilename: "",
    },
  );
});

test("Work and Codex tasks use the exact cwd returned by thread/read", () => {
  assert.deepEqual(
    normalizeActivity(
      { windowId: 4, title: "Fix Timing ChatGPT tracking", threadId: "task-id" },
      { cwd: "/Users/jon/Documents/Codex/2026-09-11/it" },
    ),
    {
      windowId: 4,
      title: "Fix Timing ChatGPT tracking",
      threadId: "task-id",
      representedFilename: "/Users/jon/Documents/Codex/2026-09-11/it",
    },
  );
});

test("a task without cwd fails safely by clearing the represented path", () => {
  assert.equal(
    normalizeActivity({ windowId: 4, title: "Task", threadId: "task-id" }, {}).representedFilename,
    "",
  );
});

test("the activity key changes when the represented path changes", () => {
  const original = {
    windowId: 4,
    title: "Task",
    threadId: "task-id",
    representedFilename: "/first",
  };
  assert.notEqual(activityKey(original), activityKey({ ...original, representedFilename: "/second" }));
});
