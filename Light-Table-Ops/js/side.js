/* Light Table Ops · © 2026 E11iot · CC BY-NC-ND 4.0
   side.js – Seitenspalten (Feeds): Paneele, Aktualisierung, Auswahl nach Platz */
"use strict";
const fmtRate = b => { b = +b || 0; const bit = b * 8; return bit >= 1e9 ? nf(bit / 1e9, 2) + " GB/S" : bit >= 1e6 ? nf(bit / 1e6, bit >= 1e8 ? 0 : 1) + " MB/S" : nf(bit / 1e3, 0) + " KB/S"; };
const fmtVol = b => b >= 1e12 ? nf(b / 1e12, 2) + " TB" : b >= 1e9 ? nf(b / 1e9, 1) + " GB" : nf(b / 1e6, 0) + " MB";
const foot = (a, b, c) => `<div class="ft"><span>${a}</span><span>${b || ""}</span><span>${c || ""}</span></div>`;

/* Paneel-Definitionen: col A = innere Spalte (früher links), B = äußere Spalte; prio für die einspaltige Ansicht */
const PANELS = [
  { id: "clock", col: "A", prio: 1, h: 238, det: "time", html: () => `
    <div class="top"><div class="logo">${ICON.logo}</div><div><div class="online" id="sOnline">ONLINE</div>
      <div class="clk" id="sClk">--:--:--</div></div></div>
    <div class="tl" id="sDay"></div>
    <div class="mid"><div class="date"><div class="d" id="sDd">--</div><div class="m" id="sDm">---</div><div class="micro" id="sWk">WK --</div></div>
      <div class="cwv"><div class="row" style="gap:6px"><span class="tag">UPTIME</span><span class="lbl" id="sUp">--</span></div><div class="cv"><canvas id="cWave"></canvas></div></div></div>
    ${foot("READOUT · LOCAL", "UTC <b id='sUtc'>--:--</b>", "SYSTEMS · PASS")}` },
  { id: "stat", col: "A", prio: 9, h: 48, det: "loc", html: () => `
    <div class="row"><span class="tag">STATION:</span><span class="lbl" id="sStat">NOT SET</span><span class="micro" id="sGrid" style="margin-left:auto"></span></div>` },
  { id: "wx", col: "A", prio: 3, h: 104, det: "wx", html: () => `
    <div class="g"><div><div class="t">TEMP <b id="wT">--</b></div><div class="micro" id="wF">FEELS -- · DEW --</div><div class="bar" id="wBar"><i></i></div></div>
      <div class="yg" id="wYG"></div><div class="ic" id="wIc"></div></div>
    ${foot("WX NOW", "", "OPEN-METEO")}` },
  { id: "ph", col: "A", prio: 7, h: 130, det: "flt", html: () => `
    <div class="row" style="justify-content:space-between;margin-bottom:6px"><span class="tag">TRAFFIC IN RANGE</span><span class="lbl" id="phT">--</span></div>
    <div class="g">
      <div class="k" id="phC">CLIMBING<small>RATE &gt; +300 FPM</small></div><div class="ic">${ICON.climb}</div>
      <div class="k" id="phR">CRUISING<small>LEVEL · ±300 FPM</small></div><div class="ic">${ICON.cruise}</div>
      <div class="k" id="phD">DESCENDING<small>RATE &lt; −300 FPM</small></div><div class="ic">${ICON.desc}</div>
      <div class="sep"></div>
      <div class="n"><span class="tag" id="phNt">NEAREST</span><span class="box" id="phN">----</span><div class="micro" id="phNd">--</div><div class="micro" id="phNp"></div></div>
    </div>` },
  { id: "log", col: "A", prio: 10, h: 120, grow: 1, det: "links", html: () => `
    <div class="row" style="justify-content:space-between"><span class="tag">EVENT LOG</span><span class="micro" id="lgN">--</span></div>
    <div class="evl" id="evl"></div>` },
  { id: "uv", col: "A", prio: 8, h: 78, det: "uv", html: () => `
    <div class="g"><div><div class="lbl">UV INDEX<br>POLLEN</div><div class="micro">CAMS · COPERNICUS</div></div><div class="sep"></div>
      <div class="v" id="uvV"></div><div class="ic">${ICON.sun}</div></div>` },
  { id: "link", col: "A", prio: 11, h: 46, det: "links", html: () => `
    <div class="row" style="justify-content:space-between"><span class="tag">DATA LINK</span><span class="lbl" id="lkS">SENSOR Nº ----</span></div>` },
  { id: "cmd", col: "A", prio: 12, h: 140, det: null, html: () => `
    <div class="g"><div class="c"><div class="h dim">MOTION</div><div class="dots" id="cmdD1"></div><div class="sw" id="swAnim"></div></div><div class="sep"></div>
      <div class="c"><div class="h cyan">NIGHT</div><div class="dots" id="cmdD2"></div><div class="sw" id="swNight"></div></div></div>
    ${foot("COMMAND", "", "LOCAL")}` },
  { id: "feeds", col: "B", prio: 2, h: 112, det: "links", html: () => `
    <div class="t">FEEDS</div><div class="row"><span class="lbl">DATALINKS</span><span class="box" id="fdN">0</span></div>
    ${foot("SRC STATUS", "", "<span id='fdT'>--</span>")}` },
  { id: "mmap", col: "B", prio: 4, h: 168, grow: 1, det: "mmap", html: () => `
    <div class="tabs"><span class="tag or" data-mm="rain">RAIN</span><span class="tag" data-mm="isob">ISOBAR</span><span class="tag" data-mm="temp">TEMP</span><span class="lbl" style="margin-left:auto">FEED</span></div>
    <div class="cv"><canvas id="cMini"></canvas></div>` },
  { id: "load", col: "B", prio: 5, h: 158, det: "sys", html: () => `
    <div class="row"><span class="tag">SYS LOAD</span><span class="lbl">FEED</span></div>
    <div class="leg"><span><i></i>SENSOR</span><span><i class="g"></i>${HOST_S} ONLY</span><span id="ldSrc" class="cyan"></span></div>
    <svg class="ga" id="ldG" viewBox="-110 -96 220 104"></svg>` },
  { id: "net", col: "B", prio: 6, h: 168, det: "net", html: () => `
    <div class="row"><span class="tag">NET LINK</span><span class="lbl">FEED</span></div>
    <div class="top"><span class="cyan">▼ DL</span><span id="ntD">--</span></div>
    <div class="g"><svg class="rg" id="ntR" viewBox="-50 -50 100 100"></svg><div class="k" id="ntK"></div>
      <div class="mini"><i id="ntM1"></i><i id="ntM2"></i><i id="ntM3"></i></div></div>
    <div class="af"><span>▲ UL</span><span id="ntU">--</span></div><div class="micro" id="ntA" style="margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">--</div>` },
  { id: "pr", col: "B", prio: 7.5, h: 150, det: "press", html: () => `
    <div class="row"><span class="tag">PRESSURE</span><span class="lbl">TREND 3H</span></div>
    <svg id="prG" viewBox="-100 -12 200 112"></svg>` },
  { id: "aud", col: "B", prio: 13, h: 70, det: "audio", html: () => `
    <div class="g"><canvas class="own" id="cAudL"></canvas><div class="lr">L<span> </span>R</div><canvas class="own" id="cAudR"></canvas></div>
    ${foot("", "AUDIO LEVEL", "")}` }
];
const PN = {};   // id -> Element

