/* Light Table Ops · © 2026 E11iot · CC BY-NC-ND 4.0
   mapview.js – Karte (MapLibre): Satellit/Vektor, UTMREF-Raster, Reichweiten-Schraffur, Flugzeuge, Regen, Warnungen */
"use strict";

/* ================== UTM / UTMREF (MGRS) ================== */
const UTM_A = 6378137, UTM_F = 1 / 298.257223563, UTM_K0 = 0.9996, UTM_E2 = UTM_F * (2 - UTM_F), UTM_EP2 = UTM_E2 / (1 - UTM_E2);
function utmZone(lat, lon) {
  let z = Math.floor((lon + 180) / 6) + 1;
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) z = 32;
  if (lat >= 72 && lat < 84) { if (lon >= 0 && lon < 9) z = 31; else if (lon >= 9 && lon < 21) z = 33; else if (lon >= 21 && lon < 33) z = 35; else if (lon >= 33 && lon < 42) z = 37; }
  return z;
}
function ll2utm(lat, lon, zone) {
  zone = zone || utmZone(lat, lon);
  const lon0 = ((zone - 1) * 6 - 180 + 3) * RAD, φ = lat * RAD, λ = lon * RAD;
  const N = UTM_A / Math.sqrt(1 - UTM_E2 * Math.sin(φ) ** 2), T = Math.tan(φ) ** 2, C = UTM_EP2 * Math.cos(φ) ** 2, A = Math.cos(φ) * (λ - lon0);
  const e2 = UTM_E2, e4 = e2 * e2, e6 = e4 * e2;
  const M = UTM_A * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * φ - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * φ) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * φ) - (35 * e6 / 3072) * Math.sin(6 * φ));
  const E = UTM_K0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * UTM_EP2) * A ** 5 / 120) + 500000;
  let Nn = UTM_K0 * (M + N * Math.tan(φ) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * UTM_EP2) * A ** 6 / 720));
  if (lat < 0) Nn += 10000000;
  return { zone, e: E, n: Nn };
}
function utm2ll(E, Nn, zone, south) {
  const e2 = UTM_E2, e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2)), x = E - 500000, y = south ? Nn - 10000000 : Nn;
  const M = y / UTM_K0, mu = M / (UTM_A * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
  const φ1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
  const N1 = UTM_A / Math.sqrt(1 - e2 * Math.sin(φ1) ** 2), T1 = Math.tan(φ1) ** 2, C1 = UTM_EP2 * Math.cos(φ1) ** 2;
  const R1 = UTM_A * (1 - e2) / Math.pow(1 - e2 * Math.sin(φ1) ** 2, 1.5), D = x / (N1 * UTM_K0);
  const lat = φ1 - (N1 * Math.tan(φ1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * UTM_EP2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * UTM_EP2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = ((zone - 1) * 6 - 180 + 3) * RAD + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * UTM_EP2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(φ1);
  return [lat / RAD, lon / RAD];
}
const BANDS = "CDEFGHJKLMNPQRSTUVWX";
function mgrsSq(zone, e, n) {
  const set = zone % 3, cols = ["STUVWXYZ", "ABCDEFGH", "JKLMNPQR"][set], rows = "ABCDEFGHJKLMNPQRSTUV";
  const c = cols[Math.floor(e / 100000) - 1] || "?", r = rows[(Math.floor(n / 100000) + (zone % 2 === 0 ? 5 : 0)) % 20];
  return c + r;
}
/* UTMREF-Text, prec = Stellen je Achse (1 = 10 km … 5 = 1 m) */
function utmRef(lat, lon, prec = 4) {
  const u = ll2utm(lat, lon), band = BANDS[clamp(Math.floor((lat + 80) / 8), 0, 19)], sq = mgrsSq(u.zone, u.e, u.n);
  const ee = String(Math.floor(u.e % 100000)).padStart(5, "0").slice(0, prec), nn = String(Math.floor(u.n % 100000)).padStart(5, "0").slice(0, prec);
  return { zone: u.zone, band, sq, e: u.e, n: u.n, short: `${u.zone}${band} ${sq}`, full: `${u.zone}${band} ${sq} ${ee} ${nn}` };
}

/* ================== KARTE ================== */
const MAP = { m: null, ready: false, rainOn: LS.get("lto-rain", true), airOn: true, gridOn: true, style: null, slot: null, homeSet: false, dirty: true };
const OFM = "https://tiles.openfreemap.org";
function vectorStyle() {
  return {
    version: 8, glyphs: OFM + "/fonts/{fontstack}/{range}.pbf",
    sources: { ofm: { type: "vector", url: OFM + "/planet", attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#141a1d" } },
      { id: "landcover", type: "fill", source: "ofm", "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["wood", "forest", "grass", "farmland"]]], paint: { "fill-color": ["match", ["get", "class"], ["wood", "forest"], "#18211f", "#171d1e"], "fill-opacity": .9 } },
      { id: "landuse", type: "fill", source: "ofm", "source-layer": "landuse", filter: ["in", ["get", "class"], ["literal", ["residential", "industrial", "commercial"]]], paint: { "fill-color": "#1f2628", "fill-opacity": .8 } },
      { id: "water", type: "fill", source: "ofm", "source-layer": "water", paint: { "fill-color": "#0f2a33" } },
      { id: "waterline", type: "line", source: "ofm", "source-layer": "water", paint: { "line-color": "#3d6f7d", "line-width": .6, "line-opacity": .7 } },
      { id: "waterway", type: "line", source: "ofm", "source-layer": "waterway", paint: { "line-color": "#24505c", "line-width": .7 } },
      { id: "aeroway", type: "line", source: "ofm", "source-layer": "aeroway", filter: ["==", ["get", "class"], "runway"], paint: { "line-color": "#8fd2e3", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 13, 6], "line-opacity": .7 } },
      { id: "roads", type: "line", source: "ofm", "source-layer": "transportation", filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
        paint: { "line-color": ["match", ["get", "class"], ["motorway", "trunk"], "#8a7d62", "#4e5455"], "line-width": ["interpolate", ["linear"], ["zoom"], 6, .4, 12, 1.6], "line-opacity": .75 } },
      { id: "rail", type: "line", source: "ofm", "source-layer": "transportation", filter: ["==", ["get", "class"], "rail"], minzoom: 8, paint: { "line-color": "#3c4547", "line-width": .7, "line-dasharray": [3, 2] } },
      { id: "border", type: "line", source: "ofm", "source-layer": "boundary", filter: ["<=", ["get", "admin_level"], 4], paint: { "line-color": ["case", ["<=", ["get", "admin_level"], 2], "#e8643c", "#56676e"], "line-width": ["case", ["<=", ["get", "admin_level"], 2], 1.2, .6], "line-dasharray": [4, 3], "line-opacity": .8 } },
      { id: "places", type: "symbol", source: "ofm", "source-layer": "place", filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
        layout: { "text-field": ["upcase", ["coalesce", ["get", "name:latin"], ["get", "name"]]], "text-font": ["Noto Sans Regular"], "text-size": ["match", ["get", "class"], "city", 12, 10], "text-letter-spacing": .2, "text-max-width": 12 },
        paint: { "text-color": "#9fb7bd", "text-halo-color": "#0d1214", "text-halo-width": 1.2 } }
    ]
  };
}
function satStyle() {
  return {
    version: 8,
    sources: { sat: { type: "raster", tileSize: 256, maxzoom: 18, tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], attribution: "Imagery © Esri, Maxar, Earthstar Geographics" } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#141a1d" } },
      { id: "sat", type: "raster", source: "sat", paint: { "raster-saturation": -.72, "raster-contrast": .18, "raster-brightness-max": .72, "raster-brightness-min": .04 } },
      { id: "tint", type: "background", paint: { "background-color": "#1b4b5c", "background-opacity": .2 } }
    ]
  };
}
function zoomFor(rangeKm, W) { return Math.log2(40075 * Math.cos(CFG.lat * RAD) * W / (512 * rangeKm * 2.35)); }
function initMap() {
  if (MAP.m || typeof maplibregl === "undefined" || !hasLoc()) return;
  const host = $("mapHost"); host.classList.add("on");
  try {
    MAP.style = CFG.mapStyle;
    MAP.m = new maplibregl.Map({ container: "map", style: CFG.mapStyle === "sat" ? satStyle() : vectorStyle(), center: [CFG.lon, CFG.lat],
      zoom: zoomFor(CFG.range, Math.max(600, host.clientWidth)), attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false,
      fadeDuration: 0, maxZoom: 15, minZoom: 3 });
    MAP.m.on("load", () => { MAP.ready = true; addRain(); MAP.dirty = true; });
    MAP.m.on("styledata", () => { if (MAP.ready) addRain(); });
    MAP.m.on("move", () => { MAP.dirty = true; });
    MAP.m.on("click", e => mapClick(e.point));
    MAP.m.on("error", () => {});
  } catch (e) { MAP.m = null; $("vMap").querySelector(".msg").textContent = "MAP NEEDS WEBGL"; }
}
function setMapStyle(s) {
  CFG.mapStyle = s; saveCfg();
  if (MAP.m && MAP.style !== s) { MAP.style = s; MAP.ready = false; MAP.m.setStyle(s === "sat" ? satStyle() : vectorStyle()); MAP.m.once("idle", () => { MAP.ready = true; addRain(); }); }
  buildMapUI();
}
function addRain() {
  const m = MAP.m; if (!m || !m.isStyleLoaded()) return;
  if (m.getLayer("rain")) m.removeLayer("rain"); if (m.getSource("rain")) m.removeSource("rain");
  const fr = RAINV.frames[RAINV.frames.length - 1]; if (!fr || !MAP.rainOn) return;
  m.addSource("rain", { type: "raster", tileSize: 256, maxzoom: 7, tiles: [`${RAINV.host}${fr.path}/256/{z}/{x}/{y}/2/1_1.png`], attribution: "Rain: RainViewer" });
  m.addLayer({ id: "rain", type: "raster", source: "rain", paint: { "raster-opacity": .62, "raster-fade-duration": 0 } });
}
BUS.on("rain", addRain);
function mapHome() { if (MAP.m && hasLoc()) MAP.m.jumpTo({ center: [CFG.lon, CFG.lat], zoom: zoomFor(CFG.range, $("mapHost").clientWidth || 1200) }); }
BUS.on("loc", () => { if (MAP.m) mapHome(); else initMap(); });

/* Kartenebene an den Platzhalter im (skalierten) Rahmen anlegen */
function placeMap() {
  const host = $("mapHost"), slot = $("vMap").querySelector(".slot");
  const vis = STATE.view === "map" && !document.body.classList.contains("nomain") && STATE.lay !== "strip" && hasLoc();
  if (!vis || !slot) { host.classList.remove("on"); return; }
  const r = slot.getBoundingClientRect(); if (r.width < 10) { host.classList.remove("on"); return; }
  host.classList.add("on"); host.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  if (!MAP.m) initMap(); else MAP.m.resize();
  if (MAP.m && !MAP.homeSet) { MAP.homeSet = true; mapHome(); }
  sizeOv(); MAP.dirty = true; drawFrame(); updFoot();
}
function sizeOv() {
  const c = $("mapOv"), h = $("mapHost"), r = window.devicePixelRatio || 1;
  c.width = Math.round(h.clientWidth * r); c.height = Math.round(h.clientHeight * r); c.style.width = h.clientWidth + "px"; c.style.height = h.clientHeight + "px"; c._r = r;
}

/* ---------- Überlagerung ---------- */
const altCol = ft => ft < 10000 ? pal().cy : (ft < 25000 ? pal().or : pal().tx);
function kmPerPx() { const m = MAP.m; return 40075 * Math.cos(m.getCenter().lat * RAD) / (512 * 2 ** m.getZoom()); }
function drawOverlay(t) {
  const m = MAP.m, c = $("mapOv"); if (!m || !$("mapHost").classList.contains("on")) return;
  const x = c.getContext("2d"), r = c._r || 1, W = c.width / r, H = c.height / r, P = pal();
  x.setTransform(r, 0, 0, r, 0, 0); x.clearRect(0, 0, W, H);
  const home = m.project([CFG.lon, CFG.lat]), kpp = kmPerPx(), Rpx = CFG.range / kpp;
  // 1) Schraffur: getreppter Rahmen am Kartenrand wie im Original; Form wechselt je Zoomstufe, außen lückenlos bis zum Rand
  if (CFG.hatch !== false) {
    const B = clamp(Math.round(H / 24), 14, 46), nx = Math.ceil(W / B), ny = Math.ceil(H / B), seed = Math.round(m.getZoom()) * 977 + 13;
    if (!HATCH || HATCH._r !== r) { HATCH = hatchPattern(x, 1); HATCH._r = r; }
    const nz = k => { const v = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453; return v - Math.floor(v); };
    const run = (edge, k) => Math.floor(k / (2 + Math.floor(3 * nz(edge * 13 + Math.floor(k / 6)))));   // Stufenlänge 2–4 Blöcke
    const off = (edge, k) => 1 + Math.floor(4.8 * nz(run(edge, k) * 7 + edge * 101));                   // Randbreite 1–5 Blöcke
    const isOut = (i, j) => i < off(0, j) || i >= nx - off(1, j) || j < off(2, i) || j >= ny - off(3, i);
    x.fillStyle = HATCH; x.beginPath();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (isOut(i, j)) x.rect(i * B, j * B, B, B);
    x.fill();
  }
  // 2) UTMREF-Raster
  if (MAP.gridOn) drawUtmGrid(x, W, H, kpp);
  // 3) Ort
  const pulse = CFG.anim ? (Math.sin(t / 400) + 1) / 2 : 1;
  x.strokeStyle = P.or; x.lineWidth = 1.5; x.beginPath(); x.arc(home.x, home.y, 6 + 3 * pulse, 0, Math.PI * 2); x.stroke();
  x.fillStyle = P.or; x.fillRect(home.x - 2, home.y - 2, 4, 4);
  // Wind am Ort
  if (WX.d) { const c2 = WX.d.current, a = (c2.wind_direction_10m + 180) * RAD, L = 26 + Math.min(40, c2.wind_speed_10m);
    x.strokeStyle = P.ye; x.lineWidth = 2; x.beginPath(); const sx = home.x - Math.sin(a) * L / 2, sy = home.y + Math.cos(a) * L / 2, ex = home.x + Math.sin(a) * L / 2 + Math.sin(a) * 18, ey = home.y - Math.cos(a) * L / 2 - Math.cos(a) * 18;
    x.moveTo(sx + Math.sin(a) * 14, sy - Math.cos(a) * 14); x.lineTo(ex, ey); x.stroke();
    x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex - Math.sin(a - .45) * 9, ey + Math.cos(a - .45) * 9); x.lineTo(ex - Math.sin(a + .45) * 9, ey + Math.cos(a + .45) * 9); x.closePath(); x.fillStyle = P.ye; x.fill(); }
  // 4) Flugzeuge
  if (MAP.airOn) drawPlanes(x, W, H, t);
  MAP.dirty = false;
}
function drawUtmGrid(x, W, H, kpp) {
  const m = MAP.m, P = pal(), c = m.getCenter(), zone = utmZone(c.lat, c.lng), south = c.lat < 0;
  const spanKm = W * kpp, steps = [1, 2, 5, 10, 20, 50, 100, 200], step = (steps.find(s => spanKm / s <= 14) || 200) * 1000;
  const b = m.getBounds(), corners = [[b.getNorth(), b.getWest()], [b.getNorth(), b.getEast()], [b.getSouth(), b.getWest()], [b.getSouth(), b.getEast()]].map(p => ll2utm(p[0], p[1], zone));
  const e0 = Math.floor(Math.min(...corners.map(u => u.e)) / step) * step, e1 = Math.ceil(Math.max(...corners.map(u => u.e)) / step) * step;
  const n0 = Math.floor(Math.min(...corners.map(u => u.n)) / step) * step, n1 = Math.ceil(Math.max(...corners.map(u => u.n)) / step) * step;
  if ((e1 - e0) / step > 60 || (n1 - n0) / step > 60) return;
  const pr = (e, n) => { const [la, lo] = utm2ll(e, n, zone, south); return m.project([lo, la]); };
  x.strokeStyle = "rgba(226,218,186,.26)"; x.lineWidth = 1; x.beginPath();
  const seg = Math.max(step / 4, (n1 - n0) / 16);
  for (let e = e0; e <= e1; e += step) { for (let n = n0; n <= n1; n += seg) { const p = pr(e, n); n === n0 ? x.moveTo(p.x, p.y) : x.lineTo(p.x, p.y); } }
  for (let n = n0; n <= n1; n += step) { for (let e = e0; e <= e1; e += Math.max(step / 4, (e1 - e0) / 16)) { const p = pr(e, n); e === e0 ? x.moveTo(p.x, p.y) : x.lineTo(p.x, p.y); } }
  x.stroke();
  // Kreuzungs-Marken (kleine Quadrate wie im Original)
  x.strokeStyle = "rgba(226,218,186,.55)";
  for (let e = e0; e <= e1; e += step) for (let n = n0; n <= n1; n += step) { const p = pr(e, n); if (p.x < -5 || p.y < -5 || p.x > W + 5 || p.y > H + 5) continue; x.strokeRect(p.x - 3, p.y - 3, 6, 6); }
  // Beschriftung: Ostwerte entlang der Mittelachse, Nordwerte am linken Rand
  const lab = v => step >= 100000 ? "" : String(Math.floor((v % 100000) / 1000)).padStart(2, "0");
  x.font = "11px Oxanium"; x.fillStyle = "rgba(232,226,200,.85)"; x.textAlign = "center"; x.textBaseline = "middle";
  const midN = ll2utm(c.lat, c.lng, zone).n;
  for (let e = e0; e <= e1; e += step) { const p = pr(e + step / 2, Math.round(midN / step) * step); if (p.x < 12 || p.x > W - 12) continue; x.fillStyle = "rgba(14,17,19,.6)"; x.fillRect(p.x - 10, p.y - 7, 20, 14); x.fillStyle = "rgba(232,226,200,.85)"; x.fillText(lab(e) || mgrsSq(zone, e + step / 2, midN), p.x, p.y); }
  x.textAlign = "left";
  for (let n = n0; n <= n1; n += step) { const p0 = pr(e0, n + step / 2); const xs = 14, p = { x: xs, y: p0.y + (pr(e0, n + step / 2).y - p0.y) }; if (p.y < 14 || p.y > H - 14) continue; x.fillText(lab(n) || mgrsSq(zone, e0, n + step / 2), 8, p.y); }
  x.textBaseline = "alphabetic";
  MAP.grid = { zone, step, band: BANDS[clamp(Math.floor((c.lat + 80) / 8), 0, 19)], sq: mgrsSq(zone, ll2utm(c.lat, c.lng, zone).e, midN) };
}
function planeShape(x, px, py, trk, size, col, fill) {
  const a = trk * RAD; x.save(); x.translate(px, py); x.rotate(a);
  x.beginPath(); x.moveTo(0, -size); x.lineTo(size * .7, size * .8); x.lineTo(0, size * .35); x.lineTo(-size * .7, size * .8); x.closePath();
  if (fill) { x.fillStyle = col; x.fill(); } else { x.strokeStyle = col; x.lineWidth = 1.6; x.stroke(); }
  x.restore();
}
function drawPlanes(x, W, H, t) {
  const m = MAP.m, P = pal(), now = Date.now(), ps = planes();
  // Flugspur des gewählten Flugzeugs
  const sel = AIR.sel && AIR.map.get(AIR.sel);
  if (sel) {
    const tr = (AIR.trail && AIR.trail.length > 1) ? AIR.trail.map(q => [q.lat, q.lon]) : sel.trail.map(q => [q[0], q[1]]);
    x.strokeStyle = P.or; x.lineWidth = 1.8; x.setLineDash([5, 4]); x.beginPath();
    tr.forEach((q, i) => { const p = m.project([q[1], q[0]]); i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y); }); x.stroke(); x.setLineDash([]);
  }
  x.font = "10.5px Oxanium"; x.textAlign = "left";
  for (const p of ps) {
    // Position fortschreiben (Koppelnavigation bis 20 s)
    const dt = Math.min(20, (now - p.t) / 1000), dkm = p.gs * 1.852 * dt / 3600;
    const lat = p.lat + dkm * Math.cos(p.trk * RAD) / 110.57, lon = p.lon + dkm * Math.sin(p.trk * RAD) / (111.32 * Math.cos(p.lat * RAD));
    const q = m.project([lon, lat]); if (q.x < -20 || q.y < -20 || q.x > W + 20 || q.y > H + 20) continue;
    p._sx = q.x; p._sy = q.y;
    const col = p.emerg ? P.or : (p.ground ? P.dim : altCol(p.alt)), isSel = p.hex === AIR.sel;
    // kurze Spur
    if (p.trail.length > 1) { x.strokeStyle = hexA(col, .35); x.lineWidth = 1; x.beginPath(); p.trail.forEach((r2, i) => { const s = m.project([r2[1], r2[0]]); i ? x.lineTo(s.x, s.y) : x.moveTo(s.x, s.y); }); x.lineTo(q.x, q.y); x.stroke(); }
    planeShape(x, q.x, q.y, p.trk, isSel ? 10 : 7, col, !p.ground);
    if (isSel) { x.strokeStyle = P.or; x.lineWidth = 1.2; x.strokeRect(q.x - 15, q.y - 15, 30, 30); }
    if (!p.ground || isSel) {
      x.fillStyle = isSel ? P.or : P.tx; x.fillText(p.call, q.x + 11, q.y - 2);
      x.fillStyle = P.dim; x.fillText(p.alt >= 6000 ? "FL" + pad(Math.round(p.alt / 100), 3) : Math.round(U.alt(p.alt) / 10) * 10 + U.altU(), q.x + 11, q.y + 10);
    }
  }
}
function mapClick(pt) {
  let best = null, bd = 22;
  for (const p of planes()) { if (p._sx == null) continue; const d = Math.hypot(p._sx - pt.x, p._sy - pt.y); if (d < bd) { bd = d; best = p; } }
  selectPlane(best ? best.hex : null);
}

