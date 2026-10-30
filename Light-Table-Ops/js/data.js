/* Light Table Ops · © 2026 E11iot · CC BY-NC-ND 4.0
   data.js – Datenquellen: Lively, Bridge-Ops-Sensor, Open-Meteo, MET Norway, RainViewer, DWD, ADS-B-Proxy */
"use strict";

/* Status aller Quellen für DATALINKS */
const LINKS = {
  lively: { n: "LIVELY SYSTEM", ok: false, t: 0 }, sensor: { n: "BRIDGE-OPS-SENSOR", ok: false, t: 0 },
  wx: { n: "OPEN-METEO", ok: false, t: 0 }, aq: { n: "CAMS AIR QUALITY", ok: false, t: 0 },
  metar: { n: "METAR / TAF", ok: false, t: 0 }, adsb: { n: "ADS-B PROXY", ok: false, t: 0 },
  rain: { n: "RAINVIEWER", ok: false, t: 0 }, dwd: { n: "DWD WARNINGS", ok: false, t: 0 }, grid: { n: "SYNOPTIC GRID", ok: false, t: 0 }
};
function link(k, ok, msg) { const l = LINKS[k]; l.ok = !!ok; l.t = Date.now(); l.msg = msg || ""; BUS.emit("links"); }
const linkCount = () => Object.values(LINKS).filter(l => l.ok).length;
async function getJSON(u, opt) { const r = await fetch(u, Object.assign({ cache: "no-store" }, opt || {})); if (!r.ok) throw new Error(r.status); return r.json(); }
const proxyUrl = q => `${CFG.adsbProxy}${CFG.adsbProxy.includes("?") ? "&" : "?"}${q}`;

