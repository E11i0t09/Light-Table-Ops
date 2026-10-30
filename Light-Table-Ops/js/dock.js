/* Light Table Ops · © 2026 E11iot · CC BY-NC-ND 4.0
   dock.js – Detail-Fach: öffnet sich beim Klick auf ein Paneel, schiebt das Layout */
"use strict";
const DOCKS = {
  time: "TIME · SUN · MOON", loc: "STATION", wx: "WEATHER", flt: "TRAFFIC", net: "NETWORK", uv: "UV · POLLEN · AIR",
  links: "DATALINKS", mmap: "SYNOPTIC FEED", sys: "SYSTEM LOAD", press: "PRESSURE", audio: "AUDIO"
};
function openDock(k) {
  if (STATE.dock === k) { closeDock(); return; }
  STATE.dock = k; STATE.dockMax = false; layout(); renderDock();
  document.querySelectorAll(".pn").forEach(p => p.classList.toggle("act", (PANELS.find(q => q.id === p.dataset.p) || {}).det === k));
}
function closeDock() {
  STATE.dock = null; STATE.dockMax = false; STATE.mode = CFG.layout; layout();
  document.querySelectorAll(".pn.act").forEach(p => p.classList.remove("act"));
}
function renderDock() {
  const d = $("dock"), k = STATE.dock; if (!k) { d.innerHTML = ""; return; }
  if (!d.querySelector(".dh") || d.dataset.k !== k) {
    d.dataset.k = k;
    d.innerHTML = `<div class="dh"><span class="tag or">DETAIL</span><span class="lbl">${DOCKS[k] || k.toUpperCase()}</span><span class="sp"></span>
      <span class="btn" id="dkMax">${STATE.dockMax ? "◧ HALF" : "◻ FULL"}</span><span class="btn or" id="dkX">✕ CLOSE</span></div><div class="dc" id="dkC"></div>`;
    $("dkX").onclick = closeDock;
    $("dkMax").onclick = () => { STATE.dockMax = !STATE.dockMax; $("dkMax").textContent = STATE.dockMax ? "◧ HALF" : "◻ FULL"; layout(); setTimeout(renderDock, 30); };
  }
  const c = $("dkC"); if (!c) return;
  ({ time: dTime, loc: dLoc, wx: dWx, flt: dFlt, net: dNet, uv: dUv, links: dLinks, mmap: dMmap, sys: dSys, press: dPress, audio: dAudio }[k] || (() => {}))(c);
}
BUS.on("layout", () => { if (STATE.dock) requestAnimationFrame(renderDock); });

