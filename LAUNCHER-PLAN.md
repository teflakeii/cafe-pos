# Cafe POS Launcher Plan

This document describes the future `Launcher.exe` architecture. It is a plan only. It does not implement the launcher.

## Purpose

`Launcher.exe` should be the single customer-facing entry point for Cafe POS on Windows. Customers should not need to run CMD, PowerShell, pnpm, npm, or Node commands manually.

## Responsibilities

The launcher should:

- Start the backend service.
- Wait until the backend health endpoint is ready.
- Start POS.
- Optionally start or open Admin.
- Open POS in an app-style browser window.
- Detect crashes.
- Write launcher logs.
- Shut down all child processes correctly.

## Startup Flow

1. Load configuration from `%ProgramData%\Cafe POS\config`.
2. Check that the SQLite database exists.
3. Check that required ports are available.
4. Start backend.
5. Poll backend health endpoint:

```text
http://localhost:3000/health
```

6. If backend becomes healthy, start POS.
7. Open POS:

```text
http://localhost:3001
```

8. If configured, open Admin:

```text
http://localhost:3002
```

## Process Model

Recommended model:

- Launcher is the parent supervisor process.
- Backend, POS, and Admin run as child processes.
- Child processes must inherit production environment variables.
- Child stdout and stderr must be redirected to log files.
- The launcher must keep process IDs in memory and avoid stale PID files where possible.

## Crash Detection

The launcher should monitor child process exit events.

Required behavior:

- If backend exits, show a clear error and stop POS/Admin.
- If POS exits, offer restart or close.
- If Admin exits, keep POS running unless backend is affected.
- If a process crashes repeatedly, stop automatic restarts and show the log location.

Recommended restart policy:

- Maximum 3 restarts within 60 seconds.
- After the limit, mark the service unhealthy.

## Shutdown Flow

Shutdown should happen in this order:

1. Stop accepting new launcher actions.
2. Close or detach browser windows if supported.
3. Stop Admin.
4. Stop POS.
5. Stop Backend last.
6. Wait for graceful process exit.
7. Force kill only after timeout.
8. Write final shutdown result to launcher log.

## Admin Behavior

Admin should be optional:

- Default customer launch opens POS only.
- Admin can be opened from a Start Menu shortcut.
- Future launcher UI can include an "Open Admin" button.

## User Interface

Initial professional version can be tray-based or minimal-window:

- Status: Starting, Running, Error, Stopping.
- Buttons: Open POS, Open Admin, Stop, View Logs.
- No persistent CMD windows should remain visible.

## Logging

Suggested files:

```text
%ProgramData%\Cafe POS\logs\launcher.log
%ProgramData%\Cafe POS\logs\backend.log
%ProgramData%\Cafe POS\logs\pos.log
%ProgramData%\Cafe POS\logs\admin.log
```

## Failure Messages

Customer-facing errors should explain:

- What failed.
- Which log file to send for support.
- Whether restarting the computer is useful.
- Whether the database is safe.

