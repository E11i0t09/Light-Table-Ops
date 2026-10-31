/* Light Table Ops · © 2026 E11iot · CC BY-NC-ND 4.0
   views.js – Hauptansichten: System (Threads), Wetter/METAR, Flüge */
"use strict";
function setView(v) {
  STATE.view = v; LS.set("lto-view-" + SCR, v);
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("on", el.id === "v" + { map: "Map", sys: "Sys", wx: "Wx", flt: "Flt" }[v]));
  if (v === "sys") buildSys(); if (v === "wx") buildWx(); if (v === "flt") renderFlt();
  updFoot(); placeMap(); BUS.emit("view", v);
}

/* ================== SYSTEM ================== */
const SV = { metric: LS.get("lto-svm", "cpu"), built: false, nThr: 0 };
const GiB = 1073741824;
function buildSys() {
  const v = $("vSys"), cores = threads(); SV.nThr = cores.length;
  v.innerHTML = `<div class="sv">
    <div class="hd">
      <div class="a"><div class="row"><span class="lbl" style="font-size:20px;letter-spacing:3px">SYS·MX</span><span class="lbl" style="font-size:20px;letter-spacing:3px">ACTIVITY <span class="orange" style="font-size:11px">x</span></span></div>
        <div class="row"><span class="lbl d">SYSTEM STATUS</span><span class="lbl d">MONITOR FEED</span></div></div>
      <div class="a"><div class="row" style="justify-content:space-between"><span class="lbl">THREADS</span><span class="box" style="height:26px;font-size:16px" id="svThr">--</span></div><div class="row"><span class="lbl">ACTIVITY</span><span class="lbl cyan">SUMMARY</span></div></div>
      <div class="row" style="gap:26px;align-items:flex-start">
        <div class="node"><small>CPU<br>LOAD</small><b id="svC">--</b></div><div class="node"><small>GPU<br>LOAD</small><b id="svG">--</b></div><div class="node"><small>RAM<br>USED</small><b id="svR">--</b></div>
        <div style="margin-left:auto;text-align:right"><div class="lbl d" id="svCpuN" style="font-size:11px"></div><div class="lbl d" id="svGpuN" style="font-size:11px"></div><div class="note" id="svNote"></div></div></div>
    </div>
    <div class="c1">
      <div class="row" style="justify-content:space-between"><span class="lbl d">GPU CODE</span><span class="lbl d">ACT STATUS</span><span class="lbl d">TEMP · VRAM</span></div>
      <div class="row" style="gap:40px"><span class="big" style="font-size:44px;color:var(--ye)" id="svGL">--</span><span class="big" style="font-size:44px" id="svGT">--</span></div>
      <div class="gpu"><canvas id="cGpu"></canvas></div>
      <div class="h2"><span>GPU TELEMETRY · 10 MIN</span><small><span class="orange">━</span> LOAD <span class="yel">━</span> TEMP <span class="cyan">━</span> VRAM</small></div>
      <div class="gpuh"><canvas id="cGpuH"></canvas></div>
      <div class="chips">${["cpu", "gpu", "ram", "net"].map(k => `<span data-m="${k}" class="${SV.metric === k ? "on" : ""}">${k.toUpperCase()}</span>`).join("")}</div>
      <div class="hist"><canvas id="cHist"></canvas></div>
      <div class="h2"><span id="svHN">CPU USAGE · 10 MIN</span><small id="svHV"></small></div>
    </div>
    <div class="c2">
      <div class="h2"><span>THREAD DIAGNOSTIC MATRIX</span><small>${SV.nThr} · 60 S</small></div>
      <div class="matrix"><canvas id="cMat"></canvas></div>
      <div class="h2"><span>MEMORY STATUS</span><small>RAM · VRAM · DRIVES</small></div>
      <div class="fuel" id="svFuel"></div>
      <div class="h2"><span>THERMAL DATA</span><small>°C</small></div>
      <div class="pos"><canvas id="cPos"></canvas></div>
      <div class="h2"><span>PROCESS MATRIX</span><small>CPU % · MEM</small></div>
      <div class="procs" id="svProc"></div>
    </div>
    <div class="c3"><div class="row" style="justify-content:space-between"><span class="lbl d">DISPATCHED THREAD TABLE</span><span class="micro" id="svTT">--</span></div>
      <div class="tt" id="svTbl"></div></div>
    <div class="drv" id="svDrv"></div>
  </div>`;
  v.querySelectorAll("[data-m]").forEach(c => c.addEventListener("click", () => { SV.metric = c.dataset.m; LS.set("lto-svm", SV.metric); v.querySelectorAll("[data-m]").forEach(d => d.classList.toggle("on", d === c)); renderSys(); }));
  buildThr(); SV.built = true; renderSys();
}
function buildThr() {
  const t = $("svTbl"); if (!t) return; const n = SV.nThr;
  // Spalten so wählen, dass die Kacheln die Fläche füllen
  const W = t.clientWidth || 800, H = t.clientHeight || 600;
  let best = 1, bs = 0; for (let c = 1; c <= 8; c++) { const r = Math.ceil(n / c), cw = W / c, ch = H / r; const s = Math.min(cw / 3.2, ch); if (s > bs && cw >= 150) { bs = s; best = c; } }
  t.style.gridTemplateColumns = `repeat(${best},1fr)`; t.style.gridAutoRows = `minmax(0,${Math.min(110, (H - 8) / Math.ceil(n / best) - 10)}px)`;
  t.innerHTML = [...Array(n)].map((_, i) => `<div class="thr"><div class="h"><span>THR <b>${pad(i, 2)}</b></span><span id="thM${i}">---- MHZ</span></div>
    <div class="v"><span class="n" id="thV${i}">--</span><canvas class="own" id="thC${i}"></canvas></div><div class="rr"><svg viewBox="-12 -12 24 24" id="thR${i}"></svg></div></div>`).join("");
}
function renderSys() {
  if (STATE.view !== "sys" || !$("svC")) return;
  const cores = threads(); if (cores.length !== SV.nThr) { SV.nThr = cores.length; buildThr(); }
  const P = pal();
  $("svC").textContent = Math.round(SYS.cpu); $("svG").textContent = Math.round(SYS.gpu); $("svR").textContent = Math.round(SYS.ram);
  $("svThr").textContent = cores.length; $("svCpuN").textContent = (SYS.cpuName || "CPU").toUpperCase(); $("svGpuN").textContent = (SYS.gpuName || "GPU").toUpperCase();
  $("svNote").textContent = SYS.demo ? (IS_WE ? "BRIDGE-OPS-SENSOR REQUIRED · DEMO VALUES" : "DEMO VALUES · NO SYSTEM DATA") : (sensV2() ? "" : (sensFresh() ? "SENSOR < 2.0 · THREADS SIMULATED" : "SENSOR OFF · THREADS SIMULATED"));
  $("svTT").textContent = sensV2() ? "BRIDGE-OPS-SENSOR " + SENS.data.ver : "SIMULATED";
  const sd = sensFresh() ? SENS.data : null, vr = sd && sd.vram;
  $("svGL").textContent = Math.round(SYS.gpu) + "%"; $("svGT").textContent = sd && sd.gpuTemp != null ? Math.round(sd.gpuTemp) + "°" : "--°";
  // Threads
  cores.forEach((c, i) => {
    const v = $("thV" + i); if (!v) return; v.textContent = c.u == null ? "--" : Math.round(c.u);
    v.style.color = c.u > 85 ? "var(--or)" : (c.u > 50 ? "var(--ye)" : "");
    $("thM" + i).textContent = c.mhz ? c.mhz + " MHZ" : "---- MHZ";
    $("thR" + i).innerHTML = dotRing(9, 12, (c.u || 0) / 100, c.u > 85 ? "var(--or)" : "var(--tx)", { dot: 1.3 });
    const cv = $("thC" + i), f = cv && fitCanvas(cv); if (f) { const h = THR.hist[i] || []; f.x.strokeStyle = P.ln; f.x.strokeRect(.5, .5, f.W - 1, f.H - 1); spark(f.x, h, 1, 2, f.W - 2, f.H - 4, P.cy, { max: 100, n: 60, fill: .18 }); spark(f.x, h, 1, 2, f.W - 2, f.H - 4, P.cy, { max: 100, n: 60 }); }
  });
  // Speicher
  const bars = (p, cls) => { let s = ""; for (let i = 0; i < 24; i++) s += `<i class="${i < Math.round(p / 100 * 24) ? (p > 90 ? "hot" : (i > 17 ? "hi" : "on")) : ""}"></i>`; return `<div class="b">${s}</div>`; };
  let fu = `${bars(SYS.ram)}<div class="n">RAM <b>${Math.round(SYS.ram)}%</b><br>${nf(SYS.ramTot * SYS.ram / 100 / GiB, 1)}/${nf(SYS.ramTot / GiB, 0)}G</div>`;
  if (vr && vr.total) fu += `${bars(vr.used / vr.total * 100)}<div class="n">VRAM <b>${Math.round(vr.used / vr.total * 100)}%</b><br>${nf(vr.used / GiB, 1)}/${nf(vr.total / GiB, 0)}G</div>`;
  (sd && sd.disks || []).slice(0, 4).forEach(d => { const p = d.total ? (d.total - d.free) / d.total * 100 : 0; fu += `${bars(p)}<div class="n">${esc(d.d)} <b>${Math.round(p)}%</b><br>${nf((d.total - d.free) / GiB, 0)}/${nf(d.total / GiB, 0)}G</div>`; });
  $("svFuel").innerHTML = fu;
  // Prozesse
  const pr = sd && sd.procs || [];
  $("svProc").innerHTML = pr.length ? pr.slice(0, 8).map(p => `<div class="r"><span style="text-align:left;color:var(--tx)">${esc(p.name).toUpperCase().slice(0, 22)}</span><b>${nf(p.cpu, 1)}</b><span>${nf(p.mem / 1048576, 0)} MB</span></div>`).join("")
    : `<div class="micro" style="padding:6px 0">PROCESS LIST NEEDS BRIDGE-OPS-SENSOR 2.0</div>`;
  // Laufwerke unten
  const ds = sd && sd.disks || [];
  $("svDrv").innerHTML = (ds.length ? ds.slice(0, 10) : [{ d: "C:", off: 1 }, { d: "D:", off: 1 }, { d: "E:", off: 1 }]).map(d => d.off ? `<div class="d off"><div class="t"><span>DRIVE IDENT</span><i></i></div><b>${d.d.replace(":", "")}</b><div class="io">NO SENSOR</div></div>`
    : `<div class="d"><div class="t"><span>DRIVE IDENT · ${esc(d.fs || "")}</span>${d.busy > 5 ? "<i></i>" : ""}</div><b>${esc(d.d.replace(":", ""))}<span style="font-size:12px;color:var(--dim)"> ${d.busy != null ? Math.round(d.busy) + "%" : ""}</span></b>
      <div class="u"><i style="width:${d.total ? (d.total - d.free) / d.total * 100 : 0}%"></i></div><div class="io">▼ ${nf(d.read / 1048576, 1)} ▲ ${nf(d.write / 1048576, 1)} MB/S</div></div>`).join("");
  drawHist(); drawMatrix(cores); drawPos(sd); drawGpu(sd); drawGpuHist();
}
BUS.on("sys", renderSys);
function drawHist() {
  const c = $("cHist"), f = c && fitCanvas(c); if (!f) return; const { x, W, H } = f, P = pal(), k = SV.metric;
  const arr = k === "net" ? SYS.hist.down : SYS.hist[k], n = 90, bw = W / n, sl = arr.slice(-n * 6);
  const vals = []; for (let i = 0; i < n; i++) { const seg = sl.slice(i * 6, i * 6 + 6); vals.push(seg.length ? Math.max(...seg) : 0); }
  const max = k === "net" ? Math.max(1, ...vals) * 1.1 : 100;
  vals.forEach((v, i) => { const h = Math.max(1, v / max * (H - 4)); x.fillStyle = i % 9 === 4 ? P.ye : (i % 3 ? P.cy2 : P.cy); x.globalAlpha = .9; x.fillRect(i * bw + 1, H - h, bw - 2.5, h); });
  x.globalAlpha = 1;
  $("svHN").textContent = { cpu: "CPU USAGE", gpu: "GPU USAGE", ram: "RAM USAGE", net: "NETWORK DL" }[k] + " · 10 MIN";
  $("svHV").textContent = k === "net" ? "PEAK " + fmtRate(Math.max(...arr, 0)) : "AVG " + nf(arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length), 0) + "%";
}
function drawGpuHist() {
  const c = $("cGpuH"), f = c && fitCanvas(c); if (!f) return; const { x, W, H } = f, P = pal();
  x.strokeStyle = P.ln; x.lineWidth = 1; x.font = "8px Oxanium"; x.fillStyle = P.dim;
  for (let i = 0; i <= 4; i++) { const y = Math.round(2 + (H - 6) * i / 4) + .5; x.beginPath(); x.moveTo(26, y); x.lineTo(W, y); x.stroke(); x.fillText(String(100 - i * 25), 2, y + 3); }
  for (let i = 1; i < 10; i++) { const xx = Math.round(26 + (W - 26) * i / 10) + .5; x.strokeStyle = hexA(P.ln, .5); x.beginPath(); x.moveTo(xx, 2); x.lineTo(xx, H - 4); x.stroke(); }
  x.save(); x.translate(26, 0); const Wd = W - 26;
  const o = { max: 100, n: HN };
  spark(x, SYS.hist.gpu, 0, 2, Wd, H - 6, P.or, Object.assign({ fill: .15 }, o)); spark(x, SYS.hist.gpu, 0, 2, Wd, H - 6, P.or, Object.assign({ lw: 1.8 }, o));
  spark(x, SYS.hist.gpuT, 0, 2, Wd, H - 6, P.ye, Object.assign({ lw: 1.6 }, o));
  spark(x, SYS.hist.vram, 0, 2, Wd, H - 6, P.cy, Object.assign({ lw: 1.6 }, o)); x.restore();
  const last = a => a.length ? a[a.length - 1] : null, gt = last(SYS.hist.gpuT), vr = last(SYS.hist.vram);
  x.font = "13px Oxanium"; x.textAlign = "right";
  x.fillStyle = P.or; x.fillText(`LOAD ${Math.round(SYS.gpu)} %`, W - 4, 16);
  x.fillStyle = P.ye; x.fillText(gt ? `${Math.round(gt)} °C` : "-- °C", W - 100, 16);
  x.fillStyle = P.cy; x.fillText(vr ? `VRAM ${Math.round(vr)} %` : "VRAM --", W - 166, 16); x.textAlign = "left";
}
function drawMatrix(cores) {
  const c = $("cMat"), f = c && fitCanvas(c); if (!f) return; const { x, W, H } = f, P = pal();
  const n = cores.length, cols = 30, rows = Math.max(1, n), ch = H / Math.min(rows, 16), cw = W / cols;
  for (let r = 0; r < Math.min(rows, 16); r++) { const h = THR.hist[r] || []; for (let k = 0; k < cols; k++) { const v = h[h.length - cols + k] || 0;
    x.fillStyle = v > 85 ? P.or : v > 50 ? P.ye : v > 15 ? P.cy : P.ln; x.fillRect(k * cw + cw / 2 - 1.2, r * ch + ch / 2 - 1.2, 2.4, 2.4); } }
}
function drawPos(sd) {
  // Zwei Rundinstrumente 0–100 °C (270°-Skala): außen CPU, innen GPU
  const c = $("cPos"), f = c && fitCanvas(c); if (!f) return; const { x, W, H } = f, P = pal();
  const cx = W * .5, cy = (H - 12) * .54, R = Math.min(W * .3, (H - 14) * .36), a0 = Math.PI * .75, sw = Math.PI * 1.5;
  const cpu = sd && sd.cpuTemp, gpu = sd && sd.gpuTemp, cx2 = sd && sd.cpuX;
  const col = v => v >= 85 ? P.or : v >= 70 ? P.ye : null;
  const gauge = (r, v, base, lbl) => {
    x.lineWidth = 6; x.strokeStyle = hexA(P.ln2, .6); x.beginPath(); x.arc(cx, cy, r, a0, a0 + sw); x.stroke();
    x.lineWidth = 1; x.strokeStyle = hexA(P.or, .5); x.beginPath(); x.arc(cx, cy, r + 5, a0 + sw * .85, a0 + sw); x.stroke();   // Bereich > 85 °C
    if (v != null) { const k = clamp(v / 100, 0, 1); x.lineWidth = 6; x.strokeStyle = col(v) || base; x.beginPath(); x.arc(cx, cy, r, a0, a0 + sw * k); x.stroke(); }
  };
  // Skala
  x.strokeStyle = P.ln2; x.lineWidth = 1; x.font = "8px Oxanium"; x.fillStyle = P.dim; x.textAlign = "center";
  for (let t = 0; t <= 100; t += 10) { const a = a0 + sw * t / 100, l = t % 50 ? 4 : 8;
    x.beginPath(); x.moveTo(cx + (R + 9) * Math.cos(a), cy + (R + 9) * Math.sin(a)); x.lineTo(cx + (R + 9 + l) * Math.cos(a), cy + (R + 9 + l) * Math.sin(a)); x.stroke();
    if (t === 0 || t === 100) x.fillText(String(t), cx + (R + 24) * Math.cos(a), cy + (R + 24) * Math.sin(a) + 3); }
  gauge(R, cpu, P.tx, "CPU"); gauge(R * .74, gpu, P.ye, "GPU");
  // Mitte: Werte
  x.textAlign = "center"; x.font = `${Math.round(R * .3)}px Oxanium`; x.fillStyle = cpu == null ? P.dim : (col(cpu) || P.tx);
  x.fillText(cpu == null ? "--" : nf(cpu, 0) + "°", cx, cy - R * .02);
  x.font = `${Math.round(R * .19)}px Oxanium`; x.fillStyle = gpu == null ? P.dim : (col(gpu) || P.ye); x.fillText(gpu == null ? "GPU --" : "GPU " + nf(gpu, 0) + "°", cx, cy + R * .26);
  x.font = "8px Oxanium"; x.fillStyle = P.dim; x.fillText("CPU °C", cx, cy - R * .34);
  // Legende links oben, Leistung/Takt rechts oben
  x.textAlign = "left"; x.font = "9px Oxanium"; x.lineWidth = 3;
  [["CPU · OUTER RING", P.tx, cpu], ["GPU · INNER RING", P.ye, gpu]].forEach(([t, cl, v], i) => { const y = 10 + i * 13; x.strokeStyle = cl; x.globalAlpha = v == null ? .4 : 1;
    x.beginPath(); x.moveTo(2, y - 3); x.lineTo(14, y - 3); x.stroke(); x.fillStyle = P.dim; x.fillText(t, 18, y); x.globalAlpha = 1; });
  x.fillStyle = hexA(P.or, .8); x.fillText("━ > 85 °C", 2, 36);
  if (cx2) { x.textAlign = "right"; x.fillStyle = P.dim; if (cx2.power != null) x.fillText("PKG " + nf(cx2.power, 0) + " W", W - 2, 10); if (cx2.clkMax) x.fillText("MAX " + cx2.clkMax + " MHZ", W - 2, 23); }
  x.textAlign = "center";
  x.fillText(sd && sd.cpuTempSrc === "lhm" ? "CPU = LIBREHARDWAREMONITOR · PAWNIO" : sd && sd.cpuTempSrc === "acpi" ? "CPU = ACPI THERMAL ZONE" : (sd && sd.ext && sd.ext.on ? "CPU: " + String(sd.ext.msg || "").toUpperCase() : "CPU TEMP: SENSOR EXTENDED MODE"), cx, H - 3); x.textAlign = "left";
}
/* GPU als Drahtgitter (eigene Strichgrafik einer Grafikkarte) */
function drawGpu(sd) {
  const c = $("cGpu"), f = c && fitCanvas(c); if (!f) return; const { x, W, H } = f, P = pal(), t = performance.now();
  const s = Math.min(W / 420, H / 260), ox = W / 2, oy = H / 2;
  const iso = (X, Y, Z) => [ox + (X - Y) * .87 * s, oy + ((X + Y) * .5 - Z) * s];
  const line = (pts, col, lw = 1) => { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); pts.forEach((p, i) => { const q = iso(...p); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.stroke(); };
  const box = (x0, y0, z0, w, d, h, col) => { const a = [[x0, y0, z0], [x0 + w, y0, z0], [x0 + w, y0 + d, z0], [x0, y0 + d, z0]], b = a.map(p => [p[0], p[1], p[2] + h]);
    line([...a, a[0]], col); line([...b, b[0]], col); a.forEach((p, i) => line([p, b[i]], col)); };
  box(-150, -60, 0, 300, 120, 8, hexA(P.cy, .9));                // Platine
  box(-140, -55, 8, 280, 110, 40, hexA(P.cy, .45));             // Kühler
  for (let i = 0; i < 14; i++) line([[-140 + i * 20, -55, 48], [-140 + i * 20, 55, 48]], hexA(P.cy, .25));
  // Lüfter (3) drehen mit der GPU-Last
  const rot = CFG.anim ? t / 1000 * (0.5 + SYS.gpu / 25) : 0;
  [-95, 0, 95].forEach(fx => {
    const pts = []; for (let k = 0; k <= 36; k++) { const a = k / 36 * Math.PI * 2; pts.push([fx + 38 * Math.cos(a), 38 * Math.sin(a), 49]); } line(pts, P.tx, 1.2);
    for (let b = 0; b < 7; b++) { const a = rot + b / 7 * Math.PI * 2; line([[fx + 8 * Math.cos(a), 8 * Math.sin(a), 49], [fx + 34 * Math.cos(a + .5), 34 * Math.sin(a + .5), 49]], hexA(P.tx, .7)); }
    const ring = []; for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2; ring.push([fx + 8 * Math.cos(a), 8 * Math.sin(a), 49]); } line(ring, P.or, 1.5);
  });
  line([[150, -60, 4], [170, -60, 4], [170, 60, 4], [150, 60, 4]], hexA(P.cy, .6));   // Slotblech
  // Beschriftungen mit Linien
  const lab = (p, dx, dy, txt) => { const q = iso(...p); const k = Math.min(1, s * 1.5); dx *= k; dy *= k; x.strokeStyle = P.ln2; x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(q[0] + dx, q[1] + dy); x.lineTo(q[0] + dx + (dx > 0 ? 30 : -30), q[1] + dy); x.stroke();
    x.fillStyle = P.dim; x.font = "9px Oxanium"; x.textAlign = dx > 0 ? "left" : "right"; x.fillText(txt, q[0] + dx + (dx > 0 ? 34 : -34), q[1] + dy + 3); x.textAlign = "left"; };
  lab([95, 0, 49], 50, -60, `LOAD ${Math.round(SYS.gpu)} %`);
  lab([-95, 0, 49], -50, -50, sd && sd.gpuTemp != null ? `TEMP ${nf(sd.gpuTemp, 0)} °C` : "TEMP --");
  lab([0, 55, 8], 40, 50, sd && sd.vram ? `VRAM ${nf(sd.vram.used / GiB, 1)} / ${nf(sd.vram.total / GiB, 0)} GB` : "VRAM --");
}

