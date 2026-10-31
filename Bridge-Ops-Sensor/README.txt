Bridge-Ops-Sensor  (optional, nur Windows)  ·  English version below
==========================================

Was ist das?
  Ein kleines PowerShell-Skript, das den Wallpapern "Bridge Ops" und "Light Table Ops" Werte liefert,
  die Lively und Wallpaper Engine nicht kennen:
  - Belegung je internem Laufwerk (USB-Platten und Netzlaufwerke werden ausgelassen)
  - Lese-/Schreibrate je Laufwerk
  - Netzwerk-Durchsatz am Adapter, über den die Internetverbindung läuft
  - Belegung des Grafikspeichers (VRAM)
  - CPU-, GPU- und RAM-Auslastung alle 0,5 s (schneller als Lively selbst)
  - ab 2.0: Last und Takt je logischem Prozessor (Thread), Top-Prozesse, Laufwerks-Aktivität,
    Systemstart (Uptime), CPU-/GPU-Name, Temperatur der ACPI-Thermozone (falls Windows sie meldet)
  Ohne Sensor läuft das Wallpaper wie bisher, nur ohne den Bereich LAUFWERKE.
  Meldungen und Symbol-Menü erscheinen in der Sprache von Windows (Deutsch, sonst Englisch).

Modus (ab 2.1)
  Install.cmd fragt nach dem Modus:
  [1] Standard  – ohne Adminrechte, Start über den Autostart-Ordner.
  [2] Erweitert – zusätzlich CPU-Temperatur, CPU-Leistung (W) und Kerntakt. Dafür lädt der Installer
      LibreHardwareMonitor 0.9.6 von github.com (MPL-2.0) und legt eine Windows-Aufgabe an, die den Sensor
      bei jeder Anmeldung mit Adminrechten startet (einmalige UAC-Abfrage beim Installieren).
      Die CPU-Werte kommen über den PawnIO-Treiber; der wird z. B. mit Fan Control oder LibreHardwareMonitor
      installiert. Fehlt er, bleibt die CPU-Temperatur leer.

Installieren
  1. Zip entpacken (nicht direkt aus dem Zip starten).
  2. Doppelklick auf "Install.cmd".
     Warnt Windows ("Der Computer wurde durch Windows geschützt"): "Weitere Informationen" -> "Trotzdem ausführen".
     Das ist normal: Das Skript ist nicht digital signiert (Zertifikate kosten Geld). Der Quelltext ist lesbar –
     wer mag, schaut vorher in Sensor.ps1 und Setup.ps1.
  3. Fertig: Unten rechts im Infobereich erscheint ein kleines Symbol (ggf. unter dem Pfeil ^).
     Der Sensor startet ab jetzt automatisch mit Windows. Keine Administratorrechte nötig.
  4. Kontrolle: Maus über das Symbol zeigt Netz- und Laufwerksraten, Rechtsklick alle Laufwerke.
     Im Wallpaper: ⚙ -> SENSOR -> TESTEN zeigt "VERBUNDEN".

Update
  Neue Version entpacken und wieder "Install.cmd" ausführen – der alte Sensor wird ersetzt.

Beenden / Entfernen
  - Beenden: Rechtsklick auf das Symbol -> Beenden (startet beim nächsten Windows-Start wieder).
  - Entfernen: Doppelklick auf "Uninstall.cmd" (Autostart-Eintrag und Programmordner werden gelöscht).