/* ================== SYSTEM (Lively + Sensor) ================== */
const VIRT_GPU = /virtual|mobile monitor|basic display|basic render|remote|parsec|idd|mirror|spacedesk|duet|displaylink|meta/i;
const HN = 600;   // 10 min Verlauf bei 1 Wert/s
const SYS = {
  live: false, last: 0, cpu: 0, gpu: 0, ram: 0, ramTot: 0, down: 0, up: 0, cpuName: "", gpuName: "", netName: "",
  hist: { cpu: [], gpu: [], ram: [], down: [], up: [], gpuT: [], vram: [] }, sess: { down: 0, up: 0, t0: Date.now() }, demo: false
};
function pushHist(k, v) { const h = SYS.hist[k]; h.push(v); if (h.length > HN) h.shift(); }
const toMB = v => { v = +v || 0; return v > 1e6 ? v / 1048576 : v; };   // Lively meldet RAM je nach Version in Byte oder MB
function livelySystemInformation(data) {
  let o; try { o = typeof data === "string" ? JSON.parse(data) : data; } catch (e) { return; }
  if (!o) return;
  SYS.live = true; SYS.last = Date.now(); SYS.demo = false; link("lively", true);
  // Namen nur übernehmen, solange der Sensor keine liefert; virtuelle Anzeigeadapter ignorieren
  if (!SYS.nameFromSensor) {
    const c = String(o.NameCpu || "").replace(/\((R|TM)\)/gi, "").replace(/\s+/g, " ").trim(); if (c) SYS.cpuName = c;
    const g = String(o.NameGpu || "").replace(/\((R|TM)\)/gi, "").trim(); if (g && !VIRT_GPU.test(g)) SYS.gpuName = g;
  }
  SYS.netName = String(o.NameNetCard || "").replace(/\[R\]|\(R\)/g, "").trim();
  if (sensFresh()) return;   // Sensor misst schneller und am richtigen Adapter
  const tot = toMB(o.TotalRam), av = toMB(o.CurrentRamAvail);
  SYS.cpu = +o.CurrentCpu || 0; SYS.gpu = +o.CurrentGpu3D || 0; SYS.ram = tot ? (1 - av / tot) * 100 : 0; SYS.ramTot = tot * 1048576;
  SYS.down = +o.CurrentNetDown || 0; SYS.up = +o.CurrentNetUp || 0;
}
const SENS = { ok: false, denied: false, data: null, last: 0, timer: null };
const sensFresh = () => SENS.ok && Date.now() - SENS.last < 8000;
async function pollSensor() {
  clearTimeout(SENS.timer);
  if (paused) { SENS.timer = setTimeout(pollSensor, 2000); return; }
  try {
    const r = await fetch(`http://127.0.0.1:${CFG.sensorPort}/`, { cache: "no-store" });
    if (r.status === 403) { SENS.ok = false; SENS.denied = true; link("sensor", false, "ACCESS DENIED"); }
    else {
      const j = await r.json();
      if (j && j.app === "Bridge-Ops-Sensor") {
        SENS.ok = true; SENS.denied = false; SENS.data = j; SENS.last = Date.now(); link("sensor", true, "V" + j.ver);
        const l = j.load || {};
        if (l.cpu != null) SYS.cpu = l.cpu; if (l.gpu != null) SYS.gpu = l.gpu; if (l.ram != null) SYS.ram = l.ram; if (l.ramTotal) SYS.ramTot = l.ramTotal;
        if (j.net && j.net.name) { SYS.down = +j.net.down || 0; SYS.up = +j.net.up || 0; SYS.netName = String(j.net.name).replace(/\[R\]|\(R\)/g, "").trim(); }
        if (j.info) { if (j.info.cpu) SYS.cpuName = j.info.cpu; if (j.info.gpu && !VIRT_GPU.test(j.info.gpu)) { SYS.gpuName = j.info.gpu; SYS.nameFromSensor = true; } }
        SYS.live = true; SYS.last = Date.now(); SYS.demo = false;
      }
    }
  } catch (e) { SENS.ok = false; SENS.denied = false; link("sensor", false, "NOT RUNNING"); }
  SENS.timer = setTimeout(pollSensor, SENS.ok ? 1000 : 15000);
}
const sensV2 = () => sensFresh() && Array.isArray(SENS.data.cores) && SENS.data.cores.length > 0;
const THR = { hist: [] };   // Verlauf je Thread (60 Werte)
// 1×/s: Verläufe fortschreiben (auch bei Demo)
setInterval(() => {
  if (paused) return;
  if (!SYS.live || Date.now() - SYS.last > 10000) demoSys();
  const sd = sensFresh() ? SENS.data : null; pushHist("gpuT", sd && sd.gpuTemp != null ? sd.gpuTemp : null); pushHist("vram", sd && sd.vram && sd.vram.total ? sd.vram.used / sd.vram.total * 100 : null);
  pushHist("cpu", SYS.cpu); pushHist("gpu", SYS.gpu); pushHist("ram", SYS.ram); pushHist("down", SYS.down); pushHist("up", SYS.up);
  SYS.sess.down += SYS.down; SYS.sess.up += SYS.up;
  const cores = threads();
  cores.forEach((c, i) => { const h = THR.hist[i] = THR.hist[i] || []; h.push(c.u || 0); if (h.length > 60) h.shift(); });
  BUS.emit("sys");
}, 1000);
let demoT = 0;
function demoSys() {
  SYS.demo = true; demoT += .15;
  SYS.cpu = 18 + 14 * Math.sin(demoT) + Math.random() * 10; SYS.gpu = 30 + 20 * Math.sin(demoT * .6 + 1) + Math.random() * 8; SYS.ram = 46 + 4 * Math.sin(demoT * .2);
  SYS.down = Math.max(0, 900e3 + 700e3 * Math.sin(demoT * .8) + Math.random() * 300e3); SYS.up = Math.max(0, 90e3 + 60e3 * Math.sin(demoT * 1.3) + Math.random() * 40e3);
  if (!SYS.ramTot) SYS.ramTot = 32 * 1073741824;
}
/* Threads: echte Werte vom Sensor 2.0, sonst Demo-Werte aus der Gesamtlast */
let DEMO_THR = 16;
function threads() {
  if (sensV2()) return SENS.data.cores;
  const n = DEMO_THR, out = [];
  for (let i = 0; i < n; i++) out.push({ u: clamp(SYS.cpu * (0.4 + 1.2 * Math.abs(Math.sin(i * 1.7 + demoT * (0.3 + i % 3 * .2)))), 0, 100), mhz: Math.round(3600 + 900 * Math.sin(i + demoT)), demo: true });
  return out;
}

/* ================== AUDIO ================== */
const AUD = { bins: new Float32Array(64), tgt: new Float32Array(64), last: 0, lvl: 0, peak: 0 };
function livelyAudioListener(arr) {
  if (!arr || !arr.length) return;
  const n = AUD.tgt.length, step = arr.length / n; let sum = 0;
  for (let i = 0; i < n; i++) { let m = 0; for (let k = Math.floor(i * step); k < Math.floor((i + 1) * step); k++) m = Math.max(m, arr[k] || 0); AUD.tgt[i] = Math.min(1, m * 1.4); sum += AUD.tgt[i]; }
  AUD.lvl = Math.min(1, sum / n * 2.2); AUD.last = Date.now();
}
const audioLive = () => Date.now() - AUD.last < 1500;

