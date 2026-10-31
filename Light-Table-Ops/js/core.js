/* Light Table Ops · © 2026 E11iot · CC BY-NC-ND 4.0
   core.js – Grundlagen: Hilfsfunktionen, Einstellungen, Speicher, Layout-Engine */
"use strict";
/* Laufzeit: Lively oder Wallpaper Engine (we-adapter.js setzt window.__WE) */
const IS_WE = !!window.__WE, HOST = IS_WE ? "WALLPAPER ENGINE" : "LIVELY", HOST_S = IS_WE ? "WE" : "LIVELY";
const $ = id => document.getElementById(id);
const pad = (n, l = 2) => String(n).padStart(l, "0");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s == null ? "" : s).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const nf = (n, d = 0) => (n == null || isNaN(n)) ? "--" : Number(n).toFixed(d);
const RAD = Math.PI / 180;
const DEMO = /[?&]demo=1/.test(location.search);
let paused = false;

/* ---------- Speicher (localStorage kann fehlen) ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
// Jede Lively-Instanz (je Monitor) hat eigene Layoutwerte – Schlüssel = Bildschirmgröße
const SCR = `${screen.width}x${screen.height}`;

/* ---------- Einstellungen ---------- */
const CFG = {
  // gemeinsam (alle Monitore)
  name: "", lat: null, lon: null, adsbProxy: "", sensorPort: 47047, units: "avi",
  // je Monitor
  layout: "full", stripSide: "right", stripW: 300, iconSide: "left", iconCols: 2, iconCellW: 118, iconCellH: 93,
  taskbar: 2.8, iconGrid: false, zoneFrame: true, zoneAdj: 0, inset: { l: 0, r: 0, t: 0, b: 0 },
  startView: "map", mapStyle: "vector", range: 100, ui: 100, dim: 100, nightMode: "auto", nightLvl: 60,
  anim: 60, fps: 30, boot: true, hatch: true
};
const COMMON = ["name", "lat", "lon", "adsbProxy", "sensorPort", "units"];
const PER = ["layout", "stripSide", "stripW", "iconSide", "iconCols", "iconCellW", "iconCellH", "taskbar", "iconGrid", "zoneFrame", "zoneAdj",
  "inset", "startView", "mapStyle", "range", "ui", "dim", "nightMode", "nightLvl", "anim", "fps", "boot", "hatch"];
let SETUP_DONE = false;
function loadCfg() {
  const c = LS.get("lto-common", null), p = LS.get("lto-scr-" + SCR, null);
  if (c) COMMON.forEach(k => { if (c[k] !== undefined) CFG[k] = c[k]; });
  if (p) PER.forEach(k => { if (p[k] !== undefined) CFG[k] = p[k]; });
  SETUP_DONE = !!(c && c.lat != null);
}
function saveCfg() {
  const c = {}, p = {};
  COMMON.forEach(k => c[k] = CFG[k]); PER.forEach(k => p[k] = CFG[k]);
  LS.set("lto-common", c); LS.set("lto-scr-" + SCR, p);
}
const hasLoc = () => CFG.lat != null && CFG.lon != null && !isNaN(CFG.lat) && !isNaN(CFG.lon);
/* Lively-Eigenschaft nur übernehmen, wenn sie in Lively geändert wurde (sonst gilt Assistent/Ziehen im Wallpaper) */
function propGate(name, val) {
  const key = "lto-prop-" + SCR + "-" + name, v = JSON.stringify(val);
  let last = null; try { last = localStorage.getItem(key); localStorage.setItem(key, v); } catch (e) { return true; }
  if (last === null) return !SETUP_DONE || !["place", "adsbProxy", "sensorPort"].includes(name);
  return last !== v;
}

/* ---------- Einheiten ---------- */
const AVI = () => CFG.units === "avi";
const U = {
  wind: kmh => AVI() ? kmh / 1.852 : kmh, windU: () => AVI() ? "KT" : "KM/H",
  alt: ft => AVI() ? ft : ft * 0.3048, altU: () => AVI() ? "FT" : "M",
  spd: kt => AVI() ? kt : kt * 1.852, spdU: () => AVI() ? "KT" : "KM/H",
  vis: m => m >= 9999 ? "10+ KM" : (m >= 5000 ? nf(m / 1000, 0) + " KM" : nf(m, 0) + " M"),
  dist: km => AVI() ? km / 1.852 : km, distU: () => AVI() ? "NM" : "KM"
};
const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const dir16 = d => DIRS[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}
function gcKm(la1, lo1, la2, lo2) {
  const a = Math.sin((la2 - la1) * RAD / 2) ** 2 + Math.cos(la1 * RAD) * Math.cos(la2 * RAD) * Math.sin((lo2 - lo1) * RAD / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}
function bearing(la1, lo1, la2, lo2) {
  const y = Math.sin((lo2 - lo1) * RAD) * Math.cos(la2 * RAD);
  const x = Math.cos(la1 * RAD) * Math.sin(la2 * RAD) - Math.sin(la1 * RAD) * Math.cos(la2 * RAD) * Math.cos((lo2 - lo1) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
/* Sonnenhöhe (vereinfachte NOAA-Formel, reicht für Tag/Nacht/Dämmerung) */
function sunAlt(d, lat, lon) {
  const jd = d / 864e5 + 2440587.5, n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) % 360;
  const lam = L + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD), eps = 23.439 - 0.0000004 * n;
  const dec = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD));
  const ra = Math.atan2(Math.cos(eps * RAD) * Math.sin(lam * RAD), Math.cos(lam * RAD)) / RAD;
  const gmst = (280.46061837 + 360.98564736629 * n) % 360, ha = (gmst + lon - ra) * RAD;
  return Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha)) / RAD;
}