function buildSide() {
  const side = $("side"); side.innerHTML = "";
  const one = STATE.cols === 1;
  const cols = one ? [side.appendChild(Object.assign(document.createElement("div"), { className: "col" }))]
                   : ["A", "B"].map(() => side.appendChild(Object.assign(document.createElement("div"), { className: "col" })));
  // äußere Spalte (B) liegt am Bildschirmrand
  const order = STATE.side === "left" ? ["B", "A"] : ["A", "B"];
  const list = one ? PANELS.slice().sort((a, b) => a.prio - b.prio) : PANELS;
  for (const p of list) {
    if (p.id === "log" && STATE.lay !== "full") continue;   // Ereignis-Log nur in der FULL-Ansicht
    const el = document.createElement("div"); el.className = "pn p-" + p.id + (p.grow ? " grow" : ""); el.dataset.p = p.id; el.innerHTML = p.html();
    if (p.det) el.addEventListener("click", e => { if (e.target.closest("[data-mm],.sw")) return; openDock(p.det); });
    PN[p.id] = el;
    (one ? cols[0] : cols[order.indexOf(p.col)]).appendChild(el);
  }
  // Minikarten-Reiter
  side.querySelectorAll("[data-mm]").forEach(t => t.addEventListener("click", e => { e.stopPropagation(); MINI.mode = t.dataset.mm; LS.set("lto-mini", MINI.mode); drawMini(); }));
  $("swAnim").addEventListener("click", e => { e.stopPropagation(); CFG.anim = CFG.anim > 0 ? 0 : 60; saveCfg(); applyAnim(); updCmd(); });
  $("swNight").addEventListener("click", e => { e.stopPropagation(); CFG.nightMode = { auto: "on", on: "off", off: "auto" }[CFG.nightMode] || "auto"; saveCfg(); applyDim(); updCmd(); });
  fitSide(); updAll();
}
/* nur so viele Paneele zeigen, wie in die Höhe (bzw. Breite) passen */
function fitSide() {
  const side = $("side");
  side.querySelectorAll(".pn").forEach(p => p.classList.remove("hide"));
  side.classList.add("meas");
  requestAnimationFrame(() => {
    side.querySelectorAll(".col").forEach(col => {
      const horiz = STATE.bottom, lim = horiz ? col.clientWidth : col.clientHeight;
      let pos = 0; const items = [...col.children];
      // nach Priorität ausblenden, bis es passt
      const size = el => horiz ? el.offsetWidth + 10 : el.offsetHeight + 10;
      let total = items.reduce((s, el) => s + size(el), 0);
      const pr = el => (PANELS.find(p => p.id === el.dataset.p) || { prio: 0 }).prio;
      const byPrio = items.filter(el => el.dataset.p).sort((a, b) => pr(b) - pr(a));
      for (const el of byPrio) { if (total <= lim + 2) break; total -= size(el); el.classList.add("hide"); }
      // ausgeblendete Paneele mit niedriger Priorität wieder zeigen, wenn sie doch passen
      for (const el of byPrio.slice().reverse()) { if (!el.classList.contains("hide")) continue; el.classList.remove("hide"); const t2 = total + size(el); if (t2 <= lim + 2) total = t2; else el.classList.add("hide"); }
    });
    side.classList.remove("meas");
    requestAnimationFrame(() => { drawMini(); BUS.emit("sidefit"); });
  });
}

