<#  Installation / Deinstallation des Bridge-Ops-Sensors
    Standard: ohne Administratorrechte (Autostart-Verknüpfung)
    Erweitert: Windows-Aufgabe beim Anmelden mit höchsten Rechten + LibreHardwareMonitorLib (CPU-Temperatur, -Leistung, -Takt)  #>
param([switch]$Install, [switch]$Uninstall, [switch]$Extended, [switch]$Standard, [switch]$Pause)
$ErrorActionPreference = 'Stop'
$script:UiDe = ((Get-UICulture).TwoLetterISOLanguageName -eq 'de')   # Sprache der Meldungen / message language
function L([string]$textDe, [string]$textEn) { if ($script:UiDe) { $textDe } else { $textEn } }
$Src     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Dest    = Join-Path $env:LOCALAPPDATA 'Bridge-Ops-Sensor'
$Startup = [Environment]::GetFolderPath('Startup')
$Link    = Join-Path $Startup 'Bridge-Ops-Sensor.lnk'
$PS      = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$Task    = 'Bridge-Ops-Sensor'
$LhmVer  = '0.9.6'
$LhmUrl  = "https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases/download/v$LhmVer/LibreHardwareMonitor.zip"
# Fehler sichtbar machen (auch im Admin-Fenster, das sich sonst sofort schließt)
trap {
  Write-Host ''
  Write-Host ((L 'FEHLER: ' 'ERROR: ') + $_.Exception.Message) -ForegroundColor Red
  Write-Host ((L '  in Zeile ' '  at line ') + $_.InvocationInfo.ScriptLineNumber)
  if ($Pause) { Read-Host (L 'Enter zum Schließen' 'Press Enter to close') | Out-Null }
  exit 1
}

function Is-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Has-Task { [bool](Get-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue) }
function Elevate([string]$args2) {
  # dieses Skript mit Adminrechten erneut starten (UAC-Abfrage) und warten
  Write-Host (L 'Adminrechte nötig – bitte die Windows-Abfrage bestätigen ...' 'Admin rights needed – please confirm the Windows prompt ...')
  $p = Start-Process -FilePath $PS -Verb RunAs -Wait -PassThru -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" $args2 -Pause"
  exit $p.ExitCode
}
function Stop-Sensor {
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*Bridge-Ops-Sensor*Sensor.ps1*' } |
    ForEach-Object { try { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null } catch { } }
  Start-Sleep -Milliseconds 600
}
function Remove-Task { if (Has-Task) { try { Stop-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue } catch { }; Unregister-ScheduledTask -TaskName $Task -Confirm:$false } }
function Copy-Files {
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  Copy-Item (Join-Path $Src 'Sensor.ps1') $Dest -Force
  if (-not (Test-Path (Join-Path $Dest 'sensor.cfg'))) { Copy-Item (Join-Path $Src 'sensor.cfg') $Dest -Force }
  Get-ChildItem $Dest -File | Unblock-File
}
function Get-Lhm {
  $dir = Join-Path $Dest 'lhm'
  if (Test-Path (Join-Path $dir 'LibreHardwareMonitorLib.dll')) { Write-Host (L 'LibreHardwareMonitor ist schon vorhanden.' 'LibreHardwareMonitor already present.'); return $true }
  Write-Host ((L 'Lade LibreHardwareMonitor ' 'Downloading LibreHardwareMonitor ') + $LhmVer + ' (github.com) ...')
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $zip = Join-Path $env:TEMP 'BridgeOps-LHM.zip'
    Invoke-WebRequest -Uri $LhmUrl -OutFile $zip -UseBasicParsing
    if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $dir -Force
    Remove-Item $zip -Force
    # falls das Archiv einen Unterordner enthält: DLLs nach oben holen
    if (-not (Test-Path (Join-Path $dir 'LibreHardwareMonitorLib.dll'))) {
      $f = Get-ChildItem $dir -Recurse -Filter 'LibreHardwareMonitorLib.dll' | Select-Object -First 1
      if ($f) { Get-ChildItem $f.DirectoryName -File | Move-Item -Destination $dir -Force }
    }
    Get-ChildItem $dir -Recurse -File | Unblock-File
    return (Test-Path (Join-Path $dir 'LibreHardwareMonitorLib.dll'))
  } catch { Write-Host ((L 'Download fehlgeschlagen: ' 'Download failed: ') + $_.Exception.Message) -ForegroundColor Yellow; return $false }
}

