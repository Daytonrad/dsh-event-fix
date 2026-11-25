Option Explicit
Dim shell, rc
Set shell = CreateObject("WScript.Shell")
rc = shell.Run("cmd.exe /d /c """"E:\programs\dsh-event-fix\install\restart-dsh.cmd""""", 0, True)
WScript.Quit rc