/* ================== WETTER / METAR ================== */
const WV = { sel: 0, fc: LS.get("lto-fc", "48h") };
function buildWx() {
  const v = $("vWx");
  v.innerHTML = `<div class="wv"><div class="l">
      <div class="hd"><div class="r1"><span>METAR</span><span class="sep"></span><span>STN<sup class="dim">3</sup></span><span class="box" style="height:22px;font-size:13px;margin-left:auto" id="wvN">--</span></div>
        <div class="row" style="gap:6px"><span class="lbl d" style="font-size:10px">AVIATION WX</span><span class="lbl" style="font-size:10px">STATION LIST</span></div></div>
      <div class="hd"><div class="r2"><span class="lbl d" style="font-size:10px;line-height:12px">REPORTING<br>QNH HOME</span><b id="wvQ">----</b><span class="lbl d" style="font-size:10px;line-height:12px">VIS<br>KM</span><b id="wvV">--</b></div></div>
      <div class="stl" id="wvList"></div>
      <div class="rawb" id="wvRaw"></div>
      <div class="h2 dh"><span>SURFACE WIND</span><small>12 H TRACK</small></div>
      <div class="dia"><canvas id="cDia"></canvas></div>
    </div>
    <div class="r"><div class="cols" id="wvCols"></div>
      <div class="fch"><span id="wvFt">FORECAST · ${esc(String(CFG.name || "").toUpperCase())}</span><div class="tabs"><span class="tag ${WV.fc === "48h" ? "or" : ""}" data-fc="48h">48 H</span><span class="tag ${WV.fc === "7d" ? "or" : ""}" data-fc="7d">7 DAYS</span></div></div>
      <div class="fc"><canvas id="cFc"></canvas></div></div></div>`;
  v.querySelectorAll("[data-fc]").forEach(t => t.addEventListener("click", () => { WV.fc = t.dataset.fc; LS.set("lto-fc", WV.fc); buildWx(); }));
  renderWx();
}
function renderWx() {
  if (STATE.view !== "wx" || !$("wvCols")) return;
  const st = MET.st, P = pal();
  $("wvN").textContent = st.length || "--";
  if (WX.d) { $("wvQ").textContent = nf(WX.d.current.pressure_msl, 0); $("wvV").textContent = nf((WX.d.current.visibility || 0) / 1000, 0); }
  $("wvList").innerHTML = st.length ? st.slice(0, 12).map((s, i) => { const m = s.m; const b = (v, mx, col) => `<i style="height:${clamp(v / mx, .08, 1) * 100}%;background:${col}"></i>`;
    return `<div class="st ${i < 3 ? "on" : ""}" data-i="${i}" title="${esc(s.raw)}"><span><span class="dotc" style="background:${CATCOL[m.cat] || "var(--ln2)"}"></span>${s.ic}</span>
      <span class="micro" style="font-size:8px">${esc(s.name).slice(0, 16)}<br>${nf(U.dist(s.d), 0)} ${U.distU()} · ${m.wspd != null ? pad(m.wspd, 2) + "KT" : "--"} · ${m.temp != null ? m.temp + "°" : "--"}</span>
      <span class="bars">${b(m.wspd || 0, 40, "var(--cy)")}${b((m.vis || 0), 10000, "var(--tx)")}${b(m.ceil == null ? 5000 : m.ceil, 5000, "var(--ye)")}${b((m.temp || 0) + 20, 50, "var(--or)")}</span></div>`; }).join("")
    : `<div class="micro" style="padding:8px 0">${hasLoc() ? "NO METAR STATIONS IN 300 KM" : "SET LOCATION FIRST"}</div>`;
  $("wvList").querySelectorAll(".st").forEach(el => el.addEventListener("click", () => { const i = +el.dataset.i; const s = MET.st.splice(i, 1)[0]; MET.st.unshift(s); renderWx(); }));
  const sel = st[0];
  $("wvRaw").innerHTML = sel ? `<div class="t"><span>RAW · <b>${sel.ic}</b></span><span>${esc(String(sel.name || "").toUpperCase()).slice(0, 18)}</span></div>
    <div class="k">METAR</div><div class="m">${esc(sel.raw || "--")}</div>
    <div class="k">TAF</div><div class="m">${sel.taf ? esc(sel.taf).replace(/\s(?=(BECMG|TEMPO|FM\d{6}|PROB\d{2})\b)/g, "<br>") : "NO TAF"}</div>` : "";
  const show = st.slice(0, STATE.mainW < 1100 ? 2 : 3);
  $("wvCols").style.setProperty("--n", Math.max(1, show.length));
  $("wvCols").style.setProperty("--k", clamp(($("wvCols").clientHeight || 900) / 950, .85, 1.5).toFixed(3));
  $("wvCols").innerHTML = show.length ? show.map((s, i) => { const m = s.m;
    const rh = m.temp != null && m.dew != null ? Math.round(100 * Math.exp(17.625 * m.dew / (243.04 + m.dew)) / Math.exp(17.625 * m.temp / (243.04 + m.temp))) : null;
    return `<div class="sc"><div class="h"><span class="s">S${i + 1}</span><span><small>ICAO<br>CODE</small> <span class="ic">${s.ic}</span></span><span><small>DIST<br>${U.distU()}</small> <span class="km">${nf(U.dist(s.d), 0)}</span></span></div>
      <div class="fw" id="fw${i}"><svg class="fun" viewBox="-190 -8 380 178" id="fun${i}"></svg>
      <div class="rings"><svg viewBox="-28 -28 56 56" id="rgA${i}"></svg><svg viewBox="-28 -28 56 56" id="rgB${i}"></svg></div></div>
      <div class="mid"><div class="kv"><span>TEMP</span><b>${m.temp != null ? m.temp + "°" : "--"}</b><span>DEWPT</span><b class="orange">${m.dew != null ? m.dew + "°" : "--"}</b><span>SPREAD</span><b>${m.temp != null && m.dew != null ? m.temp - m.dew : "--"}</b><span>CAT</span><b style="color:${CATCOL[m.cat] || "var(--tx)"}">${m.cat || "--"}</b></div>
        <div class="col"><canvas class="own" id="tdC${i}"></canvas></div>
        <div class="kv rt"><b>${m.qnh ? Math.round(m.qnh) : "--"}</b><span>QNH</span><b>${m.wspd != null ? m.wspd + (m.wgust ? "G" + m.wgust : "") : "--"}</b><span>KT</span><b class="${m.wgust ? "orange" : ""}">${m.wdir != null ? pad(m.wdir, 3) : (m.wspd ? "VRB" : "--")}</b><span>DIR</span><b>${m.vis != null ? (m.vis >= 9999 ? "10+" : nf(m.vis / 1000, 1)) : "--"}</b><span>VIS KM</span></div></div>
      <div class="clct"><span>RH</span><span class="orange">${rh != null ? rh + "%" : "--"}</span></div>
      <div class="dec">${decodeWx(m)}</div>
      <div class="taf"><canvas id="taf${i}"></canvas></div>
      <div class="raw">${esc(s.raw)}</div></div>`; }).join("")
    : `<div class="empty">NO METAR<small>${hasLoc() ? "No reporting stations found or METAR source unreachable." : "Open ⚙ setup and choose a location."}</small></div>`;
  show.forEach((s, i) => drawStation(s, i));
  drawFc(); drawDia();
}
BUS.on("metar", renderWx); BUS.on("wx", () => { if (STATE.view === "wx") renderWx(); });
function drawStation(s, i) {
  const m = s.m, P = pal();
  // Trichter = Wolkenschichten mit Höhenskala (0 … 8000 FT); Höhe passt sich der Box an
  const fb = $("fw" + i), ar = fb && fb.clientWidth ? fb.clientHeight / fb.clientWidth : .47;
  const VH = clamp(Math.round(380 * ar), 178, 640), B = VH - 18, A = Math.round(B * .625);
  $("fun" + i).setAttribute("viewBox", `-190 -8 380 ${VH}`);
  const TOP = 8000, Y = h => B - clamp(h / TOP, 0, 1) * (B - 6);
  const hw = y => y <= A ? 160 - y * 24 / A : 136 - (y - A) * 76 / (B - A);
  let g = `<path d="M-160,0 H160 L136,${A} L60,${B} H-60 L-136,${A} Z" fill="var(--bg3)" stroke="var(--cy)" stroke-width="2"/><path d="M-136,${A} H136 M0,0 V${B}" stroke="var(--ln2)" stroke-width="1"/>`;
  for (let h = 0; h <= TOP; h += 1000) { const y = Y(h); g += `<path d="M-188,${y} h${h % 2000 ? 5 : 10}" stroke="var(--ln2)"/>` + (h % 2000 ? "" : `<text x="-174" y="${y + 3}" font-size="8" fill="var(--dim)">${h ? h / 100 : "SFC"}</text>`); }
  const layers = m.cavok ? [] : m.clouds;
  layers.slice(0, 4).forEach(cl => { const y = Y(cl.h == null ? 0 : cl.h), w = hw(y);
    const cov = { FEW: .25, SCT: .5, BKN: .78, OVC: 1, VV: 1 }[cl.c] || .3; const ww = (w - 26) * cov;
    g += `<rect x="${-ww}" y="${y - 3.5}" width="${ww * 2}" height="7" fill="${cl.t === "CB" || cl.t === "TCU" ? "var(--or)" : "var(--tx)"}" opacity=".85"/>
      <text x="${w - 8}" y="${y - 6}" font-size="9" fill="var(--dim)" text-anchor="end">${cl.c}${cl.h != null ? pad(cl.h / 100, 3) : ""}${cl.t || ""}</text>`; });
  if (m.ceil != null) { const y = Y(m.ceil); g += `<path d="M0,${y - 10} L13,${y} L0,${y + 10} L-13,${y} Z" fill="var(--or)"/>`; }
  else { const yc = B * .48; g += `<path d="M0,${yc - 16} L20,${yc} L0,${yc + 16} L-20,${yc} Z" fill="none" stroke="var(--or)" stroke-width="2"/><text x="0" y="${yc + 4}" font-size="9" fill="var(--or)" text-anchor="middle">${m.cavok ? "OK" : "NSC"}</text>`; }
  $("fun" + i).innerHTML = g;
  // Ringe: Wind-Richtung und Stärke
  const dirDot = m.wdir == null ? null : Math.round(m.wdir / 360 * 24) % 24;
  $("rgA" + i).innerHTML = dotRing(20, 24, 0, "var(--tx)", { dot: 1.6, mark: dirDot, off: "var(--tx)" }) + `<path d="${arcPath(25, 200, 340)}" fill="none" stroke="var(--cy)" stroke-width="1.5"/><text y="3" font-size="9" fill="var(--tx)" text-anchor="middle">${m.wdir != null ? pad(m.wdir, 3) : "VRB"}</text>`;
  $("rgB" + i).innerHTML = dotRing(20, 24, clamp((m.wspd || 0) / 40, 0, 1), "var(--ye)", { dot: 1.6, mark: m.wgust ? Math.min(23, Math.round(m.wgust / 40 * 24)) : null }) + `<path d="${arcPath(25, 20, 160)}" fill="none" stroke="var(--cy)" stroke-width="1.5"/><text y="3" font-size="9" fill="var(--tx)" text-anchor="middle">${m.wspd ?? "--"}</text>`;
  // Säule Temperatur / Taupunkt
  const c = $("tdC" + i), f = c && fitCanvas(c);
  if (f) { const { x, W, H } = f, seg = 16, sh = (H - 4) / seg;
    for (let k = 0; k < seg; k++) { const tv = 35 - k * 55 / seg, y = 2 + k * sh;
      const tOn = m.temp != null && m.temp >= tv, dOn = m.dew != null && m.dew >= tv;
      x.fillStyle = k < 2 ? P.or : (tOn ? (k < 7 ? P.ye : P.tx) : P.ln); x.fillRect(2, y, W / 2 - 4, sh - 2);
      x.fillStyle = dOn ? P.cy : P.ln; x.fillRect(W / 2 + 1, y, W / 2 - 4, sh - 2);
      for (let l = 1; l < 6; l++) { x.fillStyle = P.bg; x.fillRect(2, y + l * (sh - 2) / 6, W - 4, .7); } }
  }
  // TAF-Raster: Stunden × Kategorie
  const tc = $("taf" + i), tf = tc && fitCanvas(tc);
  if (tf) { const { x, W, H } = tf, tl = s.tl, hrs = 24, cw = W / hrs, rows = 4, rh = H / (rows + 1);
    x.strokeStyle = P.ln2; x.lineWidth = 1;
    for (let r = 0; r <= rows; r++) { x.beginPath(); x.moveTo(0, r * rh + .5); x.lineTo(W, r * rh + .5); x.stroke(); }
    for (let k = 0; k <= hrs; k += 3) { x.beginPath(); x.moveTo(k * cw + .5, 0); x.lineTo(k * cw + .5, rows * rh); x.stroke(); }
    const now = Date.now(), cats = ["VFR", "MVFR", "IFR", "LIFR"];
    if (tl) { for (let k = 0; k < hrs; k++) { const t = now + k * 3600e3, b = tl.base.find(q => t >= q[0] && t < q[1]), o = tl.over.find(q => t >= q[0] && t < q[1]);
        if (b && b[2]) { const r = cats.indexOf(b[2]); x.fillStyle = hexA(CATCOL[b[2]], .5); x.fillRect(k * cw + 1, r * rh + 1, cw - 2, rh - 2); }
        if (o && o[2]) { const r = cats.indexOf(o[2]); x.fillStyle = P.or; x.beginPath(); x.arc(k * cw + cw / 2, r * rh + rh / 2, 3, 0, Math.PI * 2); x.fill(); } } }
    x.fillStyle = P.dim; x.font = "8px Oxanium"; cats.forEach((c2, r) => x.fillText(c2, 2, r * rh + rh - 3));
    for (let k = 0; k < hrs; k += 6) { const d = new Date(now + k * 3600e3); x.fillText(pad(d.getUTCHours()) + "Z", k * cw + 2, H - 3); }
    if (!tl) { x.fillStyle = P.dim; x.textAlign = "center"; x.fillText("NO TAF", W / 2, rows * rh / 2); x.textAlign = "left"; }
  }
}
/* Vorhersage-Leiste unten: 48 h stündlich oder 7 Tage */
function drawFc(cv) {
  const c = cv || $("cFc"), f = c && fitCanvas(c); if (!f || !WX.d) return; const { x, W, H } = f, P = pal(), d = WX.d;
  x.font = "9px Oxanium";
  if (WV.fc === "48h") {
    const i0 = hourIdx(), n = 48, bw = W / n, h = d.hourly, T = h.temperature_2m.slice(i0, i0 + n), tmin = Math.min(...T) - 2, tmax = Math.max(...T) + 2;
    for (let k = 0; k < n; k++) { const i = i0 + k, t = h.temperature_2m[i], pp = h.precipitation_probability[i] || 0, w = h.wind_speed_10m[i];
      const y = 18 + (1 - (t - tmin) / (tmax - tmin)) * (H - 60);
      x.fillStyle = P.ln; x.fillRect(k * bw + 1, 18, bw - 2, H - 60);
      x.fillStyle = t < 0 ? P.cy : (t > 20 ? P.or : P.tx); x.fillRect(k * bw + 1, y, bw - 2, H - 42 - y);
      x.fillStyle = hexA(P.cy, .25 + pp / 140); x.fillRect(k * bw + 1, H - 38, bw - 2, pp / 100 * 14);
      x.fillStyle = w > 50 ? P.or : P.ye; x.fillRect(k * bw + 1, H - 20, bw - 2, 2 + Math.min(10, w / 6));
      if (k % 6 === 0) { const dt = new Date(h.time[i]); x.fillStyle = P.dim; x.fillText(pad(dt.getHours()) + "H", k * bw + 2, 10); x.fillStyle = P.tx; x.fillText(nf(t, 0) + "°", k * bw + 2, y - 3); }
    }
    x.fillStyle = P.dim; x.fillText("TEMP", W - 30, 10); x.fillText("RAIN %", 2, H - 40); x.fillText("WIND", 2, H - 22);
  } else {
    const dd = d.daily, i0 = dd.time.findIndex(s => s === new Date().toISOString().slice(0, 10)), s0 = Math.max(0, i0), n = Math.min(7, dd.time.length - s0), cw = W / n;
    for (let k = 0; k < n; k++) { const i = s0 + k, dt = new Date(dd.time[i] + "T12:00"), X = k * cw;
      x.strokeStyle = P.ln2; x.strokeRect(X + 3.5, 3.5, cw - 7, H - 7);
      x.fillStyle = k ? P.tx : P.or; x.font = "12px Oxanium"; x.fillText(WD[dt.getDay()] + " " + pad(dt.getDate()), X + 10, 18);
      x.font = "22px Oxanium"; x.fillStyle = P.tx; x.fillText(nf(dd.temperature_2m_max[i], 0) + "°", X + 10, 46); x.fillStyle = P.dim; x.font = "14px Oxanium"; x.fillText(nf(dd.temperature_2m_min[i], 0) + "°", X + 58, 46);
      x.font = "9px Oxanium"; x.fillStyle = P.cy; x.fillText(`RAIN ${dd.precipitation_probability_max[i] ?? "--"}% · ${nf(dd.precipitation_sum[i], 1)} MM`, X + 10, 66);
      x.fillStyle = P.ye; x.fillText(`WIND ${nf(U.wind(dd.wind_speed_10m_max[i]), 0)} G${nf(U.wind(dd.wind_gusts_10m_max[i]), 0)} ${U.windU()} ${dir16(dd.wind_direction_10m_dominant[i])}`, X + 10, 80);
      x.fillStyle = P.dim; x.fillText((WMO[dd.weather_code[i]] || "").slice(0, 18), X + 10, 94);
      // Punkt-Raster wie im Original: Regenwahrscheinlichkeit
      const pp = dd.precipitation_probability_max[i] || 0; for (let r = 0; r < 2; r++) for (let q = 0; q < 10; q++) { x.fillStyle = (r * 10 + q) < pp / 5 ? P.or : P.ln2; x.fillRect(X + 10 + q * 7, 104 + r * 7, 3, 3); }
    }
  }
}
/* Raute links: Wind am Ort als Richtungsraute */
function drawDia() {
  const c = $("cDia"), f = c && fitCanvas(c); if (!f || !WX.d) return; const { x, W, H } = f, P = pal(), cw = WX.d.current;
  const cx = W / 2, cy = (H - 16) / 2 + 4, R = Math.min(W / 2 - 16, (H - 30) / 2 / .62), q = .62, MAXW = 60;
  const at = (deg, r) => { const a = deg * RAD; return [cx + Math.sin(a) * r, cy - Math.cos(a) * r * q]; };
  const pts = s => [[cx - R * s, cy], [cx, cy - R * q * s], [cx + R * s, cy], [cx, cy + R * q * s]];
  [1, .72, .45].forEach((s, k) => { x.strokeStyle = k ? P.cy2 : P.cy; x.lineWidth = 1.2; x.beginPath(); pts(s).forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.stroke(); });
  // Skala: Ringe = 20 / 40 / 60 km/h bzw. umgerechnet
  x.font = "8px Oxanium"; x.fillStyle = P.dim; x.textAlign = "left";
  [.45, .72, 1].forEach(s => x.fillText(nf(U.wind(MAXW * s), 0), cx + R * s + 3, cy - 2));
  x.fillStyle = P.tx; x.font = "10px Oxanium"; x.textAlign = "center";
  [["N", 0], ["E", 90], ["S", 180], ["W", 270]].forEach(([t, d]) => { const p = at(d, R + 9); x.fillText(t, p[0], p[1] + 4); });
  // Verlauf der letzten 12 Stunden (älter = blasser)
  const h = WX.d.hourly, i0 = hourIdx(), tr = [];
  for (let k = 12; k >= 1; k--) { const j = i0 - k; if (j >= 0 && h.wind_direction_10m[j] != null) tr.push([h.wind_direction_10m[j], h.wind_speed_10m[j], k]); }
  const pos = (d, v) => at(d, R * clamp(v / MAXW, .06, 1));
  x.strokeStyle = hexA(P.ye, .35); x.lineWidth = 1; x.beginPath(); tr.forEach(([d, v], n) => { const p = pos(d, v); n ? x.lineTo(...p) : x.moveTo(...p); }); x.stroke();
  tr.forEach(([d, v, k]) => { const p = pos(d, v); x.fillStyle = hexA(P.ye, .25 + .6 * (1 - k / 12)); x.beginPath(); x.arc(p[0], p[1], 2.4, 0, Math.PI * 2); x.fill(); });
  // aktueller Wind
  const e = pos(cw.wind_direction_10m, cw.wind_speed_10m), g = pos(cw.wind_direction_10m, cw.wind_gusts_10m);
  x.strokeStyle = hexA(P.or, .5); x.setLineDash([3, 3]); x.beginPath(); x.moveTo(...e); x.lineTo(...g); x.stroke(); x.setLineDash([]);
  x.strokeStyle = P.or; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(...e); x.stroke();
  x.fillStyle = P.or; x.beginPath(); x.arc(e[0], e[1], 3.5, 0, Math.PI * 2); x.fill();
  x.fillStyle = P.tx; x.font = "11px Oxanium";
  x.fillText(`${pad(Math.round(cw.wind_direction_10m), 3)}° · ${nf(U.wind(cw.wind_speed_10m), 0)} ${U.windU()} · G${nf(U.wind(cw.wind_gusts_10m), 0)}`, cx, Math.min(H - 2, cy + R * q + 30)); x.textAlign = "left";
}