/* ================== WETTER (Open-Meteo) ================== */
const WX = { d: null, t: 0, timer: null };
const WMO = { 0: "CLEAR", 1: "MAINLY CLEAR", 2: "PARTLY CLOUDY", 3: "OVERCAST", 45: "FOG", 48: "RIME FOG", 51: "LIGHT DRIZZLE", 53: "DRIZZLE", 55: "DENSE DRIZZLE",
  56: "FRZ DRIZZLE", 57: "FRZ DRIZZLE", 61: "LIGHT RAIN", 63: "RAIN", 65: "HEAVY RAIN", 66: "FRZ RAIN", 67: "FRZ RAIN", 71: "LIGHT SNOW", 73: "SNOW", 75: "HEAVY SNOW",
  77: "SNOW GRAINS", 80: "RAIN SHOWERS", 81: "RAIN SHOWERS", 82: "VIOLENT SHOWERS", 85: "SNOW SHOWERS", 86: "SNOW SHOWERS", 95: "THUNDERSTORM", 96: "TSTORM · HAIL", 99: "TSTORM · HAIL" };
async function loadWeather() {
  clearTimeout(WX.timer); if (!hasLoc()) return;
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${CFG.lat}&longitude=${CFG.lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover,visibility,precipitation,is_day" +
    "&hourly=temperature_2m,dew_point_2m,precipitation_probability,precipitation,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,cloud_cover,relative_humidity_2m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset,uv_index_max" +
    "&timezone=auto&past_days=1&forecast_days=8";
  try { WX.d = await getJSON(u); WX.t = Date.now(); link("wx", true); BUS.emit("wx"); WX.timer = setTimeout(loadWeather, 15 * 60e3); }
  catch (e) { link("wx", false, "UNREACHABLE"); WX.timer = setTimeout(loadWeather, 2 * 60e3); }
}
/* Index der aktuellen Stunde in hourly */
function hourIdx() { if (!WX.d) return 0; const h = WX.d.hourly.time, now = Date.now(); let i = h.findIndex(s => new Date(s) > now) - 1; return Math.max(0, i); }
function pressTrend() {   // hPa in 3 h
  if (!WX.d) return null; const i = hourIdx(), p = WX.d.hourly.pressure_msl;
  return (p[i] != null && p[i - 3] != null) ? WX.d.current.pressure_msl - p[i - 3] : null;
}

/* ---------- Luftqualität: UV + Pollen ---------- */
const AQ = { d: null, timer: null };
const POLLEN = [["alder_pollen", "ALDER"], ["birch_pollen", "BIRCH"], ["grass_pollen", "GRASS"], ["mugwort_pollen", "MUGWORT"], ["ragweed_pollen", "RAGWEED"], ["olive_pollen", "OLIVE"]];
async function loadAQ() {
  clearTimeout(AQ.timer); if (!hasLoc()) return;
  const u = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${CFG.lat}&longitude=${CFG.lon}` +
    "&current=uv_index,european_aqi," + POLLEN.map(p => p[0]).join(",") + "&hourly=uv_index,european_aqi," + POLLEN.map(p => p[0]).join(",") + "&timezone=auto&forecast_days=2";
  try { AQ.d = await getJSON(u); link("aq", true); BUS.emit("aq"); AQ.timer = setTimeout(loadAQ, 60 * 60e3); }
  catch (e) { link("aq", false); AQ.timer = setTimeout(loadAQ, 5 * 60e3); }
}
const pollenLvl = v => v == null ? 0 : v < 1 ? 0 : v < 20 ? 1 : v < 100 ? 2 : 3;   // grob: keine/gering/mäßig/hoch

/* ---------- Synoptisches Raster (Isobaren / Temperatur) ---------- */
const GRID = { n: 7, lat: [], lon: [], p: [], t: [], timer: null, ok: false };
async function loadGrid() {
  clearTimeout(GRID.timer); if (!hasLoc()) return;
  const n = GRID.n, la = [], lo = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { la.push((CFG.lat + 4.5 - 9 * r / (n - 1)).toFixed(2)); lo.push((CFG.lon - 7 + 14 * c / (n - 1)).toFixed(2)); }
  try {
    const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${la.join(",")}&longitude=${lo.join(",")}&current=pressure_msl,temperature_2m&timezone=UTC`);
    const arr = Array.isArray(j) ? j : [j];
    GRID.lat = la.map(Number); GRID.lon = lo.map(Number);
    GRID.p = arr.map(o => o.current ? o.current.pressure_msl : null); GRID.t = arr.map(o => o.current ? o.current.temperature_2m : null);
    GRID.ok = true; link("grid", true); BUS.emit("grid"); GRID.timer = setTimeout(loadGrid, 60 * 60e3);
  } catch (e) { link("grid", false); GRID.timer = setTimeout(loadGrid, 10 * 60e3); }
}

