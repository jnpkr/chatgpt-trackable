# ChatGPT Trackable

ChatGPT Trackable is a neutral copy of the unified ChatGPT desktop app that exposes the active conversation to Timing through ordinary macOS window metadata.

It records:

- the active conversation title for normal ChatGPT conversations;
- the active task title and working directory for Work and Codex tasks;
- a title with no stale working directory on Settings and other non-task screens.

It does not read or write Timing's database and does not create time entries or timers.

## How it works

The installer makes `~/Applications/ChatGPT Trackable.app` from the official `/Applications/ChatGPT.app`. Its changes are deliberately mechanical:

1. Give the copy a neutral bundle identifier and the name `ChatGPT Trackable`.
2. Use the different blue terminal icon already shipped inside the official app.
3. Wrap the original executable so the Electron main-process inspector is available locally.
4. Ad-hoc sign the resulting app.

A small per-user background service reads the active renderer title. For Work and Codex tasks, it obtains the exact task ID from the active header and calls the documented read-only `thread/read` method to resolve the task's working directory. It then sets the native macOS title and represented file path that Timing already knows how to record.

## Background service

`pnpm run install-service` installs this per-user macOS LaunchAgent:

```text
~/Library/LaunchAgents/com.jonparker.chatgpt-trackable.sync.plist
```

macOS starts it at login, restarts it if it exits, and runs this command:

```text
/opt/homebrew/bin/node /Users/jon/Dev/personal/chatgpt-trackable/src/timing-title-sync.mjs
```

The service remains running when ChatGPT Trackable is closed, but does no app-server work until it finds the app's local inspector on port `49281`. Its output is written to:

```text
~/Library/Logs/ChatGPT Trackable.log
```

To stop the service and keep it disabled across logins:

```sh
pnpm run disable-service
```

To re-enable and start it:

```sh
pnpm run enable-service
```

To stop the service and uninstall its LaunchAgent:

```sh
pnpm run uninstall-service
```

Uninstalling the service moves the LaunchAgent property list to Trash so it remains recoverable. It does not remove ChatGPT Trackable, this project, or the service log.

## Safety boundary

ChatGPT Trackable uses the existing profile at `~/Library/Application Support/Codex`. Its launcher refuses to start while the official ChatGPT app is running. Do not start the official app while ChatGPT Trackable is open, because two Electron instances must not write to the same profile concurrently.

The project never accesses Timing's database.

## Install

From this directory:

```sh
pnpm run install-app
pnpm run install-service
```

Quit the official ChatGPT app, then open `~/Applications/ChatGPT Trackable.app`.

## Updates

An in-app update may restore OpenAI's original name, identifier, executable, and signature. After the updated app has quit, run:

```sh
pnpm run repair-app
```

Repairing is done against a staged APFS clone. The previous app is retained beside the installed app under a hidden, timestamped name rather than deleted.

## Configuration

The defaults can be overridden with environment variables:

- `CHATGPT_TRACKABLE_SOURCE_APP`
- `CHATGPT_TRACKABLE_TARGET_APP`
- `CHATGPT_TRACKABLE_PROFILE`
- `CHATGPT_TRACKABLE_INSPECTOR_PORT`
- `CHATGPT_TRACKABLE_INTERVAL_MS`
- `CHATGPT_TRACKABLE_REFRESH_MS`
- `CHATGPT_TRACKABLE_CODEX_PATH`
- `CHATGPT_TRACKABLE_EXPECTED_EXECUTABLE`
