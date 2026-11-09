"use strict";
const screen=document.querySelector("#screen"), errors=document.querySelector("#error"), connection=document.querySelector("#connection");
const params=new URLSearchParams(location.search), room=(params.get("room")||"").toUpperCase(), host=params.get("view")==="host";
const key="cr:"+(host?"host":"player")+":"+room, codeOK=/^[23456789A-HJ-NP-Z]{8}$/;
const names={a:"A tért ki",b:"B tért ki",both:"Mindketten kitértek",crash:"Ütközés",stopped:"Lezárva"};
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
  const response=await fetch(path,{headers,method:body===undefined?"GET":"POST",body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(7500)});
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error),{status:response.status});
  return data;
}
const api=action=>"/api/rooms/"+room+"/"+action;
function update(value){
  const signature=JSON.stringify(value);
  if(signature!==snapshot){state=value;snapshot=signature;render();}
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
      screen.innerHTML='<section class="panel"><h1>A futam nem elérhető</h1><p>Olvasd be újra a tréner QR-kódját, vagy indíts új futamot.</p><a href="/">Vissza a főoldalra</a></section>';
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
  finally{busy=false;buttons.forEach(b=>{if(b.isConnected)b.disabled=false;});void poll();}
}
function lobbyHost(){
  const url=location.origin+"/?room="+room;
  screen.innerHTML='<div class="intro"><p class="kicker">Tréneri nézet</p><h1>Váró</h1></div><div class="lobby"><div class="panel stack"><p>Szobakód <strong class="room-code">'+room+'</strong></p><p class="big-count">'+state.count+'</p><p>csatlakozott játékos</p>'+
    (state.count%2?'<p class="muted">Páratlan létszámnál egy résztvevő megfigyelő lesz.</p>':'')+
    '<button data-do="start"'+(state.count<2?' disabled':'')+'>Párosítás és indítás</button></div><div class="panel qr"><div id="qr"></div><a id="join-url" href="'+url+'">Játékosok belépőlinkje</a><button class="secondary" data-do="copy">Link másolása</button></div></div>';
  const qr=qrcode(0,"M");qr.addData(url);qr.make();
  document.querySelector("#qr").innerHTML=qr.createSvgTag({cellSize:5,margin:20,scalable:true,alt:"QR-kód a játékosok belépéséhez"});
}
function hostRace(){
  const s=state, active=s.pairs.filter(p=>!p.result).length;
  const stats=Object.entries(s.results).filter(([k,v])=>k!=="stopped"||v).map(([k,v])=>'<div class="stat"><strong>'+v+'</strong><span>'+names[k]+'</span></div>').join("");
  const rows=s.pairs.map(p=>'<tr><td>'+p.number+'. pár</td><td>'+p.distance+' m</td><td>'+
    (p.result?names[p.result]:p.ready+' / 2 döntés')+'</td></tr>').join("");
  screen.innerHTML='<div class="intro"><p class="kicker">Tréneri nézet</p><h1>'+(s.phase==="finished"?"Eredmények":"Futam")+
    '</h1><p class="muted">'+s.count+' játékos · '+s.pairs.length+' pár · '+active+' aktív</p></div><div class="panel stats">'+stats+
    '</div><div class="panel stack"><h2>Párok állása</h2><table><thead><tr><th>Pár</th><th>Távolság</th><th>Állapot</th></tr></thead><tbody>'+rows+
    '</tbody></table>'+(s.phase==="finished"?'<button data-do="create">Új futam</button>':'<button class="danger" data-do="stop">Futam lezárása</button>')+'</div>';
}
function race(){
  const s=state, old=document.querySelector("#messages"), focus=document.activeElement?.id==="message-input",
    position=document.activeElement?.selectionStart, scroll=old?.scrollTop??0,
    stick=!old||old.scrollHeight-scroll-old.clientHeight<36, open=document.querySelector("#history")?.open;
  const last=s.history.at(-1), lx=46-37*s.distance/1000, rx=54+37*s.distance/1000;
  const history=s.history.map(h=>'<tr><td>'+h.distance+' m</td><td>'+moves[h.own]+'</td><td>'+moves[h.other]+'</td></tr>').join("");
  const result=s.result==="crash"?"Ütköztetek.":s.result==="both"?"Mindketten kitértetek.":s.result==="stopped"?"A tréner lezárta a futamot.":s.yielded?"Te tértél ki.":"A másik autó tért ki.";
  screen.innerHTML='<div class="intro"><p class="kicker">Szoba '+room+'</p><h1>Szemben az úton</h1></div><div class="game"><section class="panel"><div class="dash"><div><p class="muted">Távolság köztetek</p><p class="distance">'+s.distance+
    ' <small>m</small></p></div><span class="muted">'+(s.step+1)+'. pont / 7</span></div><div class="road" aria-hidden="true"><span class="car'+
    (s.result&&last?.own==="yield"?" yield":"")+'" style="left:'+lx+'%"></span><span class="car other'+(s.result&&last?.other==="yield"?" yield":"")+
    '" style="left:'+rx+'%"></span></div><div class="legend"><span>Te</span><span>A másik autó</span></div>'+
    (s.result?'<p class="result" role="status">'+result+'</p>':'<div class="actions"><button data-do="go"'+(s.waiting?' disabled':'')+'>Haladok</button><button class="secondary" data-do="yield"'+(s.waiting?' disabled':'')+'>Kitérek</button></div><p class="muted" role="status">'+
    (s.waiting?"A döntésed beérkezett. Várunk a másik autóra.":"Mindkét döntés beérkezése után derül ki, mi történt.")+'</p>')+
    (history?'<details id="history"'+(open||s.result?' open':'')+'><summary>Eddigi döntések</summary><table><thead><tr><th>Távolság</th><th>Te</th><th>Partner</th></tr></thead><tbody>'+history+'</tbody></table></details>':'')+
    '</section><section class="panel"><h2>Üzenet a másik autóba</h2><div id="messages" class="messages" role="log" aria-label="Üzenetek"></div>'+
    (s.result?'':'<form id="chat" class="chat-form"><input id="message-input" aria-label="Üzeneted" placeholder="Írj a partnerednek…" maxlength="240" autocomplete="off" required><button>Küldés</button></form>')+'</section></div>';
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
      const a=document.createElement("a");a.textContent="Vissza az előző tréneri futamhoz";a.href="/?room="+previous+"&view=host";screen.querySelector(".hero-copy").append(a);
    }return;
  }
  if(!codeOK.test(room)){screen.innerHTML='<div class="intro stack"><h1>Érvénytelen szobakód</h1><a href="/">Vissza a főoldalra</a></div>';return;}
  if(!state){
    screen.innerHTML='<div class="intro stack"><p class="kicker">Szoba '+room+'</p><h1>Chicken Run</h1>'+
      (auth?'<p>Kapcsolódás…</p>':host?'<p>A futamot indító böngészőből nyisd meg a tréneri nézetet.</p>':'<p>Név és fiók nélkül játszol. A partneredet véletlenszerűen kapod.</p><button data-do="join">Csatlakozom</button>')+'</div>';return;
  }
  if(state.role==="host"){if(state.phase==="lobby")lobbyHost();else hostRace();return;}
  if(state.phase==="lobby"||state.spectator){
    screen.innerHTML='<div class="intro stack"><p class="kicker">Szoba '+room+'</p><h1>'+(state.spectator?"Megfigyelő vagy":"A rajtra vársz")+'</h1><p>'+
      (state.spectator?"Páratlan létszám miatt ebben a futamban a tréneri kivetítést követheted.":"A tréner indítja a véletlenszerű párosítást. Csatlakoztak: "+state.count)+'</p></div>';return;
  }race();
}
screen.addEventListener("input",e=>{if(e.target.id==="message-input")draft=e.target.value;});
screen.addEventListener("submit",e=>{
  e.preventDefault();
  if(e.target.id==="join-form"){
    const c=new FormData(e.target).get("code").trim().toUpperCase();
    if(!codeOK.test(c))return error("Nyolckarakteres szobakódot adj meg.");
    location.assign("/?room="+c);
  }
  if(e.target.id==="chat"&&draft.trim())void action("message",{step:state.step,text:draft.trim(),id:secret()});
});
screen.addEventListener("click",async e=>{
  const b=e.target.closest("[data-do]"); if(!b||busy)return;
  const cmd=b.dataset.do;
  if(cmd==="create"){
    busy=true;b.disabled=true;
    try{
      const next=await req("/api/rooms",{});
      localStorage.setItem("cr:host:"+next.room,next.token);localStorage.setItem("cr:last-host",next.room);
      location.assign("/?room="+next.room+"&view=host");
    }catch(e){error(e.message);busy=false;b.disabled=false;}
  }else if(cmd==="join"){
    auth ||= secret();localStorage.setItem(key,auth);await action("join");
  }else if(cmd==="go"||cmd==="yield"){await action("decision",{step:state.step,choice:cmd});}
  else if(cmd==="start"){await action("start");}
  else if(cmd==="stop"&&confirm("Lezárod az összes még futó pár játékát?")){await action("stop");}
  else if(cmd==="copy"){
    try{await navigator.clipboard.writeText(location.origin+"/?room="+room);b.textContent="Link másolva";}
    catch{error("A belépőlink a QR-kód alatt megnyitható.");}
  }
});
render();
void poll();
setInterval(poll,900+Math.random()*220);