/* ================== METAR / TAF ================== */
const MET = { st: [], t: 0, timer: null, src: "" };
function nearAirports(maxKm = 300, n = 12) {
  const out = [];
  for (const a of APTS) { if (a[4] > 1) continue; const d = gcKm(CFG.lat, CFG.lon, a[2], a[3]); if (d <= maxKm) out.push({ ic: a[0], name: a[1], lat: a[2], lon: a[3], d }); }
  return out.sort((p, q) => p.d - q.d).slice(0, n);
}
function splitReports(txt, all) {
  const out = {};
  String(txt || "").split("=").forEach(r => {
    r = r.replace(/\s+/g, " ").trim(); if (!r) return;
    const tk = r.split(" "); while (/^(METAR|SPECI|TAF|AMD|COR)$/.test(tk[0])) tk.shift();
    const ic = tk[0]; if (/^[A-Z]{4}$/.test(ic)) { if (all) (out[ic] = out[ic] || []).push(tk.join(" ")); else out[ic] = tk.join(" "); }
  });
  return out;
}
function pickTaf(list) {
  if (!list || !list.length) return null;
  const iss = r => { const m = r.split(" ")[1] || ""; return /^\d{6}Z$/.test(m) ? tafDate(m.slice(0, 2), m.slice(2, 4), m.slice(4, 6)) : 0; };
  const newest = list.slice().sort((a, b) => iss(b) - iss(a));
  const valid = newest.filter(r => { const tl = tafTimeline(r); return tl && tl.to > Date.now(); });
  return (valid.length ? valid : newest)[0];
}
async function metFetch(codes) {
  const q = codes.join(",");
  try {   // MET Norway erlaubt den Abruf direkt aus dem Browser
    const [m, t] = await Promise.all(["metar", "taf"].map(k => fetch(`https://api.met.no/weatherapi/tafmetar/1.0/${k}.txt?icao=${q}`).then(r => { if (!r.ok) throw 0; return r.text(); })));
    const M = splitReports(m); if (Object.keys(M).length) return { src: "MET NORWAY", metar: M, taf: splitReports(t, true) };
  } catch (e) {}
  if (CFG.adsbProxy) {   // Rückfall über den eigenen Proxy
    const j = await getJSON(proxyUrl("metar=" + q));
    return { src: "PROXY", metar: splitReports((j.metar || []).join("=\n")), taf: splitReports((j.taf || []).join("=\n"), true) };
  }
  throw new Error("none");
}
async function loadMetar() {
  clearTimeout(MET.timer); if (!hasLoc()) return;
  const near = nearAirports(300, 14);
  try {
    const r = await metFetch(near.map(a => a.ic)); MET.src = r.src;
    MET.st = near.filter(a => r.metar[a.ic]).map(a => {
      const m = parseMetar(r.metar[a.ic]); const taf = pickTaf(r.taf[a.ic]);
      return Object.assign({}, a, { raw: r.metar[a.ic], m, taf, tl: taf ? tafTimeline(taf) : null });
    });
    MET.t = Date.now(); link("metar", MET.st.length > 0, MET.src); BUS.emit("metar");
    MET.timer = setTimeout(loadMetar, 10 * 60e3);
  } catch (e) { link("metar", false, "UNREACHABLE"); MET.timer = setTimeout(loadMetar, 2 * 60e3); }
}

