/* Light Table Ops - browser demo: live online data for Edinburgh, simulated sensor values and placeholder desktop icons. Not part of the wallpaper package. */
"use strict";
(function () {
  const q = new URLSearchParams(location.search);
  const proxy = q.get("proxy") || "";
  LS.set("lto-common", { name: "Edinburgh", lat: 55.9533, lon: -3.1883, adsbProxy: proxy, sensorPort: 47047, units: "avi" });
  const per = LS.get("lto-scr-" + SCR, {}) || {};
  per.layout = q.get("mode") || "full"; per.boot = false; per.iconCols = 2; per.iconSide = "left"; per.stripW = +(q.get("sw") || 300); per.nightMode = "off";
  LS.set("lto-scr-" + SCR, per); LS.set("lto-view-" + SCR, q.get("view") || "map");
  let t0 = Date.now();
  const sensor = () => { const t = (Date.now() - t0) / 1000;
    return { v: 1, app: "Bridge-Ops-Sensor", ver: "2.1", load: { cpu: 18 + 9 * Math.sin(t / 7) + 4 * Math.random(), gpu: 34 + 10 * Math.sin(t / 11) + 3 * Math.random(), ram: 41.6 + Math.sin(t / 30), ramTotal: 34359738368 },
      net: { name: "Ethernet Controller 2.5GbE", down: 2.4e6 + 1.6e6 * Math.max(0, Math.sin(t / 5)) + 2e5 * Math.random(), up: 1.4e5 + 9e4 * Math.random() }, nics: [{ name: "Ethernet Controller 2.5GbE", down: 2.4e6, up: 1.4e5, auto: true }],
      disks: [{ d: "C:", label: "SYSTEM", total: 1e12, free: 4.2e11, read: 1.2e6 * Math.random(), write: 6e5 * Math.random(), busy: 3 + 4 * Math.random(), fs: "NTFS" }, { d: "D:", label: "DATA", total: 2e12, free: 8.8e11, read: 0, write: 4e4, busy: 1, fs: "NTFS" }, { d: "E:", label: "GAMES", total: 4e12, free: 1.9e12, read: 2.2e7 * Math.max(0, Math.sin(t / 9)), write: 0, busy: 12 * Math.max(0, Math.sin(t / 9)), fs: "NTFS" }],
      vram: { used: 5.6e9 + 4e8 * Math.sin(t / 13), total: 17179869184 }, cpuMhz: 4280, gpuTemp: 52 + 3 * Math.sin(t / 15), cpuTemp: 58 + 4 * Math.sin(t / 8), cpuTempSrc: "lhm",
      cpuX: { temp: 58, power: 71 + 8 * Math.sin(t / 6), clkMax: 4450, clkAvg: 4080 }, ext: { on: true, msg: "ok" },
      cores: [...Array(24)].map((_, i) => ({ u: Math.max(0, Math.min(100, 8 + 55 * Math.abs(Math.sin(i * 1.3 + t / 5)) * (i % 5 === 0 ? 1.3 : .55))), mhz: 3900 + (i * 53 + Math.round(t * 7)) % 600 })),
      procs: [["FlightSim", 14.2, 8.1e9], ["Lively", 2.9, 6.1e8], ["Browser", 2.1, 1.7e9], ["dwm", 1.5, 1.1e8], ["Chat", .7, 3.9e8], ["explorer", .4, 2e8], ["Audio", .3, 9e7], ["Defender", .2, 2.8e8]].map(([name, cpu, mem]) => ({ name, cpu: +(cpu * (0.8 + .4 * Math.random())).toFixed(1), mem, n: 1 })),
      info: { cpu: "AMD Ryzen 9 12-Core Processor", gpu: "AMD Radeon RX Graphics", threads: 24, coresPhys: 12, boot: Date.now() - 1.3 * 864e5, maxMhz: 3800 } }; };
  const realFetch = window.fetch;
  window.fetch = (u, o) => String(u).includes("127.0.0.1") ? Promise.resolve(new Response(JSON.stringify(sensor()), { status: 200, headers: { "Content-Type": "application/json" } })) : realFetch(u, o);
  // Audio-Pegel simulieren
  setInterval(() => { const a = []; for (let i = 0; i < 128; i++) a.push(Math.max(0, .35 * Math.exp(-i / 30) * (0.6 + .4 * Math.sin(Date.now() / 300 + i / 4)) + .05 * Math.random())); window.livelyAudioListener && livelyAudioListener(a); }, 50);
  // Platzhalter-Desktopsymbole in der Icon-Zone
  addEventListener("load", () => {
    const names = [["folder", "Projects"], ["folder", "Photos"], ["doc", "Notes.txt"], ["folder", "Downloads"], ["app", "Flight Sim"], ["doc", "Checklist.pdf"], ["app", "Browser"], ["folder", "Music"], ["bin", "Trash"]];
    const svg = k => k === "folder" ? `<svg viewBox="0 0 48 40"><path d="M2,6 h16 l4,4 h24 v28 h-44 z" fill="#d9b25a"/><path d="M2,14 h44 v24 h-44 z" fill="#f0c96a"/></svg>`
      : k === "doc" ? `<svg viewBox="0 0 48 48"><path d="M10,2 h20 l10,10 v34 h-30 z" fill="#e9eef2"/><path d="M30,2 v10 h10" fill="#b9c4cc"/><path d="M15,22 h20 M15,28 h20 M15,34 h14" stroke="#7c8b96" stroke-width="2"/></svg>`
      : k === "bin" ? `<svg viewBox="0 0 48 48"><path d="M12,12 h24 l-3,32 h-18 z" fill="#9fb7c4"/><path d="M8,9 h32 v4 h-32 z M19,5 h10 v4 h-10 z" fill="#c9d8e0"/></svg>`
      : `<svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="9" fill="#2f6f8f"/><path d="M14,30 l10,-14 l10,14 z" fill="#fff"/></svg>`;
    const z = document.createElement("div"); z.style.cssText = "position:fixed;left:0;top:0;z-index:4;pointer-events:none;font:12px 'Segoe UI',sans-serif;color:#fff;text-shadow:0 1px 2px #000";
    names.forEach((n, i) => { const c = Math.floor(i / 5), r = i % 5, d = document.createElement("div");
      d.style.cssText = `position:absolute;left:${c * CFG.iconCellW + 18}px;top:${r * CFG.iconCellH + 10}px;width:${CFG.iconCellW - 36}px;text-align:center`;
      d.innerHTML = `<div style="width:44px;height:44px;margin:0 auto 4px">${svg(n[0])}</div>${n[1]}`; z.appendChild(d); });
    document.body.appendChild(z);
  });
})();