/* ---------- kleine Ereignis-Drehscheibe ---------- */
const BUS = { m: {}, on(e, f) { (this.m[e] = this.m[e] || []).push(f); }, emit(e, a) { (this.m[e] || []).forEach(f => { try { f(a); } catch (err) { console.error(e, err); } }); } };

/* ---------- Zustand der Oberfläche ---------- */
const STATE = {
  mode: "full",        // aktuelle Ansicht: full | half | strip
  view: "map",         // Hauptansicht: map | sys | wx | flt
  dock: null,          // offenes Detail (Schlüssel) oder null
  dockMax: false,      // Detail über die ganze Fläche
  cols: 2, s: 1, W: 1920, H: 1080, rect: null, side: "right", edit: false
};

/* ================== LAYOUT ================== */
function zoneGeom() {
  const vw = innerWidth, vh = innerHeight, cols = Math.max(0, CFG.iconCols | 0);
  const zw = cols ? Math.max(0, Math.round(cols * CFG.iconCellW + 24 + (CFG.zoneAdj || 0))) : 0;
  const tb = Math.round(vh * (CFG.taskbar || 0) / 100);
  const left = CFG.iconSide !== "right";
  const free = { x: left ? zw : 0, y: 0, w: vw - zw, h: vh - tb };
  const ins = CFG.inset || { l: 0, r: 0, t: 0, b: 0 };
  free.x += ins.l; free.y += ins.t; free.w -= ins.l + ins.r; free.h -= ins.t + ins.b;
  free.w = Math.max(200, free.w); free.h = Math.max(200, free.h);
  return { zw, tb, left, free, vw, vh };
}
function consoleRect(g, mode) {
  const f = g.free;
  if (mode === "full") return { ...f };
  if (mode === "half") { const w = Math.round(f.w / 2); return { x: g.left ? f.x + f.w - w : f.x, y: f.y, w, h: f.h }; }
  const sw = clamp(CFG.stripW, 120, 900);
  if (CFG.stripSide === "bottom") return { x: f.x, y: f.y + f.h - sw, w: f.w, h: sw };
  if (CFG.stripSide === "left") return { x: f.x, y: f.y, w: sw, h: f.h };
  return { x: f.x + f.w - sw, y: f.y, w: sw, h: f.h };
}
function layout() {
  const g = zoneGeom();
  let mode = STATE.mode;
  // Streifen bleibt immer gleich; Ansicht/Detail kommen daneben (bzw. darüber) dazu
  const stripX = CFG.layout === "strip" && (STATE.mode !== "strip" || !!STATE.dock || STATE.dockMax);
  if (!stripX && STATE.dockMax) mode = "full";
  let r, s, W, H, side, cols, lay, sideW, bottom = false;
  if (stripX) {
    const sr = consoleRect(g, "strip"), f = g.free; bottom = CFG.stripSide === "bottom";
    const full = STATE.dockMax || STATE.mode === "full";
    s = Math.max(0.35, bottom ? sr.h / 250 : sr.w / 300);
    if (bottom) { const eh = full ? f.h - sr.h : Math.max(Math.round(f.h / 2) - sr.h, 360); r = { x: sr.x, y: sr.y - eh, w: sr.w, h: sr.h + eh }; }
    else { const ew = full ? f.w - sr.w : Math.max(Math.round(f.w / 2) - sr.w, 520); r = CFG.stripSide === "left" ? { x: sr.x, y: sr.y, w: sr.w + ew, h: sr.h } : { x: sr.x - ew, y: sr.y, w: sr.w + ew, h: sr.h }; }
    W = r.w / s; H = r.h / s; side = CFG.stripSide; cols = 1; lay = "stripx";
    sideW = bottom ? W - 24 : sr.w / s - 24;
    $("body").style.setProperty("--sideH", (sr.h / s - 20) + "px");
  } else {
    r = consoleRect(g, mode); bottom = mode === "strip" && CFG.stripSide === "bottom";
    if (mode === "strip") s = bottom ? r.h / 250 : r.w / 300;
    else s = Math.min(r.h / 1080, r.w / (mode === "full" ? 1560 : 1000)) * clamp(CFG.ui, 50, 150) / 100;
    s = Math.max(0.35, s); W = r.w / s; H = r.h / s;
    side = mode === "strip" ? CFG.stripSide : (g.left ? "right" : "left");
    cols = mode === "strip" ? 1 : (W >= 1400 ? 2 : 1); lay = mode;
    sideW = mode === "strip" ? W : cols * 290 + (cols - 1) * 14;
  }
  Object.assign(STATE, { s, W, H, rect: r, side, cols, lay, bottom });
  const con = $("console"), st = $("stage");
  con.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
  st.style.width = W + "px"; st.style.height = H + "px"; st.style.transform = `scale(${s})`;
  document.body.dataset.mode = lay; document.body.dataset.side = side;
  document.body.classList.toggle("bottomstrip", bottom);
  document.body.classList.toggle("dockopen", !!STATE.dock);
  document.body.classList.toggle("dockmax", !!STATE.dockMax);
  document.body.classList.toggle("twocol", cols === 2);
  // Kopfzeile: im aufgeklappten Streifen in die Hauptfläche, damit der Streifen unverändert bleibt
  const hdr = $("hdr"), main = $("main");
  if (lay === "stripx") { if (hdr.parentElement !== main) main.insertBefore(hdr, main.firstChild); }
  else if (hdr.parentElement !== st) st.insertBefore(hdr, $("body"));
  // Breiten: Seitenspalte, Detail, Hauptfläche
  let dockW = 0, mainOn = lay !== "strip" && !(lay === "stripx" && STATE.mode === "strip");
  if (STATE.dock) {
    const avail = (bottom && lay === "stripx") ? W - 28 : W - sideW - 28;
    if (STATE.dockMax || !mainOn) { dockW = avail; mainOn = false; }
    else { dockW = Math.min(660, avail); if (avail - dockW < 440) { dockW = avail; mainOn = false; } }
  }
  if (bottom && lay === "strip") dockW = 0;
  const body = $("body");
  body.style.setProperty("--sideW", sideW + "px");
  body.style.setProperty("--dockW", dockW + "px");
  document.body.classList.toggle("nomain", !mainOn);
  const mainW = (bottom && lay === "stripx") ? W - dockW - 40 : W - sideW - dockW - 40; STATE.mainW = mainW;
  document.body.classList.toggle("narrowmain", mainOn && mainW < 1050);
  document.body.classList.toggle("mainS", mainOn && mainW < 900);
  drawZone(g);
  BUS.emit("layout", STATE);
}
let layoutT = null;
function relayout(delay = 60) { clearTimeout(layoutT); layoutT = setTimeout(layout, delay); }
addEventListener("resize", () => relayout(100));