/* ---------- Zeit / Sonne / Mond ---------- */
function moonPhase(d) { const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14); return (((d - ref) / 864e5) % syn + syn) % syn / syn; }
function dTime(c) {
  const d = new Date(), sd = sensFresh() && SENS.data.info;
  let sun = "";
  if (WX.d && WX.d.daily) { const i = WX.d.daily.time.indexOf(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    if (i >= 0) { const sr = new Date(WX.d.daily.sunrise[i]), ss = new Date(WX.d.daily.sunset[i]), len = (ss - sr) / 60000, hm = t => pad(t.getHours()) + ":" + pad(t.getMinutes());
      sun = `<span>SUNRISE</span><b>${hm(sr)}</b><span>SUNSET</span><b>${hm(ss)}</b><span>DAYLIGHT</span><b>${Math.floor(len / 60)}H ${pad(Math.round(len % 60))}M</b>
        <span>GOLDEN HOUR</span><b>${hm(new Date(+ss - 60 * 60e3))} – ${hm(ss)}</b><span>BLUE HOUR</span><b>${hm(ss)} – ${hm(new Date(+ss + 35 * 60e3))}</b>`; } }
  const mp = moonPhase(d), mpn = ["NEW MOON", "WAXING CRESCENT", "FIRST QUARTER", "WAXING GIBBOUS", "FULL MOON", "WANING GIBBOUS", "LAST QUARTER", "WANING CRESCENT"][Math.round(mp * 8) % 8];
  const doy = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / 864e5) + 1;
  const alt = hasLoc() ? sunAlt(Date.now(), CFG.lat, CFG.lon) : null;
  c.innerHTML = `<div class="dgrid" style="grid-template-columns:1fr 1fr">
    <div class="card" style="grid-column:1/-1"><div class="ct"><span>LOCAL TIME</span><span>UTC ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}</span></div>
      <div class="big" style="font-size:86px;line-height:92px">${pad(d.getHours())}:${pad(d.getMinutes())}<span class="dim" style="font-size:44px">:${pad(d.getSeconds())}</span></div>
      <div class="lbl">${WD[d.getDay()]} · ${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()} · WEEK ${isoWeek(d)} · DAY ${doy}</div></div>
    <div class="card"><div class="ct"><span>SUN</span><span>${alt != null ? "ALT " + nf(alt, 1) + "°" : ""}</span></div><div class="kv2">${sun || "<span>NO DATA</span>"}</div></div>
    <div class="card"><div class="ct"><span>MOON</span><span>${Math.round(mp * 100)}% CYCLE</span></div>
      <div class="row"><svg viewBox="-30 -30 60 60" style="width:70px;height:70px"><circle r="24" fill="var(--ln)"/><path d="${moonPath(mp, 24)}" fill="var(--ye)"/></svg><div class="lbl">${mpn}</div></div></div>
    <div class="card" style="grid-column:1/-1"><div class="ct"><span>SYSTEM</span><span>${sd ? "BRIDGE-OPS-SENSOR" : "WALLPAPER"}</span></div><div class="kv2">
      ${sd && sd.boot ? `<span>BOOT</span><b>${new Date(sd.boot).toLocaleString("en-GB")}</b><span>UPTIME</span><b>${$("sUp").textContent}</b>` : `<span>WALLPAPER RUNNING</span><b>${$("sUp").textContent.replace("WP ", "")}</b><span>UPTIME</span><b>NEEDS SENSOR 2.0</b>`}</div></div></div>`;
}
function moonPath(p, r) {   // beleuchteter Teil
  const k = Math.cos(p * 2 * Math.PI) * r, right = p < .5;
  return `M0,${-r} A${r},${r} 0 0 ${right ? 1 : 0} 0,${r} A${Math.abs(k)},${r} 0 0 ${(p < .25 || (p > .5 && p < .75)) ? (right ? 0 : 1) : (right ? 1 : 0)} 0,${-r} Z`;
}
setInterval(() => { if (STATE.dock === "time" && !paused) renderDock(); }, 1000);

