/* Light Table Ops · METAR/TAF-Auswertung (aus Bridge Ops übernommen) · © 2026 E11iot · CC BY-NC-ND 4.0 */
"use strict";
const WXP = {DZ:"DRIZZLE",RA:"RAIN",SN:"SNOW",SG:"SNOW GRAINS",IC:"ICE CRYSTALS",PL:"ICE PELLETS",GR:"HAIL",GS:"SMALL HAIL",UP:"PRECIP",BR:"MIST",FG:"FOG",FU:"SMOKE",VA:"VOLC ASH",DU:"DUST",SA:"SAND",HZ:"HAZE",PY:"SPRAY",PO:"DUST WHIRLS",SQ:"SQUALLS",FC:"FUNNEL CLOUD",SS:"SANDSTORM",DS:"DUSTSTORM"};
const WXD = {MI:"SHALLOW",PR:"PARTIAL",BC:"PATCHES",DR:"DRIFTING",BL:"BLOWING",SH:"SHOWERS",TS:"THUNDERSTORM",FZ:"FREEZING"};
const WXRE = /^(\+|-|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)*)$/;
function wxText(code){
  const m=code.match(WXRE); if(!m) return code;
  const ph=(m[3].match(/../g)||[]).map(p=>(WXP[p]||p)), parts=[];
  if(m[2]) parts.push(WXD[m[2]]);
  parts.push(...ph);
  let s=parts.join(" · ");
  if(m[1]) s += " (" + ({"-":"LIGHT","+":"HEAVY","VC":"VICINITY"}[m[1]]) + ")";
  return s;
}
function smVal(s){ s=s.replace(/^[MP]/,"").replace(/SM$/,""); if(s.includes("/")){ const [a,b]=s.split("/"); return +a/+b; } return +s; }
function wxTokens(tk, o){
  o = o || {}; o.wx=o.wx||[]; o.clouds=o.clouds||[];
  for(let i=0;i<tk.length;i++){
    const t=tk[i]; let m;
    if(/^(BECMG|TEMPO|NOSIG|RMK|PROB\d\d|FM\d{6}|TL\d|AT\d)/.test(t)) break;
    if((m=t.match(/^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/))){ const f=m[4]==="MPS"?1.94384:(m[4]==="KMH"?0.539957:1);
      o.wdir=m[1]==="VRB"?null:+m[1]; o.wspd=Math.round(+m[2]*f); o.wgust=m[3]?Math.round(+m[3]*f):null; continue; }
    if(/^\d{3}V\d{3}$/.test(t)){ o.wvar=t; continue; }
    if(t==="CAVOK"){ o.cavok=true; o.vis=10000; o.hasCl=true; continue; }
    if(/^\d{4}$/.test(t) && o.vis==null){ o.vis = t==="9999" ? 10000 : +t; continue; }
    if(/^\d{4}(N|NE|E|SE|S|SW|W|NW)$/.test(t) || /^\d{4}NDV$/.test(t)){ if(o.vis==null) o.vis=+t.slice(0,4); continue; }
    if(/^\d$/.test(t) && /^\d\/\dSM$/.test(tk[i+1]||"")){ o.vis=(+t+smVal(tk[i+1]))*1609.34; i++; continue; }
    if(/^[MP]?\d+(\/\d+)?SM$/.test(t)){ o.vis=smVal(t)*1609.34; if(t[0]==="P") o.vis=Math.max(o.vis,10000); continue; }
    if(/^R\d{2}[LCR]?\//.test(t)) continue;
    if((m=t.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)(CB|TCU|\/\/\/)?$/))){ const h=m[2]==="///"?null:+m[2]*100; o.hasCl=true;
      o.clouds.push({c:m[1], h, t:m[3]&&m[3]!=="///"?m[3]:""}); if(/BKN|OVC|VV/.test(m[1]) && h!=null && (o.ceil==null||h<o.ceil)) o.ceil=h; continue; }
    if(/^(NSC|NCD|SKC|CLR)$/.test(t)){ o.nsc=t; o.hasCl=true; continue; }
    if((m=t.match(/^(M?\d{2})\/(M?\d{2})?$/))){ o.temp=+m[1].replace("M","-"); o.dew=m[2]!=null?+m[2].replace("M","-"):null; continue; }
    if((m=t.match(/^Q(\d{4})$/))){ o.qnh=+m[1]; continue; }
    if((m=t.match(/^A(\d{4})$/))){ o.qnh=+m[1]/100*33.8639; continue; }
    if(/^(RE|WS)/.test(t)) continue;
    if(t!=="NSW" && (m=t.match(WXRE)) && (m[2]||m[3])){ o.wx.push(t); continue; }
  }
  return o;
}
function flightCat(vis, ceil){
  if(vis==null && ceil==null) return null;
  const sm = vis==null ? 99 : vis/1609.34, c = ceil==null ? 99999 : ceil;
  if(c<500 || sm<1) return "LIFR"; if(c<1000 || sm<3) return "IFR"; if(c<=3000 || sm<=5) return "MVFR"; return "VFR";
}
function obsTime(s){ const d=+s.slice(0,2), h=+s.slice(2,4), mi=+s.slice(4,6), n=new Date();
  let t=Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), d, h, mi); if(t>Date.now()+2*864e5) t=Date.UTC(n.getUTCFullYear(), n.getUTCMonth()-1, d, h, mi); return new Date(t); }
