' Silent launcher for a desktop/Start-menu shortcut.
' Starts the services with no visible console window, then the launcher opens
' the POS app window itself. Use Stop.cmd (or Task Manager) to quit.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
repoRoot = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
sh.CurrentDirectory = repoRoot
' 0 = hidden window, False = don't wait
sh.Run "node scripts\win-start.mjs", 0, False