/* ---------- Station ---------- */
function dLoc(c) {
  if (!hasLoc()) { c.innerHTML = `<div class="empty">NO LOCATION<small>Open setup to choose your location.</small><span class="btn" onclick="openSetup()">⚙ SETUP</span></div>`; return; }
  const r = utmRef(CFG.lat, CFG.lon, 5), near = nearAirports(150, 6);
  c.innerHTML = `<div class="dgrid" style="grid-template-columns:1fr 1fr">
    <div class="card" style="grid-column:1/-1"><div class="ct"><span>STATION</span><span>WGS84</span></div><div class="big" style="font-size:44px">${esc(String(CFG.name).toUpperCase())}</div>
      <div class="kv2" style="margin-top:8px"><span>UTMREF</span><b>${r.full}</b><span>LAT / LON</span><b>${nf(CFG.lat, 5)}° N · ${nf(CFG.lon, 5)}° E</b>
      <span>DWD CELL</span><b>${WARN.out ? "OUTSIDE GERMANY" : (WARN.cell || "--")}</b><span>RANGE</span><b>${nf(U.dist(CFG.range), 0)} ${U.distU()}</b></div></div>
    <div class="card" style="grid-column:1/-1"><div class="ct"><span>NEAREST AIRFIELDS</span><span>${U.distU()}</span></div><div class="lst">${near.map(a => `<div class="r" style="grid-template-columns:60px 1fr 60px"><b>${a.ic}</b><span>${esc(a.name)}</span><span style="text-align:right">${nf(U.dist(a.d), 0)}</span></div>`).join("")}</div></div>
    <div><span class="btn" id="dlS">⚙ CHANGE LOCATION / SETUP</span></div></div>`;
  $("dlS").onclick = openSetup;
}
/* ---------- Wetter ---------- */
function dWx(c) {
  if (!WX.d) { c.innerHTML = `<div class="empty">NO WEATHER DATA</div>`; return; }
  const w = WX.d.current;
  c.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;height:100%">
    <div class="dgrid" style="grid-template-columns:auto 1fr 1fr">
      <div style="width:110px;height:120px">${wxIcon(w.weather_code, !!w.is_day)}</div>
      <div><div class="big" style="font-size:72px;line-height:76px">${nf(w.temperature_2m, 1)}°</div><div class="lbl">${WMO[w.weather_code] || ""}</div><div class="lbl d">FEELS ${nf(w.apparent_temperature, 0)}° · DEW ${nf(w.dew_point_2m, 0)}°</div></div>
      <div class="kv2"><span>WIND</span><b>${pad(Math.round(w.wind_direction_10m), 3)}° ${dir16(w.wind_direction_10m)} · ${nf(U.wind(w.wind_speed_10m), 0)} ${U.windU()}</b><span>GUSTS</span><b>${nf(U.wind(w.wind_gusts_10m), 0)} ${U.windU()}</b>
        <span>PRESSURE</span><b>${nf(w.pressure_msl, 0)} HPA ${pressTrend() != null ? "(" + (pressTrend() > 0 ? "+" : "") + nf(pressTrend(), 1) + "/3H)" : ""}</b><span>HUMIDITY</span><b>${Math.round(w.relative_humidity_2m)} %</b>
        <span>CLOUD</span><b>${Math.round(w.cloud_cover)} %</b><span>VISIBILITY</span><b>${U.vis(w.visibility || 0)}</b><span>PRECIP</span><b>${nf(w.precipitation, 1)} MM</b></div></div>
    <div class="fch" style="display:flex;justify-content:space-between"><span class="lbl d">FORECAST</span><div class="tabs" style="display:flex;gap:6px"><span class="tag ${WV.fc === "48h" ? "or" : ""}" data-fc="48h" style="cursor:pointer">48 H</span><span class="tag ${WV.fc === "7d" ? "or" : ""}" data-fc="7d" style="cursor:pointer">7 DAYS</span></div></div>
    <div style="height:200px;position:relative;flex:none"><canvas id="dFc"></canvas></div>
    <div class="card"><div class="ct"><span>DWD WARNINGS</span><span>${WARN.out ? "GERMANY ONLY" : WARN.list.length + " ACTIVE"}</span></div><div class="lst">${WARN.list.length ? WARN.list.slice(0, 5).map(x => `<div class="r" style="grid-template-columns:140px 1fr"><b class="orange">${esc(warnEN(x.EVENT))}</b><span>${esc(x.HEADLINE || "")}</span></div>`).join("") : "<span class='dim'>NONE</span>"}</div></div>
    <div><span class="btn" id="dwV">OPEN METAR VIEW</span></div></div>`;
  c.querySelectorAll("[data-fc]").forEach(t => t.onclick = () => { WV.fc = t.dataset.fc; LS.set("lto-fc", WV.fc); renderDock(); });
  $("dwV").onclick = () => { closeDock(); setView("wx"); };
  requestAnimationFrame(() => drawFc($("dFc")));
}
function dFlt(c) { renderFlt(c); }
/* ---------- Netz ---------- */
function dNet(c) {
  const nics = sensFresh() ? (SENS.data.nics || []) : [];
  c.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;height:100%">
    <div class="dgrid" style="grid-template-columns:1fr 1fr 1fr">
      <div class="card"><div class="ct"><span>▼ DOWNLOAD</span></div><div class="big" style="font-size:30px" id="dnD">${fmtRate(SYS.down)}</div></div>
      <div class="card"><div class="ct"><span>▲ UPLOAD</span></div><div class="big" style="font-size:30px" id="dnU">${fmtRate(SYS.up)}</div></div>
      <div class="card"><div class="ct"><span>SESSION</span></div><div class="lbl">▼ ${fmtVol(SYS.sess.down)}<br>▲ ${fmtVol(SYS.sess.up)}</div></div></div>
    <div class="card" style="flex:1;min-height:160px;display:flex;flex-direction:column"><div class="ct"><span>THROUGHPUT · 10 MIN</span><span><span class="orange">━</span> DL <span class="cyan">━</span> UL</span></div><div style="flex:1;position:relative"><canvas id="dnC"></canvas></div></div>
    <div class="card"><div class="ct"><span>ADAPTERS</span><span>${nics.length ? "SENSOR" : "LIVELY"}</span></div><div class="lst">${(nics.length ? nics : [{ name: SYS.netName || "--", down: SYS.down, up: SYS.up, auto: true }]).map(n => `<div class="r" style="grid-template-columns:1fr 110px 110px"><span>${n.auto ? "<b class='orange'>● </b>" : ""}${esc(String(n.name).toUpperCase())}</span><span>▼ ${fmtRate(n.down)}</span><span>▲ ${fmtRate(n.up)}</span></div>`).join("")}</div></div></div>`;
  drawNetBig();
}
function drawNetBig() {
  const cv = $("dnC"), f = cv && fitCanvas(cv); if (!f) return; const { x, W, H } = f, P = pal(), mx = Math.max(1024, ...SYS.hist.down, ...SYS.hist.up) * 1.1;
  x.strokeStyle = P.ln; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, H * i / 4); x.lineTo(W, H * i / 4); x.stroke(); }
  spark(x, SYS.hist.down, 0, 2, W, H - 4, P.or, { max: mx, n: HN, fill: .2 }); spark(x, SYS.hist.down, 0, 2, W, H - 4, P.or, { max: mx, n: HN, lw: 2 });
  spark(x, SYS.hist.up, 0, 2, W, H - 4, P.cy, { max: mx, n: HN, lw: 2 });
  x.fillStyle = P.dim; x.font = "10px Oxanium"; x.fillText(fmtRate(mx / 1.1), 4, 12);
  if ($("dnD")) { $("dnD").textContent = fmtRate(SYS.down); $("dnU").textContent = fmtRate(SYS.up); }
}
/* ---------- UV / Pollen ---------- */
function dUv(c) {
  if (!AQ.d) { c.innerHTML = `<div class="empty">NO AIR QUALITY DATA</div>`; return; }
  const cur = AQ.d.current;
  c.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;height:100%">
    <div class="dgrid" style="grid-template-columns:1fr 1fr"><div class="card"><div class="ct"><span>UV INDEX</span></div><div class="big" style="font-size:54px">${nf(cur.uv_index, 1)}</div></div>
      <div class="card"><div class="ct"><span>EUROPEAN AQI</span></div><div class="big" style="font-size:54px">${nf(cur.european_aqi, 0)}</div></div></div>
    <div class="card"><div class="ct"><span>POLLEN · GRAINS/M³</span><span>NOW</span></div><div class="lst">${POLLEN.map(([k, n]) => { const v = cur[k], l = pollenLvl(v);
      return `<div class="r" style="grid-template-columns:110px 1fr 70px"><span>${n}</span><span style="height:6px;background:var(--ln);position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:${clamp((v || 0) / 150, 0, 1) * 100}%;background:${["var(--ln2)", "var(--cy)", "var(--ye)", "var(--or)"][l]}"></i></span><span style="text-align:right">${v == null ? "--" : nf(v, 0)}</span></div>`; }).join("")}</div></div>
    <div class="card" style="flex:1;min-height:140px;display:flex;flex-direction:column"><div class="ct"><span>UV · 48 H</span></div><div style="flex:1;position:relative"><canvas id="duC"></canvas></div></div>
    <div class="micro">CAMS (COPERNICUS ATMOSPHERE MONITORING SERVICE) VIA OPEN-METEO · CONTAINS MODIFIED COPERNICUS INFORMATION</div></div>`;
  requestAnimationFrame(() => { const cv = $("duC"), f = cv && fitCanvas(cv); if (!f) return; const { x, W, H } = f, P = pal(), h = AQ.d.hourly, i0 = Math.max(0, h.time.findIndex(s => new Date(s) > Date.now()) - 1), u = h.uv_index.slice(i0, i0 + 48), bw = W / 48;
    u.forEach((v, i) => { const hh = (v || 0) / 10 * (H - 14); x.fillStyle = v >= 6 ? P.or : v >= 3 ? P.ye : P.cy; x.fillRect(i * bw + 1, H - 12 - hh, bw - 2, hh); if (i % 6 === 0) { x.fillStyle = P.dim; x.font = "9px Oxanium"; x.fillText(new Date(h.time[i0 + i]).getHours() + "H", i * bw, H - 1); } }); });
}
/* ---------- Datenquellen ---------- */
function dLinks(c) {
  const ago = t => { if (!t) return "--"; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? s + " S" : Math.round(s / 60) + " MIN"; };
  c.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="card"><div class="ct"><span>DATALINKS</span><span>${linkCount()} / ${Object.keys(LINKS).length} ONLINE</span></div><div class="lst">${Object.entries(LINKS).map(([k, l]) => `<div class="r" style="grid-template-columns:22px 1fr 1fr 70px"><span class="dotc" style="background:${l.ok ? "#5fcf7a" : (l.t ? "var(--or)" : "var(--ln2)")}"></span><span>${l.n}</span><span class="dim">${esc(l.msg || (l.t ? "" : "WAITING"))}</span><span style="text-align:right">${ago(l.t)}</span></div>`).join("")}</div></div>
    <div class="card"><div class="ct"><span>SENSOR</span><span>PORT ${CFG.sensorPort}</span></div><div class="kv2"><span>STATUS</span><b>${sensFresh() ? "CONNECTED · V" + SENS.data.ver : (SENS.denied ? "ACCESS DENIED (UPDATE LIVELY)" : "NOT RUNNING")}</b>
      <span>THREADS</span><b>${sensV2() ? SENS.data.cores.length + " · LIVE" : "NEEDS SENSOR 2.0"}</b></div></div>
    <div class="card legal"><div class="ct"><span>SOURCES</span></div><div class="micro" style="font-size:9px;line-height:14px">WEATHER: OPEN-METEO.COM (CC BY 4.0) · AIR/UV/POLLEN: CAMS VIA OPEN-METEO · METAR/TAF: MET NORWAY (NLOD / CC BY 4.0), FALLBACK AVIATIONWEATHER.GOV · RAIN RADAR: RAINVIEWER ·
      WARNINGS: DEUTSCHER WETTERDIENST · MAP: OPENFREEMAP © OPENMAPTILES © OPENSTREETMAP CONTRIBUTORS · IMAGERY © ESRI · COASTLINES: NATURAL EARTH · AIRFIELDS: OURAIRPORTS · ADS-B: AIRPLANES.LIVE / ADSB.LOL VIA YOUR OWN PROXY · MAP RENDERER: MAPLIBRE GL JS (BSD-3)</div></div>
    <div><span class="btn" id="dlS2">⚙ SETUP</span></div></div>`;
  $("dlS2").onclick = openSetup;
}
/* ---------- Synoptik groß ---------- */
function dMmap(c) {
  c.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;height:100%"><div class="row">${[["rain", "RAIN RADAR"], ["isob", "ISOBARS"], ["temp", "TEMPERATURE"]].map(([k, n]) => `<span class="tag ${MINI.mode === k ? "or" : ""}" data-mb="${k}" style="cursor:pointer">${n}</span>`).join("")}</div>
    <div style="flex:1;position:relative;border:1px solid var(--ln)"><canvas id="dmC"></canvas></div><div class="micro">${MINI.mode === "rain" ? "RAINVIEWER · LATEST FRAME" : "OPEN-METEO MODEL GRID 7×7 · BILINEAR · " + (MINI.mode === "isob" ? "ISOBARS 4 HPA" : "ISOTHERMS 2 °C")}</div></div>`;
  c.querySelectorAll("[data-mb]").forEach(t => t.onclick = () => { MINI.mode = t.dataset.mb; LS.set("lto-mini", MINI.mode); drawMini(); renderDock(); });
  requestAnimationFrame(() => drawMini($("dmC")));
}
/* ---------- Systemlast ---------- */
function dSys(c) {
  c.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;height:100%">${[["cpu", "CPU", "var(--or)"], ["gpu", "GPU", "var(--ye)"], ["ram", "RAM", "var(--cy)"]].map(([k, n]) => `
    <div class="card" style="flex:1;min-height:90px;display:flex;flex-direction:column"><div class="ct"><span>${n} · 10 MIN</span><span id="ds_${k}">--</span></div><div style="flex:1;position:relative"><canvas id="dsC_${k}"></canvas></div></div>`).join("")}
    <div><span class="btn" id="dsV">OPEN SYSTEM VIEW</span></div></div>`;
  $("dsV").onclick = () => { closeDock(); setView("sys"); };
  drawSysBig();
}
function drawSysBig() {
  [["cpu", "or"], ["gpu", "ye"], ["ram", "cy"]].forEach(([k, col]) => { const cv = $("dsC_" + k), f = cv && fitCanvas(cv); if (!f) return; const P = pal();
    spark(f.x, SYS.hist[k], 0, 2, f.W, f.H - 4, P[col], { max: 100, n: HN, fill: .18 }); spark(f.x, SYS.hist[k], 0, 2, f.W, f.H - 4, P[col], { max: 100, n: HN, lw: 1.6 });
    $("ds_" + k).textContent = Math.round(SYS[k]) + " %"; });
}
BUS.on("sys", () => { if (STATE.dock === "sys") drawSysBig(); if (STATE.dock === "net") drawNetBig(); });
/* ---------- Luftdruck ---------- */
function dPress(c) {
  if (!WX.d) { c.innerHTML = `<div class="empty">NO DATA</div>`; return; }
  const tr = pressTrend();
  c.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;height:100%"><div class="dgrid" style="grid-template-columns:1fr 1fr">
    <div class="card"><div class="ct"><span>MSLP / QNH</span></div><div class="big" style="font-size:54px">${nf(WX.d.current.pressure_msl, 1)}</div></div>
    <div class="card"><div class="ct"><span>TENDENCY 3H</span></div><div class="big" style="font-size:54px">${tr == null ? "--" : (tr > 0 ? "+" : "") + nf(tr, 1)}</div><div class="lbl d">${tr == null ? "" : tr > 1.5 ? "RISING FAST" : tr > .5 ? "RISING" : tr < -1.5 ? "FALLING FAST" : tr < -.5 ? "FALLING" : "STEADY"}</div></div></div>
    <div class="card" style="flex:1;min-height:160px;display:flex;flex-direction:column"><div class="ct"><span>−24 H … +48 H</span><span>HPA</span></div><div style="flex:1;position:relative"><canvas id="dpC"></canvas></div></div></div>`;
  requestAnimationFrame(() => { const cv = $("dpC"), f = cv && fitCanvas(cv); if (!f) return; const { x, W, H } = f, P = pal(), h = WX.d.hourly, i0 = hourIdx(), a = Math.max(0, i0 - 24), arr = h.pressure_msl.slice(a, i0 + 48);
    const mn = Math.min(...arr) - 1, mx = Math.max(...arr) + 1, X = i => i / (arr.length - 1) * W, Y = v => 8 + (1 - (v - mn) / (mx - mn)) * (H - 26);
    x.strokeStyle = P.ln; for (let v = Math.ceil(mn); v <= mx; v += 2) { x.beginPath(); x.moveTo(0, Y(v)); x.lineTo(W, Y(v)); x.stroke(); x.fillStyle = P.dim; x.font = "9px Oxanium"; x.fillText(v, 2, Y(v) - 2); }
    x.strokeStyle = P.tx; x.lineWidth = 2; x.beginPath(); arr.forEach((v, i) => i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v))); x.stroke();
    const nx = X(i0 - a); x.strokeStyle = P.or; x.beginPath(); x.moveTo(nx, 0); x.lineTo(nx, H - 14); x.stroke(); x.fillStyle = P.or; x.fillText("NOW", nx + 3, H - 3); });
}
/* ---------- Audio ---------- */
function dAudio(c) {
  c.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;height:100%"><div class="card" style="flex:1;display:flex;flex-direction:column"><div class="ct"><span>SPECTRUM</span><span id="daS">${audioLive() ? "LIVE" : "NO SIGNAL"}</span></div><div style="flex:1;position:relative"><canvas id="daC"></canvas></div></div>
    <div class="micro">LIVELY DELIVERS A MONO SPECTRUM OF THE SYSTEM AUDIO · L AND R SHOW THE SAME LEVEL</div></div>`;
}
function drawAudioBig() {
  const cv = $("daC"), f = cv && fitCanvas(cv); if (!f) return; const { x, W, H } = f, P = pal(), n = AUD.bins.length, bw = W / n;
  for (let i = 0; i < n; i++) { const h = Math.max(2, AUD.bins[i] * (H - 4)); x.fillStyle = i % 8 === 5 ? P.or : P.cy; x.fillRect(i * bw + 1, H - h, bw - 2, h); }
  $("daS").textContent = audioLive() ? "LIVE" : "NO SIGNAL";
}