/* ---------- Aktualisierung ---------- */
function updClock() {
  const d = new Date();
  $("sClk").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  $("sUtc").textContent = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  $("sDd").textContent = pad(d.getDate()); $("sDm").textContent = MON[d.getMonth()] + " · " + WD[d.getDay()]; $("sWk").textContent = "WK " + pad(isoWeek(d));
  const boot = sensFresh() && SENS.data.info && SENS.data.info.boot;
  if (boot) { const s = Math.floor((Date.now() - boot) / 1000), dd = Math.floor(s / 86400); $("sUp").textContent = `${dd ? dd + "D " : ""}${pad(Math.floor(s % 86400 / 3600))}:${pad(Math.floor(s % 3600 / 60))}`; }
  else { const s = Math.floor(performance.now() / 1000); $("sUp").textContent = `WP ${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}`; }
  const ok = linkCount() > 0, on = $("sOnline");
  on.textContent = ok ? "ONLINE" : (hasLoc() ? "OFFLINE" : "STANDBY"); on.classList.toggle("off", !ok);
  // Tagesleiste: Sonnenaufgang · Mittag · Untergang · jetzt
  const tl = $("sDay"); let marks = [];
  if (WX.d && WX.d.daily) { const i = WX.d.daily.time.indexOf(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    if (i >= 0) { const sr = new Date(WX.d.daily.sunrise[i]), ss = new Date(WX.d.daily.sunset[i]); marks = [sr, new Date((+sr + +ss) / 2), ss]; } }
  const f = t => (t.getHours() * 60 + t.getMinutes()) / 1440, nowF = f(d);
  const pts = [...marks.map(m => [f(m), ""]), [nowF, "o"]].sort((a, b) => a[0] - b[0]);
  let h = "", last = 0; pts.forEach(([p, c]) => { h += `<i style="flex:${Math.max(.001, p - last)}"></i><b class="${c}"></b>`; last = p; }); h += `<i style="flex:${1 - last}"></i>`;
  tl.innerHTML = h;
}
function updWx() {
  if (!WX.d) return; const c = WX.d.current;
  $("wT").textContent = nf(c.temperature_2m, 0) + "°"; $("wF").textContent = `FEELS ${nf(c.apparent_temperature, 0)}° · DEW ${nf(c.dew_point_2m, 0)}°`;
  $("wBar").querySelector("i").style.left = clamp((c.temperature_2m + 15) / 50 * 100, 0, 100) + "%";
  $("wYG").innerHTML = `${pad(Math.round(c.relative_humidity_2m))} <span>H</span><br>${pad(Math.round(U.wind(c.wind_speed_10m)))} <span>${AVI() ? "KT" : "KM"}</span><br>${String(Math.round(c.wind_direction_10m)).padStart(3, "0")} <span>°</span>`;
  $("wIc").innerHTML = wxIcon(c.weather_code, !!c.is_day);
  PN.wx.title = WMO[c.weather_code] || "";
  if (PN.stat) { $("sStat").textContent = String(CFG.name || "NOT SET").toUpperCase(); }
}
function updPhase() {
  const ps = planes(), n = { climb: 0, cruise: 0, desc: 0 };
  ps.forEach(p => { const k = phase(p); if (n[k] != null) n[k]++; });
  [["phC", "climb", "CLIMBING", "RATE &gt; +300 FPM"], ["phR", "cruise", "CRUISING", "LEVEL · ±300 FPM"], ["phD", "desc", "DESCENDING", "RATE &lt; −300 FPM"]].forEach(([id, k, t, s]) => {
    const el = $(id); el.innerHTML = `${t} <span class="${n[k] ? "yel" : ""}">${n[k]}</span><small>${s}</small>`; el.classList.toggle("zero", !n[k]); });
  $("phT").innerHTML = `<span class="yel">${ps.length}</span> <span class="dim">· ${nf(U.dist(CFG.range), 0)} ${U.distU()}</span>`;
  const sel = AIR.sel && AIR.map.get(AIR.sel), p = sel || ps.find(q => !q.ground), ph = p ? phase(p) : null;
  // Phase des gezeigten Flugzeugs in der Liste markieren
  ["phC", "phR", "phD"].forEach((id, i) => $(id).classList.toggle("mark", !!p && ["climb", "cruise", "desc"][i] === ph));
  $("phNt").textContent = sel ? "SELECTED" : "NEAREST"; $("phNt").className = "tag" + (sel ? " or" : "");
  $("phN").textContent = p ? p.call : (AIR.ok ? "NONE" : "----");
  $("phNd").textContent = p ? `${nf(U.dist(p.d), 0)} ${U.distU()} · ${p.ground ? "GND" : p.alt >= 6000 ? "FL" + pad(Math.round(p.alt / 100), 3) : Math.round(U.alt(p.alt) / 10) * 10 + " " + U.altU()}` : (AIR.msg || "--");
  $("phNp").textContent = p ? `${{ climb: "▲ CLIMB", cruise: "▶ CRUISE", desc: "▼ DESCENT", gnd: "■ GROUND" }[ph]} · ${p.rate == null ? "--" : (p.rate > 0 ? "+" : "") + Math.round(p.rate)} FPM` : "";
}
function updSys() {
  // Netz-Transfer (Sitzung)
  // Systemlast-Bogen
  const vals = [["CPU", SYS.cpu], ["GPU", SYS.gpu], ["RAM", SYS.ram]];
  let g = `<path d="${arcPath(88, -90, 90)}" fill="none" stroke="var(--ln2)" stroke-width="16"/>`;
  for (let i = 0; i <= 20; i++) { const a = -90 + i * 9, l = i % 5 ? 4 : 9; g += `<path d="M${(70 * Math.sin(a * RAD)).toFixed(1)},${(-70 * Math.cos(a * RAD)).toFixed(1)} L${((70 - l) * Math.sin(a * RAD)).toFixed(1)},${(-(70 - l) * Math.cos(a * RAD)).toFixed(1)}" stroke="var(--ln2)" stroke-width="1.2"/>`; }
  g += `<path d="${arcPath(88, -90, -90 + 180 * clamp(SYS.cpu, 0, 100) / 100)}" fill="none" stroke="${sensFresh() ? "var(--or)" : "var(--cy2)"}" stroke-width="16"/>`;
  vals.forEach(([k, v], i) => { const a = -90 + 180 * clamp(v, 0, 100) / 100, r0 = 68, x = r0 * Math.sin(a * RAD), y = -r0 * Math.cos(a * RAD), col = ["var(--or)", "var(--ye)", "var(--cy)"][i];
    g += `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${a.toFixed(1)})"><path d="M0,-7 L-5,3 H5 Z" fill="${col}"/></g>`; });
  g += `<text x="-100" y="6" font-size="8" fill="var(--dim)" letter-spacing="1">0</text><text x="100" y="6" font-size="8" fill="var(--dim)" text-anchor="end">100</text>
    <text x="0" y="-36" font-size="9" text-anchor="middle" letter-spacing="1"><tspan fill="var(--ye)">GPU ${Math.round(SYS.gpu)}</tspan><tspan fill="var(--dim)"> · </tspan><tspan fill="var(--cy)">RAM ${Math.round(SYS.ram)}</tspan></text>`;
  g += `<text x="0" y="-8" font-size="24" text-anchor="middle" fill="var(--tx)" font-weight="200">${Math.round(SYS.cpu)}<tspan font-size="11" fill="var(--dim)">%</tspan></text>
    <text x="0" y="6" font-size="7" text-anchor="middle" fill="var(--dim)" letter-spacing="1.5">CPU · ${SYS.demo ? "DEMO" : (sensFresh() ? "SENSOR" : HOST_S)}</text>`;
  $("ldG").innerHTML = g; $("ldSrc").textContent = SYS.demo ? "DEMO" : "";
  // Netz-Ring
  const mx = Math.max(1, ...SYS.hist.down.slice(-120), SYS.down), mu = Math.max(1, ...SYS.hist.up.slice(-120), SYS.up);
  $("ntD").textContent = fmtRate(SYS.down); $("ntU").textContent = fmtRate(SYS.up);
  $("ntR").innerHTML = `<circle r="44" fill="none" stroke="var(--ln2)" stroke-width="6"/>
    <path d="${arcPath(44, 0, Math.max(1, 359 * SYS.down / mx))}" fill="none" stroke="var(--tx)" stroke-width="6"/>
    <circle r="31" fill="none" stroke="var(--ln)" stroke-width="5"/><path d="${arcPath(31, 0, Math.max(1, 359 * SYS.up / mu))}" fill="none" stroke="var(--cy)" stroke-width="5"/>
    <circle r="20" fill="none" stroke="var(--ln2)" stroke-width="1.5"/><path d="M-6,-14 L14,0 L-6,14" fill="none" stroke="var(--tx)" stroke-width="2"/>
    ${dotRing(25, 24, (Date.now() / 1000 % 24) / 24, "var(--cy2)", { dot: 1.1, off: "transparent" })}`;
  $("ntK").innerHTML = `PK <b>${fmtRate(mx)}</b> / <b>${fmtRate(mu)}</b><br>SESSION ▼ <b>${fmtVol(SYS.sess.down)}</b><br>SESSION ▲ <b>${fmtVol(SYS.sess.up)}</b>`;
  $("ntA").textContent = (SYS.netName || "ADAPTER --").toUpperCase();
  $("ntM1").className = sensFresh() ? "on" : ""; $("ntM2").className = SYS.live && !SYS.demo ? "on" : ""; $("ntM3").className = SYS.down > 1e5 ? "on" : "";
  $("ntM1").title = "SENSOR"; $("ntM2").title = HOST_S; $("ntM3").title = "ACTIVITY";
  $("lkS").textContent = sensFresh() ? `SENSOR Nº ${CFG.sensorPort}` : (SENS.denied ? "SENSOR · DENIED" : "SENSOR · OFF");
}
function updUv() {
  if (!AQ.d || !AQ.d.current) { $("uvV").innerHTML = "UV --<br>POLLEN --"; return; }
  const c = AQ.d.current; const top = POLLEN.map(([k, n]) => [n, c[k]]).filter(p => p[1] != null).sort((a, b) => b[1] - a[1])[0];
  const lv = top ? pollenLvl(top[1]) : 0, uv = c.uv_index;
  const uvl = uv == null ? 0 : uv < 3 ? 1 : uv < 6 ? 2 : 3;
  $("uvV").innerHTML = `UV <b class="l${uvl}">${nf(uv, 1)}</b><br>${top && lv ? `${top[0]} <b class="l${lv}">${["", "LOW", "MOD", "HIGH"][lv]}</b>` : "POLLEN <b class='l1'>NONE</b>"}<br>AQI <b>${nf(c.european_aqi, 0)}</b>`;
}
function updFeeds() {
  $("fdN").textContent = linkCount();
  const bad = Object.values(LINKS).filter(l => !l.ok && l.t).length;
  $("fdT").textContent = bad ? bad + " OFFLINE" : "ALL NOMINAL";
}
function updPress() {
  if (!WX.d) return;
  const tr = pressTrend(), q = WX.d.current.pressure_msl, a = clamp((tr || 0) / 6, -1, 1) * 90;
  const P = (r, d) => [(r * Math.sin(d * RAD)).toFixed(1), (70 - r * Math.cos(d * RAD)).toFixed(1)];   // Mittelpunkt (0,70)
  let g = `<path d="M-70,70 A70,70 0 0 1 70,70" fill="none" stroke="var(--ln2)" stroke-width="1.5"/>`;
  for (let i = -6; i <= 6; i++) { const [x1, y1] = P(70, i * 15), [x2, y2] = P(i % 3 ? 75 : 80, i * 15); g += `<path d="M${x1},${y1} L${x2},${y2}" stroke="${i ? "var(--ln2)" : "var(--tx)"}" stroke-width="1.2"/>`; }
  const [nx, ny] = P(62, a);
  g += `<path d="M0,70 L${nx},${ny}" stroke="var(--or)" stroke-width="2.5"/><circle cx="${nx}" cy="${ny}" r="4" fill="var(--or)"/>
    <rect x="-34" y="44" width="68" height="40" fill="var(--bg)" stroke="var(--ln2)"/><rect x="-28" y="50" width="20" height="28" fill="none" stroke="var(--tx)"/>
    <text x="10" y="66" font-size="15" text-anchor="middle" fill="var(--tx)" font-weight="300">${nf(q, 0)}</text><text x="10" y="76" font-size="6" text-anchor="middle" fill="var(--dim)">HPA</text>
    <text x="-18" y="68" font-size="9" text-anchor="middle" fill="var(--cy)">${tr == null ? "·" : tr > .5 ? "▲" : tr < -.5 ? "▼" : "▶"}</text>
    <text x="84" y="6" font-size="12" fill="var(--tx)" text-anchor="end">${tr == null ? "--" : (tr > 0 ? "+" : "") + nf(tr, 1)}</text>
    <text x="-92" y="96" font-size="7" fill="var(--dim)" letter-spacing="1">−6</text><text x="92" y="96" font-size="7" fill="var(--dim)" text-anchor="end" letter-spacing="1">+6 HPA/3H</text>`;
  $("prG").innerHTML = g;
}
function updCmd() {
  const on = CFG.anim > 0;
  $("swAnim").innerHTML = `${ICON.sw(on)}<b>${on ? "ON" : "OFF"}</b>`; $("swAnim").classList.toggle("on", on);
  const nm = CFG.nightMode, non = nm !== "off";
  $("swNight").innerHTML = `${ICON.sw(non)}<b>${nm.toUpperCase()}</b>`; $("swNight").classList.toggle("on", non);
  $("swNight").title = nm === "auto" ? (NIGHT ? "AUTO · NIGHT – DIMMED" : "AUTO · DAY – DIMS AFTER SUNSET") : (nm === "on" ? "DIMMED NOW" : "NEVER DIM");
  const dots = (n, on2) => `<svg viewBox="0 0 120 10" preserveAspectRatio="none" style="width:100%;height:10px">${[...Array(30)].map((_, i) => `<circle cx="${2 + i * 4}" cy="5" r="1.1" fill="${on2 && i % 3 ? "var(--cy2)" : "var(--ln2)"}"/>`).join("")}</svg>`;
  $("cmdD1").innerHTML = dots(30, on); $("cmdD2").innerHTML = dots(30, NIGHT);
}
function updAll() { updClock(); updWx(); updPhase(); updSys(); updUv(); updFeeds(); updPress(); updCmd(); drawMini(); updStat(); }
function updStat() { $("sStat").textContent = String(CFG.name || "NOT SET").toUpperCase(); $("sGrid").textContent = hasLoc() ? utmRef(CFG.lat, CFG.lon, 1).short : ""; }
BUS.on("wx", () => { updWx(); updPress(); drawMini(); });
BUS.on("air", updPhase); BUS.on("aq", updUv); BUS.on("links", updFeeds); BUS.on("sys", updSys); BUS.on("grid", drawMini); BUS.on("rain", () => { MINI.tiles = null; drawMini(); });
BUS.on("loc", () => { updStat(); MINI.tiles = null; });
setInterval(() => { if (!paused) updClock(); }, 1000);

/* ---------- Animierte Teile (Wellenform, Audio) – aus der Hauptschleife ---------- */
function drawWave(t) {
  const c = $("cWave"); if (!c) return; const f = fitCanvas(c); if (!f) return; const { x, W, H } = f, P = pal();
  const n = Math.floor(W / 5), live = audioLive();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(i / n * AUD.bins.length), v = live ? AUD.bins[k] : (.12 + .1 * Math.sin(t / 700 + i * .45) * Math.sin(t / 1300 + i * .13)) * (CFG.anim / 60);
    const h = Math.max(1.5, Math.abs(v) * H * .9), px = i * 5 + 2;
    x.fillStyle = P.ln2; x.fillRect(px, H / 2 - h / 2, 1, h);
    x.fillStyle = i % 7 === 3 ? P.or : P.tx; x.fillRect(px - .6, H / 2 - h / 2 - 1.2, 2.2, 2.2); x.fillRect(px - .6, H / 2 + h / 2 - 1, 2.2, 2.2);
  }
}
const AUDM = { l: 0 };
function drawAudio() {
  for (let i = 0; i < AUD.bins.length; i++) AUD.bins[i] = AUD.bins[i] * .7 + (audioLive() ? AUD.tgt[i] : 0) * .3;
  AUDM.l = Math.max(audioLive() ? AUD.lvl : 0, AUDM.l * .9);
  ["cAudL", "cAudR"].forEach((id, j) => {
    const c = $(id); if (!c || !c.offsetParent) return; const f = fitCanvas(c); if (!f) return; const { x, W, H } = f, P = pal();
    const bars = 5, on = Math.round(AUDM.l * bars);
    for (let i = 0; i < bars; i++) { const bh = H * (.3 + .7 * (i + 1) / bars), bx = j ? i * (W / bars) : W - (i + 1) * (W / bars);
      x.fillStyle = i < on ? (i >= 3 ? P.or : P.tx) : P.ln; x.fillRect(bx + 1, (H - bh) / 2, W / bars - 3, bh); }
  });
}

