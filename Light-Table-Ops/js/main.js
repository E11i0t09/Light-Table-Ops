/* Light Table Ops · © 2026 E11iot · CC BY-NC-ND 4.0
   main.js – Kopfzeile, Start, Hauptschleife, Lively-Eigenschaften */
"use strict";

/* ---------- Kopfzeile ---------- */
function buildHdr() {
  const exp = STATE.mode !== CFG.layout;
  $("hdr").innerHTML = `<div class="brand"><span class="ic">${ICON.dots}</span><b>LIGHT TABLE</b><small>OPS 1.0<br>E11IOT</small></div>
    <div class="sector"><span class="tri">${ICON.tri}</span><b id="hdSec">SECTOR <span>----</span></b></div>
    <div class="tick" id="hdTick"></div>
    <div class="ctl"><span class="btn" id="hbSet" title="SETUP">⚙</span><span class="btn" id="hbEd" title="EDIT LAYOUT">✎</span>
      ${STATE.lay !== "strip" ? `<span class="btn" id="hbExp" title="HALF / FULL">${STATE.mode === "full" ? "◧" : "◻"}</span>` : ""}
      ${exp ? `<span class="btn or" id="hbX">✕ CLOSE</span>` : ""}</div><div class="line"></div>`;
  $("hbSet").onclick = openSetup; $("hbEd").onclick = startEdit;
  if ($("hbExp")) $("hbExp").onclick = () => { STATE.mode = STATE.mode === "full" ? "half" : "full"; STATE.dockMax = false; layout(); };
  if ($("hbX")) $("hbX").onclick = () => { STATE.mode = CFG.layout; STATE.dock = null; STATE.dockMax = false; layout(); };
  updSector();
}
function updSector() { const e = $("hdSec"); if (e && hasLoc()) e.innerHTML = `SECTOR <span>${utmRef(CFG.lat, CFG.lon, 1).short}</span>`; }
/* Streifen-Leiste: Ansicht öffnen, Einrichtung, Bearbeiten */
function stripBar() {
  if (STATE.lay !== "strip" && STATE.lay !== "stripx") return;
  const b = document.createElement("div"); b.className = "pn"; b.style.cssText = "cursor:default;padding:6px 0 8px";
  b.innerHTML = `<div class="row" style="justify-content:space-between">${[["map", "MAP"], ["sys", "SYS"], ["wx", "WX"], ["flt", "FLT"]].map(([k, n]) => `<span class="btn" data-sv="${k}">${n}</span>`).join("")}
    <span class="btn" id="sbSet">⚙</span><span class="btn" id="sbEd">✎</span></div>`;
  const col = $("side").querySelector(".col"); col.insertBefore(b, col.firstChild);
  b.querySelectorAll("[data-sv]").forEach(s => s.onclick = () => { STATE.mode = "half"; layout(); setView(s.dataset.sv); });
  $("sbSet").onclick = openSetup; $("sbEd").onclick = startEdit;
}

/* ---------- Daten-Ticker (Zahlenkolonnen oben rechts) ---------- */
const TICK = { lines: [], t: 0 };
function tick(now) {
  const el = $("hdTick"); if (!el) return;
  const iv = CFG.anim ? 2600 - CFG.anim * 22 : 1e9; if (now - TICK.t < iv) return; TICK.t = now;
  const d = new Date(), rnd = n => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
  const vals = [hasLoc() ? CFG.lat : 0, hasLoc() ? CFG.lon : 0, SYS.cpu / 100, SYS.gpu / 100, WX.d ? WX.d.current.pressure_msl / 1000 : 1];
  if (!TICK.lines.length) for (let i = 0; i < 4; i++) TICK.lines.push("");
  TICK.lines.shift();
  TICK.lines.push(`${d.getFullYear()} ${pad(isoWeek(d))}  ${(vals[Math.floor(Math.random() * vals.length)] * (Math.random() < .5 ? -1 : 1)).toExponential(8).toUpperCase()}  ${rnd(7)}`);
  el.textContent = TICK.lines.join("\n");
}

/* ---------- Animationen ---------- */
function applyAnim() { document.body.classList.toggle("noanim", !CFG.anim); }

/* ---------- Hauptschleife ---------- */
let lastF = 0, lastOv = 0, lastSlow = 0;
function loop(now) {
  if (paused) return;
  requestAnimationFrame(loop);
  if (now - lastF < 1000 / clamp(CFG.fps, 5, 60)) return; lastF = now;
  drawAudio(); drawWave(now); tick(now);
  if (STATE.dock === "audio") drawAudioBig();
  if (MAP.m && (MAP.dirty || (CFG.anim && now - lastOv > 1000 / Math.max(2, CFG.anim / 5)))) { lastOv = now; drawOverlay(now); }
  if (STATE.view === "sys" && CFG.anim && now - lastSlow > 66) { lastSlow = now; drawGpu(sensFresh() ? SENS.data : null); }
}
function setPaused(p) { const was = paused; paused = p; if (was && !p) requestAnimationFrame(loop); }
function livelyWallpaperPlaybackChanged(data) { try { const o = typeof data === "string" ? JSON.parse(data) : data; setPaused(!!o.IsPaused); } catch (e) {} }
document.addEventListener("visibilitychange", () => setPaused(document.hidden));

