# Customer Release Checklist

Complete this checklist before giving the installer to customers.

## Installer Validation

- Installer starts without security warnings beyond normal unsigned/signed publisher prompts.
- Installer displays correct product name and version.
- License text is correct.
- Readme text is correct.
- Install path is correct.
- Installer creates required folders.
- Installer creates Desktop shortcut if selected.
- Installer creates Start Menu shortcuts.
- Installer does not require a terminal for normal users.
- No CMD windows remain visible after launch.

## Application Launch

- Application launches from Desktop shortcut.
- Application launches from Start Menu shortcut.
- Backend starts successfully.
- POS opens successfully.
- Admin opens successfully.
- Launcher detects and reports backend startup failure.
- Launcher shuts all services down correctly.

## POS Validation

- POS login works.
- Table list loads.
- Table order flow works.
- Menu items load.
- Order item add/remove flow works.
- Payment flow works.
- Receipt or printing flow works on target printer.
- Shift-sensitive operations behave correctly.

## Admin Validation

- Admin login works.
- Dashboard loads.
- Menu management works.
- User management works.
- Expenses work.
- Daily reports work.
- Range reports work.
- Shift reports work.
- Settings load and save correctly.

## Database Validation

- Fresh install creates the SQLite database.
- Reinstall preserves the SQLite database.
- Upgrade preserves the SQLite database.
- Uninstall preserves the SQLite database by default.
- Optional data removal deletes the SQLite database only after explicit confirmation.
- Migrations run successfully on an existing database.
- Database backup is created before upgrade migrations.

## Logs and Support

- Backend logs are written.
- POS logs are written.
- Admin logs are written.
- Launcher logs are written.
- Installer logs are available.
- Logs survive upgrade.
- Logs survive uninstall unless data removal is selected.

## Runtime and Environment

- Ports 3000, 3001, and 3002 are available or clear errors are shown.
- Required runtime is installed or bundled.
- Prisma Client is present.
- Native Windows packages load correctly.
- No developer absolute paths are present.
- No `.env` secrets are committed or exposed in installer metadata.

## Security and Delivery

- Default password change is documented.
- Installer is signed when signing is available.
- Download checksum is recorded.
- Version number is recorded.
- Final installer is scanned by antivirus.
- Final installer is tested on a clean customer-like machine.