/* ---------- Minikarte: Regen / Isobaren / Temperatur ---------- */
const MINI = { mode: LS.get("lto-mini", "rain"), tiles: null, zoom: 6, coast: null };
const WORLD = { arcs: null, coast: null, loading: false };
async function loadWorld() {
  if (WORLD.arcs || WORLD.loading) return; WORLD.loading = true;
  try {
    const topo = await getJSON("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json");
    const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
    WORLD.arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(p => { x += p[0]; y += p[1]; return [x * sx + tx, y * sy + ty]; }); });
    drawMini(); BUS.emit("world");
  } catch (e) { WORLD.loading = false; }
}
function drawMini(big) {
  const c = big || $("cMini"); if (!c) return;
  if (!big) document.querySelectorAll("[data-mm]").forEach(t => t.className = "tag" + (t.dataset.mm === MINI.mode ? " or" : ""));
  const f = fitCanvas(c); if (!f || !hasLoc()) return; const { x, W, H } = f, P = pal();
  // Ausschnitt: ±spanKm um den Ort (Web-Mercator lokal linear genähert)
  const spanKm = big ? 520 : 380, kx = W / (2 * spanKm), cosL = Math.cos(CFG.lat * RAD);
  const px = (la, lo) => [W / 2 + (lo - CFG.lon) * 111.32 * cosL * kx, H / 2 - (la - CFG.lat) * 110.57 * kx];
  x.fillStyle = "#0e1214"; x.fillRect(0, 0, W, H);
  const mode = MINI.mode;
  if (mode === "rain") miniRain(x, W, H, px, spanKm);
  else if (GRID.ok) miniField(x, W, H, px, mode);
  // Küsten
  if (WORLD.arcs) {
    x.strokeStyle = mode === "rain" ? P.ln2 : "rgba(232,226,200,.55)"; x.lineWidth = 1; x.beginPath();
    const dLa = spanKm / 110.57 * (H / W) + 1, dLo = spanKm / (111.32 * cosL) + 1;
    for (const a of WORLD.arcs) { let pen = false;
      for (const p of a) { if (Math.abs(p[1] - CFG.lat) > dLa || Math.abs(p[0] - CFG.lon) > dLo) { pen = false; continue; }
        const [X, Y] = px(p[1], p[0]); pen ? x.lineTo(X, Y) : x.moveTo(X, Y); pen = true; } }
    x.stroke();
  } else loadWorld();
  // Standort + Raster
  x.strokeStyle = P.or; x.lineWidth = 1.2; x.beginPath(); x.arc(W / 2, H / 2, 3.5, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = hexA(P.or, .5); x.beginPath(); x.arc(W / 2, H / 2, CFG.range * kx, 0, Math.PI * 2); x.stroke();
  x.fillStyle = P.dim; x.font = `${big ? 12 : 8}px Oxanium`; x.fillText(mode === "rain" ? "RAINVIEWER" : mode === "isob" ? "MSLP HPA" : "T2M °C", 4, H - 4);
  if (!big) { // kleine Höhenlinien-Anmutung oben rechts
    x.fillStyle = P.tx; x.textAlign = "right"; x.fillText(mode === "rain" ? (RAINV.frames.length ? new Date(RAINV.frames[RAINV.frames.length - 1].time * 1000).toTimeString().slice(0, 5) : "--") : "", W - 4, 10); x.textAlign = "left"; }
}
function miniRain(x, W, H, px, spanKm) {
  const fr = RAINV.frames[RAINV.frames.length - 1]; if (!fr) return;
  const Z = spanKm > 300 ? 5 : 6, n = 2 ** Z;
  const lon2x = lo => (lo + 180) / 360 * n, lat2y = la => { const r = la * RAD; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n; };
  const x2lon = X => X / n * 360 - 180, y2lat = Y => { const k = Math.PI - 2 * Math.PI * Y / n; return 180 / Math.PI * Math.atan(.5 * (Math.exp(k) - Math.exp(-k))); };
  const dLa = spanKm / 110.57, dLo = spanKm / (111.32 * Math.cos(CFG.lat * RAD));
  const xa = Math.floor(lon2x(CFG.lon - dLo)), xb = Math.floor(lon2x(CFG.lon + dLo)), ya = Math.floor(lat2y(CFG.lat + dLa)), yb = Math.floor(lat2y(CFG.lat - dLa));
  const key = fr.path + Z + xa + ya;
  if (!MINI.tiles || MINI.tiles.key !== key) {
    MINI.tiles = { key, list: [] };
    for (let tx = xa; tx <= xb; tx++) for (let ty = ya; ty <= yb; ty++) { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => drawMini(); img.src = rainTile(fr, Z, tx, ty, 256);
      MINI.tiles.list.push({ img, w: x2lon(tx), e: x2lon(tx + 1), n: y2lat(ty), s: y2lat(ty + 1) }); }
  }
  x.globalAlpha = .9;
  for (const t of MINI.tiles.list) { if (!t.img.complete || !t.img.naturalWidth) continue; const [x0, y0] = px(t.n, t.w), [x1, y1] = px(t.s, t.e); x.drawImage(t.img, x0, y0, x1 - x0, y1 - y0); }
  x.globalAlpha = 1;
}
/* Feld aus dem 7×7-Raster bilinear interpoliert; Isobaren über Marching Squares */
function gridVal(arr, la, lo) {
  const n = GRID.n, la0 = CFG.lat + 4.5, lo0 = CFG.lon - 7;
  const r = (la0 - la) / 9 * (n - 1), c = (lo - lo0) / 14 * (n - 1);
  if (r < 0 || c < 0 || r > n - 1 || c > n - 1) return null;
  const r0 = Math.min(n - 2, Math.floor(r)), c0 = Math.min(n - 2, Math.floor(c)), fr = r - r0, fc = c - c0, g = (i, j) => arr[i * n + j];
  const a = g(r0, c0), b = g(r0, c0 + 1), cc = g(r0 + 1, c0), d = g(r0 + 1, c0 + 1); if ([a, b, cc, d].some(v => v == null)) return null;
  return a * (1 - fr) * (1 - fc) + b * (1 - fr) * fc + cc * fr * (1 - fc) + d * fr * fc;
}
function miniField(x, W, H, px, mode) {
  const P = pal(), step = 6, cosL = Math.cos(CFG.lat * RAD), kx = W / (2 * (W > 400 ? 520 : 380));
  const inv = (X, Y) => [CFG.lat - (Y - H / 2) / kx / 110.57, CFG.lon + (X - W / 2) / kx / (111.32 * cosL)];
  const arr = mode === "isob" ? GRID.p : GRID.t;
  if (mode === "temp") {
    for (let Y = 0; Y < H; Y += step) for (let X = 0; X < W; X += step) {
      const [la, lo] = inv(X + step / 2, Y + step / 2), v = gridVal(arr, la, lo); if (v == null) continue;
      const k = clamp((v + 10) / 40, 0, 1);
      x.fillStyle = k < .5 ? `rgba(${Math.round(60 + 120 * k)},${Math.round(150 + 60 * k)},${Math.round(190 - 40 * k)},.55)` : `rgba(${Math.round(200 + 50 * (k - .5) * 2)},${Math.round(180 - 100 * (k - .5) * 2)},${Math.round(120 - 70 * (k - .5) * 2)},.55)`;
      x.fillRect(X, Y, step, step);
    }
  }
  // Linien (Isobaren alle 4 hPa, Isothermen alle 2 °C)
  const iv = mode === "isob" ? 4 : 2, gs = 8, cols = Math.ceil(W / gs) + 1, rows = Math.ceil(H / gs) + 1, V = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const [la, lo] = inv(i * gs, j * gs); V.push(gridVal(arr, la, lo)); }
  const vs = V.filter(v => v != null); if (!vs.length) return;
  const lo = Math.floor(Math.min(...vs) / iv) * iv, hi = Math.ceil(Math.max(...vs) / iv) * iv;
  x.lineWidth = 1.1; x.font = `${W > 400 ? 11 : 8}px Oxanium`;
  for (let lv = lo; lv <= hi; lv += iv) {
    x.strokeStyle = mode === "isob" ? (lv % 20 === 0 ? P.ye : P.cy) : P.tx; x.beginPath(); let lab = null;
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = V[j * cols + i], b = V[j * cols + i + 1], c = V[(j + 1) * cols + i + 1], d = V[(j + 1) * cols + i]; if ([a, b, c, d].some(v => v == null)) continue;
      const e = [];
      const it = (v1, v2, x1, y1, x2, y2) => { if ((v1 < lv) !== (v2 < lv)) { const t = (lv - v1) / (v2 - v1); e.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } };
      const X = i * gs, Y = j * gs;
      it(a, b, X, Y, X + gs, Y); it(b, c, X + gs, Y, X + gs, Y + gs); it(c, d, X + gs, Y + gs, X, Y + gs); it(d, a, X, Y + gs, X, Y);
      for (let k = 0; k + 1 < e.length; k += 2) { x.moveTo(e[k][0], e[k][1]); x.lineTo(e[k + 1][0], e[k + 1][1]); if (!lab && i > cols / 3) lab = e[k]; }
    }
    x.stroke();
    if (lab) { x.fillStyle = x.strokeStyle; x.fillText(String(lv), lab[0] + 2, lab[1] - 2); }
  }
}