/* ================== ADS-B (eigener Proxy) ================== */
const EMERG = { "7500": "HIJACK", "7600": "RADIO FAIL", "7700": "EMERGENCY" };
const AIR = { map: new Map(), sel: null, info: new Map(), ok: false, msg: "", timer: null, trail: null };
async function loadAir() {
  clearTimeout(AIR.timer);
  if (!hasLoc()) return;
  if (!CFG.adsbProxy) { AIR.ok = false; AIR.msg = "ADS-B PROXY NOT SET"; link("adsb", false, "NOT SET"); BUS.emit("air"); return; }
  if (paused) { AIR.timer = setTimeout(loadAir, 5000); return; }
  const nm = Math.min(100, Math.ceil(CFG.range * 2.1 / 1.852) + 5);   // Rechteck bis in die Ecken
  try {
    const j = await getJSON(proxyUrl(`lat=${CFG.lat}&lon=${CFG.lon}&dist=${nm}`));
    if (!j || !Array.isArray(j.ac)) throw 0;
    const now = Date.now();
    for (const a of j.ac) {
      if (a.lat == null || a.lon == null) continue;
      const p = AIR.map.get(a.hex) || { hex: a.hex, trail: [] };
      p.lat = a.lat; p.lon = a.lon; p.t = now - (a.seen_pos || 0) * 1000;
      p.trk = a.track ?? a.true_heading ?? p.trk ?? 0; p.gs = a.gs || 0;
      p.ground = a.alt_baro === "ground"; p.alt = p.ground ? 0 : (+a.alt_baro || +a.alt_geom || 0);
      p.call = (a.flight || "").trim() || a.r || a.hex; p.reg = a.r || ""; p.type = a.t || ""; p.seen = now;
      p.rate = a.baro_rate ?? a.geom_rate ?? null; p.sq = a.squawk || ""; p.cat = a.category || "";
      p.emerg = EMERG[p.sq] || (a.emergency && a.emergency !== "none" ? String(a.emergency).toUpperCase() : "");
      p.d = gcKm(CFG.lat, CFG.lon, p.lat, p.lon);
      const last = p.trail[p.trail.length - 1];
      if (!last || last[0] !== p.lat || last[1] !== p.lon) { p.trail.push([p.lat, p.lon, p.alt]); if (p.trail.length > 40) p.trail.shift(); }
      AIR.map.set(a.hex, p);
    }
    for (const [k, p] of AIR.map) if (now - p.seen > 60000) { AIR.map.delete(k); if (AIR.sel === k) selectPlane(null); }
    AIR.ok = true; AIR.msg = ""; link("adsb", true, j.src || "");
    AIR.timer = setTimeout(loadAir, 10000);
  } catch (e) { AIR.ok = false; AIR.msg = "NO ADS-B DATA"; link("adsb", false, "UNREACHABLE"); AIR.timer = setTimeout(loadAir, 30000); }
  BUS.emit("air");
}
const phase = p => p.ground ? "gnd" : (p.rate != null && p.rate > 300 ? "climb" : (p.rate != null && p.rate < -300 ? "desc" : "cruise"));
function planes() { return [...AIR.map.values()].filter(p => p.d <= CFG.range * 2.1).sort((a, b) => a.d - b.d); }
async function selectPlane(hex) {
  AIR.sel = hex; AIR.trail = null; BUS.emit("sel");
  if (!hex || !CFG.adsbProxy) return;
  const p = AIR.map.get(hex); if (!p) return;
  try {
    if (!AIR.info.has(hex)) AIR.info.set(hex, await getJSON(proxyUrl(`info=1&hex=${hex}&cs=${encodeURIComponent(p.call)}&plat=${p.lat}&plon=${p.lon}`)));
    const t = await getJSON(proxyUrl("trail=" + hex));
    if (AIR.sel === hex) { AIR.trail = (t.trail || []).map(r => ({ t: r[0] * 1000, lat: r[1], lon: r[2], alt: r[3] })); }
  } catch (e) {}
  BUS.emit("sel");
}

/* ================== REGENRADAR (RainViewer) ================== */
const RAINV = { host: "", frames: [], timer: null };
async function loadRain() {
  clearTimeout(RAINV.timer);
  try {
    const j = await getJSON("https://api.rainviewer.com/public/weather-maps.json");
    RAINV.host = j.host; RAINV.frames = (j.radar && j.radar.past) || []; link("rain", RAINV.frames.length > 0);
    BUS.emit("rain"); RAINV.timer = setTimeout(loadRain, 10 * 60e3);
  } catch (e) { link("rain", false); RAINV.timer = setTimeout(loadRain, 3 * 60e3); }
}
const rainTile = (f, z, x, y, size = 256) => `${RAINV.host}${f.path}/${size}/${z}/${x}/${y}/2/1_1.png`;

