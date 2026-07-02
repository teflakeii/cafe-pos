# Cafe POS Installer Plan

This document describes the future professional Windows installer architecture. It is a plan only. It does not build, package, or implement the installer.

## Goals

- Install Cafe POS on Windows 10 and Windows 11 with a normal setup wizard.
- Install backend, POS, and admin assets into a stable application directory.
- Preserve customer data across repair, upgrade, and uninstall unless the user explicitly chooses data removal.
- Avoid requiring customers to run terminal commands after installation.
- Prepare for future code signing and auto-update support.

## Installer Architecture

Recommended installer stack:

- Installer technology: Inno Setup or WiX Toolset.
- Application launcher: future `Launcher.exe`.
- Runtime strategy: bundle a tested Node.js runtime or compile/ship a managed runtime folder with the installer.
- Application layout:

```text
%ProgramFiles%\Cafe POS\
  app\
    backend\
    pos\
    admin\
    launcher\
  runtime\
  scripts\
  assets\

%ProgramData%\Cafe POS\
  database\
    cafe.db
  logs\
  config\
    backend.env
    pos.env
    admin.env
  backups\
```

Rationale:

- `%ProgramFiles%` is for read-only application files.
- `%ProgramData%` is for writable machine-level data.
- Keeping the database outside the app folder prevents accidental deletion during upgrades.

## Installation Flow

1. Show welcome screen, license, install path, and shortcut options.
2. Check Windows version.
3. Check required ports or warn if ports 3000, 3001, or 3002 are already in use.
4. Install or verify the required runtime.
5. Copy built backend, POS standalone, admin standalone, launcher, scripts, and assets.
6. Create `%ProgramData%\Cafe POS` data directories if missing.
7. Create configuration files if missing.
8. Run Prisma migrations against the preserved SQLite database.
9. Seed only required default data without overwriting existing customer data.
10. Create Start Menu and optional Desktop shortcuts.
11. Optionally launch Cafe POS after setup finishes.

## Upgrade Flow

1. Detect an existing installation.
2. Stop running Cafe POS services through the launcher or service manager.
3. Back up the SQLite database before changing application files.
4. Replace application files in `%ProgramFiles%\Cafe POS`.
5. Preserve `%ProgramData%\Cafe POS`.
6. Run Prisma migrations.
7. Keep existing JWT secret and local configuration.
8. Restart the application only if the user chooses it.

## Uninstall Flow

1. Stop all running Cafe POS processes.
2. Remove application files from `%ProgramFiles%\Cafe POS`.
3. Remove shortcuts.
4. Preserve `%ProgramData%\Cafe POS` by default.
5. Offer an explicit optional checkbox to remove database, logs, config, and backups.
6. Write uninstall logs for support.

## Database Preservation

The SQLite database must live under:

```text
%ProgramData%\Cafe POS\database\cafe.db
```

Rules:

- Never store the production database inside `.next`, `dist`, source folders, or `%ProgramFiles%`.
- Always back up the database before migrations.
- Never reseed in a way that overwrites customer data.
- Migration failure must abort upgrade and keep the backup.

## Log Preservation

Logs must live under:

```text
%ProgramData%\Cafe POS\logs
```

Rules:

- Preserve logs during upgrade.
- Remove logs only if the user explicitly selects data removal during uninstall.
- Use separate log files for backend, POS, admin, launcher, installer, and updater.
- Add log rotation before customer release.

## Future Auto-Update Support

The installer should prepare for future updates by reserving:

```text
%ProgramData%\Cafe POS\updates
%ProgramData%\Cafe POS\backups
```

Future updater requirements:

- Signed update packages.
- Version metadata.
- Download verification by checksum and signature.
- Safe rollback if update or migration fails.
- Database backup before update.
- No update while an order, payment, or shift-critical operation is active.

## Installer Outputs

Future installer output should be:

```text
CafePOS-Setup-x.y.z.exe
```

The setup file should eventually be code signed.

