import { command, readState, saved, secret } from "../connection.js?v=5";

const $ = id => document.getElementById(id);
const screen = $("screen"), dialog = $("dialog"), signal = $("signal");
const url = new URL(location.href), projector = url.searchParams.has("screen");
const pattern = /^[A-Z2-9]{6}$/;
let code = (url.searchParams.get("room") || "").toUpperCase(), state, busy = false, signature = "", pending = false, revision = 0;
const last = "xy:last";
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
function matrix(multiplier) {
  return `<table class="matrix"><thead><tr><th>A négy döntés</th><th>Egy X pontja</th><th>Egy Y pontja</th></tr></thead><tbody>${
    [[0,null,10],[1,30,-10],[2,20,-20],[3,10,-30],[4,-10,null]].map(([x,a,b])=>`<tr><th>${split(x)}</th>${
      [a,b].map(n=>`<td>${n===null ? "—" : score(n*multiplier)+(multiplier===1?"":`<small>alap: ${score(n)}</small>`)}</td>`).join("")}</tr>`).join("")
    }</tbody></table>`;
}
function matrixFold() {
  return `<details class="paper fold"><summary>Pontozási mátrix <span>×${r().multiplier}</span></summary>${matrix(r().multiplier)}</details>`;
}
function roster() {
  return `<div class="roster">${state.occupied.map((yes,i)=>{
    const move=r().moves?.[i], label=yes ? state.names[i] : "Szabad csapathely";
    return `<div class="seat"><span class="seatNo">0${i+1}</span><strong>${esc(label)}</strong>
      ${state.phase==="open" ? (move ? tag(move,move+(r().manual[i]?" · kézi":"")) : btn("Kézi döntés","manual",`data-seat="${i}"`,"quiet")) :
         state.phase==="lobby" ? btn(yes?"Eltávolítás":"Kézi hely","seat",`data-seat="${i}"`,"quiet") : `<span class="total">${score(state.totals[i])}</span>`}
      ${yes ? btn("Telefoncsere","transfer",`data-seat="${i}"`,"link") : ""}</div>`;
  }).join("")}</div>`;
}
function qrBlock() {
  return `<div class="qr-card"><div id="qr" aria-label="Csatlakozási QR-kód"></div><div><small>Szobakód</small><strong>${code}</strong><a href="${joinUrl()}" target="_blank" rel="noopener">Belépő megnyitása</a></div></div>`;
}
function timeline() {
  const visible = state.rounds.map((round,i)=>({round,i})).filter(({round})=>round.scored);
  if (!visible.length) return '<p class="muted">A lezárt körök itt jelennek meg.</p>';
  const marker = (round,i,head=false) => round.played ? (head ? `<th class="neg" title="${round.played} tárgyalás a ${i+1}. kör előtt">T${round.played>1?" · "+round.played:""}</th>` : '<td class="neg"></td>') : "";
  return `<div class="scroll"><table class="timeline"><thead><tr><th>Csapat</th><th>Összpont</th>${
    visible.map(({round,i})=>marker(round,i,true)+`<th>${i+1}. kör <small>×${round.multiplier}</small></th>`).join("")
  }</tr></thead><tbody>${state.names.map((name,j)=>`<tr><th>${esc(name)}</th><td class="total">${score(state.totals[j])}</td>${
    visible.map(({round,i})=>marker(round,i)+`<td>${tag(round.moves[j])}<small>${score(round.scores[j])}${round.manual?.[j]?" · kézi":""}</small></td>`).join("")
  }</tr>`).join("")}<tr class="group"><th>Együttesen</th><td>${score(state.totals.reduce((a,b)=>a+b,0))}</td>${
    visible.map(({round,i})=>marker(round,i)+`<td>${score(round.scores.reduce((a,b)=>a+b,0))}</td>`).join("")
  }</tr></tbody></table></div>`;
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
  if (phase==="finished") {title="Feldolgozás";desc=`${state.reflections.filter(Boolean).length}/4 reflexió beérkezett`;action=btn("CSV letöltése","csv","","primary")+btn(state.names&&state.rounds.length&&(state.revealed?"Csapatriport elrejtése":"Csapatriport megosztása"),"reveal");}
  return `<section class="hero board"><div><p class="kicker">Tréneri vezérlő · ${code}</p><h1>${title}</h1><p>${desc}</p><div class="actions">${action}</div></div><div class="weight"><span>${state.index+1} / ${state.rounds.length}. kör</span><strong>×${now.multiplier}</strong></div></section>
  ${phase==="lobby"?qrBlock():""}${roster()}
  <section class="paper tools"><div><h2>Kivetítő</h2><a href="${screenUrl()}" target="_blank" rel="noopener">Kivetítő megnyitása ↗</a></div>
  <div class="actions">${[["Élő nézet","live"],["Pontozási mátrix","matrix"],["QR-kód","join"],["Üres vászon","blank"]].map(([label,mode])=>btn(label,"screen",`data-mode="${mode}" aria-pressed="${state.mode===mode}"`)).join("")}</div></section>
  <section class="paper report"><h2>Döntések és pontok</h2>${timeline()}
  ${phase==="finished"?`<label class="focus">Kiemelt forduló a vásznon<select id="focus"><option value="">Teljes döntéssor</option>${state.rounds.map((_,i)=>`<option value="${i}" ${state.focus===i?"selected":""}>${i+1}. kör</option>`).join("")}</select></label>`:""}</section>
  ${phase==="finished"?`<section class="paper"><h2>Csapatreflexiók</h2><div class="reflections">${state.reflections.map((t,i)=>`<article><h3>${esc(state.names[i])}</h3><p>${esc(t || "Várjuk a reflexiót.")}</p>${t?btn("Kivetítés név nélkül","reflect",`data-seat="${i}"`,"quiet")+btn("Névvel","reflect",`data-seat="${i}" data-named="1"`,"quiet"):""}</article>`).join("")}</div></section>`:schedule()}`;
}
function participant() {
  const now=r(), phase=state.phase;
  let title={lobby:"Várjuk a csapatokat",ready:"A következő körre vártok",negotiation:"Tárgyalás",open:"Mi a döntésetek?",result:"Kör lezárva",finished:"A játék véget ért"}[phase];
  if (phase==="open" && now.own) title=`Az ${now.own} beérkezett`;
  return `<div class="participant"><section class="hero"><p class="kicker">${esc(state.name)} · ${state.index+1} / ${state.rounds.length}. kör</p><h1>${title}</h1><div class="stats"><div><small>Összpont</small><strong>${score(state.ownTotal)}</strong></div>${phase!=="negotiation"?`<div><small>Körszorzó</small><strong>×${now.multiplier}</strong></div>`:""}</div></section>
    ${phase==="open" && !now.own?`<div class="choices">${["X","Y"].map(v=>btn(v,"move",`data-choice="${v}" aria-label="${v} választása"`,"choice "+v)).join("")}</div>`:""}
    ${phase==="open" && now.own?'<p class="paper">A döntést rögzítettük. A tréner zárja a kört.</p>':""}
    ${phase==="result"?`<div class="paper"><strong>${split(now.countX)}</strong><p>Saját döntés: ${tag(now.own)} · Körpont: <b>${score(now.ownScore)}</b></p></div>`:""}
    ${matrixFold()}
    ${state.rounds.some(x=>x.scored)?`<details class="paper fold"><summary>Saját döntéseink</summary><ol class="own-history">${state.rounds.map((x,i)=>x.scored?`<li><strong>${i+1}. kör</strong> · ${tag(x.own)} · ${split(x.countX)} · ×${x.multiplier} · <b>${score(x.ownScore)}</b>
    <form data-kind="note" data-index="${i}"><label>Körjegyzet<input name="text" maxlength="800" value="${esc(x.note)}"></label><button>Mentés</button></form></li>`:"").join("")}</ol></details>`:""}
    ${phase==="finished"?`<form class="paper" data-kind="reflection"><h2>Csapatreflexió</h2><label>Melyik körben változott meg, mire számítottatok a többiektől?<textarea name="text" maxlength="1600" rows="4" required>${esc(state.ownReflection)}</textarea></label><button class="primary">${state.ownReflection?"Reflexió frissítése":"Reflexió elküldése"}</button>${state.ownReflection?'<span role="status"> · Elmentve</span>':""}</form>`:""}
    ${state.names && phase==="finished"?`<section class="paper"><h2>Közös döntéssor</h2>${timeline()}</section>`:""}</div>`;
}
function projection() {
  const phase=state.phase, now=r(), focus=state.rounds[state.focus];
  if (state.mode==="blank") return '<div class="blank"></div>';
  if (state.mode==="join" || phase==="lobby" && state.mode==="live") return `<div class="project"><p class="kicker">Csatlakozás</p><h1>Nagy X/Y</h1>${qrBlock()}</div>`;
  if (state.mode==="matrix") return `<div class="project"><p class="kicker">${state.index+1}. kör · ×${now.multiplier}</p><h1>Pontozási mátrix</h1>${matrix(now.multiplier)}</div>`;
  if (state.mode==="reflection") return `<div class="project"><p class="kicker">Reflexió ${esc(state.projectedReflection?.name)}</p><blockquote>${esc(state.projectedReflection?.text)}</blockquote></div>`;
  if (phase==="finished") return `<div class="project"><p class="kicker">Feldolgozás</p><h1>${focus?`${state.focus+1}. kör · ×${focus.multiplier}`:"Döntések és pontok"}</h1>${
    focus?`<p class="large">${split(focus.countX)}</p><div class="focusTeams">${state.names.map((n,i)=>`<div><strong>${esc(n)}</strong>${tag(focus.moves[i])}<span>${score(focus.scores[i])}</span></div>`).join("")}</div>${focus.played?`<p>Tárgyalás a kör előtt · ${focus.played}</p>`:""}`:timeline()}</div>`;
  return `<div class="project"><p class="kicker">${state.index+1}. kör${phase==="negotiation"?"":" · ×"+now.multiplier}</p><h1>${{ready:"Következő kör",negotiation:"Tárgyalás",open:"Döntésre nyitva",result:split(now.countX)}[phase]}</h1>${phase==="open"?'<div class="projectXY">X<span>/</span>Y</div>':""}</div>`;
}
function startView() {
  if (projector) return '<section class="paper"><h1>A kivetítő kapcsolódik</h1><p>A kivetítőt a tréneri vezérlőből nyisd meg.</p></section>';
  if (pattern.test(code)) return `<section class="hero"><p class="kicker">Csapatbelépés · ${code}</p><h1>${transfer?"Telefoncsere":"Hogy hívják a csapatot?"}</h1>
    <form data-kind="join">${transfer?"":'<label>Csapatnév<input name="name" maxlength="40" autocomplete="off" required></label>'}<button class="primary">Csatlakozás</button></form></section>`;
  return `<section class="hero landing"><div><p class="kicker">Budai Máté · Játékelmélet</p><h1>Nagy X/Y</h1><p>Nyerjetek, amennyit csak tudtok!</p>
  <form data-kind="create"><label>Fordulók száma<input type="number" min="1" max="60" value="10" name="rounds" required></label><button class="primary">Új játék és QR-kód</button></form>
  ${saved.get(last)?btn("Legutóbbi tréneri szoba","recover","","ghost"):""}</div><div class="poster" aria-hidden="true"><b>X</b><i></i><b>Y</b></div></section>
  <section class="paper join"><h2>Csatlakozás szobakóddal</h2><form data-kind="code"><label>Szobakód<input name="code" maxlength="6" pattern="[A-Za-z2-9]{6}" autocapitalize="characters" required></label><button>Belépek</button></form></section>`;
}
function render(force=false) {
  const next=JSON.stringify(state);
  if (!force && (next===signature || dialog.open || screen.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
  const opened=[...screen.querySelectorAll("details")].map(x=>x.open);
  const scroll=screen.querySelector(".scroll")?.scrollLeft || 0;
  signature=next;
  document.body.classList.toggle("projection",projector);
  document.body.classList.toggle("blackout",projector&&state?.mode==="blank");
  screen.innerHTML=!state?startView():state.host?hostView():projector?projection():participant();
  screen.querySelectorAll("details").forEach((d,i)=>d.open=opened[i]||false);
  if (screen.querySelector(".scroll")) screen.querySelector(".scroll").scrollLeft=scroll;
  if ($("qr") && window.qrcode) {
    const qr=window.qrcode(0,"M"); qr.addData(joinUrl()); qr.make();
    $("qr").innerHTML=qr.createSvgTag({cellSize:5,margin:20,scalable:true,alt:"Csatlakozási QR-kód"});
  }
}
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
function download() {
  const quote=x=>'"'+(typeof x==="number"?String(x):String(x??"").replace(/^[\s]*[=+@-]/,c=>"'"+c)).replaceAll('"','""')+'"';
  const rows=[["Kör","Tárgyalások előtte","Szorzó","Csapat","Döntés","Körpont","Futó pont","Kézi rögzítés","Reflexió"]];
  const totals=[0,0,0,0];
  state.rounds.forEach((r,i)=>r.scored&&state.names.forEach((name,j)=>rows.push([i+1,r.played,r.multiplier,name,r.moves[j],r.scores[j],totals[j]+=r.scores[j],r.manual[j]?"igen":"",i===state.rounds.length-1?state.reflections[j]:""])));
  const href=URL.createObjectURL(new Blob(["\ufeff"+rows.map(row=>row.map(quote).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a"); a.href=href;a.download="nagy-xy-"+code+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
screen.addEventListener("click",e=>{
  const b=e.target.closest("button[data-act]"); if(!b||busy)return;
  const {act,seat,choice,mode,named}=b.dataset;
  if(act==="recover"){location.href="?room="+saved.get(last);return;}
  if(act==="csv"){download();return;}
  if(act==="screen"){void run(act,{mode});return;}
  if(act==="reflect"){void run("screen",{mode:"reflection",seat:Number(seat),anonymous:!named});return;}
  if(act==="reveal"){void run(act,{enabled:!state.revealed});return;}
  if(act==="move"){confirmBox(`${choice} legyen a döntés?`,"<p>A megerősített döntést erre a körre rögzítjük.</p>",()=>run(act,{choice}));return;}
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
screen.addEventListener("change",e=>{if(e.target.id==="focus")void run("focus",{index:e.target.value===""?null:Number(e.target.value)});});
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
  else if(kind==="note") await run(kind,{index,text:b.text});
  else await run(kind,{text:b.text});
});
async function poll() {
  if (!busy && !pending && key && pattern.test(code)) {
    pending=true;
    const requestedAt=revision;
    try {
      const next=await readState(endpoint(),key);
      if(!busy && revision===requestedAt){state=next;signal.textContent="Kapcsolódva";setError("");render();}
    } catch(e) {
      signal.textContent="Kapcsolat keresése…";
      if(e.status===403 && !state && !projector && !transfer){saved.remove(slot());key=null;render(true);}
      else if(e.status===404 || e.status===403)setError(e.message);
    } finally {pending=false;}
  }
  setTimeout(poll,document.hidden?4500:1250);
}
render(true);
void poll();
