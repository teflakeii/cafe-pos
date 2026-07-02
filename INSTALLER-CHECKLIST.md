# Windows Installer Build Checklist

Complete this checklist on Windows before creating `Setup.exe`.

## Machine Preparation

- Install Windows 10 or Windows 11 test machine.
- Install Node.js LTS 20.x or 22.x.
- Enable Corepack.
- Verify pnpm version from `packageManager`.
- Install Git if building from source.
- Install the chosen installer tool, such as Inno Setup or WiX.
- Install code signing tools when signing is introduced.

## Repository Preparation

- Clone or update the repository.
- Confirm the current branch and commit.
- Confirm the working tree is clean.
- Ensure generated release folders are not committed.
- Confirm `.gitignore` excludes build, release, database, log, dependency, and zip artifacts.

## Dependency Installation

- Run production dependency installation.
- Confirm native Windows dependencies install correctly.
- Confirm Prisma engines are Windows-compatible.
- Confirm Next/SWC Windows binaries are present.

## Production Build

- Run the production build.
- Confirm backend `dist` exists.
- Confirm POS `.next/standalone` exists.
- Confirm Admin `.next/standalone` exists.
- Confirm no absolute developer machine paths are embedded in release files.

## Prisma and Database

- Run Prisma generate.
- Run Prisma validate.
- Run migrations against a test SQLite database.
- Run seed on a fresh database.
- Verify seed does not overwrite existing customer data.
- Verify database path points to the planned `%ProgramData%` location.

## Application Test

- Start backend.
- Verify `http://localhost:3000/health`.
- Start POS.
- Start Admin.
- Verify login works.
- Verify POS order flow.
- Verify payment flow.
- Verify admin reports.
- Verify shift open and close flow.
- Verify printing workflow on the target hardware.

## Installer Creation

- Add final assets from `INSTALLER-ASSETS`.
- Create installer script.
- Include application files.
- Include runtime or document runtime prerequisite.
- Configure install path.
- Configure `%ProgramData%` data path.
- Create Desktop shortcut.
- Create Start Menu shortcuts.
- Configure uninstall behavior.
- Build `Setup.exe`.

## Signing

- Sign `Setup.exe` when a certificate is available.
- Timestamp the signature.
- Verify signature on a clean Windows machine.

## Installer Test

- Test install on clean Windows 10.
- Test install on clean Windows 11.
- Test repair install.
- Test upgrade install over previous version.
- Test uninstall while app is stopped.
- Test uninstall while app is running.
- Confirm database preservation.
- Confirm log preservation.
- Confirm optional data removal works only when explicitly selected.