/* ---------- Rahmen, Bedienfelder, Flugzeugkarte ---------- */
function buildMapUI() {
  const v = $("vMap");
  v.innerHTML = `<div class="slot"></div><svg class="frame" id="mapFrame"></svg>
    <div class="info" id="mapInfo"></div>
    <div class="zoom"><span data-z="in" title="ZOOM IN">+</span><span data-z="out" title="ZOOM OUT">−</span><span data-z="home" title="CENTER">⌂</span>
      <span data-z="sty" title="SATELLITE / VECTOR" style="font-size:9px">${CFG.mapStyle === "sat" ? "VEC" : "SAT"}</span>
      <span data-z="rain" title="RAIN RADAR" style="font-size:9px;${MAP.rainOn ? "color:var(--or)" : ""}">RN</span>
      <span data-z="air" title="AIRCRAFT" style="font-size:9px;${MAP.airOn ? "color:var(--or)" : ""}">AC</span>
      <span data-z="grid" title="UTMREF GRID" style="font-size:9px;${MAP.gridOn ? "color:var(--or)" : ""}">#</span></div>
    <div class="msg" id="mapMsg"></div>
    <div class="side"><span class="mk">HN</span><span class="mk">MT</span><span class="mk">UZ</span></div>
    <div class="plane" id="planeCard"></div>
    <div id="warnOv"></div>`;
  v.querySelectorAll("[data-z]").forEach(b => b.addEventListener("click", () => {
    const z = b.dataset.z, m = MAP.m;
    if (z === "in" && m) m.zoomIn(); if (z === "out" && m) m.zoomOut(); if (z === "home") mapHome();
    if (z === "sty") setMapStyle(CFG.mapStyle === "sat" ? "vector" : "sat");
    if (z === "rain") { MAP.rainOn = !MAP.rainOn; LS.set("lto-rain", MAP.rainOn); addRain(); buildMapUI(); placeMap(); }
    if (z === "air") { MAP.airOn = !MAP.airOn; buildMapUI(); placeMap(); }
    if (z === "grid") { MAP.gridOn = !MAP.gridOn; buildMapUI(); placeMap(); }
    MAP.dirty = true;
  }));
  updPlaneCard(); updWarnOv();
}
/* Registriermarken, Zeilenbuchstaben-Leiste und Höhenskala um die Karte (wie im Original) */
function drawFrame() {
  const v = $("vMap"), svg = $("mapFrame"); if (!svg) return;
  const W = v.clientWidth, H = v.clientHeight; svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.style.width = W + "px"; svg.style.height = H + "px";
  const L = 34, R = W - 34, T = 14, B = H - 10;
  let s = `<path d="M${L},${T} H${R} V${B} H${L} Z" fill="none" stroke="var(--ln2)" stroke-width="1"/>`;
  // Registrierkreuze
  const reg = (x, y) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="none" stroke="var(--ln2)"/><path d="M${x - 9},${y} h18 M${x},${y - 9} v18" stroke="var(--ln2)" stroke-width=".8"/>`;
  for (let i = 0; i <= 8; i++) { const xx = L + (R - L) * i / 8; s += reg(xx, T - 2) + reg(xx, B + 2); }
  for (let i = 0; i <= 4; i++) { const yy = T + (B - T) * i / 4; s += reg(L - 14, yy) + reg(R + 14, yy); }
  // Höhenskala links
  for (let i = 0; i <= 40; i++) { const yy = T + 40 + (B - T - 80) * i / 40, l = i % 5 ? 4 : 9; s += `<path d="M${L - 26},${yy} h${l}" stroke="var(--ln2)" stroke-width=".8"/>`; if (i % 10 === 0) s += `<text x="${L - 30}" y="${yy + 3}" font-size="7" fill="var(--dim)" text-anchor="end">-${pad(i / 2, 2)}</text>`; }
  svg.innerHTML = s;
}
function updMapInfo() {
  const el = $("mapInfo"); if (!el || !hasLoc()) return;
  const r = utmRef(CFG.lat, CFG.lon, 4), g = MAP.grid;
  el.innerHTML = `<div style="font-size:13px;letter-spacing:2px;color:var(--tx)">${r.full}</div><div>${nf(CFG.lat, 5)}N · ${nf(CFG.lon, 5)}E · GRID ${g ? (g.step >= 1000 ? g.step / 1000 + " KM" : g.step + " M") : "--"}</div>`;
  const msg = $("mapMsg"); const t = !CFG.adsbProxy ? "ADS-B PROXY NOT SET · ⚙ SETUP" : (!AIR.ok && AIR.msg ? AIR.msg : "");
  msg.textContent = t; msg.style.display = t ? "block" : "none";
}
function updPlaneCard() {
  const el = $("planeCard"); if (!el) return; const p = AIR.sel && AIR.map.get(AIR.sel);
  if (!p) { el.classList.remove("on"); return; }
  const inf = AIR.info.get(p.hex) || {}, ac = inf.aircraft || {}, rt = inf.route || {};
  const route = rt.airports && rt.airports.length ? rt.airports.map(a => a.icao || a.iata).join(" → ") : (rt.codes || "--");
  el.classList.add("on");
  el.innerHTML = `<span class="btn x" id="pcX">✕ CLOSE</span><div class="cs">${esc(p.call)}</div><div class="micro">${esc([ac.manufacturer, ac.type || p.type].filter(Boolean).join(" ") || p.type || "")}</div>
    <div class="kv"><span>ROUTE</span><b>${esc(route)}</b><span>REG</span><b>${esc(ac.reg || p.reg || "--")}</b><span>OPERATOR</span><b>${esc(ac.owner || ac.operator || "--")}</b>
    <span>ALT</span><b>${p.ground ? "GND" : nf(U.alt(p.alt), 0) + " " + U.altU()}</b><span>GS</span><b>${nf(U.spd(p.gs), 0)} ${U.spdU()} · ${pad(Math.round(p.trk), 3)}°</b>
    <span>V/S</span><b>${p.rate == null ? "--" : (p.rate > 0 ? "+" : "") + Math.round(p.rate) + " FPM"}</b><span>SQUAWK</span><b class="${p.emerg ? "orange" : ""}">${p.sq || "--"} ${p.emerg || ""}</b>
    <span>DIST</span><b>${nf(U.dist(p.d), 1)} ${U.distU()} · ${pad(Math.round(bearing(CFG.lat, CFG.lon, p.lat, p.lon)), 3)}°</b></div>`;
  $("pcX").onclick = e => { e.stopPropagation(); selectPlane(null); };
}
BUS.on("sel", () => { updPlaneCard(); updFoot(); MAP.dirty = true; renderFlt(); });
BUS.on("air", () => { MAP.dirty = true; updMapInfo(); updFoot(); if (AIR.sel) updPlaneCard(); });

/* ---------- große Warnung in Punktmatrix ---------- */
function updWarnOv() {
  const el = $("warnOv"); if (!el) return; const w = bigWarning();
  if (!w || WARN.dismissed.includes(w.IDENTIFIER)) { el.classList.remove("on"); return; }
  el.classList.add("on");
  const fmt = s => { const d = new Date(s); return `${WD[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  el.innerHTML = `<div class="h"><span class="tag or">WEATHER WARNING</span><span>DWD · ${esc(String(w.SEVERITY || "").toUpperCase())}</span><span class="btn x" id="woX">✕ CLOSE</span></div>
    <canvas class="own" id="woC"></canvas><div class="d">${esc(w.HEADLINE || "")} — ${esc(w.DESCRIPTION || "")}</div>
    <div class="r"><div>ONSET<b>${fmt(w.ONSET)}</b></div><div>EXPIRES<b>${fmt(w.EXPIRES)}</b></div><div>AREA<b>${esc(String(CFG.name || "").toUpperCase())}</b></div></div>`;
  $("woX").onclick = () => { WARN.dismissed.push(w.IDENTIFIER); WARN.dismissed = WARN.dismissed.slice(-50); LS.set("lto-warn-dismissed", WARN.dismissed); updWarnOv(); };
  requestAnimationFrame(() => drawWarnText(warnEN(w.EVENT)));
}
function drawWarnText(txt) {
  const c = $("woC"); if (!c) return; const f = fitCanvas(c); if (!f) return; const { x, W, H } = f, P = pal();
  const n = txt.length + 1, cell = Math.min(H / 7.4, W / (n * 6)); const ox = (W - txt.length * cell * 6) / 2;
  x.fillStyle = "rgba(143,210,227,.06)"; x.fillRect(0, 0, W, H);
  drawDotText(x, txt, ox, (H - cell * 7) / 2, cell, P.tx, "rgba(143,210,227,.10)");
  x.fillStyle = P.tx; x.fillRect(ox + txt.length * cell * 6, (H - cell * 7) / 2, cell * 5, cell * 7);   // Block-Cursor
}
BUS.on("warn", updWarnOv);

/* ---------- Fußzeile der Hauptfläche ---------- */
function buildFoot() {
  $("mfoot").innerHTML = `<div class="leg"><div><i style="background:var(--or)"></i>MID HEIGHT</div><div><i style="background:var(--tx)"></i>MAX HEIGHT</div><div><i style="background:var(--cy)"></i>LOW HEIGHT</div></div>
    <div class="elev"><div class="h"><span id="elT">#---- ·· SURFACE ELEVATION DATA ··</span><b id="elV"></b></div><div class="cv"><canvas id="cElev"></canvas></div></div>
    <div class="sw4">${[["map", "MAP"], ["sys", "SYSTEM"], ["wx", "WEATHER"], ["flt", "FLIGHTS"]].map(([k, n]) => `<i data-v="${k}" data-n="${n}"></i>`).join("")}</div>
    <div class="gs"><div class="tri">${ICON.tri}</div><div class="k" id="gsK"></div><div class="bars" id="gsB"></div></div>`;
  $("mfoot").querySelectorAll("[data-v]").forEach(i => i.addEventListener("click", () => setView(i.dataset.v)));
}
function updFoot() {
  const k = $("gsK"); if (!k) return;
  const p = AIR.sel && AIR.map.get(AIR.sel), ps = planes();
  k.innerHTML = `· GS <b>${p ? nf(U.spd(p.gs), 0) : "---"}</b><br>· LON <b>${p ? nf(p.lon, 3) : nf(CFG.lon, 3)}</b><br>· TFC <b>${pad(ps.length, 3)}</b>`;
  const bar = (v, max, col) => `<i style="width:${clamp(v / max, 0.02, 1) * 100}%;background:${col}"></i>`;
  const hi = ps.filter(q => q.alt >= 25000).length, mid = ps.filter(q => q.alt >= 10000 && q.alt < 25000).length, lo = ps.filter(q => q.alt < 10000 && !q.ground).length, n = Math.max(1, ps.length);
  $("gsB").innerHTML = `<div>${bar(p ? p.gs : 0, 600, "var(--ye)")}${bar(1, 6, "var(--ln2)")}</div><div>${bar(lo, n, "var(--cy)")}${bar(mid, n, "var(--or)")}${bar(hi, n, "var(--tx)")}</div><div>${bar(ps.length, 60, "var(--cy2)")}${bar(.4, 6, "var(--or)")}</div>`;
  document.querySelectorAll("#mfoot [data-v]").forEach(i => i.classList.toggle("on", i.dataset.v === STATE.view));
  drawElev();
}
function drawElev() {
  const c = $("cElev"); if (!c) return; const f = fitCanvas(c); if (!f) return; const { x, W, H } = f, P = pal();
  const p = AIR.sel && AIR.map.get(AIR.sel);
  const prof = p ? ((AIR.trail && AIR.trail.length > 1) ? AIR.trail.map(q => q.alt) : p.trail.map(q => q[2])) : [];
  $("elT").textContent = p ? `#${p.hex.toUpperCase()} ·· ALTITUDE PROFILE ··` : "#---- ·· SURFACE ELEVATION DATA ··";
  $("elV").textContent = p ? (p.alt >= 6000 ? "FL" + pad(Math.round(p.alt / 100), 3) : nf(U.alt(p.alt), 0) + " " + U.altU()) : "";
  const n = 60, max = Math.max(1000, ...prof) * 1.05;
  for (let i = 0; i < n; i++) {
    const v = prof.length ? prof[Math.floor(i / (n - 1) * (prof.length - 1))] : 0, h = prof.length ? Math.max(1, v / max * (H - 2)) : 2;
    const bw = W / n;
    x.fillStyle = P.ln; x.fillRect(i * bw + .5, 0, bw - 1.5, H);
    x.fillStyle = prof.length ? altCol(v) : P.ln2; x.fillRect(i * bw + .5, H - h, bw - 1.5, h);
  }
}