/* ================== DWD-WARNUNGEN (nur Deutschland) ================== */
const WARN = { cell: null, cellFor: "", out: false, list: [], timer: null, dismissed: LS.get("lto-warn-dismissed", []) };
async function loadWarn() {
  clearTimeout(WARN.timer); if (!hasLoc()) return;
  try {
    const key = CFG.lat.toFixed(3) + "," + CFG.lon.toFixed(3);
    if (WARN.cellFor !== key) {
      const u = "https://maps.dwd.de/geoserver/dwd/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&typeName=dwd:Warngebiete_Gemeinden&propertyName=WARNCELLID,NAME&CQL_FILTER=" +
        encodeURIComponent(`INTERSECTS(SHAPE,POINT(${CFG.lat} ${CFG.lon}))`);
      const f = ((await getJSON(u)).features || [])[0]; WARN.cellFor = key;
      WARN.out = !f; WARN.cell = f ? +f.properties.WARNCELLID : null;
    }
    if (WARN.out) { WARN.list = []; link("dwd", false, "OUTSIDE GERMANY"); BUS.emit("warn"); WARN.timer = setTimeout(loadWarn, 60 * 60e3); return; }
    const u = "https://maps.dwd.de/geoserver/dwd/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=dwd:Warnungen_Gemeinden&outputFormat=application/json" +
      "&propertyName=IDENTIFIER,EVENT,SEVERITY,HEADLINE,DESCRIPTION,ONSET,EXPIRES,MSGTYPE,EC_GROUP&CQL_FILTER=" + encodeURIComponent(`WARNCELLID=${WARN.cell}`);
    const j = await getJSON(u); const seen = new Set();
    WARN.list = (j.features || []).map(f => f.properties).filter(p => p.MSGTYPE !== "Cancel" && !seen.has(p.IDENTIFIER) && seen.add(p.IDENTIFIER));
    link("dwd", true, WARN.list.length + " ACTIVE"); BUS.emit("warn"); WARN.timer = setTimeout(loadWarn, 5 * 60e3);
  } catch (e) { link("dwd", false, "UNREACHABLE"); WARN.timer = setTimeout(loadWarn, 3 * 60e3); }
}
const SEVR = { Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 };
/* Warnung, die das Overlay auslöst: ab "Moderate" oder jedes Gewitter */
function bigWarning() {
  const now = Date.now();
  return WARN.list.filter(w => (SEVR[w.SEVERITY] >= 2 || /GEWITTER|THUNDER/i.test(w.EVENT || "")) && new Date(w.ONSET) <= now + 30 * 60e3 && new Date(w.EXPIRES) > now)
    .sort((a, b) => (SEVR[b.SEVERITY] || 0) - (SEVR[a.SEVERITY] || 0))[0] || null;
}
/* englische Kurzform der häufigsten DWD-Ereignisse für die Punktmatrix */
const DWD_EN = [[/ORKAN/i, "HURRICANE WINDS"], [/SCHWERE[SN]? STURMB/i, "SEVERE GALES"], [/STURMB/i, "GALE GUSTS"], [/WINDB/i, "WIND GUSTS"], [/SCHWERES GEWITTER/i, "SEVERE THUNDERSTORM"],
  [/GEWITTER/i, "THUNDERSTORM"], [/STARKREGEN|DAUERREGEN/i, "HEAVY RAIN"], [/GLATT|GLÄTTE|GLATTEIS/i, "ICY ROADS"], [/SCHNEE/i, "SNOWFALL"], [/FROST/i, "FROST"],
  [/NEBEL/i, "DENSE FOG"], [/HITZE/i, "HEAT"], [/TAUWETTER/i, "THAW"], [/HAGEL/i, "HAIL"], [/STURMFLUT/i, "STORM SURGE"]];
const warnEN = ev => { for (const [re, t] of DWD_EN) if (re.test(ev || "")) return t; return String(ev || "WEATHER WARNING").toUpperCase(); };

/* ================== ORT ================== */
async function geocode(q) {
  const j = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en`);
  return (j.results || []).map(r => ({ name: r.name, lat: r.latitude, lon: r.longitude, admin: [r.admin1, r.country_code].filter(Boolean).join(" · ") }));
}
function startData() {
  if (!hasLoc()) return;
  loadWeather(); loadAQ(); loadGrid(); loadMetar(); loadAir(); loadRain(); loadWarn();
}
function onLocationChanged() {
  AIR.map.clear(); AIR.sel = null; WARN.cellFor = ""; MET.st = []; saveCfg(); startData(); BUS.emit("loc");
}