/* ---------- Icon-Zone: Rahmen + Kalibrierraster ---------- */
function drawZone(g) {
  const z = $("izone");
  if (!g.zw) { z.style.display = "none"; z.innerHTML = ""; return; }
  const x = g.left ? 0 : g.vw - g.zw;
  z.style.cssText = `display:block;left:${x}px;top:0;width:${g.zw}px;height:${g.vh - g.tb}px`;
  let cells = "";
  if (CFG.iconGrid || STATE.edit) {
    const rows = Math.floor((g.vh - g.tb) / CFG.iconCellH);
    for (let c = 0; c < CFG.iconCols; c++) for (let r = 0; r < rows; r++) {
      const cx = g.left ? c * CFG.iconCellW : g.zw - (c + 1) * CFG.iconCellW;
      cells += `<rect x="${cx + 3}" y="${r * CFG.iconCellH + 3}" width="${CFG.iconCellW - 6}" height="${CFG.iconCellH - 6}" rx="4" fill="none" stroke="var(--cy)" stroke-opacity=".55" stroke-dasharray="4 4"/>`;
    }
  }
  const W = g.zw, H = g.vh - g.tb, ex = g.left ? W - 6 : 6;
  const frame = CFG.zoneFrame ? `<line x1="${ex}" y1="${H * .06}" x2="${ex}" y2="${H * .94}" stroke="var(--ln)" stroke-width="1"/>
    <line x1="${ex}" y1="${H * .06}" x2="${ex + (g.left ? -14 : 14)}" y2="${H * .06}" stroke="var(--ln2)"/>
    <line x1="${ex}" y1="${H * .94}" x2="${ex + (g.left ? -14 : 14)}" y2="${H * .94}" stroke="var(--ln2)"/>
    ${[.2, .4, .6, .8].map(f => `<line x1="${ex - 4}" y1="${H * f}" x2="${ex + 4}" y2="${H * f}" stroke="var(--ln2)"/>`).join("")}` : "";
  z.innerHTML = `<svg width="${W}" height="${H}">${cells}${frame}</svg>`;
}

/* ---------- Helligkeit / Nacht ---------- */
let NIGHT = false;
function applyDim() {
  let b = clamp(CFG.dim, 10, 100) / 100;
  if (CFG.nightMode === "on") { NIGHT = true; b *= CFG.nightLvl / 100; }
  else if (CFG.nightMode === "auto" && hasLoc()) {
    const a = sunAlt(Date.now(), CFG.lat, CFG.lon); NIGHT = a < -6;
    const k = a >= 0 ? 1 : (a <= -6 ? CFG.nightLvl / 100 : 1 - (1 - CFG.nightLvl / 100) * (-a / 6));
    b *= k;
  } else NIGHT = false;
  document.body.style.setProperty("--bright", b.toFixed(3));
}
setInterval(applyDim, 60e3);
