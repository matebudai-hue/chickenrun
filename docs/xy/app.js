import { command, readState, saved, secret } from "../connection.js?v=5";
import { createReportPdf } from "./report-pdf.js?v=3";

const $ = id => document.getElementById(id);
const screen = $("screen"), dialog = $("dialog"), signal = $("signal");
const url = new URL(location.href), projector = url.searchParams.has("screen");
const pattern = /^[A-Z2-9]{6}$/;
let code = (url.searchParams.get("room") || "").toUpperCase(), state, busy = false, signature = "", pending = false, revision = 0;
const last = "xy:last";
const archiveStorageKey = "xy:archive-key";
const archivePath = "/api/xy/archive";
const slot = () => "xy:"+code+":"+(projector ? "screen" : "player");
const fragment = new URLSearchParams(url.hash.slice(1));
const transfer = fragment.get("transfer");
let key = projector ? fragment.get("key") || saved.get(slot()) : transfer ? secret() : saved.get(slot());
if (projector && key) {
  saved.set(slot(),key);
  history.replaceState(null,"",location.pathname+location.search);
}
const endpoint = (act="") => "/api/xy/rooms/"+code+(act ? "/"+act : "");
const esc = x => String(x ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const number = new Intl.NumberFormat("hu");
const score = n => n > 0 ? "+"+number.format(n) : n < 0 ? "−"+number.format(-n) : "0";
const options = [1,2,5,10,100,1000];
const tag = (value, label=value) => `<span class="chip ${value === "X" || value === "Y" ? value : ""}">${esc(label)}</span>`;
const btn = (label,act,data="",css="",disabled=false) => `<button type="button" class="${css}" data-act="${act}" ${data} ${disabled?"disabled":""}>${label}</button>`;
const joinUrl = () => new URL("?room="+code,location.href).href;
const screenUrl = () => joinUrl()+"&screen=1#key="+encodeURIComponent(saved.get("xy:"+code+":projector") || "");
const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n%32]).join("");
const setError = message => { $("error").textContent=message; $("error").hidden=!message; };
const r = () => state.rounds[state.index];
const split = count => `${count} X · ${4-count} Y`;
const negotiationAfter = count => `Tárgyalás következik${count>1?` (×${count})`:""}`;
function matrix(multiplier) {
  return `<table class="matrix"><thead><tr><th>A négy döntés</th><th>Egy X pontja</th><th>Egy Y pontja</th></tr></thead><tbody>${
    [[0,null,10],[1,30,-10],[2,20,-20],[3,10,-30],[4,-10,null]].map(([x,a,b])=>`<tr><th>${split(x)}</th>${
      [a,b].map(n=>`<td>${n===null ? "—" : score(n*multiplier)+(multiplier===1?"":`<small>alap: ${score(n)}</small>`)}</td>`).join("")}</tr>`).join("")
    }</tbody></table>`;
}
function matrixFold() {
  const multiplier=r().multiplier;
  return `<details class="paper fold"><summary>Pontozási mátrix <span>${multiplier ? "×"+multiplier : "Alappontok"}</span></summary>${matrix(multiplier ?? 1)}</details>`;
}
function roster() {
  return `<div class="roster">${state.occupied.map((yes,i)=>{
    const move=r().moves?.[i], label=yes ? state.names[i] : "Szabad csapathely";
    const away = state.presence?.[i] === "offline";
    return `<div class="seat"><span class="seatNo">0${i+1}</span><strong class="${away?"away":""}" ${away?'title="A telefon egy ideje nem jelentkezett"':""}>${esc(label)}${away?'<span class="away-dot" aria-hidden="true"></span><span class="sr-only"> · Nincs kapcsolat</span>':""}</strong>
      ${state.phase==="open" ? (move ? tag(move,move+(r().manual[i]?" · kézi":"")) : btn("Kézi döntés","manual",`data-seat="${i}"`,"quiet")) :
         state.phase==="lobby" ? btn(yes?"Eltávolítás":"Kézi hely","seat",`data-seat="${i}"`,"quiet") : `<span class="total">${score(state.totals[i])}</span>`}
      ${state.phase==="open"?noteMark(r(),state.index,i):""}
      ${yes ? btn("Telefoncsere","transfer",`data-seat="${i}"`,"link") : ""}</div>`;
  }).join("")}</div>`;
}
function qrBlock() {
  return `<div class="qr-card"><div id="qr" aria-label="Csatlakozási QR-kód"></div><div><small>Szobakód</small><strong>${code}</strong><a href="${joinUrl()}" target="_blank" rel="noopener">Belépő megnyitása</a></div></div>`;
}
let projectionPage=0;
const projectionPageSize=10;
const noteIcon='<span class="note-icon" aria-hidden="true">▤</span>';
const reflectionIcon='<span class="reflection-icon" aria-hidden="true">◇</span>';
function reflectionMark(name, seat) {
  if(!projector || !state.projectorReflections?.[seat]) return "";
  return btn(reflectionIcon,"read-reflection",`data-seat="${seat}" aria-label="${esc(name)}: reflexió megnyitása" title="Csapatreflexió megnyitása"`,"note-mark reflection-mark");
}
function noteMark(round,i,j) {
  if(!round.noteFlags?.[j]) return "";
  const label=`${i+1}. kör, ${state.names[j]}: körjegyzet érkezett`;
  return btn(noteIcon,"read-note",`data-round="${i}" data-seat="${j}" aria-label="${esc(label)} – megnyitás" title="Körjegyzet megnyitása"`,"note-mark");
}
function timeline() {
  const scored = state.rounds.map((round,i)=>({round,i})).filter(({round})=>round.scored);
  const visible = projector ? scored.slice(projectionPage*projectionPageSize,(projectionPage+1)*projectionPageSize) : scored;
  if (!visible.length) return '<p class="muted">A lezárt körök itt jelennek meg.</p>';
  const sum = values => values.reduce((a,b)=>a+b,0);
  return `<div class="scroll"><table class="timeline"><thead><tr><th scope="col">Kör</th>${
    state.names.map((name,seat)=>`<th scope="col">${esc(name)}${reflectionMark(name,seat)}</th>`).join("")
  }<th scope="col">Kör összesen</th></tr></thead><tbody>${visible.map(({round,i})=>{
    const after=state.rounds[i+1]?.played;
    const beforeFirst=i===0 && round.played;
    return `
    <tr class="${beforeFirst?"negotiation-before-first ":""}${after?"negotiation-follows":""}"><th scope="row">${i+1}. kör <small>×${round.multiplier}</small>${beforeFirst?`<small class="negotiation-label">Tárgyalás az első kör előtt${round.played>1?` (×${round.played})`:""}</small>`:""}${after?`<small class="negotiation-label">${negotiationAfter(after)}</small>`:""}</th>${
      round.moves.map((move,j)=>`<td>${tag(move)} <small class="cell-score">${score(round.scores[j])}${round.manual?.[j]?" · kézi":""}</small>${noteMark(round,i,j)}</td>`).join("")
    }<td class="total">${score(sum(round.scores))}</td></tr>`;
  }).join("")}</tbody><tfoot><tr class="group"><th scope="row">Összpont</th>${
    state.totals.map(total=>`<td class="total">${score(total)}</td>`).join("")
  }<td class="total">${score(sum(state.totals))}</td></tr></tfoot></table></div>`;
}
function schedule() {
  return `<details class="paper fold"><summary>Menetrend <span>${state.rounds.length} kör</span></summary>
    <div class="schedule">${state.rounds.map((round,i)=>{
      const locked = i<state.index || i===state.index && ["open","result","finished"].includes(state.phase);
      return `<form data-kind="config" data-index="${i}" class="scheduleRow"><strong>${i+1}. kör</strong>
        <label>Szorzó<select name="multiplier" ${locked?"disabled":""}>${options.map(n=>`<option value="${n}" ${n===round.multiplier?"selected":""}>×${n}</option>`).join("")}</select></label>
        <label>Tárgyalások előtte<input name="negotiations" type="number" min="${round.played}" step="1" value="${round.negotiations}" required ${locked?"disabled":""}></label>
        <button ${locked?"disabled":""}>Mentés</button></form>`;
    }).join("")}</div></details>`;
}
function hostView() {
  const phase=state.phase, now=r(), count=now.moves.filter(Boolean).length;
  let title, desc, action;
  if (phase==="lobby") {title="Csapatok fogadása";desc=`${state.occupied.filter(Boolean).length}/4 csapat a váróban`;action=btn("Játék indítása","start","","primary",!state.occupied.every(Boolean));}
  if (phase==="ready") {title="A következő kör";desc=now.negotiations>now.played?`${now.negotiations-now.played} tárgyalás van hátra a kör előtt`:"Megnyithatod a döntést";action=now.negotiations>now.played?btn("Tárgyalás indítása","negotiation","","primary"):btn("Kör megnyitása","open","","primary")+btn("Tárgyalás beszúrása","negotiation");}
  if (phase==="negotiation") {title="Tárgyalás";desc="A résztvevőknél a tárgyalás jelzése látszik.";action=btn("Tárgyalás lezárása","resume","","primary");}
  if (phase==="open") {title="Döntésre nyitva";desc=`${count}/4 döntés beérkezett`;action=btn("Kör lezárása","close","","primary",count!==4);}
  if (phase==="result") {title=split(now.countX);desc="A kör lezárult, a csapatok látják a saját pontjukat.";action=btn(state.index+1===state.rounds.length?"Játék lezárása és reflexiók":"Következő kör",state.index+1===state.rounds.length?"finish":"next","","primary");}
  if (["ready","negotiation","open"].includes(phase) || phase==="result" && state.index+1<state.rounds.length) action+=btn("Játék lezárása","finish");
  if (phase==="finished") {title="Feldolgozás";desc=`${state.reflections.filter(Boolean).length}/4 reflexió beérkezett${state.reportShared?" · PDF megosztva":""}`;action=btn("Végeredmény kivetítése","results","","primary")+btn("PDF letöltése","pdf")+btn(state.reportShared?"Megosztott PDF frissítése":"PDF megosztása a csapatokkal","share-pdf")+(state.reportShared?btn("Megosztás leállítása","unshare-pdf"):"");}
  const weight = ["lobby","ready","negotiation"].includes(phase) ? `<label class="quick-weight">Körszorzó<select id="quick-weight">${options.map(n=>`<option value="${n}" ${n===now.multiplier?"selected":""}>×${n}</option>`).join("")}</select></label>` : `<strong>×${now.multiplier}</strong>`;
  if (phase==="finished") action+=btn("Játék mentése","save-game")+btn("Új játék","new-game");
  if (state.canContinue) action=btn("Tovább játszom","continue","","primary")+action;
  return `<section class="hero board"><div><p class="kicker">Tréneri vezérlő · ${code}</p><h1>${title}</h1><p>${desc}</p></div><div class="weight"><span>${state.index+1} / ${state.rounds.length}. kör</span>${weight}</div><div class="actions">${action}</div></section>
  <div class="teams-panel ${phase==="lobby"?"with-qr":""}">${roster()}${phase==="lobby"?qrBlock():""}</div>
  <section class="paper tools"><div class="trainer-links"><a href="${screenUrl()}" target="_blank" rel="noopener">Kivetítő megnyitása ↗</a></div>
  <div class="actions">${[[phase==="finished"?"Élő nézet":"Játéknézet · mátrix","live"],...(phase==="finished"?[["Pontozási mátrix","matrix"]]:[]),["QR-kód","join"],["Üres vászon","blank"]].map(([label,mode])=>btn(label,"screen",`data-mode="${mode}" aria-pressed="${state.mode===mode || phase!=="finished" && mode==="live" && state.mode==="matrix"}"`)).join("")}<a class="guide-button" href="./trainer-guide.html?v=5" target="_blank" rel="noopener" data-guide-window>Tréneri játékleírás</a></div></section>
  <section class="paper report"><h2>Döntések és pontok</h2>${timeline()}
  ${phase==="finished"?`<label class="focus">Kiemelt forduló a vásznon<select id="focus"><option value="">Teljes döntéssor</option>${state.rounds.map((round,i)=>round.scored?`<option value="${i}" ${state.focus===i?"selected":""}>${i+1}. kör</option>`:"").join("")}</select></label>`:""}</section>
  ${phase==="finished"?`<section class="paper host-reflections"><h2>Csapatreflexiók</h2><div class="reflections">${state.reflections.map((t,i)=>`<article><h3>${esc(state.names[i])}</h3><p>${esc(t || "Várjuk a reflexiót.")}</p>${t?btn("Kivetítés név nélkül","reflect",`data-seat="${i}"`,"quiet")+btn("Névvel","reflect",`data-seat="${i}" data-named="1"`,"quiet"):""}</article>`).join("")}</div></section>`:schedule()}`;
}
const noteDrafts = new Map();
function noteForm(round,index,inline=false) {
  const draft=noteDrafts.get(index);
  return `<form ${inline?'class="paper live-note"':""} data-kind="note" data-index="${index}">${inline?'<h2>Körjegyzet · opcionális</h2>':""}<label>Kérlek kommentáld a döntéseteket.<textarea name="text" maxlength="800" rows="2">${esc(draft ?? round.note)}</textarea></label><button>Jegyzet mentése</button>${round.note && (draft===undefined || draft===round.note)?'<span role="status">Elmentve</span>':""}</form>`;
}
function participant() {
  const now=r(), phase=state.phase;
  let title={lobby:"Várjuk a csapatokat",ready:"A következő körre vártok",negotiation:"Tárgyalás",open:"Mi a döntésetek?",result:"Kör lezárva",finished:"A játék véget ért"}[phase];
  if (phase==="open" && now.own) title=`Mentett döntés: ${now.own}`;
  return `<div class="participant"><section class="hero"><p class="kicker">${esc(state.name)} · ${phase==="finished"?`${state.rounds.filter(x=>x.scored).length} lezárt kör`:`${state.index+1} / ${state.rounds.length}. kör`}</p><h1>${title}</h1><div class="stats"><div><small>Összpont</small><strong>${score(state.ownTotal)}</strong></div>${["open","result"].includes(phase) && now.multiplier?`<div><small>Körszorzó</small><strong>×${now.multiplier}</strong></div>`:""}</div></section>
    ${phase==="finished" && state.reportShared?`<section class="paper"><h2>A tréner megosztotta a végeredményt</h2>${btn("Végeredmény letöltése PDF-ben","pdf","","primary")}</section>`:""}
    ${phase==="open"?`<div class="choices">${["X","Y"].map(v=>btn(v,"move",`data-choice="${v}" aria-label="${v} választása" aria-pressed="${now.own===v}"`,"choice "+v,now.own===v)).join("")}</div>`:""}
    ${phase==="open" && now.own?'<p class="paper">A kör lezárásáig módosíthatjátok a döntést.</p>':""}
    ${phase==="open" && now.own || phase==="result"?noteForm(now,state.index,true):""}
    ${phase==="result"?`<div class="paper"><strong>${split(now.countX)}</strong><p>Saját döntés: ${tag(now.own)} · Körpont: <b>${score(now.ownScore)}</b></p></div>`:""}
    ${matrixFold()}
    ${state.rounds.some(x=>x.scored)?`<details class="paper fold"><summary>Saját döntéseink</summary><ol class="own-history">${state.rounds.map((x,i)=>x.scored?`<li><strong>${i+1}. kör</strong> · ${tag(x.own)} · ${split(x.countX)} · ×${x.multiplier} · <b>${score(x.ownScore)}</b>
    ${phase==="result" && i===state.index?"":noteForm(x,i)}</li>`:"").join("")}</ol></details>`:""}
    ${phase==="finished"?`<form class="paper" data-kind="reflection"><h2>Csapatreflexió</h2><label>Melyik körben változott meg, mire számítottatok a többiektől?<textarea name="text" maxlength="1600" rows="4" required>${esc(state.ownReflection)}</textarea></label><button class="primary">${state.ownReflection?"Reflexió frissítése":"Reflexió elküldése"}</button>${state.ownReflection?'<span role="status"> · Elmentve</span>':""}</form>`:""}
    </div>`;
}
function projection() {
  const phase=state.phase, now=r(), focus=state.rounds[state.focus];
  if (state.mode==="blank") return '<div class="blank"></div>';
  if (state.mode==="join" || phase==="lobby" && state.mode==="live") return `<div class="project"><p class="kicker">Csatlakozás</p><h1>Nagy X/Y</h1>${qrBlock()}</div>`;
  if (["lobby","ready","negotiation","open","result"].includes(phase)) {
    const label={lobby:"Indításra vár",ready:"Indításra vár",negotiation:"Tárgyalás",open:"Döntésre nyitva",result:"Lezárva"}[phase];
    return `<div class="project project-round"><header class="project-round-head"><div><p class="kicker">Pontozási mátrix</p><h1>${state.index+1}. kör</h1></div><span class="round-status ${phase}">${label}</span><strong class="round-stake">${now.multiplier?"×"+now.multiplier:"Alappontok"}</strong></header>${matrix(now.multiplier ?? 1)}</div>`;
  }
  if (state.mode==="matrix") return `<div class="project"><p class="kicker">${state.index+1}. kör · ${now.multiplier?"×"+now.multiplier:"Alappontok"}</p><h1>Pontozási mátrix</h1>${matrix(now.multiplier ?? 1)}</div>`;
  if (state.mode==="reflection") return `<div class="project"><p class="kicker">Reflexió ${esc(state.projectedReflection?.name)}</p><blockquote>${esc(state.projectedReflection?.text)}</blockquote></div>`;
  if (state.mode==="note") return `<div class="project"><p class="kicker">${(state.projectedNote?.round ?? 0)+1}. kör · Körjegyzet ${esc(state.projectedNote?.name)}</p><blockquote>${esc(state.projectedNote?.text)}</blockquote></div>`;
  if (phase==="finished") {
    const pages=Math.ceil(state.rounds.filter(x=>x.scored).length/projectionPageSize);
    return `<div class="project ${focus?"":"project-results"}"><p class="kicker">Feldolgozás</p><h1>${focus?`${state.focus+1}. kör · ×${focus.multiplier}`:"Végeredmény"}</h1>${
      focus?`<p class="large">${split(focus.countX)}</p><div class="focusTeams">${state.names.map((n,i)=>`<div><strong>${esc(n)}</strong>${tag(focus.moves[i])}<span>${score(focus.scores[i])}</span></div>`).join("")}</div>${focus.played?`<p>Tárgyalás a kör előtt · ${focus.played}</p>`:""}`
      :timeline()+`<div class="project-legend">${state.rounds.some(r=>r.noteFlags?.some(Boolean))?`<span>${noteIcon} Körjegyzet</span>`:""}${state.projectorReflections?.some(Boolean)?`<span>${reflectionIcon} Csapatreflexió</span>`:""}${pages>1?`<nav aria-label="Döntéstábla lapozása">${btn("← Előző","project-page",'data-step="-1"',"",projectionPage===0)} <span>${projectionPage+1} / ${pages}</span> ${btn("Következő →","project-page",'data-step="1"',"",projectionPage>=pages-1)}</nav>`:""}</div>`
    }</div>`;
  }
  return "";
}
function startView() {
  if (projector) return '<section class="paper"><h1>A kivetítő kapcsolódik</h1><p>A kivetítőt a tréneri vezérlőből nyisd meg.</p></section>';
  if (pattern.test(code)) return `<section class="hero"><p class="kicker">Csapatbelépés · ${code}</p><h1>${transfer?"Telefoncsere":"Hogy hívják a csapatot?"}</h1>
    <form data-kind="join">${transfer?"":'<label>Csapatnév<input name="name" maxlength="40" autocomplete="off" required></label>'}<button class="primary">Csatlakozás</button></form></section>`;
  return `<section class="hero landing"><div><p class="kicker">Budai Máté · Játékelmélet</p><h1>Nagy X/Y</h1><p>Nyerjetek, amennyit csak tudtok!</p>
  <form data-kind="create"><label>Fordulók száma<input type="number" min="1" max="60" value="10" name="rounds" required></label><button class="primary">Új játék és QR-kód</button></form>
  ${saved.get(last)?btn("Legutóbbi tréneri szoba","recover","","ghost"):""}${saved.get(archiveStorageKey)?btn("Mentett játékok","saved-games","","ghost"):""}</div><div class="poster" aria-hidden="true"><b>X</b><i></i><b>Y</b></div></section>
  <section class="paper join"><h2>Csatlakozás szobakóddal</h2><form data-kind="code"><label>Szobakód<input name="code" maxlength="6" pattern="[A-Za-z2-9]{6}" autocapitalize="characters" required></label><button>Belépek</button></form></section>`;
}
function render(force=false) {
  const next=JSON.stringify(state);
  if (!force && (next===signature || dialog.open || screen.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
  const opened=[...screen.querySelectorAll("details")].map(x=>x.open);
  const previousTable=screen.querySelector(".scroll");
  const scroll=[previousTable?.scrollLeft || 0,previousTable?.scrollTop || 0];
  signature=next;
  document.body.classList.toggle("projection",projector);
  document.body.classList.toggle("trainer",!!state?.host);
  document.body.classList.toggle("team-view",!!state && !state.host && !projector);
  document.body.classList.toggle("blackout",projector&&state?.mode==="blank");
  screen.innerHTML=!state?startView():state.host?hostView():projector?projection():participant();
  screen.querySelectorAll("details").forEach((d,i)=>d.open=opened[i]||false);
  screen.querySelector(".scroll")?.scrollTo(...scroll);
  if ($("qr") && window.qrcode) {
    const qr=window.qrcode(0,"M"); qr.addData(joinUrl()); qr.make();
    $("qr").innerHTML=qr.createSvgTag({cellSize:5,margin:20,scalable:true,alt:"Csatlakozási QR-kód"});
  }
  fitProjectedQuote();
  fitProjectionTable();
}
function fitProjectionTable() {
  if(!projector) return;
  const table=screen.querySelector(".project-results .timeline");
  if(!table) return;
  table.style.zoom="";
  const frame=table.parentElement.getBoundingClientRect();
  const box=table.getBoundingClientRect();
  if(box.height>frame.height+1 && frame.height>0) table.style.zoom=String(frame.height/box.height);
}
function fitProjectedQuote() {
  const quote=projector && screen.querySelector(".project blockquote");
  if(!quote) return;
  quote.style.fontSize="";
  const available=quote.parentElement.getBoundingClientRect().bottom-quote.getBoundingClientRect().top-12;
  let size=parseFloat(getComputedStyle(quote).fontSize);
  while(quote.scrollHeight>available && size>8) {
    size=Math.max(8,size*.9);
    quote.style.fontSize=size+"px";
  }
}
window.addEventListener("resize",fitProjectedQuote);
window.addEventListener("resize",fitProjectionTable);
if(projector) document.fonts?.ready.then(fitProjectionTable);
async function run(act,b={}) {
  if (busy) return false;
  busy=true; revision++; setError(""); signal.textContent="Mentés…";
  try {
    state=await command(endpoint(act),key,{index:state?.index,...b});
    signal.textContent="Kapcsolódva";
    render(true);return true;
  } catch(e) {setError(e.message);signal.textContent="Ellenőrizd a kapcsolatot";return false;}
  finally {busy=false;}
}
function confirmBox(title,body,callback) {
  dialog.innerHTML=`<form method="dialog"><h2>${title}</h2>${body}<div class="actions"><button value="cancel">Mégse</button><button class="primary" value="yes">Megerősítem</button></div></form>`;
  dialog.showModal();
  dialog.addEventListener("close",()=>{if(dialog.returnValue==="yes")callback();render();},{once:true});
}
async function downloadReport(reportPath=endpoint("report"), reportKey=key, archived=false) {
  busy=true;revision++;setError("");signal.textContent="PDF készül…";
  try{
    const data=await readState(reportPath,reportKey);
    const report=archived?data.report:data;
    const href=URL.createObjectURL(await createReportPdf(report));
    const a=document.createElement("a");
    a.href=href;a.download="nagy-xy-vegeredmeny-"+report.code+".pdf";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),30000);
  }catch(e){setError(e.message);}
  finally{busy=false;signal.textContent="Kapcsolódva";}
}
function saveGameDialog() {
  const today=new Intl.DateTimeFormat("sv-SE").format(new Date());
  dialog.innerHTML=`<form id="save-game-form">
    <h2>Játék mentése</h2>
    <label>Dátum<input type="date" name="date" value="${today}" required></label>
    <label>Cég<input name="company" maxlength="120" required></label>
    <label>Miért érdekes ez a játék?<textarea name="reason" rows="4" maxlength="1600" required></textarea></label>
    <p role="alert" data-archive-error></p>
    <div class="actions"><button type="button" data-close-archive>Mégse</button><button class="primary">Mentés</button></div>
  </form>`;
  dialog.showModal();
}
async function savedGamesDialog() {
  busy=true;setError("");
  try {
    const entries=await readState(archivePath,saved.get(archiveStorageKey));
    dialog.innerHTML=`<div class="archive-list"><h2>Mentett játékok</h2>
      ${entries.length?entries.map(entry=>`<article>
        <h3>${esc(entry.company)}</h3>
        <p><small>${esc(entry.date)} · ${entry.rounds} lezárt kör · ${esc(entry.code)}</small></p>
        <p class="archive-reason">${esc(entry.reason)}</p>
        <button type="button" data-archive-pdf="${esc(entry.id)}">Eredmény letöltése PDF-ben</button>
      </article>`).join(""):"<p>Még nincs mentett játék.</p>"}
      <p role="alert" data-archive-error></p><button type="button" data-close-archive>Bezárás</button>
    </div>`;
    dialog.showModal();
  } catch(e) {setError(e.message);}
  finally{busy=false;}
}
dialog.addEventListener("click",e=>{
  if(e.target.closest("[data-close-archive]") && !busy) dialog.close();
  const pdf=e.target.closest("[data-archive-pdf]");
  if(pdf && !busy) void downloadReport(archivePath+"/"+pdf.dataset.archivePdf,saved.get(archiveStorageKey),true);
});
dialog.addEventListener("submit",async e=>{
  if(e.target.id!=="save-game-form") return;
  e.preventDefault();
  if(busy) return;
  busy=true;
  const form=e.target, submit=form.querySelector('button.primary'), error=form.querySelector("[data-archive-error]");
  submit.disabled=true;error.textContent="";
  try {
    const archiveKey=localStorage.getItem(archiveStorageKey) || secret();
    localStorage.setItem(archiveStorageKey,archiveKey);
    await command(endpoint("archive"),key,{...Object.fromEntries(new FormData(form)),archiveKey});
    dialog.close();
    signal.textContent="Játék elmentve";
  } catch(e) {error.textContent=e.message;}
  finally{busy=false;submit.disabled=false;}
});
screen.addEventListener("click",e=>{
  const guide=e.target.closest("[data-guide-window]");
  if (guide && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    const popup=window.open(guide.href,"xy-trainer-guide","popup,width=820,height=780");
    if (popup) {
      popup.opener=null;
      popup.focus();
      e.preventDefault();
    }
    return;
  }
  const b=e.target.closest("button[data-act]"); if(!b||busy)return;
  const {act,seat,choice,mode,named}=b.dataset;
  if(act==="new-game"){location.href="./";return;}
  if(act==="save-game"){saveGameDialog();return;}
  if(act==="saved-games"){void savedGamesDialog();return;}
  if(act==="recover"){location.href="?room="+saved.get(last);return;}
  if(act==="pdf"){void downloadReport();return;}
  if(act==="share-pdf"){
    confirmBox(state.reportShared?"Frissíted a megosztott PDF-et?":"Megosztod a PDF-et a csapatokkal?",
      "<p>A csatlakozott csapatok letölthetik a végeredményt, az eddig beérkezett körjegyzetekkel és reflexiókkal együtt.</p>",
      ()=>run("reportshare",{enabled:true}));return;
  }
  if(act==="unshare-pdf"){void run("reportshare",{enabled:false});return;}
  if(act==="screen"){void run(act,{mode});return;}
  if(act==="results"){void run("focus",{index:null});return;}
  if(act==="read-note" && (state.host || projector) || act==="read-reflection" && projector){
    const index=Number(b.dataset.round);
    const isReflection=act==="read-reflection";
    const round=state.rounds[index];
    const comment=isReflection?state.projectorReflections?.[Number(seat)]:
      (state.host?round?.hostNotes:round?.projectorNotes)?.[Number(seat)];
    if(!comment) return;
    const context=isReflection?state.names[Number(seat)]:`${index+1}. kör · ${state.names[Number(seat)]}`;
    dialog.classList.add("project-note");
    dialog.innerHTML=`<form method="dialog"><p class="kicker">${esc(context)}</p><h2>${isReflection?"Csapatreflexió":"Körjegyzet"}</h2><p class="project-note-text">${esc(comment)}</p><button class="primary">${state.host?"Bezárás":"Vissza a táblához"}</button></form>`;
    dialog.addEventListener("close",()=>{dialog.classList.remove("project-note");render();},{once:true});
    dialog.showModal();
    const commentBox=dialog.querySelector(".project-note-text");
    let size=parseFloat(getComputedStyle(commentBox).fontSize);
    while(projector && dialog.scrollHeight>dialog.clientHeight+1 && size>9){
      size=Math.max(9,size*.9);
      commentBox.style.fontSize=size+"px";
    }
    return;
  }
  if(act==="project-page"){projectionPage+=Number(b.dataset.step);render(true);return;}
  if(act==="reflect"){void run("screen",{mode:"reflection",seat:Number(seat),anonymous:!named});return;}
  if(act==="move"){const index=state.index;confirmBox(`${choice} legyen a döntés?`,"<p>A kör lezárásáig még módosíthatjátok.</p>",()=>run(act,{choice,index}));return;}
  if(act==="finish"){
    const index=state.index;
    if(state.phase==="result" && index===state.rounds.length-1){void run(act,{index});return;}
    const detail=state.phase==="open"?"A nyitott kör döntései nem számítanak bele.":"A lezárt körök pontjai megmaradnak.";
    confirmBox("Lezárod a játékot?",`<p>${detail} A csapatok ezután reflexiót írhatnak.</p>`,()=>run(act,{index}));return;
  }
  if(act==="manual"){
    dialog.innerHTML=`<form method="dialog"><h2>Kézi döntés · ${esc(state.names[seat])}</h2><p>A csapat által megadott döntést rögzítsd.</p><div class="actions"><button value="">Mégse</button><button value="X">X</button><button value="Y">Y</button></div></form>`;
    dialog.showModal();dialog.addEventListener("close",()=>{if(["X","Y"].includes(dialog.returnValue))void run(act,{seat:Number(seat),choice:dialog.returnValue});render();},{once:true});return;
  }
  if(act==="transfer"){
    const invite=secret(); void run(act,{seat:Number(seat),transfer:invite}).then(ok=>{
      if(!ok)return;
      const link=joinUrl()+"#transfer="+invite;
      dialog.innerHTML=`<form method="dialog"><h2>Telefoncsere</h2><div id="transferQr"></div><p><a href="${link}" target="_blank" rel="noopener">Egyszer használható belépő</a></p><button>Bezárás</button></form>`;
      const qr=window.qrcode(0,"M");qr.addData(link);qr.make();$("transferQr").innerHTML=qr.createSvgTag({cellSize:5,margin:20,scalable:true});
      dialog.showModal();
    });return;
  }
  if(act==="seat"){
    const i=Number(seat);
    if(state.occupied[i]) confirmBox("Csapat eltávolítása","",()=>run("remove",{seat:i}));
    else confirmBox("Kézi csapathely",'<label>Csapatnév<input id="seatName" maxlength="40"></label>',()=>run("seat",{seat:i,name:$("seatName").value}));
    return;
  }
  void run(act);
});
screen.addEventListener("change",e=>{
  if(e.target.id==="focus")void run("focus",{index:e.target.value===""?null:Number(e.target.value)});
  if(e.target.id==="quick-weight")void run("config",{multiplier:Number(e.target.value),negotiations:r().negotiations});
});
screen.addEventListener("input",e=>{
  const form=e.target.closest('form[data-kind="note"]');
  if(form && e.target.name==="text") noteDrafts.set(Number(form.dataset.index),e.target.value);
});
screen.addEventListener("submit",async e=>{
  const form=e.target.closest("form[data-kind]");if(!form)return;e.preventDefault();if(busy)return;
  const b=Object.fromEntries(new FormData(form)), kind=form.dataset.kind;
  if(kind==="code"){location.href="?room="+b.code.toUpperCase();return;}
  if(kind==="create"){
    busy=true;setError("");
    const seed=JSON.parse(saved.get("xy:pending")||"null")||{code:rnd(),key:secret(),projector:secret(),rounds:Number(b.rounds)};
    saved.set("xy:pending",JSON.stringify(seed));
    try{
      await command("/api/xy/rooms",null,seed);
      saved.set("xy:"+seed.code+":player",seed.key);saved.set("xy:"+seed.code+":projector",seed.projector);saved.set(last,seed.code);
      saved.remove("xy:pending");location.href="?room="+seed.code;
    }catch(err){setError(err.message);if(!err.retryable)saved.remove("xy:pending");busy=false;}
    return;
  }
  if(kind==="join"){
    key ||= secret();
    saved.set(slot(),key);
    const ok=await run("join",{name:b.name,transfer});
    if(ok){history.replaceState(null,"",location.pathname+location.search);}
    else if(!state){saved.remove(slot());key=null;}
    return;
  }
  const index=Number(form.dataset.index);
  if(kind==="config") await run(kind,{index,multiplier:Number(b.multiplier),negotiations:Number(b.negotiations)});
  else if(kind==="note") {
    if(await run(kind,{index,text:b.text}) && noteDrafts.get(index)===b.text) {
      noteDrafts.delete(index);
      render(true);
    }
  }
  else await run(kind,{text:b.text});
});
let pollTimer;
async function poll() {
  clearTimeout(pollTimer);
  if (!busy && !pending && key && pattern.test(code)) {
    pending=true;
    const requestedAt=revision;
    try {
      const next=await readState(endpoint()+(document.hidden?"?idle=1":""),key);
      if(!busy && revision===requestedAt){state=next;signal.textContent="Kapcsolódva";setError("");render();}
    } catch(e) {
      signal.textContent="Kapcsolat keresése…";
      if(e.status===403 && !state && !projector && !transfer){saved.remove(slot());key=null;render(true);}
      else if(e.status===404 || e.status===403)setError(e.message);
    } finally {pending=false;}
  }
  pollTimer=setTimeout(poll,document.hidden?4500:1250);
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)void poll();});
window.addEventListener("pageshow",()=>void poll());
render(true);
void poll();