/* ================== FLÜGE ================== */
function renderFlt(target) {
  const v = target || $("vFlt"); if (!target && STATE.view !== "flt") return; const ps = planes();
  const cl = phase;
  v.innerHTML = `<div class="fv"><div class="hd"><div><small>TRAFFIC</small><br><b>${pad(ps.length, 3)}</b></div><div><small>CLIMB</small><br><b class="cyan">${ps.filter(p => cl(p) === "climb").length}</b></div>
      <div><small>CRUISE</small><br><b>${ps.filter(p => cl(p) === "cruise").length}</b></div><div><small>DESCENT</small><br><b class="orange">${ps.filter(p => cl(p) === "desc").length}</b></div>
      <div style="margin-left:auto"><small>RANGE</small><br><b>${nf(U.dist(CFG.range), 0)} ${U.distU()}</b></div></div>
    <div class="grid">${ps.length ? ps.slice(0, 60).map(p => `<div class="fl ${p.hex === AIR.sel ? "on" : ""}" data-h="${p.hex}"><div class="t"><span>${esc(p.type || "----")} · ${esc(p.reg || p.hex.toUpperCase())}</span><span>${nf(U.dist(p.d), 0)} ${U.distU()}</span></div>
      <div class="cs">${esc(p.call)}</div><svg viewBox="-20 -20 40 40">${dotRing(16, 20, 0, "var(--ln2)", { dot: 1.2 })}<g transform="rotate(${p.trk})"><path d="M0,-11 L7,8 L0,4 L-7,8 Z" fill="${p.ground ? "var(--dim)" : altCol(p.alt)}"/></g></svg>
      <div class="kv"><span>ALT <b>${p.ground ? "GND" : (p.alt >= 6000 ? "FL" + pad(Math.round(p.alt / 100), 3) : nf(U.alt(p.alt), 0) + U.altU())}</b></span><span>GS <b>${nf(U.spd(p.gs), 0)}</b></span><span>VS <b class="${cl(p) === "climb" ? "cyan" : cl(p) === "desc" ? "orange" : ""}">${p.rate == null ? "--" : Math.round(p.rate)}</b></span></div></div>`).join("")
      : `<div class="empty">${CFG.adsbProxy ? (AIR.ok ? "NO TRAFFIC IN RANGE" : "NO ADS-B DATA") : "ADS-B PROXY NOT SET"}<small>${CFG.adsbProxy ? "" : "The flight radar needs your own adsb.php proxy (see PROXY-HOSTING.txt). Open ⚙ setup to enter the URL."}</small></div>`}</div></div>`;
  v.querySelectorAll("[data-h]").forEach(el => el.addEventListener("click", () => { selectPlane(el.dataset.h === AIR.sel ? null : el.dataset.h); }));
}
BUS.on("air", () => { renderFlt(); if (STATE.dock === "flt") renderDock(); });