function parseMetar(raw){
  const tk=raw.split(" "), o={ raw, ic:tk.shift() };
  if(/^\d{6}Z$/.test(tk[0]||"")) o.time=obsTime(tk.shift());
  while(/^(AUTO|COR|NIL)$/.test(tk[0]||"")) tk.shift();
  wxTokens(tk, o);
  o.cat = flightCat(o.vis, o.hasCl ? o.ceil : null);
  if(o.cat===null && o.vis!=null) o.cat=flightCat(o.vis, null);
  return o;
}
function tafLines(raw){
  const tk=raw.split(" "); const ic=tk.shift(); let issue=""; if(/^\d{6}Z$/.test(tk[0]||"")) issue=tk.shift();
  const segs=[]; let cur=[];
  tk.forEach((t,i)=>{ const isHead=/^(BECMG|TEMPO|FM\d{6}|PROB\d\d)$/.test(t) && !(t==="TEMPO" && /^PROB\d\d$/.test(tk[i-1]||"")); if(isHead && cur.length){ segs.push(cur); cur=[]; } cur.push(t); });
  if(cur.length) segs.push(cur);
  let base={};
  return { issue, segs: segs.map((s,k)=>{
    let j=0; while(j<s.length && /^(BECMG|TEMPO|FM\d{6}|PROB\d\d|\d{4}\/\d{4})$/.test(s[j])) j++;
    const o=wxTokens(s.slice(j), {});
    if(k===0) base=o;
    const vis=o.vis!=null?o.vis:base.vis, ceil=o.hasCl?o.ceil:base.ceil;
    return { txt:s.join(" "), cat:flightCat(vis!=null?vis:null, (o.hasCl||base.hasCl)?(ceil==null?null:ceil):null) || (vis!=null?flightCat(vis,null):null) };
  }) };
}
/* TAF-Zeiten (TTHH bzw. TTHHMM, UTC) relativ zur Ausgabezeit */
function tafDate(dd, hh, mm, ref){
  const r=ref||new Date(); let y=r.getUTCFullYear(), mo=r.getUTCMonth();
  let t=Date.UTC(y,mo,+dd,+hh,+(mm||0));
  if(t < r.getTime()-15*864e5) t=Date.UTC(y,mo+1,+dd,+hh,+(mm||0));
  else if(t > r.getTime()+15*864e5) t=Date.UTC(y,mo-1,+dd,+hh,+(mm||0));
  return t;
}
const tafPer = (s, ref) => { const m=s.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/); return m ? [tafDate(m[1],m[2],0,ref), tafDate(m[3],m[4],0,ref)] : null; };
/* Zeitleiste: Hauptvorhersage (inkl. BECMG/FM) + TEMPO/PROB-Abschnitte */
function tafTimeline(raw){
  const tk=raw.split(" "); tk.shift(); let ref=new Date();
  if(/^\d{6}Z$/.test(tk[0]||"")){ const s=tk.shift(); ref=new Date(tafDate(s.slice(0,2),s.slice(2,4),s.slice(4,6))); }
  const segs=[]; let cur=[];
  tk.forEach((t,i)=>{ const head=/^(BECMG|TEMPO|FM\d{6}|PROB\d\d)$/.test(t) && !(t==="TEMPO" && /^PROB\d\d$/.test(tk[i-1]||"")); if(head && cur.length){ segs.push(cur); cur=[]; } cur.push(t); });
  if(cur.length) segs.push(cur);
  if(!segs.length) return null;
  const v=tafPer(segs[0].find(t=>/^\d{4}\/\d{4}$/.test(t))||"", ref); if(!v) return null;
  const base=[], over=[]; let st={vis:null, ceil:null, hasCl:false}, t0=v[0];
  const apply=(o,full)=>{ if(full) st={vis:null,ceil:null,hasCl:false}; if(o.vis!=null) st.vis=o.vis; if(o.hasCl){ st.ceil=o.ceil; st.hasCl=true; } };
  const cat=()=>flightCat(st.vis, st.hasCl?st.ceil:null) || (st.vis!=null?flightCat(st.vis,null):null);
  const body=s=>{ let j=0; while(j<s.length && /^(BECMG|TEMPO|FM\d{6}|PROB\d\d|\d{4}\/\d{4}|\d{4}\/\d{4}Z?)$/.test(s[j])) j++; return wxTokens(s.slice(j),{}); };
  apply(body(segs[0].slice(segs[0].indexOf(segs[0].find(t=>/^\d{4}\/\d{4}$/.test(t)))+1)), true);
  for(const s of segs.slice(1)){
    const h=s[0], o=body(s);
    if(/^FM/.test(h)){ const t=tafDate(h.slice(2,4),h.slice(4,6),h.slice(6,8),ref); base.push([t0,t,cat()]); t0=t; apply(o,true); continue; }
    const p=tafPer(s.find(t=>/^\d{4}\/\d{4}$/.test(t))||"", ref); if(!p) continue;
    if(h==="BECMG"){ base.push([t0,p[0],cat()]); t0=p[0]; apply(o,false); continue; }
    // TEMPO / PROB: zeitweise Abweichung, fehlende Werte von der Hauptvorhersage
    const vis=o.vis!=null?o.vis:st.vis, ceil=o.hasCl?o.ceil:(st.hasCl?st.ceil:null);
    over.push([p[0],p[1], flightCat(vis,ceil) || (vis!=null?flightCat(vis,null):null), h]);
  }
  base.push([t0,v[1],cat()]);
  return { from:v[0], to:v[1], base, over };
}
const CATCOL = { VFR: "#3fbf5f", MVFR: "#4a8cff", IFR: "#ff4b3e", LIFR: "#d94bd9" };
