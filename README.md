# ChatGPT Trackable

ChatGPT Trackable makes Timing record activity against individual ChatGPT conversations and Work/Codex tasks. It publishes the active title and working directory as native macOS window metadata that Timing can capture automatically.

## Tracking behaviour

- Normal ChatGPT conversations publish the conversation title.
- Work and Codex tasks publish the task title and working directory.
- Settings and other general screens publish their screen title without a working directory.

## How it works

The project creates `~/Applications/ChatGPT Trackable.app` from the official `/Applications/ChatGPT.app` with:

- the neutral bundle identifier `com.jonparker.chatgpt-trackable`;
- the display name `ChatGPT Trackable`;
- a distinct blue terminal icon already included with ChatGPT;
- a launcher that enables the local Electron inspector.

A per-user LaunchAgent connects to the inspector while ChatGPT Trackable is open. It reads the active conversation title and, for Work/Codex tasks, resolves the active task ID and working directory through the bundled Codex app server. It then updates the window title and represented file path used by Timing.

## Requirements

- macOS
- The official ChatGPT app at `/Applications/ChatGPT.app`
- Node.js at `/opt/homebrew/bin/node`
- pnpm

## Install

Run from this directory:

```sh
pnpm run install-app
pnpm run install-service
```

This installs:

- the app at `~/Applications/ChatGPT Trackable.app`;
- the LaunchAgent at `~/Library/LaunchAgents/com.jonparker.chatgpt-trackable.sync.plist`.

## Use

Quit the official ChatGPT app, then open `~/Applications/ChatGPT Trackable.app`.

ChatGPT Trackable uses the existing profile at `~/Library/Application Support/Codex`. Do not run it at the same time as the official ChatGPT app. The launcher blocks ChatGPT Trackable from opening when the official app is already running.

## Service management

Disable the service across logins:

```sh
pnpm run disable-service
```

Re-enable and start it:

```sh
pnpm run enable-service
```

Stop the service and uninstall its LaunchAgent:

```sh
pnpm run uninstall-service
```

Uninstall moves the LaunchAgent property list to Trash. Reinstall it with `pnpm run install-service`.

## Logs

The service logs activity changes and distinct errors to:

```text
~/Library/Logs/ChatGPT Trackable.log
```

The log rotates at 1 MiB and retains three backups: `.1`, `.2`, and `.3`.

## Updates

A ChatGPT update can replace the patched app metadata and launcher. After the updated app has quit, reapply them with:

```sh
pnpm run repair-app
```

Repair runs against a staged APFS clone and retains the previous app beside the installed app under a hidden, timestamped name.

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
- `CHATGPT_TRACKABLE_LOG_PATH`
- `CHATGPT_TRACKABLE_LOG_MAX_BYTES`
- `CHATGPT_TRACKABLE_LOG_BACKUPS`
