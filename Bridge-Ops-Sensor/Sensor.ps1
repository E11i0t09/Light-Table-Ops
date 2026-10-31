<#
  Bridge-Ops-Sensor  ·  © 2026 E11iot  ·  CC BY-NC-ND 4.0 (https://creativecommons.org/licenses/by-nc-nd/4.0/)
  Liefert dem Wallpaper "Bridge Ops" Messwerte, die Lively nicht kennt:
    - Belegung je internem Laufwerk (ohne USB, ohne Netzlaufwerke)
    - Lese-/Schreibrate je Laufwerk
    - Netzwerk-Durchsatz am Adapter, über den die Internetverbindung läuft
    - ab 2.0 (für "Light Table Ops"): Last + Takt je logischem Prozessor, Top-Prozesse,
      Laufwerks-Aktivität, Systemstart, CPU-/GPU-Name, Temperatur der ACPI-Thermozone
  Sicherheit:
    - lauscht nur auf 127.0.0.1 (nicht aus dem Netz erreichbar)
    - antwortet nur dem Wallpaper (Herkunft https://<hex>.localhost, wie Lively sie vergibt)
    - nimmt keine Befehle an, liest nur Messwerte
  Läuft ohne Administratorrechte. Beenden über das Symbol im Infobereich der Taskleiste.
#>
param([int]$Port = 0, [switch]$Extended)

$ErrorActionPreference = 'Stop'
$Version = '2.2.0'
$script:UiDe = ((Get-UICulture).TwoLetterISOLanguageName -eq 'de')   # Sprache der Meldungen / message language
function L([string]$textDe, [string]$textEn) { if ($script:UiDe) { $textDe } else { $textEn } }
$Here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$OnWin   = ($env:OS -eq 'Windows_NT')
# ---------- Protokoll (sensor.log im Programmordner, wird bei jedem Start neu angelegt) ----------
$script:LogFile = Join-Path $Here 'sensor.log'
function Log([string]$m) { try { Add-Content -Path $script:LogFile -Value ((Get-Date).ToString('yyyy-MM-dd HH:mm:ss') + '  ' + $m) -Encoding UTF8 } catch { } }
try { Set-Content -Path $script:LogFile -Value '' -Encoding UTF8 } catch { }
trap { Log ('FEHLER/ERROR: ' + $_.Exception.Message + ' @ ' + $_.InvocationInfo.ScriptLineNumber); continue }

# ---------- Einstellungen (sensor.cfg: Port=47047) ----------
if ($Port -le 0) {
  $Port = 47047
  $cfg = Join-Path $Here 'sensor.cfg'
  if (Test-Path $cfg) {
    foreach ($l in Get-Content $cfg) { if ($l -match '^\s*Port\s*=\s*(\d+)') { $Port = [int]$Matches[1] } }
  }
}
$OriginRx = '^https://[0-9a-f]{8,64}\.localhost$'
# Wallpaper Engine lädt Web-Wallpaper als file:// (Origin "null"). Damit nicht jede beliebige Seite mitlesen kann,
# braucht diese Herkunft einen Schlüssel (?k=...), den man im Wallpaper einträgt. / WE key for origin "null".
$KeyFile = Join-Path $Here 'we-key.txt'
$WeKey = ''
try { if (Test-Path $KeyFile) { $WeKey = (Get-Content $KeyFile -Raw).Trim() } } catch { }
if ($WeKey -notmatch '^[0-9a-f]{16}$') {
  $rb = New-Object byte[] 8; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($rb)
  $WeKey = -join ($rb | ForEach-Object { $_.ToString('x2') })
  try { Set-Content -Path $KeyFile -Value $WeKey -Encoding ASCII } catch { }
}
Log ("Start v$Version  Port=$Port  Extended=$([bool]$Extended)  Admin=" + ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) + "  User=$env:USERNAME  PS=$($PSVersionTable.PSVersion)")

# ---------- nur eine Instanz ----------
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\BridgeOpsSensor', [ref]$created)
if (-not $created) { Log 'Sensor läuft bereits (Mutex) – Ende. / already running – exit.'; exit 0 }

# ---------- Laufwerke ----------
$script:UsbLetters = @()
function Update-UsbLetters {
  # Externe USB-Platten melden sich teils als "fest" – über den Bustyp aussortieren
  $script:UsbLetters = @()
  if (-not $OnWin) { return }
  try {
    foreach ($d in Get-Disk -ErrorAction Stop | Where-Object { $_.BusType -eq 'USB' }) {
      foreach ($p in Get-Partition -DiskNumber $d.Number -ErrorAction SilentlyContinue) {
        if ($p.DriveLetter) { $script:UsbLetters += ([string]$p.DriveLetter).ToUpper() }
      }
    }
  } catch { }
}
$script:DiskCtr = @{}
function Get-DiskCounter([string]$name) {
  if (-not $OnWin) { return $null }
  if (-not $script:DiskCtr.ContainsKey($name)) {
    try {
      $r = New-Object System.Diagnostics.PerformanceCounter('LogicalDisk', 'Disk Read Bytes/sec',  $name, $true)
      $w = New-Object System.Diagnostics.PerformanceCounter('LogicalDisk', 'Disk Write Bytes/sec', $name, $true)
      [void]$r.NextValue(); [void]$w.NextValue()
      $script:DiskCtr[$name] = @($r, $w)
    } catch { $script:DiskCtr[$name] = $null }
  }
  return $script:DiskCtr[$name]
}
function Get-Disks {
  $out = @()
  foreach ($d in [System.IO.DriveInfo]::GetDrives()) {
    try {
      if ($d.DriveType -ne [System.IO.DriveType]::Fixed -or -not $d.IsReady) { continue }
      if ($d.TotalSize -lt 1GB) { continue }
      $name = $d.Name.TrimEnd('\', '/')
      if ($OnWin -and $script:UsbLetters -contains $name.Substring(0, 1).ToUpper()) { continue }
      $rd = 0.0; $wr = 0.0
      $c = Get-DiskCounter $name
      if ($c) { try { $rd = $c[0].NextValue(); $wr = $c[1].NextValue() } catch { } }
      $out += [ordered]@{ d = $name; label = $d.VolumeLabel; total = $d.TotalSize; free = $d.AvailableFreeSpace; read = [math]::Round($rd); write = [math]::Round($wr); busy = (Get-DiskBusy $name); fs = $d.DriveFormat }
    } catch { }
  }
  return ,$out
}

# ---------- CPU / RAM / GPU-Last (alle 0,5 s, schneller als Lively) ----------
$script:CpuCtr = $null; $script:MemCtr = $null; $script:RamTotal = 0; $script:GpuCtr = @()
function Init-Load {
  if (-not $OnWin) { return }
  try { $script:CpuCtr = New-Object System.Diagnostics.PerformanceCounter('Processor Information', '% Processor Utility', '_Total', $true); [void]$script:CpuCtr.NextValue() }
  catch { try { $script:CpuCtr = New-Object System.Diagnostics.PerformanceCounter('Processor', '% Processor Time', '_Total', $true); [void]$script:CpuCtr.NextValue() } catch { $script:CpuCtr = $null } }
  try { $script:MemCtr = New-Object System.Diagnostics.PerformanceCounter('Memory', 'Available Bytes', $true) } catch { }
  try { $script:RamTotal = [double](Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).TotalPhysicalMemory } catch { }
  # Taktfrequenz: % Processor Performance x Nenntakt (wie der Task-Manager)
  try { $script:MaxMhz = [double](@(Get-CimInstance Win32_Processor -ErrorAction Stop)[0].MaxClockSpeed) } catch { }
  try { $script:PerfCtr = New-Object System.Diagnostics.PerformanceCounter('Processor Information', '% Processor Performance', '_Total', $true); [void]$script:PerfCtr.NextValue() } catch { $script:PerfCtr = $null }
  # GPU-Temperatur über die Grafiktreiber-Schnittstelle (D3DKMT, wie der Task-Manager)
  try {
    Add-Type -ErrorAction Stop -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class BoGpu {
  [StructLayout(LayoutKind.Sequential)] struct LUID { public uint Low; public int High; }
  [StructLayout(LayoutKind.Sequential)] struct OPENLUID { public LUID Luid; public uint hAdapter; }
  [StructLayout(LayoutKind.Sequential)] struct CLOSEA { public uint hAdapter; }
  [StructLayout(LayoutKind.Sequential)] struct QAI { public uint hAdapter; public int Type; public IntPtr pData; public uint Size; }
  [DllImport("gdi32.dll")] static extern int D3DKMTOpenAdapterFromLuid(ref OPENLUID p);
  [DllImport("gdi32.dll")] static extern int D3DKMTQueryAdapterInfo(ref QAI p);
  [DllImport("gdi32.dll")] static extern int D3DKMTCloseAdapter(ref CLOSEA p);
  // Temperatur in 1/10 Grad C, -1 = nicht verfuegbar (KMTQAITYPE_ADAPTERPERFDATA = 62)
  public static int Temp(uint low, int high){
    var o = new OPENLUID(); o.Luid.Low = low; o.Luid.High = high;
    if (D3DKMTOpenAdapterFromLuid(ref o) != 0) return -1;
    IntPtr buf = Marshal.AllocHGlobal(64);
    try {
      for (int i = 0; i < 64; i++) Marshal.WriteByte(buf, i, 0);
      var q = new QAI(); q.hAdapter = o.hAdapter; q.Type = 62; q.pData = buf; q.Size = 64;
      if (D3DKMTQueryAdapterInfo(ref q) != 0) return -1;
      return Marshal.ReadInt32(buf, 56);
    } finally { Marshal.FreeHGlobal(buf); var c = new CLOSEA(); c.hAdapter = o.hAdapter; D3DKMTCloseAdapter(ref c); }
  }
}
'@
    $script:GpuTempOk = $true
  } catch { $script:GpuTempOk = $false }
}
$script:MaxMhz = 0; $script:PerfCtr = $null; $script:GpuTempOk = $false; $script:VramLuid = $null
function Get-CpuMhz {
  if (-not $script:PerfCtr -or $script:MaxMhz -le 0) { return $null }
  try { return [math]::Round($script:PerfCtr.NextValue() / 100 * $script:MaxMhz) } catch { return $null }
}
function Get-GpuTemp {
  if (-not $script:GpuTempOk -or -not $script:VramLuid) { return $null }
  try {
    $m = [regex]::Match($script:VramLuid, 'luid_0x([0-9a-fA-F]+)_0x([0-9a-fA-F]+)')
    if (-not $m.Success) { return $null }
    $hi = [Convert]::ToInt32($m.Groups[1].Value, 16); $lo = [Convert]::ToUInt32($m.Groups[2].Value, 16)
    $t = [BoGpu]::Temp($lo, $hi)
    if ($t -le 0) { return $null }
    return [math]::Round($t / 10, 1)
  } catch { return $null }
}
function Update-GpuCounters {
  # 3D-Engines je Prozess; die Liste ändert sich, wenn Programme starten/enden
  if (-not $OnWin) { return }
  foreach ($c in $script:GpuCtr) { try { $c.Dispose() } catch { } }
  $script:GpuCtr = @()
  try {
    $cat = New-Object System.Diagnostics.PerformanceCounterCategory('GPU Engine')
    foreach ($i in $cat.GetInstanceNames()) {
      if ($i -notlike '*engtype_3D') { continue }
      $c = New-Object System.Diagnostics.PerformanceCounter('GPU Engine', 'Utilization Percentage', $i, $true)
      [void]$c.NextValue(); $script:GpuCtr += $c
    }
  } catch { }
}
function Get-Load {
  if (-not $OnWin) { return $null }
  $cpu = $null; $ram = $null; $gpu = $null
  if ($script:CpuCtr) { try { $cpu = [math]::Round([math]::Min(100, $script:CpuCtr.NextValue()), 1) } catch { } }
  if ($script:MemCtr -and $script:RamTotal -gt 0) { try { $ram = [math]::Round((1 - $script:MemCtr.NextValue() / $script:RamTotal) * 100, 1) } catch { } }
  if ($script:GpuCtr.Count) {
    # wie der Task-Manager: je Grafikkarte (luid) summieren, höchste Karte zählt
    $per = @{}
    foreach ($c in $script:GpuCtr) {
      try { $v = $c.NextValue(); $k = ($c.InstanceName -replace '^.*?(luid_0x[0-9a-fA-F]+_0x[0-9a-fA-F]+).*$', '$1'); $per[$k] = [double]$per[$k] + $v } catch { }
    }
    if ($per.Count) { $gpu = [math]::Round([math]::Min(100, ($per.Values | Measure-Object -Maximum).Maximum), 1) }
  }
  return [ordered]@{ cpu = $cpu; gpu = $gpu; ram = $ram; ramTotal = $script:RamTotal }
}

# ---------- Grafikspeicher (VRAM) ----------
$script:VramCtr = @(); $script:VramTotal = 0
function Update-Vram {
  if (-not $OnWin) { return }
  # Gesamtgröße aus der Registry (Win32_VideoController.AdapterRAM endet bei 4 GB)
  $tot = 0
  try {
    Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue |   # Unterschlüssel 'Properties' braucht Adminrechte -> still überspringen
      ForEach-Object {
      $v = (Get-ItemProperty $_.PSPath -Name 'HardwareInformation.qwMemorySize' -ErrorAction SilentlyContinue).'HardwareInformation.qwMemorySize'
      if ($v -and [double]$v -gt $tot) { $tot = [double]$v }
    }
  } catch { }
  $script:VramTotal = $tot
  foreach ($c in $script:VramCtr) { try { $c.Dispose() } catch { } }
  $script:VramCtr = @()
  try {
    $cat = New-Object System.Diagnostics.PerformanceCounterCategory('GPU Adapter Memory')
    foreach ($i in $cat.GetInstanceNames()) { $script:VramCtr += New-Object System.Diagnostics.PerformanceCounter('GPU Adapter Memory', 'Dedicated Usage', $i, $true) }
  } catch { }
}
function Get-Vram {
  $used = 0
  foreach ($c in $script:VramCtr) { try { $v = $c.NextValue(); if ($v -gt $used) { $used = $v; $script:VramLuid = $c.InstanceName } } catch { } }
  if ($script:VramTotal -le 0 -or $used -le 0) { return $null }
  return [ordered]@{ used = [math]::Round($used); total = [math]::Round($script:VramTotal) }
}

# ---------- Netzwerk: Adapter der Standardroute ----------
$script:Nic = $null; $script:NicDesc = ''; $script:Prev = $null
function Update-Nic {
  # physische, verbundene Adapter + der Adapter der Standardroute ("automatisch")
  $desc = $null; $physDesc = @()
  if ($OnWin) {
    try {
      $phys = @(Get-NetAdapter -Physical -ErrorAction Stop | Where-Object Status -eq 'Up')
      $physDesc = @($phys | ForEach-Object { $_.InterfaceDescription })
      $routes = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
                Sort-Object { $_.RouteMetric + (Get-NetIPInterface -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).InterfaceMetric }
      foreach ($r in $routes) { $a = $phys | Where-Object ifIndex -eq $r.ifIndex; if ($a) { $desc = $a.InterfaceDescription; break } }
      if (-not $desc -and $phys.Count) { $desc = $phys[0].InterfaceDescription }
    } catch { }
  }
  $all = @([System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
         Where-Object { $_.OperationalStatus -eq 'Up' -and $_.NetworkInterfaceType -ne 'Loopback' })
  $list = @()
  if ($physDesc.Count) { $list = @($all | Where-Object { $physDesc -contains $_.Description }) }
  if (-not $list.Count) { $list = @($all | Where-Object { $_.GetIPProperties().GatewayAddresses.Count -gt 0 }) }   # Rückfall
  if (-not $desc -and $list.Count) { $desc = ($list | Sort-Object { $_.GetIPStatistics().BytesReceived } -Descending | Select-Object -First 1).Description }
  $script:NicList = $list
  $script:NicDesc = if ($desc) { $desc } else { '' }
}
$script:NicList = @(); $script:NicHist = @{}
$script:Net = [ordered]@{ name = ''; down = 0; up = 0 }; $script:Nics = @()
function Sample-Net {
  # alle 0,5 s je Adapter messen, Rate über die letzte Sekunde mitteln (ruhig, aber schnell)
  $now = [DateTime]::UtcNow; $out = @(); $seen = @{}
  foreach ($n in $script:NicList) {
    try {
      $id = $n.Id; $seen[$id] = 1
      if (-not $script:NicHist.ContainsKey($id)) { $script:NicHist[$id] = New-Object System.Collections.Generic.List[object] }
      $h = $script:NicHist[$id]; $st = $n.GetIPStatistics()
      $h.Add(@{ t = $now; rx = [double]$st.BytesReceived; tx = [double]$st.BytesSent })
      while ($h.Count -gt 2 -and ($now - $h[1].t).TotalSeconds -ge 1.0) { $h.RemoveAt(0) }
      $a = $h[0]; $b = $h[$h.Count - 1]; $dt = ($b.t - $a.t).TotalSeconds
      $dn = 0; $upv = 0
      if ($dt -gt 0.2) { $dn = [math]::Max(0, [math]::Round(($b.rx - $a.rx) / $dt)); $upv = [math]::Max(0, [math]::Round(($b.tx - $a.tx) / $dt)) }
      $out += [ordered]@{ name = $n.Description; down = $dn; up = $upv; auto = ($n.Description -eq $script:NicDesc) }
    } catch { }
  }
  foreach ($k in @($script:NicHist.Keys)) { if (-not $seen.ContainsKey($k)) { $script:NicHist.Remove($k) } }
  $script:Nics = $out
  $auto = $out | Where-Object { $_.auto } | Select-Object -First 1
  $script:Net = if ($auto) { [ordered]@{ name = $auto.name; down = $auto.down; up = $auto.up } } else { [ordered]@{ name = ''; down = 0; up = 0 } }
}

# ---------- ab 2.0: je Thread, Prozesse, Namen, Systemstart, Thermozone ----------
$script:CoreCtr = @(); $script:Cores = @(); $script:Procs = @(); $script:ProcPrev = @{}; $script:ProcT = $null
$script:Info = [ordered]@{ cpu = ''; gpu = ''; threads = 0; coresPhys = 0; boot = $null; maxMhz = 0 }
$script:ThermCtr = @(); $script:CpuTemp = $null
function Init-Extra {
  if (-not $OnWin) { return }
  try {
    $p = @(Get-CimInstance Win32_Processor -ErrorAction Stop)
    $script:Info.cpu = (($p[0].Name -replace '\((R|TM)\)', '') -replace '\s+', ' ').Trim()
    $script:Info.coresPhys = [int](($p | Measure-Object -Property NumberOfCores -Sum).Sum)
    $script:Info.threads = [int](($p | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum)
    $script:Info.maxMhz = [int]$p[0].MaxClockSpeed
  } catch { }
  try { $script:Info.gpu = (@(Get-CimInstance Win32_VideoController -ErrorAction Stop | Where-Object { $_.Name -notmatch 'Basic|Remote|Virtual|Parsec|Meta|Mobile Monitor|IddCx|Mirror|spacedesk|DisplayLink|Duet' } | Sort-Object { [double]$_.AdapterRAM } -Descending)[0].Name -replace '\((R|TM)\)', '').Trim() } catch { }
  try { $script:Info.boot = [DateTimeOffset]::new((Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).LastBootUpTime).ToUnixTimeMilliseconds() } catch { }
  # je logischem Prozessor: Auslastung (wie Task-Manager) und Leistung in % des Nenntakts
  try {
    $cat = New-Object System.Diagnostics.PerformanceCounterCategory('Processor Information')
    $names = @($cat.GetInstanceNames() | Where-Object { $_ -match '^\d+,\d+$' } |
              Sort-Object { $a = $_.Split(','); [int]$a[0] * 1000 + [int]$a[1] })
    foreach ($n in $names) {
      $u = New-Object System.Diagnostics.PerformanceCounter('Processor Information', '% Processor Utility', $n, $true); [void]$u.NextValue()
      $f = $null; try { $f = New-Object System.Diagnostics.PerformanceCounter('Processor Information', '% Processor Performance', $n, $true); [void]$f.NextValue() } catch { }
      $script:CoreCtr += ,@($u, $f)
    }
  } catch { $script:CoreCtr = @() }
  # Thermozone (ACPI) – nicht bei jedem Rechner die echte CPU-Temperatur
  try {
    $cat = New-Object System.Diagnostics.PerformanceCounterCategory('Thermal Zone Information')
    foreach ($i in $cat.GetInstanceNames()) { $c = New-Object System.Diagnostics.PerformanceCounter('Thermal Zone Information', 'Temperature', $i, $true); [void]$c.NextValue(); $script:ThermCtr += $c }
  } catch { }
}
function Get-Cores {
  $out = @()
  foreach ($c in $script:CoreCtr) {
    try {
      $u = [math]::Round([math]::Min(100, $c[0].NextValue()), 1)
      $mhz = $null; if ($c[1] -and $script:Info.maxMhz -gt 0) { $mhz = [math]::Round($c[1].NextValue() / 100 * $script:Info.maxMhz) }
      $out += [ordered]@{ u = $u; mhz = $mhz }
    } catch { $out += [ordered]@{ u = $null; mhz = $null } }
  }
  return ,$out
}
# ---------- ab 2.1: erweiterter Modus (Adminrechte) – CPU-Werte über LibreHardwareMonitorLib + PawnIO ----------
$script:Lhm = $null; $script:LhmMsg = ''; $script:LhmDir = Join-Path $Here 'lhm'; $script:LhmCpu = $null
function Init-Lhm {
  if (-not $Extended -or -not $OnWin) { $script:LhmMsg = 'off'; return }
  $dll = Join-Path $script:LhmDir 'LibreHardwareMonitorLib.dll'
  if (-not (Test-Path $dll)) { $script:LhmMsg = 'lib missing'; Log "LibreHardwareMonitor fehlt / missing: $dll"; return }
  $adm = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $adm) { $script:LhmMsg = 'no admin'; Log 'Erweitert ohne Adminrechte / extended without admin rights'; return }
  try {
    # Abhängigkeiten aus dem lhm-Ordner laden, egal welche Version angefragt wird
    [AppDomain]::CurrentDomain.add_AssemblyResolve({
      param($sender, $e)
      $n = (New-Object System.Reflection.AssemblyName($e.Name)).Name
      $f = Join-Path $script:LhmDir ($n + '.dll')
      if (Test-Path $f) { return [System.Reflection.Assembly]::LoadFrom($f) }
      return $null
    })
    [void][System.Reflection.Assembly]::LoadFrom($dll)
    $c = New-Object LibreHardwareMonitor.Hardware.Computer
    $c.IsCpuEnabled = $true
    $c.Open()
    $script:Lhm = $c; $script:LhmMsg = 'ok'
  } catch { $script:LhmMsg = 'error: ' + $_.Exception.Message; $script:Lhm = $null }
  Log ('LibreHardwareMonitor: ' + $script:LhmMsg)
}
function Get-LhmCpu {
  if (-not $script:Lhm) { return $null }
  try {
    $t = $null; $tAny = $null; $pw = $null; $clk = @()
    foreach ($h in $script:Lhm.Hardware) {
      if ([string]$h.HardwareType -ne 'Cpu') { continue }
      $h.Update()
      foreach ($s in $h.Sensors) {
        if ($s.Value -eq $null) { continue }
        $v = [double]$s.Value; $n = [string]$s.Name; $ty = [string]$s.SensorType
        if ($ty -eq 'Temperature') {
          if ($n -match 'Tctl|Tdie|Package') { if ($t -eq $null -or $v -gt $t) { $t = $v } }
          if ($tAny -eq $null -or $v -gt $tAny) { $tAny = $v }
        }
        elseif ($ty -eq 'Power' -and $n -match 'Package') { $pw = $v }
        elseif ($ty -eq 'Clock' -and $n -match '^Core #') { $clk += $v }
      }
    }
    if ($t -eq $null) { $t = $tAny }
    if ($t -eq $null) { $script:LhmMsg = 'no cpu sensors (PawnIO?)' } else { $script:LhmMsg = 'ok' }
    $o = [ordered]@{ temp = $(if ($t -ne $null) { [math]::Round($t, 1) } else { $null }); power = $(if ($pw -ne $null) { [math]::Round($pw, 1) } else { $null }) }
    if ($clk.Count) { $o.clkMax = [math]::Round(($clk | Measure-Object -Maximum).Maximum); $o.clkAvg = [math]::Round(($clk | Measure-Object -Average).Average) }
    return $o
  } catch { $script:LhmMsg = 'error: ' + $_.Exception.Message; return $null }
}
function Get-CpuTemp {
  $m = $null
  foreach ($c in $script:ThermCtr) { try { $k = $c.NextValue(); if ($k -gt 200) { $v = $k - 273.15; if ($m -eq $null -or $v -gt $m) { $m = $v } } } catch { } }
  if ($m -eq $null -or $m -lt 5 -or $m -gt 125) { return $null }
  return [math]::Round($m, 1)
}
function Get-Procs {
  # Top-Prozesse nach CPU-Anteil seit der letzten Messung (gleichnamige zusammengefasst)
  if (-not $OnWin) { return ,@() }
  $now = [DateTime]::UtcNow; $cur = @{}; $agg = @{}
  $nt = [math]::Max(1, $script:Info.threads); if ($nt -le 1) { $nt = [Environment]::ProcessorCount }
  foreach ($p in Get-Process -ErrorAction SilentlyContinue) {
    try {
      if ($p.Id -eq 0) { continue }
      $cpu = $p.CPU; $cur[$p.Id] = $cpu
      $name = $p.ProcessName
      if (-not $agg.ContainsKey($name)) { $agg[$name] = @{ c = 0.0; m = 0.0; n = 0 } }
      $a = $agg[$name]; $a.m += [double]$p.WorkingSet64; $a.n++
      if ($cpu -ne $null -and $script:ProcT -and $script:ProcPrev.ContainsKey($p.Id) -and $script:ProcPrev[$p.Id] -ne $null) { $a.c += [double]$cpu - [double]$script:ProcPrev[$p.Id] }
    } catch { }
  }
  $out = @()
  if ($script:ProcT) {
    $dt = ($now - $script:ProcT).TotalSeconds
    if ($dt -gt 0.2) {
      foreach ($k in $agg.Keys) { if ($k -eq 'Idle') { continue }; $a = $agg[$k]; $out += [ordered]@{ name = $k; cpu = [math]::Round([math]::Max(0, $a.c / $dt / $nt * 100), 1); mem = [math]::Round($a.m); n = $a.n } }
      $out = @($out | Sort-Object { $_.cpu }, { $_.mem } -Descending | Select-Object -First 12)
    }
  }
  $script:ProcPrev = $cur; $script:ProcT = $now
  return ,$out
}
$script:DiskBusy = @{}
function Get-DiskBusy([string]$name) {
  if (-not $OnWin) { return $null }
  if (-not $script:DiskBusy.ContainsKey($name)) {
    try { $c = New-Object System.Diagnostics.PerformanceCounter('LogicalDisk', '% Idle Time', $name, $true); [void]$c.NextValue(); $script:DiskBusy[$name] = $c } catch { $script:DiskBusy[$name] = $null }
  }
  $c = $script:DiskBusy[$name]; if (-not $c) { return $null }
  try { return [math]::Round([math]::Max(0, [math]::Min(100, 100 - $c.NextValue())), 1) } catch { return $null }
}

# ---------- Messwerte zusammenstellen ----------
$script:Json = '{}'
$script:Tick = 0
$script:Disks = @(); $script:Vram = $null; $script:CpuMhz = $null; $script:GpuTemp = $null
function Fmt-Rate([double]$b) {
  if ($b -ge 1GB) { return ('{0:N2} GB/s' -f ($b / 1GB)) }
  if ($b -ge 100MB) { return ('{0:N0} MB/s' -f ($b / 1MB)) }
  if ($b -ge 1MB) { return ('{0:N1} MB/s' -f ($b / 1MB)) }
  return ('{0:N0} KB/s' -f ($b / 1KB))
}
function Tray-Text {
  # Tooltip: max. 63 Zeichen
  $rd = 0; $wr = 0; foreach ($d in $script:Disks) { $rd += $d.read; $wr += $d.write }
  $t = (L "Netz " "Net ") + [char]0x25BC + (Fmt-Rate $script:Net.down) + ' ' + [char]0x25B2 + (Fmt-Rate $script:Net.up) + "`nDisk " + (L 'L ' 'R ') + (Fmt-Rate $rd) + (L ' S ' ' W ') + (Fmt-Rate $wr)
  if ($t.Length -gt 63) { $t = $t.Substring(0, 63) }
  return $t
}
function Sample {
  # Takt 0,5 s: Netz jedes Mal, Laufwerke jede Sekunde, USB-Liste/Adapter seltener
  if ($script:Tick % 120 -eq 0) { Update-UsbLetters }
  if ($script:Tick % 60 -eq 0) { Update-Nic }
  if ($script:Tick % 240 -eq 0) { Update-Vram }
  if ($script:Tick % 20 -eq 0) { Update-GpuCounters }
  Sample-Net
  $script:Load = Get-Load
  if ($script:Tick % 2 -eq 0) { $script:Disks = Get-Disks; $script:Vram = Get-Vram; $script:CpuMhz = Get-CpuMhz }
  if ($script:Tick % 4 -eq 0) { $script:GpuTemp = Get-GpuTemp; $script:CpuTemp = Get-CpuTemp; $script:Procs = Get-Procs }
  if ($script:Tick % 2 -eq 0 -and $script:Lhm) { $script:LhmCpu = Get-LhmCpu }
  $script:Cores = Get-Cores
  $script:Tick++
  $o = [ordered]@{ v = 1; app = 'Bridge-Ops-Sensor'; ver = $Version; t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); load = $script:Load; net = $script:Net; nics = @($script:Nics); disks = $script:Disks; vram = $script:Vram; cpuMhz = $script:CpuMhz; gpuTemp = $script:GpuTemp; port = $Port; cores = $script:Cores; procs = $script:Procs; cpuTemp = $(if ($script:LhmCpu -and $script:LhmCpu.temp -ne $null) { $script:LhmCpu.temp } else { $script:CpuTemp }); cpuTempSrc = $(if ($script:LhmCpu -and $script:LhmCpu.temp -ne $null) { 'lhm' } elseif ($script:CpuTemp -ne $null) { 'acpi' } else { $null }); cpuX = $script:LhmCpu; ext = [ordered]@{ on = [bool]$Extended; msg = $script:LhmMsg }; info = $script:Info }
  $script:Json = ($o | ConvertTo-Json -Depth 4 -Compress)
}

# ---------- Mini-HTTP-Server (nur 127.0.0.1) ----------
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch {
  Log "Port $Port belegt / in use"
  if ($OnWin) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show((L "Port $Port ist belegt.`nIn sensor.cfg einen anderen Port eintragen (und im Wallpaper-Assistenten)." "Port $Port is in use.`nSet another port in sensor.cfg (and in the wallpaper setup wizard)."), 'Bridge-Ops-Sensor')
  }
  exit 1
}
function Send([System.Net.Sockets.NetworkStream]$st, [int]$code, [string]$reason, [string]$body, [string]$acao) {
  $b = [System.Text.Encoding]::UTF8.GetBytes($body)
  $h = "HTTP/1.1 $code $reason`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($b.Length)`r`nCache-Control: no-store`r`nVary: Origin`r`nConnection: close`r`n"
  if ($acao) { $h += "Access-Control-Allow-Origin: $acao`r`n" }
  $hb = [System.Text.Encoding]::ASCII.GetBytes($h + "`r`n")
  $st.Write($hb, 0, $hb.Length); $st.Write($b, 0, $b.Length); $st.Flush()
}
function Serve-Pending {
  while ($listener.Pending()) {
    $c = $listener.AcceptTcpClient()
    try {
      $c.ReceiveTimeout = 1000; $c.SendTimeout = 1000
      $st = $c.GetStream()
      $buf = New-Object byte[] 8192; $req = ''
      while ($req.IndexOf("`r`n`r`n") -lt 0 -and $req.Length -lt 8192) {
        $n = $st.Read($buf, 0, $buf.Length); if ($n -le 0) { break }
        $req += [System.Text.Encoding]::ASCII.GetString($buf, 0, $n)
      }
      $origin = ''
      foreach ($line in $req -split "`r`n") { if ($line -imatch '^Origin:\s*(.+)$') { $origin = $Matches[1].Trim() } }
      $method = ($req -split ' ')[0]
      $path = ($req -split ' ')[1]
      $weOk = ($origin -eq 'null') -and ($path -match '[?&]k=([0-9a-f]{16})(&|$)') -and ($Matches[1] -eq $WeKey)
      if ($weOk) {
        if ($method -eq 'GET') { Send $st 200 'OK' $script:Json 'null' }
        else { Send $st 405 'Method Not Allowed' '{"error":"method"}' 'null' }
      } elseif ($origin -eq 'null') {
        Send $st 403 'Forbidden' '{"error":"key"}' 'null'
      } elseif ($origin -match $OriginRx) {
        if ($method -eq 'GET') { Send $st 200 'OK' $script:Json $origin }
        else { Send $st 405 'Method Not Allowed' '{"error":"method"}' $origin }
      } else {
        # keine Daten an fremde Herkunft – nur ein Hinweis, damit das Wallpaper "Zugriff abgelehnt" anzeigen kann
        Send $st 403 'Forbidden' '{"error":"origin"}' '*'
      }
    } catch { } finally { $c.Close() }
  }
}

# ---------- Start ----------
Init-Load
Init-Extra
Sample
Log 'Messung läuft / sampling'
if ($OnWin) {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  # Symbol: kleine Konsolen-Pille in Bernstein
  $bmp = New-Object System.Drawing.Bitmap 32, 32
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $br = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(243, 156, 74))
  $g.FillEllipse($br, 1, 6, 20, 20); $g.FillRectangle($br, 11, 6, 20, 20)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 166, 242))), 14, 10, 14, 4)
  $g.Dispose()
  $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())

  $tray = New-Object System.Windows.Forms.NotifyIcon
  $tray.Icon = $icon; $tray.Text = (L "Bridge-Ops-Sensor läuft (Port $Port)" "Bridge-Ops-Sensor running (port $Port)"); $tray.Visible = $true
  $menu = New-Object System.Windows.Forms.ContextMenuStrip
  $i1 = $menu.Items.Add("Bridge-Ops-Sensor $Version · Port $Port" + $(if ($Extended) { (L ' · erweitert' ' · extended') } else { '' })); $i1.Enabled = $false
  $i2 = $menu.Items.Add((L 'Netz: –' 'Net: –')); $i2.Enabled = $false
  $sepD = New-Object System.Windows.Forms.ToolStripSeparator; [void]$menu.Items.Add($sepD)
  $diskItems = New-Object System.Collections.ArrayList
  $menu.add_Opening({
    foreach ($it in $diskItems) { $menu.Items.Remove($it) }; $diskItems.Clear()
    $idx = $menu.Items.IndexOf($sepD) + 1
    foreach ($d in $script:Disks) {
      $used = ($d.total - $d.free) / 1GB; $tot = $d.total / 1GB
      $it = New-Object System.Windows.Forms.ToolStripMenuItem(((L '{0}  {1:N0} / {2:N0} GB  ·  L {3}  S {4}' '{0}  {1:N0} / {2:N0} GB  ·  R {3}  W {4}') -f $d.d, $used, $tot, (Fmt-Rate $d.read), (Fmt-Rate $d.write)))
      $it.Enabled = $false; $menu.Items.Insert($idx, $it); [void]$diskItems.Add($it); $idx++
    }
    if ($script:Vram) { $it = New-Object System.Windows.Forms.ToolStripMenuItem(('VRAM  {0:N1} / {1:N0} GB' -f ($script:Vram.used / 1GB), ($script:Vram.total / 1GB))); $it.Enabled = $false; $menu.Items.Insert($idx, $it); [void]$diskItems.Add($it); $idx++ }
    $sep2 = New-Object System.Windows.Forms.ToolStripSeparator; $menu.Items.Insert($idx, $sep2); [void]$diskItems.Add($sep2)
  })
  $iKey = $menu.Items.Add((L "Wallpaper-Engine-Schlüssel kopieren ($WeKey)" "Copy Wallpaper Engine key ($WeKey)"))
  $iKey.add_Click({ try { [System.Windows.Forms.Clipboard]::SetText($WeKey); $tray.ShowBalloonTip(3000, 'Bridge-Ops-Sensor', (L 'Schlüssel kopiert – im Wallpaper unter "Sensor key" einfügen.' 'Key copied – paste it into the wallpaper setting "Sensor key".'), [System.Windows.Forms.ToolTipIcon]::Info) } catch { } })
  $quit = $menu.Items.Add((L 'Beenden' 'Quit'))
  $quit.add_Click({ [System.Windows.Forms.Application]::Exit() })
  $tray.ContextMenuStrip = $menu

  $tSample = New-Object System.Windows.Forms.Timer; $tSample.Interval = 500
  $tSample.add_Tick({ try { Sample
      $i2.Text = (L 'Netz: ' 'Net: ') + $(if ($script:NicDesc) { $script:NicDesc + '  ' + [char]0x25BC + (Fmt-Rate $script:Net.down) + ' ' + [char]0x25B2 + (Fmt-Rate $script:Net.up) } else { '–' })
      if ($script:Tick % 2 -eq 0) { $tray.Text = Tray-Text } } catch { } })
  $tServe = New-Object System.Windows.Forms.Timer; $tServe.Interval = 50
  $tServe.add_Tick({ try { Serve-Pending } catch { } })
  $tSample.Start(); $tServe.Start()
  Log 'Infobereich-Symbol aktiv / tray icon active'
  if ($Extended) {
    $tLhm = New-Object System.Windows.Forms.Timer; $tLhm.Interval = 1500
    $tLhm.add_Tick({ $tLhm.Stop(); try { Init-Lhm } catch { Log ('LHM: ' + $_.Exception.Message) } })
    $tLhm.Start()
  }
  [System.Windows.Forms.Application]::Run()
  $tray.Visible = $false; $tray.Dispose()
} else {
  # Testbetrieb ohne Windows (kein Infobereich)
  $last = [DateTime]::UtcNow
  while ($true) {
    Serve-Pending
    if (([DateTime]::UtcNow - $last).TotalMilliseconds -ge 500) { Sample; $last = [DateTime]::UtcNow }
    Start-Sleep -Milliseconds 50
  }
}
$listener.Stop()
$mutex.ReleaseMutex()
