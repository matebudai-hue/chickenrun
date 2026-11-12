import { readState, saved } from "../connection.js?v=5";

const storageKey="xy:activity-owner";
const authForm=document.getElementById("activity-auth");
const refreshButton=document.getElementById("activity-refresh");
const signoutButton=document.getElementById("activity-signout");
const status=document.getElementById("activity-status");
const results=document.getElementById("activity-results");
const date=new Intl.DateTimeFormat("hu-HU",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Budapest"});
const phaseNames={ready:"Körre vár",open:"Döntésre nyitva",negotiation:"Tárgyalás",result:"Kör lezárva"};
const activeWindow=30*60*1000;
const fragment=new URLSearchParams(location.hash.slice(1)).get("key");
let key=/^[a-f0-9]{32}$/.test(fragment || "")?fragment:saved.get(storageKey);
if (location.hash) history.replaceState(null,"",location.pathname+location.search);
let loading=false;

function renderEntries({now,entries}) {
  const table=document.createElement("table");
  table.className="timeline";
  const head=table.createTHead().insertRow();
  for(const label of ["Szobakód","Indítás","Utolsó lépés","Állapot","Kör"]){
    const cell=document.createElement("th");
    cell.scope="col";cell.textContent=label;head.append(cell);
  }
  const body=table.createTBody();
  for(const entry of entries){
    const row=body.insertRow();
    const phase=entry.phase==="finished"?"Lezárva":now-entry.updatedAt>activeWindow?"Inaktív":phaseNames[entry.phase] || "Folyamatban";
    const own=saved.get("xy:"+entry.code+":projector");
    for(const value of [entry.code+(own?" · innen indítva":""),date.format(entry.startedAt),date.format(entry.updatedAt),phase,entry.round+" / "+entry.rounds])
      row.insertCell().textContent=value;
  }
  results.replaceChildren(...(entries.length?[table]:[]));
  const recent=entries.filter(entry=>entry.phase!=="finished" && now-entry.updatedAt<=activeWindow).length;
  status.textContent=entries.length?`${recent} játékban történt lépés az elmúlt 30 percben · ${entries.length} indítás a listán.`:"Még nincs rögzített játékindítás.";
}

async function refresh() {
  authForm.hidden=!!key;
  refreshButton.hidden=signoutButton.hidden=!key;
  if(!key || loading) return;
  loading=true;refreshButton.disabled=true;
  const requestedKey=key;
  try{
    const data=await readState("/api/xy/activity",requestedKey);
    if(key!==requestedKey) return;
    saved.set(storageKey,key);
    renderEntries(data);
  }catch(err){
    if(key!==requestedKey) return;
    status.textContent=err.message;
    if(err.status===403) signOut();
  }finally{
    loading=false;refreshButton.disabled=false;
  }
}
function signOut(){
  key=null;saved.remove(storageKey);
  results.replaceChildren();
  authForm.reset();authForm.hidden=false;
  refreshButton.hidden=signoutButton.hidden=true;
}
authForm.addEventListener("submit",event=>{
  event.preventDefault();
  key=new FormData(authForm).get("key").trim();
  void refresh();
});
refreshButton.addEventListener("click",refresh);
signoutButton.addEventListener("click",()=>{signOut();status.textContent="";});
setInterval(()=>{if(!document.hidden) void refresh();},30_000);
void refresh();
