"use strict";
const screen=document.querySelector("#screen"), errors=document.querySelector("#error"), connection=document.querySelector("#connection");
const home = new URL("./", location.href);
const backend = location.hostname === "matebudai-hue.github.io" ? "https://chicken-run.mbudai.chatgpt.site" : location.origin;
const roomLink = (code, trainer = false) => {
  const url = new URL(home);
  url.searchParams.set("room", code);
  if (trainer) url.searchParams.set("view", "host");
  return url.href;
};
const params=new URLSearchParams(location.search), room=(params.get("room")||"").toUpperCase(), host=params.get("view")==="host";
const key="cr:"+(host?"host":"player")+":"+room, codeOK=/^[23456789A-HJ-NP-Z]{8}$/;
const results = { a: "A tért ki", b: "B tért ki", both: "Mindketten kitértek", crash: "Ütközés", stopped: "Lezárva" };
const outcomes = { own: "Te tértél ki", other: "A másik autó tért ki", both: results.both, crash: results.crash, stopped: results.stopped };
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const time = at => at ? new Date(at).toLocaleTimeString("hu-HU") : "–";
function decisionTable(history, a, b, read) {
  if (!history.length) return '<p class="muted">Ehhez a játékhoz még nincs közösen lezárt döntés.</p>';
  const rows = history.map(row => {
    const [first, second] = read(row);
    return '<tr><td>'+row.distance+' m</td><td>'+time(row.at)+'</td><td>'+moves[first]+'</td><td>'+moves[second]+'</td></tr>';
  }).join("");
  return '<table><thead><tr><th>Távolság</th><th>Időpont</th><th>'+a+'</th><th>'+b+'</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
const moves={go:"Halad",yield:"Kitér"};
let auth=localStorage.getItem(key), state, snapshot, busy=false, polling=false, generation=0, draft="", notice;
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,"0")).join("");
function error(message){
  clearTimeout(notice); errors.hidden=!message; errors.textContent=message;
  if(message)notice=setTimeout(()=>{errors.hidden=true},6000);
}
async function req(path,body,token){
  const headers={}; if(token)headers.Authorization="Bearer "+token;
  if(body!==undefined)headers["Content-Type"]="application/json";
  const response=await fetch(backend+path,{headers,method:body===undefined?"GET":"POST",body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(7500)});
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error),{status:response.status});
  return data;
}
const api=action=>"/api/rooms/"+room+"/"+action;
function update(value){
  const signature=JSON.stringify(value);
  if(signature!==snapshot){
    if(state?.number !== value.number) draft="";
    state=value;snapshot=signature;render();
  }
}
async function poll(){
  if(!auth||!codeOK.test(room)||busy||polling)return;
  const version=generation;
  polling=true;
  try{
    const next=await req(api("state"),undefined,auth);
    if(version===generation){connection.textContent="";update(next);}
  }catch(e){
    if(version!==generation)return;
    if(e.status===403||e.status===404){
      localStorage.removeItem(key);auth=null;state=undefined;snapshot=undefined;
      screen.innerHTML='<section class="panel"><h1>A futam nem elérhető</h1><p>Olvasd be újra a tréner QR-kódját, vagy indíts új futamot.</p><a href="./">Vissza a főoldalra</a></section>';
    }else connection.textContent="Újracsatlakozás…";
  }finally{polling=false;}
}
async function action(name, body={}){
  if(busy)return false;
  busy=true;generation++;
  const buttons=[...screen.querySelectorAll("button:not(:disabled)")]; buttons.forEach(b=>b.disabled=true);
  try{
    const next=await req(api(name),body,auth);
    if(name==="message"&&draft.trim()===body.text)draft="";
    error("");update(next);return true;
  }catch(e){error(e.status?e.message:"Kapcsolati hiba. Próbáld újra.");return false;}
  finally{busy=false;buttons.forEach(b=>{if(b.isConnected)b.disabled=false;});if(name!=="join")void poll();}
}
function lobbyHost(){
  const url=roomLink(room);
  screen.innerHTML='<div class="intro"><p class="kicker">Tréneri nézet</p><h1>Váró</h1></div><div class="lobby"><div class="panel stack"><p>Szobakód <strong class="room-code">'+room+'</strong></p><p class="big-count">'+state.count+'</p><p>csatlakozott játékos</p>'+
    (state.count%2?'<p class="muted">Páratlan létszámnál egy tesztjátékos egészíti ki a mezőnyt.</p>':'')+
    '<button data-do="start"'+(state.count<1?' disabled':'')+'>Párosítás és indítás</button></div><div class="panel qr"><div id="qr"></div><a id="join-url" href="'+url+'">Játékosok belépőlinkje</a><button class="secondary" data-do="copy">Link másolása</button></div></div>';
  const qr=qrcode(0,"M");qr.addData(url);qr.make();
  document.querySelector("#qr").innerHTML=qr.createSvgTag({cellSize:5,margin:20,scalable:true,alt:"QR-kód a játékosok belépéséhez"});
}
function hostRace(){
  const s = state;
  const open = new Set([...screen.querySelectorAll("details[open]")].map(el => el.id));
  const active = s.pairs.filter(p => !p.result).length;
  const stats = [
    ["Egyik kitért", s.results.a + s.results.b], [results.both, s.results.both],
    [results.crash, s.results.crash], [results.stopped, s.results.stopped],
  ].map(([label, value]) => '<div class="stat"><strong>'+value+'</strong><span>'+label+'</span></div>').join("");
  const matches = s.pairs.map(p => {
    const [a, b] = p.names.map(escapeHtml);
    const id = "match-"+p.number;
    const outcome = p.result === "a" ? a+" tért ki" : p.result === "b" ? b+" tért ki" : results[p.result];
    return '<details id="'+id+'"'+(open.has(id)?' open':'')+'><summary><strong>'+p.number+'. játék · '+a+' és '+b+
      '</strong><span class="muted">'+p.distance+' m · '+(outcome || p.ready+' / 2 döntés')+'</span></summary>'+
      decisionTable(p.history, a, b, row => row.choices)+'</details>';
  }).join("");
  screen.innerHTML = '<div class="intro"><p class="kicker">Tréneri nézet · '+room+'</p><h1>'+
    (s.phase === "closed" ? "Eredmények" : "Futam")+'</h1><p class="muted">'+s.count+' résztvevő · '+s.pairs.length+
    ' játék · '+active+' aktív</p></div><div class="panel stats">'+stats+
    '</div><div class="panel stack"><h2>Párok és döntések</h2><p class="muted">Új partnerre vár: '+
    (s.queue.map(escapeHtml).join(", ") || "senki")+'</p>'+matches+
    (s.phase === "closed" ? '<button data-do="create">Új tréningfutam</button>' : '<button class="danger" data-do="stop">Futam lezárása</button>')+'</div>';
}
function playerReport(){
  const open = new Set([...screen.querySelectorAll("details[open]")].map(el => el.id));
  const entries = state.report.map(match => {
    const id = "report-"+match.number;
    return '<details id="'+id+'"'+(open.has(id) || match.number === state.report.at(-1).number?' open':'')+
      '><summary><strong>'+match.number+'. játék · '+outcomes[match.outcome]+'</strong>'+
      (match.bot?'<span class="muted">Tesztjátékos ellen</span>':'')+'</summary>'+
      decisionTable(match.history, "Te", "A másik autó", row => [row.own, row.other])+'</details>';
  }).join("");
  return '<section class="panel stack"><h2>Saját döntési riport</h2>'+entries+'</section>';
}
function rematchControls(){
  if (state.phase === "closed") return '<p class="muted">A tréner lezárta a futamot.</p>';
  if (state.queued) return '<p role="status">Várunk egy másik játékosra, aki szintén új játékot indított.</p>'+
    '<button class="secondary" data-do="cancel">Kilépek a várólistáról</button>';
  return '<button data-do="requeue">Új játékot indítok</button>';
}
function race(){
  const s=state, old=document.querySelector("#messages"), focus=document.activeElement?.id==="message-input",
    position=document.activeElement?.selectionStart, scroll=old?.scrollTop??0,
    stick=!old||old.scrollHeight-scroll-old.clientHeight<36, open=document.querySelector("#history")?.open;
  const last=s.history.at(-1), lx=46-37*s.distance/1000, rx=54+37*s.distance/1000;
  const result = outcomes[s.outcome];
  const report = s.report.length ? playerReport() : "";
  screen.innerHTML='<div class="intro"><p class="kicker">Szoba '+room+' · '+s.number+'. játék</p><h1>Szemben az úton</h1></div><div class="game"><section class="panel"><div class="dash"><div><p class="muted">Távolság köztetek</p><p class="distance">'+s.distance+
    ' <small>m</small></p></div><span class="muted">'+(s.step+1)+'. pont / 7</span></div><div class="road" aria-hidden="true"><span class="car'+
    (s.result&&last?.own==="yield"?" yield":"")+'" style="left:'+lx+'%"></span><span class="car other'+(s.result&&last?.other==="yield"?" yield":"")+
    '" style="left:'+rx+'%"></span></div><div class="legend"><span>Te</span><span>A másik autó</span></div>'+
    (s.result?'<p class="result" role="status">'+result+'</p><div class="stack rematch">'+rematchControls()+'</div>':'<div class="actions"><button data-do="go"'+(s.waiting?' disabled':'')+'>Haladok</button><button class="secondary" data-do="yield"'+(s.waiting?' disabled':'')+'>Kitérek</button></div><p class="muted" role="status">'+
    (s.waiting?"A döntésed beérkezett. Várunk a másik autóra.":"Mindkét döntés beérkezése után derül ki, mi történt.")+'</p>')+
    (!s.result && s.history.length ? '<details id="history"'+(open?' open':'')+'><summary>Eddigi döntések</summary>'+
      decisionTable(s.history, "Te", "A másik autó", row => [row.own, row.other])+'</details>' : '')+
    '</section><section class="panel"><h2>Üzenet a másik autóba</h2><div id="messages" class="messages" role="log" aria-label="Üzenetek"></div>'+
    (s.result?'':'<form id="chat" class="chat-form"><input id="message-input" aria-label="Üzeneted" placeholder="Írj a partnerednek…" maxlength="240" autocomplete="off" required><button>Küldés</button></form>')+'</section></div>'+report;
  const log=document.querySelector("#messages");
  if(!s.messages.length){const p=document.createElement("p");p.className="muted";p.textContent="Még nincs üzenet.";log.append(p);}
  for(const m of s.messages){const p=document.createElement("p");p.className="message"+(m.own?" own":"");p.textContent=(m.own?"Te: ":"Partner: ")+m.text;log.append(p);}
  log.scrollTop=stick?log.scrollHeight:scroll;
  const input=document.querySelector("#message-input");
  if(input){input.value=draft;if(focus){input.focus({preventScroll:true});input.setSelectionRange(position,position);}}
}
function render(){
  if(!room){
    screen.innerHTML='<article class="hero"><div class="hero-copy stack"><p class="kicker">Élő tréningjáték</p><h1>Két autó.<br>Egy út.</h1><p class="muted">Egy kilométerről indultok. Minden döntéssel közelebb kerülhettek egymáshoz.</p><button data-do="create">Trénerként futamot indítok</button><form id="join-form" class="join-form"><label for="room-code">Van szobakódod?</label><input id="room-code" name="code" placeholder="Szobakód" maxlength="8" required autocomplete="off"><button class="secondary">Csatlakozás</button></form></div><div class="hero-art" aria-hidden="true"></div></article>';
    const previous=localStorage.getItem("cr:last-host");if(codeOK.test(previous||"")){
      const a=document.createElement("a");a.textContent="Vissza az előző tréneri futamhoz";a.href=roomLink(previous,true);screen.querySelector(".hero-copy").append(a);
    }return;
  }
  if(!codeOK.test(room)){screen.innerHTML='<div class="intro stack"><h1>Érvénytelen szobakód</h1><a href="./">Vissza a főoldalra</a></div>';return;}
  if(!state){
    screen.innerHTML='<div class="intro stack"><p class="kicker">Szoba '+room+'</p><h1>Chicken Run</h1>'+
      (auth?'<p>Kapcsolódás…</p>':host?'<p>A futamot indító böngészőből nyisd meg a tréneri nézetet.</p>':'<p>Fiók nélkül játszol. A partnered nem látja, ki vagy.</p><form id="player-join" class="stack"><label for="player-label">Név vagy becenév (csak a tréner látja, opcionális)</label><input id="player-label" name="label" maxlength="40" autocomplete="off"><button>Csatlakozom</button></form>')+'</div>';return;
  }
  if(state.role==="host"){if(state.phase==="lobby")lobbyHost();else hostRace();return;}
  if(state.phase==="lobby"){
    screen.innerHTML='<div class="intro stack"><p class="kicker">Szoba '+room+'</p><h1>A rajtra vársz</h1><p>A tréner indítja a véletlenszerű párosítást. Csatlakoztak: '+state.count+'</p></div>';
    return;
  }
  if(state.spectator){
    screen.innerHTML='<div class="intro stack"><h1>Új játék</h1>'+rematchControls()+'</div>';
    return;
  }
  race();
}
screen.addEventListener("input",e=>{if(e.target.id==="message-input")draft=e.target.value;});
screen.addEventListener("submit",e=>{
  e.preventDefault();
  if(e.target.id==="join-form"){
    const c=new FormData(e.target).get("code").trim().toUpperCase();
    if(!codeOK.test(c))return error("Nyolckarakteres szobakódot adj meg.");
    location.assign(roomLink(c));
  }
  if(e.target.id==="player-join" && !busy){
    auth ||= secret();
    void action("join", { label: new FormData(e.target).get("label") }).then(joined => {
      if (joined) localStorage.setItem(key, auth);
      else auth = null;
    });
  }
  if(e.target.id==="chat"&&draft.trim())void action("message",{number:state.number,step:state.step,text:draft.trim(),id:secret()});
});
screen.addEventListener("click",async e=>{
  const b=e.target.closest("[data-do]"); if(!b||busy)return;
  const cmd=b.dataset.do;
  if(cmd==="create"){
    busy=true;b.disabled=true;
    try{
      const next=await req("/api/rooms",{});
      localStorage.setItem("cr:host:"+next.room,next.token);localStorage.setItem("cr:last-host",next.room);
      location.assign(roomLink(next.room,true));
    }catch(e){error(e.message);busy=false;b.disabled=false;}
  }else if(cmd==="go"||cmd==="yield"){
    await action("decision",{number:state.number,step:state.step,choice:cmd});
  }else if(cmd==="requeue"||cmd==="cancel"){
    await action(cmd,{number:state.number??0});
  }
  else if(cmd==="start"){await action("start");}
  else if(cmd==="stop"&&confirm("Lezárod a futamot és az újrapárosítást? A riportok elérhetők maradnak.")){await action("stop");}
  else if(cmd==="copy"){
    try{await navigator.clipboard.writeText(roomLink(room));b.textContent="Link másolva";}
    catch{error("A belépőlink a QR-kód alatt megnyitható.");}
  }
});
render();
void poll();
setInterval(poll,900+Math.random()*220);
