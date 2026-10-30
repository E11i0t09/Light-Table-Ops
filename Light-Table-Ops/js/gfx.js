/* Light Table Ops · © 2026 E11iot · CC BY-NC-ND 4.0
   gfx.js – Zeichenbausteine im Stil eines Glas-Lichttischs (SVG + Canvas) */
"use strict";
const css = v => getComputedStyle(document.body).getPropertyValue(v).trim();
let PAL = null;
function pal() {
  if (!PAL) PAL = { tx: css("--tx"), cy: css("--cy"), cy2: css("--cy2"), or: css("--or"), ye: css("--ye"), ln: css("--ln"), ln2: css("--ln2"), dim: css("--dim"), bg: css("--bg") };
  return PAL;
}
/* Canvas passend zur Elterngröße (logische px × Skalierung × dpr) */
function fitCanvas(c) {
  const own = c.classList.contains("own"), p = c.parentElement; if (!p) return null;
  if (!own && !c._abs) { c._abs = 1; c.style.position = "absolute"; c.style.left = "0"; c.style.top = "0"; if (getComputedStyle(p).position === "static") p.style.position = "relative"; }
  const W = own ? c.clientWidth : p.clientWidth, H = own ? c.clientHeight : p.clientHeight; if (!W || !H) return null;
  const r = (window.devicePixelRatio || 1) * STATE.s;
  if (c._W !== W || c._H !== H || c._r !== r) {
    if (!own) { c.style.width = W + "px"; c.style.height = H + "px"; }
    c.width = Math.round(W * r); c.height = Math.round(H * r); c._W = W; c._H = H; c._r = r;
  }
  const x = c.getContext("2d"); x.setTransform(r, 0, 0, r, 0, 0); x.clearRect(0, 0, W, H);
  return { x, W, H };
}
function hexA(h, a) { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

/* ---------- SVG-Bausteine ---------- */
/* Punktring wie die kleinen Ringanzeigen: n Punkte, Anteil v leuchtet */
function dotRing(r, n, v, col, opt = {}) {
  let s = ""; const on = Math.round(n * clamp(v, 0, 1)), off = opt.off || "var(--ln2)", a0 = opt.a0 ?? -90, sw = opt.span ?? 360;
  for (let i = 0; i < n; i++) {
    const a = (a0 + sw * i / (sw === 360 ? n : n - 1)) * RAD, x = r * Math.cos(a), y = r * Math.sin(a);
    const hot = opt.mark != null && i === opt.mark;
    s += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${hot ? opt.dot * 1.6 : (opt.dot || 2)}" fill="${hot ? "var(--or)" : (i < on ? col : off)}"/>`;
  }
  return s;
}
/* Bogen (Grad, 0 = oben, im Uhrzeigersinn) */
function arcPath(r, a0, a1) {
  const p = a => [r * Math.sin(a * RAD), -r * Math.cos(a * RAD)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}
/* Ecken-Klammern um ein Rechteck */
function brackets(w, h, l = 10, col = "var(--ln2)") {
  return `<path d="M0,${l} V0 H${l} M${w - l},0 H${w} V${l} M${w},${h - l} V${h} H${w - l} M${l},${h} H0 V${h - l}" fill="none" stroke="${col}" stroke-width="1"/>`;
}
/* Linie mit Endstrichen und Lesepunkt (wie die dünnen Trennlinien im Original) */
function rule(label) {
  return `<div class="rule"><i></i>${label ? `<span>${label}</span>` : ""}<i></i></div>`;
}

/* ---------- eigene Symbole (Strichgrafik) ---------- */
const ICON = {
  logo: `<svg viewBox="-50 -50 100 100"><circle r="40" fill="none" stroke="var(--cy)" stroke-width="7" stroke-dasharray="190 61" transform="rotate(-60)"/>
    <circle r="23" fill="none" stroke="var(--tx)" stroke-width="5" stroke-dasharray="60 25" transform="rotate(30)"/><circle r="6" fill="var(--or)"/></svg>`,
  dots: `<svg viewBox="-20 -20 40 40">${[0, 1, 2, 3, 4, 5, 6].map(i => { const a = i / 7 * Math.PI * 2; return `<circle cx="${(13 * Math.cos(a)).toFixed(1)}" cy="${(13 * Math.sin(a)).toFixed(1)}" r="${i === 2 ? 3.2 : 2.4}" fill="${i === 2 ? "var(--or)" : "var(--cy)"}"/>`; }).join("")}<circle r="3" fill="none" stroke="var(--cy)"/></svg>`,
  tri: `<svg viewBox="0 0 60 52"><path d="M30,3 L57,49 H3 Z" fill="none" stroke="var(--cy2)" stroke-width="2.5"/><path d="M30,18 L44,42 H16 Z" fill="var(--or)"/><path d="M30,18 L37,30 H23 Z" fill="var(--bg)" opacity=".5"/></svg>`,
  climb: `<svg viewBox="0 0 40 30"><path d="M5,22 L20,8 L35,22" fill="none" stroke="var(--cy)" stroke-width="5" stroke-linecap="round"/></svg>`,
  cruise: `<svg viewBox="0 0 40 30"><path d="M4,15 H36" stroke="var(--tx)" stroke-width="5" stroke-linecap="round"/><circle cx="20" cy="15" r="6" fill="var(--bg)" stroke="var(--tx)" stroke-width="3"/></svg>`,
  desc: `<svg viewBox="0 0 40 30"><path d="M5,8 L20,22 L35,8" fill="none" stroke="var(--or)" stroke-width="5" stroke-linecap="round"/></svg>`,
  sun: `<svg viewBox="-30 -30 60 60"><circle r="10" fill="none" stroke="var(--ye)" stroke-width="3"/><circle r="4" fill="var(--ye)"/>${[...Array(12)].map((_, i) => { const a = i * 30 * RAD, r1 = 15, r2 = i % 2 ? 20 : 25; return `<path d="M${(r1 * Math.sin(a)).toFixed(1)},${(-r1 * Math.cos(a)).toFixed(1)} L${(r2 * Math.sin(a)).toFixed(1)},${(-r2 * Math.cos(a)).toFixed(1)}" stroke="var(--ye)" stroke-width="2.5" stroke-linecap="round"/>`; }).join("")}</svg>`,
  wave: `<svg viewBox="0 0 60 40"><path d="M2,20 Q10,4 18,20 T34,20 T50,20 T58,20" fill="none" stroke="var(--cy)" stroke-width="3"/><path d="M2,30 H58" stroke="var(--ln2)" stroke-width="2"/></svg>`,
  net: `<svg viewBox="-30 -30 60 60"><path d="M-22,8 L0,-18 L22,8 Z" fill="none" stroke="var(--cy)" stroke-width="3"/><path d="M-22,8 L0,22 L22,8" fill="var(--cy)" opacity=".35"/><path d="M0,-18 V22" stroke="var(--tx)" stroke-width="2"/></svg>`,
  sw: on => `<svg viewBox="0 0 70 50"><rect x="2" y="12" width="66" height="26" rx="13" fill="none" stroke="${on ? "var(--tx)" : "var(--ln2)"}" stroke-width="3"/>
    <circle cx="${on ? 50 : 20}" cy="25" r="9" fill="${on ? "var(--cy)" : "var(--ln2)"}"/><path d="M${on ? 50 : 20},19 v12" stroke="${on ? "#183" : "var(--bg)"}" stroke-width="3"/>
    <path d="M8,6 h54 M8,44 h54" stroke="${on ? "var(--ln2)" : "var(--ln)"}" stroke-width="3" stroke-dasharray="6 4"/></svg>`
};
/* einfache Wettersymbole (Strichgrafik) nach WMO-Code */
function wxIcon(code, day = true) {
  const sun = `<circle cx="0" cy="-4" r="8" fill="none" stroke="var(--ye)" stroke-width="3"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M${(12 * Math.sin(a * RAD)).toFixed(1)},${(-4 - 12 * Math.cos(a * RAD)).toFixed(1)} L${(16 * Math.sin(a * RAD)).toFixed(1)},${(-4 - 16 * Math.cos(a * RAD)).toFixed(1)}" stroke="var(--ye)" stroke-width="2.5"/>`).join("")}`;
  const moon = `<path d="M3,-14 A11,11 0 1 0 10,4 A8,8 0 1 1 3,-14 Z" fill="none" stroke="var(--ye)" stroke-width="2.5"/>`;
  const cloud = (y = 4, c = "var(--tx)") => `<path d="M-14,${y + 8} H12 A7,7 0 0 0 10,${y - 5} A10,10 0 0 0 -8,${y - 6} A8,8 0 0 0 -14,${y + 8} Z" fill="var(--bg)" stroke="${c}" stroke-width="2.6"/>`;
  const drops = n => [...Array(n)].map((_, i) => `<path d="M${-9 + i * 8},18 l-3,7" stroke="var(--cy)" stroke-width="2.6" stroke-linecap="round"/>`).join("");
  const flakes = n => [...Array(n)].map((_, i) => `<circle cx="${-9 + i * 8}" cy="21" r="2" fill="var(--tx)"/>`).join("");
  const bolt = `<path d="M1,12 L-5,22 H1 L-3,30 L7,18 H1 L5,12 Z" fill="var(--or)"/>`;
  const fog = `<path d="M-16,4 H16 M-12,10 H14 M-16,16 H10" stroke="var(--dim)" stroke-width="3" stroke-linecap="round"/>`;
  let g;
  if (code <= 1) g = day ? sun : moon;
  else if (code === 2) g = `<g transform="translate(6,-6) scale(.7)">${day ? sun : moon}</g>${cloud(6)}`;
  else if (code === 3) g = cloud(2);
  else if (code === 45 || code === 48) g = fog;
  else if (code >= 95) g = cloud(-2) + bolt;
  else if ((code >= 71 && code <= 77) || code === 85 || code === 86) g = cloud(-2) + flakes(3);
  else if (code >= 51) g = cloud(-2) + drops(code >= 63 && code !== 80 ? 3 : 2);
  else g = cloud(2);
  return `<svg viewBox="-20 -22 40 54">${g}</svg>`;
}

/* ---------- Canvas: Verlaufskurven, Balken ---------- */
function spark(x, arr, X0, Y0, W, H, col, opt = {}) {
  if (!arr || arr.length < 2) return; const max = opt.max || Math.max(1e-6, ...arr.filter(v => v != null)) * 1.1, n = opt.n || arr.length;
  x.beginPath();
  if (arr.some(v => v == null)) { if (opt.fill) return; let pen = false;   // Lücken (keine Messwerte) als Unterbrechung
    arr.forEach((v, i) => { if (v == null) { pen = false; return; } const px = X0 + W - (arr.length - 1 - i) / (n - 1) * W, py = Y0 + H - clamp(v / max, 0, 1) * H; pen ? x.lineTo(px, py) : x.moveTo(px, py); pen = true; });
    x.strokeStyle = col; x.lineWidth = opt.lw || 1.5; x.stroke(); return; }
  arr.forEach((v, i) => { const px = X0 + W - (arr.length - 1 - i) / (n - 1) * W, py = Y0 + H - clamp(v / max, 0, 1) * H; i ? x.lineTo(px, py) : x.moveTo(px, py); });
  if (opt.fill) { x.lineTo(X0 + W, Y0 + H); x.lineTo(X0 + W - (arr.length - 1) / (n - 1) * W, Y0 + H); x.closePath(); x.fillStyle = hexA(col, opt.fill); x.fill(); }
  else { x.strokeStyle = col; x.lineWidth = opt.lw || 1.5; x.stroke(); }
}
/* Punktmatrix-Schrift (5×7), für die große Warnzeile */
const DM = {
  A: "01110100011000111111100011000110001", B: "11110100011000111110100011000111110", C: "01110100011000010000100001000101110", D: "11110100011000110001100011000111110",
  E: "11111100001000011110100001000011111", F: "11111100001000011110100001000010000", G: "01110100011000010111100011000101111", H: "10001100011000111111100011000110001",
  I: "01110001000010000100001000010001110", J: "00111000100001000010000101001001100", K: "10001100101010011000101001001010001", L: "10000100001000010000100001000011111",
  M: "10001110111010110101100011000110001", N: "10001110011010110011100011000110001", O: "01110100011000110001100011000101110", P: "11110100011000111110100001000010000",
  Q: "01110100011000110001101011001001101", R: "11110100011000111110101001001010001", S: "01111100001000001110000010000111110", T: "11111001000010000100001000010000100",
  U: "10001100011000110001100011000101110", V: "10001100011000110001100010101000100", W: "10001100011000110101101011010101010", X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100", Z: "11111000010001000100010001000011111", " ": "00000000000000000000000000000000000",
  "0": "01110100011001110101110011000101110", "1": "00100011000010000100001000010001110", "2": "01110100010000100010001000100011111", "3": "11111000100010000010000011000101110",
  "4": "00010001100101010010111110001000010", "5": "11111100001111000001000011000101110", "6": "00110010001000011110100011000101110", "7": "11111000010001000100010000100001000",
  "8": "01110100011000101110100011000101110", "9": "01110100011000101111000010001001100", "-": "00000000000000011111000000000000000", "·": "00000000000000000100000000000000000",
  ".": "00000000000000000000000000110001100", ":": "00000011000110000000011000110000000", "/": "00001000010001000100010001000010000"
};
function drawDotText(x, txt, X, Y, cell, col, dimCol) {
  txt = String(txt).toUpperCase();
  for (let k = 0; k < txt.length; k++) {
    const g = DM[txt[k]] || DM[" "], ox = X + k * cell * 6;
    for (let i = 0; i < 35; i++) {
      const cx = ox + (i % 5) * cell + cell / 2, cy = Y + Math.floor(i / 5) * cell + cell / 2, on = g[i] === "1";
      x.fillStyle = on ? col : dimCol; x.fillRect(cx - cell * .34, cy - cell * .34, cell * .68, cell * .68);
    }
  }
}
/* rote Schraffur als Muster */
let HATCH = null;
function hatchPattern(x, sc = 1) {
  const c = document.createElement("canvas"), n = Math.round(14 * sc); c.width = c.height = n;
  const g = c.getContext("2d"); g.fillStyle = "rgba(170,52,38,.20)"; g.fillRect(0, 0, n, n);
  g.strokeStyle = "rgba(196,64,44,.85)"; g.lineWidth = 3.2 * sc;
  g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(k * n, n); g.lineTo(k * n + n, 0); } g.stroke();
  return x.createPattern(c, "repeat");
}