if ($Install) {
  # Modus wählen
  if (-not $Extended -and -not $Standard) {
    Write-Host ''
    Write-Host (L 'Welcher Modus?' 'Which mode?')
    Write-Host (L '  [1] Standard  – ohne Adminrechte (Last, Threads, Laufwerke, Netz, VRAM, GPU-Temperatur)' '  [1] Standard  – no admin rights (load, threads, drives, network, VRAM, GPU temperature)')
    Write-Host (L '  [2] Erweitert – zusätzlich CPU-Temperatur, CPU-Leistung und Kerntakt' '  [2] Extended  – adds CPU temperature, CPU power and core clocks')
    Write-Host (L '      (Windows-Aufgabe mit Adminrechten, lädt LibreHardwareMonitor; nutzt den PawnIO-Treiber,' '      (Windows task with admin rights, downloads LibreHardwareMonitor; uses the PawnIO driver,')
    Write-Host (L '       der z. B. mit Fan Control oder LibreHardwareMonitor installiert wird)' '       installed e.g. with Fan Control or LibreHardwareMonitor)')
    $a = Read-Host (L 'Auswahl 1 oder 2' 'Choose 1 or 2')
    if ($a -eq '2') { $Extended = $true } else { $Standard = $true }
  }
  if ($Extended -and -not (Is-Admin)) { Elevate '-Install -Extended' }
  if ($Standard -and (Has-Task) -and -not (Is-Admin)) { Elevate '-Install -Standard' }   # alte Admin-Aufgabe entfernen

  Write-Host (L 'Bridge-Ops-Sensor wird installiert ...' 'Installing Bridge-Ops-Sensor ...')
  Stop-Sensor; Remove-Task
  Copy-Files
  if ($Extended) {
    if (Test-Path $Link) { Remove-Item $Link -Force }
    $ok = Get-Lhm
    $user = "$env:USERDOMAIN\$env:USERNAME"
    $act = New-ScheduledTaskAction -Execute $PS -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Dest\Sensor.ps1`" -Extended" -WorkingDirectory $Dest
    $trg = New-ScheduledTaskTrigger -AtLogOn -User $user
    $prn = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest
    $set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $Task -Action $act -Trigger $trg -Principal $prn -Settings $set -Description (L 'Bridge-Ops-Sensor (erweitert, Messwerte für das Wallpaper)' 'Bridge-Ops-Sensor (extended, readings for the wallpaper)') -Force | Out-Null
    Start-ScheduledTask -TaskName $Task
    # prüfen, ob der Sensor wirklich läuft
    $run = $false
    for ($i = 0; $i -lt 10 -and -not $run; $i++) {
      Start-Sleep -Seconds 1
      $run = [bool](Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*Bridge-Ops-Sensor*Sensor.ps1*' })
    }
    $info = Get-ScheduledTaskInfo -TaskName $Task -ErrorAction SilentlyContinue
    if ($run) { Write-Host (L 'Sensor läuft (Aufgabe gestartet).' 'Sensor is running (task started).') -ForegroundColor Green }
    else {
      Write-Host (L 'Sensor läuft NICHT.' 'Sensor is NOT running.') -ForegroundColor Red
      if ($info) { Write-Host ((L '  Letztes Ergebnis der Aufgabe: 0x' '  Last task result: 0x') + ('{0:X}' -f $info.LastTaskResult)) }
      $log = Join-Path $Dest 'sensor.log'
      if (Test-Path $log) { Write-Host (L '  sensor.log:' '  sensor.log:'); Get-Content $log -Tail 15 | ForEach-Object { Write-Host ('    ' + $_) } }
    }
    Write-Host ''
    Write-Host ((L 'Fertig (erweitert). Installiert in: ' 'Done (extended). Installed to: ') + $Dest)
    Write-Host (L 'Startet ab jetzt bei jeder Anmeldung über die Aufgabenplanung (Aufgabe "Bridge-Ops-Sensor"), ohne Abfrage.' 'Starts at every sign-in via Task Scheduler (task "Bridge-Ops-Sensor"), without a prompt.')
    if (-not $ok) { Write-Host (L 'Achtung: LibreHardwareMonitor fehlt – CPU-Temperatur bleibt leer. Install.cmd später erneut ausführen.' 'Note: LibreHardwareMonitor missing – CPU temperature stays empty. Run Install.cmd again later.') -ForegroundColor Yellow }
    Write-Host (L 'Ohne PawnIO-Treiber (kommt mit Fan Control / LibreHardwareMonitor) gibt es keine CPU-Temperatur.' 'Without the PawnIO driver (comes with Fan Control / LibreHardwareMonitor) there is no CPU temperature.')
  } else {
    $argLine = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Dest\Sensor.ps1`""
    $sh = New-Object -ComObject WScript.Shell
    $lnk = $sh.CreateShortcut($Link)
    $lnk.TargetPath = $PS; $lnk.Arguments = $argLine; $lnk.WorkingDirectory = $Dest
    $lnk.WindowStyle = 7; $lnk.Description = (L 'Bridge-Ops-Sensor (Messwerte für das Wallpaper)' 'Bridge-Ops-Sensor (readings for the wallpaper)')
    $lnk.Save()
    if (Is-Admin) {
      # aus einer Admin-Sitzung heraus nicht mit Adminrechten starten: über den Explorer als normaler Benutzer
      Start-Process -FilePath 'explorer.exe' -ArgumentList "`"$Link`""
    } else { Start-Process -FilePath $PS -ArgumentList $argLine -WindowStyle Hidden }
    Write-Host ''
    Write-Host ((L "Fertig. Installiert in: " "Done. Installed to: ") + $Dest)
    Write-Host (L 'Der Sensor startet ab jetzt automatisch mit Windows.' 'The sensor now starts automatically with Windows.')
  }
  Write-Host (L 'Symbol im Infobereich der Taskleiste (ggf. unter dem Pfeil ^) -> Rechtsklick -> Beenden.' 'Icon in the taskbar notification area (maybe under the arrow ^) -> right-click -> Quit.')
}
elseif ($Uninstall) {
  if ((Has-Task) -and -not (Is-Admin)) { Elevate '-Uninstall' }
  Write-Host (L 'Bridge-Ops-Sensor wird entfernt ...' 'Removing Bridge-Ops-Sensor ...')
  Stop-Sensor; Remove-Task
  if (Test-Path $Link) { Remove-Item $Link -Force }
  if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
  Write-Host (L 'Fertig. Autostart, Aufgabe und Programmordner sind entfernt.' 'Done. Autostart, task and program folder removed.')
}
if ($Pause) { Write-Host ''; Read-Host (L 'Enter zum Schließen' 'Press Enter to close') | Out-Null }