/* ---------- Ereignis-Log ---------- */
const EVLOG = [];
function evlog(txt, cls = "") {
  const d = new Date(); EVLOG.unshift({ t: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, txt, cls });
  if (EVLOG.length > 80) EVLOG.pop(); renderEvlog();
}
function renderEvlog() {
  const el = $("evl"); if (!el) return;
  el.innerHTML = EVLOG.slice(0, 40).map(e => `<div class="${e.cls}"><span>${e.t}</span>${esc(e.txt)}</div>`).join("") || `<div class="dim"><span>--:--:--</span>WAITING FOR EVENTS</div>`;
  $("lgN").textContent = EVLOG.length + " EVENTS";
}
const EVS = { hex: null, links: {}, metar: {}, warn: new Set(), sq: new Set() };
BUS.on("air", () => {
  const ps = planes(), now = new Set(ps.map(p => p.hex));
  if (EVS.hex) { let n = 0; for (const p of ps) if (!EVS.hex.has(p.hex) && !p.ground && n++ < 3) evlog(`ACQ ${p.call} · ${p.alt >= 6000 ? "FL" + pad(Math.round(p.alt / 100), 3) : nf(U.alt(p.alt), 0) + U.altU()} · ${nf(U.dist(p.d), 0)} ${U.distU()}`, "c"); }
  EVS.hex = now;
  for (const p of ps) if (p.emerg && !EVS.sq.has(p.hex + p.sq)) { EVS.sq.add(p.hex + p.sq); evlog(`SQUAWK ${p.sq} ${p.emerg} · ${p.call}`, "o"); }
});
BUS.on("metar", () => { for (const st of MET.st.slice(0, 3)) { if (EVS.metar[st.ic] !== st.raw) { if (EVS.metar[st.ic] || Object.keys(EVS.metar).length < 3) evlog(`METAR ${st.ic} ${st.m.cat || ""} · ${st.m.wdir != null ? pad(st.m.wdir, 3) : "VRB"}/${st.m.wspd ?? "--"}KT · ${st.m.temp ?? "--"}°`, "y"); EVS.metar[st.ic] = st.raw; } } });
BUS.on("warn", () => { for (const w of WARN.list) if (!EVS.warn.has(w.IDENTIFIER)) { EVS.warn.add(w.IDENTIFIER); evlog(`DWD ${String(w.SEVERITY || "").toUpperCase()} · ${warnEN(w.EVENT)}`, "o"); } });
BUS.on("links", () => { for (const [k, l] of Object.entries(LINKS)) { if (!l.t) continue; const was = EVS.links[k]; if (was !== undefined && was !== l.ok) evlog(`${l.ok ? "LINK UP" : "LINK LOST"} · ${l.n}`, l.ok ? "c" : "o"); else if (was === undefined && l.ok) evlog(`LINK UP · ${l.n}`, ""); EVS.links[k] = l.ok; } });
BUS.on("sidefit", renderEvlog);
BUS.on("sel", updPhase);
