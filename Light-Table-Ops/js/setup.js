/* Light Table Ops · © 2026 E11iot · CC BY-NC-ND 4.0
   setup.js – Einrichtungs-Assistent und Bearbeiten-Modus (Ziehen) */
"use strict";
let SU = null;
function openSetup() {
  SU = { name: CFG.name, lat: CFG.lat, lon: CFG.lon, adsbProxy: CFG.adsbProxy, sensorPort: CFG.sensorPort, units: CFG.units, mapStyle: CFG.mapStyle,
    layout: CFG.layout, stripSide: CFG.stripSide, iconSide: CFG.iconSide, iconCols: CFG.iconCols, range: CFG.range, res: [] };
  $("setup").classList.add("on"); renderSetup();
}
function seg(k, opts) { return `<span class="seg">${opts.map(([v, l]) => `<span data-k="${k}" data-v="${v}" class="${String(SU[k]) === String(v) ? "on" : ""}">${l}</span>`).join("")}</span>`; }
function renderSetup() {
  const el = $("setup");
  el.innerHTML = `<div class="sb"><h2><span class="ic">${ICON.logo}</span>LIGHT TABLE OPS · SETUP</h2><div class="g">
    <div class="k">LOCATION</div><div><div class="r"><input id="suQ" placeholder="SEARCH PLACE …" spellcheck="false"><span class="btn" id="suGo">SEARCH</span></div>
      <div class="hint">${SU.lat == null ? "<span class='bad'>NO LOCATION YET – SEARCH AND PICK ONE</span>" : `CURRENT: <b>${esc(String(SU.name).toUpperCase())}</b> · ${nf(SU.lat, 3)}, ${nf(SU.lon, 3)}`}</div>
      <div class="res" id="suRes">${SU.res.map((r, i) => `<div data-i="${i}">${esc(r.name)} <span class="dim">${esc(r.admin)} · ${nf(r.lat, 2)}, ${nf(r.lon, 2)}</span></div>`).join("")}</div></div>
    <div class="k">ADS-B PROXY</div><div><div class="r"><input id="suP" value="${esc(SU.adsbProxy)}" placeholder="https://…/adsb.php" spellcheck="false"><span class="btn" id="suPT">TEST</span></div>
      <div class="hint" id="suPR">EMPTY = NO FLIGHT RADAR. HOST adsb.php YOURSELF (SEE PROXY-HOSTING.txt).</div></div>
    <div class="k">SENSOR</div><div><div class="r"><input id="suS" value="${SU.sensorPort}" style="width:120px" spellcheck="false"><span class="btn" id="suST">TEST</span></div>
      <div class="hint" id="suSR">BRIDGE-OPS-SENSOR 2.0 (WINDOWS, OPTIONAL) – THREADS, PROCESSES, DRIVES, TEMPERATURES.</div></div>
    <div class="k">RANGE</div><div class="r">${seg("range", [[50, "50"], [100, "100"], [150, "150"], [180, "180 KM"]])}</div>
    <div class="k">UNITS</div><div>${seg("units", [["avi", "AVIATION · KT FT"], ["met", "METRIC · KM/H M"]])}</div>
    <div class="k">MAP</div><div>${seg("mapStyle", [["vector", "VECTOR DARK"], ["sat", "SATELLITE"]])}<div class="hint">SATELLITE: ESRI WORLD IMAGERY – PRIVATE USE ONLY.</div></div>
    <div class="k">LAYOUT</div><div>${seg("layout", [["full", "FULL"], ["half", "HALF"], ["strip", "STRIP"]])} &nbsp; ${seg("stripSide", [["right", "STRIP RIGHT"], ["left", "LEFT"], ["bottom", "BOTTOM"]])}</div>
    <div class="k">ICONS</div><div>${seg("iconSide", [["left", "LEFT"], ["right", "RIGHT"]])} &nbsp; ${seg("iconCols", [[0, "0"], [1, "1"], [2, "2"], [3, "3"], [4, "4"]])} <span class="dim">COLUMNS</span>
      <div class="hint">FINE-TUNE: ✎ EDIT LAYOUT (DRAG THE HANDLES) OR THE ${HOST} ${IS_WE ? "PROPERTIES" : "SETTINGS"}.</div></div>
    </div>
    <div class="hint" style="margin-top:14px">IF THE KEYBOARD DOES NOT REACH THE WALLPAPER, ENTER PLACE AND PROXY IN THE ${IS_WE ? "WALLPAPER ENGINE PROPERTIES" : "LIVELY SETTINGS (CUSTOMISE)"}.</div>
    <div class="foot"><span class="btn" id="suEd">✎ EDIT LAYOUT</span><span style="flex:1"></span><span class="btn" id="suC">CANCEL</span><span class="btn or" id="suOk">APPLY</span></div></div>`;
  el.querySelectorAll("[data-k]").forEach(s => s.onclick = () => { const k = s.dataset.k; SU[k] = typeof CFG[k] === "number" ? +s.dataset.v : s.dataset.v; keepInputs(); renderSetup(); });
  const search = async () => { const q = $("suQ").value.trim(); if (!q) return; keepInputs(); try { SU.res = await geocode(q); } catch (e) { SU.res = []; } renderSetup(); };
  $("suGo").onclick = search; $("suQ").onkeydown = e => { if (e.key === "Enter") search(); };
  el.querySelectorAll("#suRes [data-i]").forEach(d => d.onclick = () => { const r = SU.res[+d.dataset.i]; Object.assign(SU, { name: r.name, lat: r.lat, lon: r.lon, res: [] }); keepInputs(); renderSetup(); });
  $("suPT").onclick = async () => { const u = $("suP").value.trim(), out = $("suPR"); if (!u) { out.textContent = "EMPTY"; return; } out.textContent = "TESTING …";
    try { const j = await getJSON(`${u}${u.includes("?") ? "&" : "?"}lat=${SU.lat ?? 52.52}&lon=${SU.lon ?? 13.4}&dist=20`); out.innerHTML = Array.isArray(j.ac) ? `<span class="ok">OK · ${j.ac.length} AIRCRAFT · ${esc(j.src || "")}</span>` : "<span class='bad'>UNEXPECTED ANSWER</span>"; }
    catch (e) { out.innerHTML = "<span class='bad'>NO ANSWER (URL / CORS?)</span>"; } };
  $("suST").onclick = async () => { const p = +$("suS").value || 47047, out = $("suSR"); out.textContent = "TESTING …";
    try { const r = await fetch(`http://127.0.0.1:${p}/`, { cache: "no-store" }); if (r.status === 403) { out.innerHTML = (IS_WE ? "<span class='bad'>SENSOR KEY MISSING OR WRONG – TRAY ICON → COPY WALLPAPER ENGINE KEY</span>" : "<span class='bad'>ACCESS DENIED – UPDATE LIVELY</span>"); return; }
      const j = await r.json(); out.innerHTML = `<span class="ok">CONNECTED · V${esc(j.ver)}${Array.isArray(j.cores) ? " · " + j.cores.length + " THREADS" : " · UPDATE TO 2.0 FOR THREADS"}</span>`; }
    catch (e) { out.innerHTML = "<span class='bad'>NOT RUNNING ON THIS PORT</span>"; } };
  $("suC").onclick = () => { $("setup").classList.remove("on"); };
  $("suEd").onclick = () => { $("setup").classList.remove("on"); startEdit(); };
  $("suOk").onclick = () => {
    keepInputs(); const locCh = SU.lat !== CFG.lat || SU.lon !== CFG.lon, pxCh = SU.adsbProxy !== CFG.adsbProxy;
    ["name", "lat", "lon", "adsbProxy", "sensorPort", "units", "layout", "stripSide", "iconSide", "iconCols", "range"].forEach(k => CFG[k] = SU[k]);
    CFG.sensorPort = clamp(+CFG.sensorPort || 47047, 1024, 65535);
    SETUP_DONE = CFG.lat != null; saveCfg(); $("setup").classList.remove("on");
    if (SU.mapStyle !== CFG.mapStyle) setMapStyle(SU.mapStyle);
    STATE.mode = CFG.layout; STATE.dock = null; STATE.dockMax = false; layout(); pollSensor();
    if (locCh) onLocationChanged(); else { if (pxCh) loadAir(); MAP.dirty = true; mapHome(); BUS.emit("units"); }
  };
}
function keepInputs() { if ($("suP")) SU.adsbProxy = $("suP").value.trim(); if ($("suS")) SU.sensorPort = +$("suS").value || 47047; }