/* aktuelles Wetter einer METAR-Meldung im Klartext */
function metarWmo(m) {
  const w = (m.wx || []).join(" ");
  if (/TS/.test(w)) return 95; if (/SN|SG|PL/.test(w)) return /SH/.test(w) ? 85 : 73; if (/SHRA/.test(w)) return 80;
  if (/\+RA/.test(w)) return 65; if (/RA/.test(w)) return /-RA/.test(w) ? 61 : 63; if (/DZ/.test(w)) return 53; if (/FG|BR/.test(w)) return 45;
  if (m.cavok || m.nsc) return 0; const c = (m.clouds || []).map(x => x.c);
  return c.includes("OVC") || c.includes("BKN") ? 3 : (c.length ? 2 : 1);
}
function decodeWx(m) {
  const wx = (m.wx || []).map(wxText), cl = m.cavok ? ["CAVOK · NO CLOUD BELOW 5000 FT"] : (m.clouds || []).map(c => `${{ FEW: "FEW", SCT: "SCATTERED", BKN: "BROKEN", OVC: "OVERCAST", VV: "VERT VIS" }[c.c] || c.c} ${c.h != null ? c.h + " FT" : ""}${c.t ? " · " + (c.t === "CB" ? "CUMULONIMBUS" : "TOWERING CU") : ""}`);
  if (!cl.length) cl.push(m.nsc ? "NO SIGNIFICANT CLOUD" : "CLOUD --");
  const day = sunAlt(Date.now(), CFG.lat || 0, CFG.lon || 0) > -2;
  return `<div class="ic">${wxIcon(metarWmo(m), day)}</div><div class="tx"><b>${wx.length ? esc(wx.join(" · ")) : "NO SIGNIFICANT WEATHER"}</b>
    <span>VIS ${m.vis != null ? (m.vis >= 9999 ? "10 KM OR MORE" : U.vis(m.vis)) : "--"}${m.ceil != null ? " · CEILING " + m.ceil + " FT" : ""}</span>${cl.map(c => `<i>${esc(c)}</i>`).join("")}</div>`;
}