/* ---------- Lively-Eigenschaften ---------- */
const DD = {
  layout: ["full", "half", "strip"], stripSide: ["right", "left", "bottom"], iconSide: ["left", "right"], startView: ["map", "sys", "wx", "flt"],
  mapStyle: ["vector", "sat"], units: ["avi", "met"], nightMode: ["auto", "on", "off"]
};
let propT = null;
function livelyPropertyListener(name, val) {
  if (name === "openSetup") { if (performance.now() > 4000) openSetup(); return; }   // beim Start sendet Lively alle Werte
  if (name === "editMode") { if (!propGate(name, val)) return; if (val) startEdit(); else if (STATE.edit) stopEdit(); return; }
  if (!propGate(name, val)) return;
  if (DD[name]) val = DD[name][+val] || DD[name][0];
  switch (name) {
    case "place": {
      const q = String(val || "").trim(); if (!q) return;
      clearTimeout(propT); propT = setTimeout(async () => { try { const r = (await geocode(q))[0]; if (r) { Object.assign(CFG, { name: r.name, lat: r.lat, lon: r.lon }); SETUP_DONE = true; onLocationChanged(); updSector(); } } catch (e) {} }, 800);
      return;
    }
    case "adsbProxy": CFG.adsbProxy = String(val || "").trim(); saveCfg(); clearTimeout(AIR.timer); AIR.timer = setTimeout(loadAir, 500); return;
    case "sensorPort": CFG.sensorPort = clamp(+val || 47047, 1024, 65535); saveCfg(); pollSensor(); return;
    case "layout": CFG.layout = val; STATE.mode = val; STATE.dock = null; STATE.dockMax = false; break;
    case "startView": CFG.startView = val; saveCfg(); setView(val); return;
    case "mapStyle": setMapStyle(val); return;
    case "units": CFG.units = val; saveCfg(); BUS.emit("units"); return;
    case "range": CFG.range = clamp(+val || 100, 20, 180); saveCfg(); mapHome(); clearTimeout(AIR.timer); AIR.timer = setTimeout(loadAir, 500); MAP.dirty = true; return;
    case "dim": CFG.dim = clamp(+val || 100, 10, 100); saveCfg(); applyDim(); return;
    case "nightMode": CFG.nightMode = val; saveCfg(); applyDim(); if ($("swNight")) updCmd(); return;
    case "nightLvl": CFG.nightLvl = clamp(+val || 60, 10, 100); saveCfg(); applyDim(); return;
    case "anim": CFG.anim = clamp(+val, 0, 100); saveCfg(); applyAnim(); if ($("swAnim")) updCmd(); return;
    case "fps": CFG.fps = clamp(+val || 30, 5, 60); saveCfg(); return;
    case "boot": CFG.boot = !!val; saveCfg(); return;
    case "iconGrid": case "zoneFrame": CFG[name] = !!val; break;
    case "stripSide": case "iconSide": CFG[name] = val; break;
    case "stripW": case "iconCols": case "iconCellW": case "iconCellH": case "taskbar": case "ui": CFG[name] = +val; break;
    default: return;
  }
  saveCfg(); relayout(150);
}
BUS.on("units", () => { updAll(); updFoot(); MAP.dirty = true; renderWx(); renderFlt(); if (STATE.dock) renderDock(); });

/* ---------- Layout-Ereignis: Seitenspalte neu, Karte anlegen ---------- */
let lastCols = -1, lastLay = "", lastSide = "";
let STARTED = false;
BUS.on("layout", s => {
  if (!STARTED) return;
  buildHdr();
  const lk = s.lay === "stripx" ? "strip" : s.lay;
  if (s.cols !== lastCols || lk !== lastLay || s.side !== lastSide) { lastCols = s.cols; lastLay = lk; lastSide = s.side; buildSide(); stripBar(); }
  else fitSide();
  requestAnimationFrame(() => { placeMap(); drawFrame(); if (STATE.view === "sys") buildSys(); if (STATE.view === "wx") renderWx(); if (STATE.view === "flt") renderFlt(); updFoot(); if (STATE.edit) renderEdit(); });
});
BUS.on("loc", () => { updSector(); });
setInterval(() => { if (!paused) updMapInfo(); }, 2000);

/* ---------- Startsequenz ---------- */
function bootSeq() {
  const els = [$("hdr"), ...document.querySelectorAll(".pn"), $("mfoot"), ...document.querySelectorAll(".view.on > *")];
  if (!CFG.boot || !CFG.anim) { document.body.classList.remove("booting"); return; }
  els.forEach((el, i) => { if (el) { el.style.animationDelay = (i * 70) + "ms"; el.classList.add("bootin"); } });
  setTimeout(() => { document.body.classList.remove("booting"); els.forEach(el => { if (el) { el.classList.remove("bootin"); el.style.animationDelay = ""; } }); }, els.length * 70 + 700);
}

/* ---------- Start ---------- */
loadCfg(); STATE.mode = CFG.layout; STATE.view = LS.get("lto-view-" + SCR, CFG.startView);
function start() {
  STATE.mode = CFG.layout;
  applyDim(); applyAnim(); buildMapUI(); buildFoot();
  STARTED = true; layout(); setView(STATE.view);
  pollSensor();
  if (hasLoc()) startData(); else setTimeout(() => { if (!hasLoc()) openSetup(); }, 1500);
  requestAnimationFrame(bootSeq);
  requestAnimationFrame(loop);
}
if (document.fonts && document.fonts.load) document.fonts.load("300 16px Oxanium").finally(start); else start();