/* ================== BEARBEITEN-MODUS ================== */
function startEdit() { STATE.edit = true; $("edit").classList.add("on"); layout(); renderEdit(); }
function stopEdit() { STATE.edit = false; $("edit").classList.remove("on"); saveCfg(); layout(); }
function renderEdit() {
  if (!STATE.edit) return;
  const g = zoneGeom(), r = STATE.rect, el = $("edit");
  const zx = g.left ? 0 : g.vw - g.zw;
  const strip = STATE.lay === "strip";
  const handles = [];
  if (g.zw) handles.push({ id: "z", x: g.left ? g.zw : zx, y: (g.vh - g.tb) / 2, cls: "z" });
  if (strip) {
    const s = CFG.stripSide; handles.push({ id: "sw", x: s === "right" ? r.x : s === "left" ? r.x + r.w : r.x + r.w / 2, y: s === "bottom" ? r.y : r.y + r.h / 2 });
  } else {
    handles.push({ id: "l", x: r.x, y: r.y + r.h / 2 }, { id: "r", x: r.x + r.w, y: r.y + r.h / 2 }, { id: "t", x: r.x + r.w / 2, y: r.y }, { id: "b", x: r.x + r.w / 2, y: r.y + r.h });
  }
  el.innerHTML = `${g.zw ? `<div class="zbox" style="left:${zx}px;top:0;width:${g.zw}px;height:${g.vh - g.tb}px"></div>` : ""}
    <div class="box" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"></div>
    ${handles.map(h => `<div class="h ${h.cls || ""}" data-h="${h.id}" style="left:${h.x}px;top:${h.y}px"></div>`).join("")}
    <div class="bar"><span class="tag or">EDIT LAYOUT</span><span>DRAG THE HANDLES · CYAN = ICON ZONE · ORANGE = CONSOLE</span>
      ${["full", "half", "strip"].map(m => `<span class="btn ${CFG.layout === m ? "on" : ""}" data-m="${m}">${m.toUpperCase()}</span>`).join("")}
      <span class="btn" id="edR">RESET</span><span class="btn or" id="edOk">DONE</span></div>`;
  el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { CFG.layout = b.dataset.m; STATE.mode = CFG.layout; layout(); renderEdit(); });
  $("edR").onclick = () => { CFG.zoneAdj = 0; CFG.inset = { l: 0, r: 0, t: 0, b: 0 }; CFG.stripW = 300; layout(); renderEdit(); };
  $("edOk").onclick = stopEdit;
  el.querySelectorAll("[data-h]").forEach(h => h.addEventListener("pointerdown", e => dragStart(e, h.dataset.h)));
}
function dragStart(e, id) {
  e.preventDefault(); const sx = e.clientX, sy = e.clientY, ins = { ...CFG.inset }, za = CFG.zoneAdj || 0, sw = CFG.stripW, left = CFG.iconSide !== "right";
  const mv = ev => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (id === "z") CFG.zoneAdj = Math.round(za + (left ? dx : -dx));
    if (id === "l") CFG.inset.l = Math.max(0, Math.round(ins.l + dx));
    if (id === "r") CFG.inset.r = Math.max(0, Math.round(ins.r - dx));
    if (id === "t") CFG.inset.t = Math.max(0, Math.round(ins.t + dy));
    if (id === "b") CFG.inset.b = Math.max(0, Math.round(ins.b - dy));
    if (id === "sw") { const s = CFG.stripSide; CFG.stripW = clamp(Math.round(sw + (s === "right" ? -dx : s === "left" ? dx : -dy)), 120, 900); }
    layout(); renderEdit();
  };
  const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); saveCfg(); };
  addEventListener("pointermove", mv); addEventListener("pointerup", up);
}