Sicherheit
  - Der Sensor ist nur auf diesem Rechner erreichbar (127.0.0.1), nicht aus dem Netzwerk.
  - Er antwortet nur dem Wallpaper in Lively (Herkunft https://….localhost) oder mit Schlüssel in Wallpaper Engine; Webseiten bekommen nichts.
  - Er nimmt keine Befehle an, liest nur Messwerte und sendet nichts ins Internet.
  - Der Quelltext (Sensor.ps1) ist lesbar – gern vorher reinschauen.

Wallpaper Engine (ab 2.2)
  Wallpaper Engine öffnet Web-Wallpaper als lokale Datei. Damit trotzdem keine fremde Seite mitlesen kann,
  braucht diese Verbindung einen Schlüssel:
  1. Rechtsklick auf das Sensor-Symbol -> "Wallpaper-Engine-Schlüssel kopieren".
  2. In Wallpaper Engine beim Wallpaper unter "Sensor key" einfügen.
  Der Schlüssel steht auch in we-key.txt im Programmordner (löschen = beim nächsten Start neuer Schlüssel).

Port ändern
  Standard ist 47047. Falls belegt: in "sensor.cfg" (im Ordner %LOCALAPPDATA%\Bridge-Ops-Sensor) z. B. Port=47048
  eintragen, Sensor neu starten und denselben Port im Wallpaper-Assistenten (⚙ -> SENSOR-PORT) eintragen.

Wallpaper zeigt "SENSOR: ZUGRIFF ABGELEHNT"?
  Dann öffnet die installierte Lively-Version das Wallpaper noch als lokale Datei. Lively aktualisieren.


Bridge-Ops-Sensor  (optional, Windows only)
===========================================

What is it?
  A small PowerShell script that gives the "Bridge Ops" and "Light Table Ops" wallpapers readings
  Lively and Wallpaper Engine don't have:
  - usage per internal drive (USB disks and network drives are skipped)
  - read/write rate per drive
  - network throughput on the adapter that carries your internet connection
  - graphics memory usage (VRAM)
  - CPU, GPU and RAM load every 0.5 s (faster than Lively itself)
  - since 2.0: load and clock per logical processor (thread), top processes, drive activity,
    boot time (uptime), CPU/GPU name, ACPI thermal zone temperature (if Windows reports one)
  Without the sensor the wallpaper works as before, just without the DRIVES section.
  Messages and the tray menu follow your Windows display language (German, otherwise English).

Mode (since 2.1)
  Install.cmd asks for the mode:
  [1] Standard – no admin rights, starts via the Startup folder.
  [2] Extended – adds CPU temperature, CPU power (W) and core clocks. The installer downloads
      LibreHardwareMonitor 0.9.6 from github.com (MPL-2.0) and creates a Windows task that starts the sensor
      with admin rights at every sign-in (one UAC prompt while installing).
      CPU values come through the PawnIO driver, installed e.g. with Fan Control or LibreHardwareMonitor.
      Without it the CPU temperature stays empty.

Install
  1. Unzip first (don't run it from inside the zip).
  2. Double-click "Install.cmd".
     If Windows warns ("Windows protected your PC"): "More info" -> "Run anyway".
     That's expected: the script is not digitally signed (certificates cost money). The source is plain text –
     feel free to read Sensor.ps1 and Setup.ps1 first.
  3. Done: a small icon appears in the notification area at the bottom right (maybe under the arrow ^).
     From now on the sensor starts automatically with Windows. No admin rights needed.
  4. Check: hovering the icon shows network and drive rates, right-click lists all drives.
     In the wallpaper: ⚙ -> SENSOR -> TEST shows "CONNECTED".

Update
  Unzip the new version and run "Install.cmd" again – the old sensor gets replaced.

Quit / remove
  - Quit: right-click the icon -> Quit (starts again with the next Windows start).
  - Remove: double-click "Uninstall.cmd" (autostart entry and program folder are deleted).

Security
  - The sensor is only reachable on this computer (127.0.0.1), not from the network.
  - It only answers the wallpaper inside Lively (origin https://….localhost) or, with the key, in Wallpaper Engine; websites get nothing.
  - It accepts no commands, only reads measurements and sends nothing to the internet.
  - The source (Sensor.ps1) is plain text – feel free to have a look first.

Change the port
  Default is 47047. If it's taken: in "sensor.cfg" (folder %LOCALAPPDATA%\Bridge-Ops-Sensor) set e.g. Port=47048,
  restart the sensor and enter the same port in the wallpaper wizard (⚙ -> SENSOR PORT).

Wallpaper shows "SENSOR: ACCESS DENIED"?
  Your Lively version still opens the wallpaper as a local file. Update Lively.

Wallpaper Engine (since 2.2)
  Wallpaper Engine opens web wallpapers as local files. So that no other page can read along,
  this connection needs a key:
  1. Right-click the sensor icon -> "Copy Wallpaper Engine key".
  2. Paste it into the wallpaper's "Sensor key" setting in Wallpaper Engine.
  The key is also in we-key.txt in the program folder (delete it = new key on next start).

