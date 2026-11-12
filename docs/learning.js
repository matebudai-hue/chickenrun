import { injuryCard } from "./injuries.js?v=1";

// Trainer-only analytics. Outcomes describe a race, never a personality.
export const MEDALS = {win:'Győztes',lose:'Vesztes',crash:'Kórház',both:'Döntetlen'};
const SHORT = {win:'GY',lose:'V',crash:'K',both:'D'};
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const completed = p => ['a','b','both','crash'].includes(p.result);
export const medalFor = (result,seat) => result === 'a' ? (seat===0?'lose':'win') : result === 'b' ? (seat===1?'lose':'win') : result;
const admitted = (p,scope) => scope==='all' || (scope==='test' ? p.bot : !p.bot);
const counts = () => ({win:0,lose:0,crash:0,both:0});
export function analyse(pairs,roster=[],scope='human') {
  const ordered = pairs.slice().sort((a,b)=>a.number-b.number);
  const races = ordered.filter(p=>completed(p)&&admitted(p,scope));
  const people = new Map(roster.map(p=>[p.number,{number:p.number,name:p.name,events:[],medals:counts(),injuries:0,transitions:[]} ]));
  let unlinked=0;
  for (const p of ordered) {
    if (!p.result) continue;
    if (!p.playerNumbers) { if (completed(p)&&admitted(p,scope)) unlinked++; continue; }
    p.playerNumbers.forEach((id,seat)=>{
      if (!id) return;
      if (!people.has(id)) people.set(id,{number:id,name:p.names[seat],events:[],medals:counts(),injuries:0,transitions:[]});
      const person=people.get(id);
      const row=p.history?.at(-1);
      const event={pair:p,seat,medal:medalFor(p.result,seat),distance:p.result==='crash'?0:row?.distance,
        included:completed(p)&&admitted(p,scope),move:row?.choices?.[seat],gap:!!p.connectionGap?.some(Boolean)};
      person.events.push(event);
      if (event.medal === "crash") person.injuries++;
      if(event.included) person.medals[event.medal]++;
    });
  }
  const transitions=Object.fromEntries(Object.keys(MEDALS).map(k=>[k,counts()]));
  for(const person of people.values()) {
    for(let i=1;i<person.events.length;i++) {
      const prev=person.events[i-1],next=person.events[i];
      // Never bridge stopped, excluded, mixed-mode or technically uncertain races.
      if(prev.included&&next.included&&!prev.gap&&!next.gap&&!!prev.pair.timed===!!next.pair.timed) {
        transitions[prev.medal][next.medal]++;
        person.transitions.push({prev,next});
      }
    }
  }
  const total={single:0,both:0,crash:0};
  for(const p of races) total[p.result==='a'||p.result==='b'?'single':p.result]++;
  const players=[...people.values()].sort((a,b)=>a.number-b.number);
  return {races,total,players,transitions,unlinked,
    stopped:ordered.filter(p=>p.result==='stopped').length,
    test:ordered.filter(p=>completed(p)&&p.bot).length,
    gaps:races.filter(p=>p.connectionGap?.some(Boolean)).length,
    active:ordered.filter(p=>!p.result).length};
}
const tag = (key,n) => '<span class="medal-count medal-'+key+'"><b>'+n+'</b> '+MEDALS[key]+'</span>';
function distanceLabel(e){return e.medal==='crash'?'Ütközés':Number.isFinite(e.distance)?e.distance+' m':'Nincs mérési adat';}
function raceButton(e,index,projected=false){
  const title=(index+1)+'. saját futam · #'+e.pair.number+' · '+(MEDALS[e.medal]??'Félbemaradt')+' · '+distanceLabel(e);
  return '<'+(projected?'span':'button type="button" data-do="report-case" data-number="'+e.pair.number+'"')+' class="race-stamp medal-'+esc(e.medal)+'" '+(projected?'':'aria-label="'+esc(title)+'" ')+'title="'+esc(title)+'"><small>'+String(index+1).padStart(2,'0')+'</small><b>'+ (SHORT[e.medal]??'—')+'</b><span>'+distanceLabel(e)+'</span>'+(e.pair.bot&&!projected?'<i>T</i>':'')+(e.gap?'<i>!</i>':'')+'</'+(projected?'span':'button')+'>';
}
function outcomeChart(items, description) {
  const bar = items.filter(([,,count]) => count > 0).map(([color,,count]) =>
    '<span class="'+color+'" style="flex-grow:'+count+'"></span>').join('');
  const legend = items.map(([color,label,count]) =>
    '<div><i class="'+color+'"></i><b>'+count+'</b><span>'+label+'</span></div>').join('');
  return '<div class="outcome-chart" role="img" aria-label="'+esc(description)+'">'+
    '<div class="outcome-bar" aria-hidden="true">'+bar+'</div><div class="outcome-legend" aria-hidden="true">'+legend+'</div></div>';
}
function outcomeStrip(data) {
  const {single,both,crash} = data.total;
  return outcomeChart([['strip-single','Egyik kitért',single],['strip-both','Mindketten kitértek',both],['strip-crash','Ütközés',crash]],
    data.races.length+' futam: '+single+' egyoldalú kitérés, '+both+' kölcsönös kitérés, '+crash+' ütközés');
}
function personalOutcomes(person) {
  const items = Object.entries(MEDALS).map(([key,label]) => ['medal-'+key,label,person.medals[key]]);
  return outcomeChart(items, items.map(([,label,count]) => count+' '+label).join(', '));
}
function personalInjuries(person) {
  return injuryCard(person.injuries,{fullSession:person.injuries !== person.medals.crash});
}
function personalSummary(person) {
  return '<div class="personal-result-summary">'+personalOutcomes(person)+personalInjuries(person)+'</div>';
}
export function outcomeReport(data, selected) {
  const players = data.players.filter(player => player.events.some(event => event.included) || player.number === selected);
  const person = players.find(player => player.number === selected);
  const options = players.map(player => '<option value="'+player.number+'"'+(player === person ? ' selected' : '')+'>'+esc(player.name)+' · R'+String(player.number).padStart(2,'0')+'</option>').join('');
  return '<section class="compact-outcomes"><div class="outcome-toolbar"><h2>Ki engedett, mi lett belőle?</h2>'+
    '<label for="outcome-player">Eredmények</label><select id="outcome-player"><option value="">Csoport</option>'+options+'</select>'+
    '<button class="button secondary small" data-do="project-learning" data-player="'+(person?.number ?? 'group')+'">'+(person ? 'Játékos eredményeinek kivetítése' : 'Csoportkép kivetítése')+'</button></div>'+
    (person ? personalSummary(person) : outcomeStrip(data))+'</section>';
}
export function learningOverview(data,projected=false){
  return '<header class="debrief-hero"><div><p class="eyebrow">PADLÓGÁZ / '+(projected?'KÖZÖS VISSZANÉZÉS':'DÖNTÉSEK NYOMÁBAN')+'</p><h2>Ki engedett.<br>Mi lett belőle.</h2><p>A győzelemhez valakinek ki kellett térnie.</p></div><div class="hero-number"><strong>'+data.races.length+'</strong><span>lezárt futam</span></div></header>'+
    outcomeStrip(data)+(data.races.length?'':'<p class="report-empty">A lezárt futamokból itt rajzolódik ki a csoport története.</p>');
}
function transitionTable(data){
  const keys=Object.keys(MEDALS);
  const rows=keys.map(k=>{
    const total=Object.values(data.transitions[k]).reduce((a,b)=>a+b,0);
    return '<tr><th scope="row">'+MEDALS[k]+' után <small>('+total+')</small></th>'+keys.map(next=>'<td><span class="transition-value" style="--fill:'+ (total?100*data.transitions[k][next]/total:0)+'%">'+data.transitions[k][next]+'</span></td>').join('')+'</tr>';
  }).join('');
  return '<div class="table-wrap"><table class="transition-table"><caption>A következő saját futam eredménye · előfordulások száma</caption><thead><tr><th scope="col">Előző → következő</th>'+keys.map(k=>'<th scope="col">'+MEDALS[k]+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
export function learningPeople(data,selected){
  const players=data.players.filter(p=>p.events.some(e=>e.included));
  if(!players.length) return '<p class="report-empty">Itt jelenik meg minden résztvevő saját futamsora.</p>';
  return '<div class="driver-list">'+players.map(p=>{
    const events=p.events.filter(e=>e.included);
    return '<article class="driver-row"><div class="driver-heading"><button class="driver-name" data-do="report-player" data-player="'+p.number+'" aria-pressed="'+(selected===p.number)+'"><small>R'+String(p.number).padStart(2,'0')+'</small><strong>'+esc(p.name)+'</strong></button><div class="driver-medals">'+Object.keys(MEDALS).map(k=>tag(k,p.medals[k])).join('')+'</div><span class="small-text">'+events.length+' futam</span></div><div class="race-ribbon">'+events.map((e,i)=>raceButton(e,i)).join('')+'</div>'+(selected===p.number?learningDetail(data,selected):'')+'</article>';
  }).join('')+'</div>';
}
function learningDetail(data,selected){
  const p=data.players.find(p=>p.number===selected);
  if(!p) return '';
  const events=p.events.filter(e=>e.included);
  const turn=events.filter(e=>e.move==='yield');
  const afterCrash=p.transitions.filter(t=>t.prev.medal==='crash');
  return '<section class="learning-person" id="learning-person"><div class="row between"><div><p class="eyebrow">R'+String(p.number).padStart(2,'0')+' / EGYÉNI TÖRTÉNET</p><h3>'+esc(p.name)+'</h3></div><button class="button secondary small" data-do="project-learning" data-player="'+p.number+'">Történet kivetítése</button></div>'+personalInjuries(p)+'<p>'+turn.length+' saját kitérés a kijelölt '+events.length+' futamban. Ütközés után '+afterCrash.length+' összevethető következő futam.</p><p class="trainer-question">Melyik futamban változott meg, amit a másiktól vártál? Mi történt előtte?</p><div class="table-wrap"><table><thead><tr><th>Saját futam</th><th>Partner</th><th>Medál</th><th>Lezárás</th><th>Visszanézés</th></tr></thead><tbody>'+events.map((e,i)=>'<tr><td>'+ (i+1)+'</td><td>'+esc(e.pair.names[1-e.seat])+'</td><td>'+MEDALS[e.medal]+'</td><td>'+distanceLabel(e)+(e.gap?' · kapcsolati jel hiányzott':'')+'</td><td><button class="text-link" data-do="report-case" data-number="'+e.pair.number+'">#'+e.pair.number+' megnyitása</button></td></tr>').join('')+'</tbody></table></div></section>';
}
export function learningPatterns(data, selected = 0){
  const person = data.players.find(player => player.number === selected);
  const players = person ? [person] : data.players;
  const options = data.players.filter(player => player.events.some(event => event.included) || player === person)
    .map(player => '<option value="'+player.number+'"'+(player === person?' selected':'')+'>'+esc(player.name)+' · R'+String(player.number).padStart(2,'0')+'</option>').join('');
  const controls = '<div class="transition-controls"><label for="transition-person">Kinek a futamai?</label><select id="transition-person"><option value="0">Csoport</option>'+options+
    '</select><button class="button secondary small" data-do="project-transitions">Kivetítem</button></div>';
  const stories=[];
  for(const p of players){
    const t=p.transitions.find(t=>t.prev.medal==='win'&&t.next.medal==='crash');
    if(t) stories.push({p,t,title:'Győzelem után ütközés',q:'Mire számítottál a győzelem után? Mi volt hasonló, és mi változott a következő helyzetben?'});
    const c=p.transitions.find(t=>t.prev.medal==='crash'&&['lose','both'].includes(t.next.medal));
    if(c) stories.push({p,t:c,title:'Ütközés után kitérés',q:'Mit vittél tovább az ütközésből? Tudatosan változtattál, vagy más volt a helyzet?'});
  }
  const picked=stories.slice(0,4);
  return '<section class="debrief-section report-panel" id="report-transitions" tabindex="-1"><div class="report-section-head"><div><h3>Mi jött utána?</h3><p>Egymást követő saját futamok, azonos játékmódban.</p></div>'+controls+'</div>'+transitionSummary(data,person)+'<p class="trainer-question">Mit vittetek tovább az előző futamból: várakozást, elhatározást, indulatot?</p><div class="turning-points">'+picked.map(({p,t,title,q})=>'<article><p class="eyebrow">'+esc(p.name)+'</p><h4>'+title+'</h4><div class="row">'+raceButton(t.prev,p.events.indexOf(t.prev))+ '<span>→</span>'+raceButton(t.next,p.events.indexOf(t.next))+'</div><p>'+q+'</p></article>').join('')+'</div>'+(picked.length?'':'<p class="muted">Még nincs kiemelhető győzelem → ütközés vagy ütközés → kitérés történet. A riport nem feltételez fordulópontot.</p>')+'<p class="small-text">Egy futam két játékos történetében is szerepelhet. A félbemaradt, a szűrésből kieső és a hiányos futamok megszakítják a sorozatot. Az átmenetekből önmagukban nem következik ok-okozati kapcsolat.</p></section>';
}
export function learningGuide(opened = new Set()){
  const stages=[
    ['Tapasztalat','Válasszatok egy konkrét futamot.','Mit akartál elérni? Mire számítottál a másiktól, és mire alapoztad ezt?','A medálsor egy elemét nyisd meg. Először az akkori információt rekonstruáljátok, csak utána értékeljétek a kimenetelt.'],
    ['Kölcsönös függés','A győztes történetéhez kell a kitérő története is.','A másik kitérése mit tett lehetővé neked? Aki Vesztest kapott, mit védett meg?','Ugyanazt a futamot mindkét fél nézőpontjából dolgozzátok fel. A kitérés lehet önvédelem, kockázatkezelés vagy megállapodás is.'],
    ['Jelzés és következtetés','Nézzétek meg az üzenetet a döntés előtt.','Mit hittél el? Miből következtettél arra, hogy a másik engedni fog?','Válaszd külön az elküldött üzenetet és a ténylegesen megértett jelzést. A „nem térek ki” szöveg még nem visszavonhatatlan elköteleződés.'],
    ['Eloszló teher','A biztonságot ki teremtette meg?','Hol várjuk újra és újra ugyanattól az embertől, hogy engedjen?','A saját medálsor kérdésindító. Változó, névtelen partnerek mellett a sok Vesztesből nem következik állandó alárendelt szerep.'],
    ['Közös szabály','Építsetek lámpát a szervezeti helyzethez.','Milyen szabályt fogadnál el akkor is, ha legközelebb te kapnál pirosat?','Nevezzétek meg: milyen helyzetben, ki és milyen szempont alapján enged; mikor vált a prioritás; mi a kivétel és ki dönt vitában.'],
    ['Kipróbálás','Egy saját munkahelyi helyzetben teszteljétek.','Kivel, mikor próbálod ki a szabályt, és miből látjátok majd, hogy működik?','Rögzítsetek egy megfigyelhető jelet: például ismételt sürgős felülírások száma vagy az engedés terhének eloszlása. A játék önmagában nem bizonyít munkahelyi változást.']
  ];
  return '<section class="debrief-section report-panel guide" id="report-guide" tabindex="-1"><div class="report-section-head"><h3>Kivezetési kérdések</h3><button class="button secondary small" data-do="project-section" data-target="guide">Kivezetési kérdések kivetítése</button></div><p>Lehetséges tanulási cél: a résztvevő képes legyen felismerni a kölcsönös függést, ellenőrizni a másikra vonatkozó feltételezését, és közös eljárást javasolni az engedés rendezésére.</p><div class="guide-grid">'+stages.map(([label,title,q,note],i)=>'<article><span class="guide-number">0'+(i+1)+'</span><div><p class="eyebrow">'+label+'</p><h4>'+title+'</h4><p class="trainer-question">'+q+'</p><p class="small-text">'+note+'</p></div></article>').join('')+'</div><details id="learning-theory"'+(opened.has('learning-theory')?' open':'')+'><summary>Játékelméleti háttér és értelmezési határok</summary><div class="stack"><p>A klasszikus Chicken sorrendje: egyoldalú győzelem &gt; kölcsönös kitérés &gt; egyoldalú kitérés &gt; ütközés. A jobb válasz a másik döntésétől függ. Két tiszta Nash-egyensúlya az egyoldalú kitérés két esete; a kölcsönös kitérés egy egyszeri játékban nem tiszta Nash-egyensúly.</p><p>A kézikönyv 4–3–1–0 példapontozásában a kölcsönös kitérés összesen 6 pontot ér, az egyoldalú 5-öt. A jelen játék medálokat gyűjt: ebből nem számolunk utólag kitalált hasznosságot vagy együttműködési pontszámot. Előbb kérdezd meg, nekik mit ért az egyes eredmény.</p><p>A mérési pontok, a kommunikáció és az időnyomás kibővítik az egyszeri modellt. A Döntetlen ugyanazon mérési pontban rögzített két kitérés; nem bizonyít azonos kattintási időt vagy előzetes egyezséget. A győztes tervezett későbbi kitérését nem ismerjük. Változó, névtelen partnereknél nincs automatikusan partnerhez kötött reputáció vagy megtorlás.</p><p>A sok győzelem nem önmagában jó döntés, a Kórház nem önmagában jellemhiba. Vizsgáld az akkori információt és a technikai körülményeket. Tíz futam beszélgetési alap, nem személyiségteszt.</p><p>Alap: Budai Máté: Együttműködés-fejlesztés, kézikönyv 8. oldal és tréneri forgatókönyv. <a href="https://homes.cs.washington.edu/~karlin/GameTheoryBook.pdf" target="_blank" rel="noopener">Karlin–Peres: Game Theory, Alive, 4.2.3</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/17574196/" target="_blank" rel="noopener">Rudolph és mtsai.: Debriefing with good judgment</a>.</p></div></details></section>';
}
export function learningProjection(state,target='group'){
  const data=analyse(state.pairs,state.roster,'human');
  const p=data.players.find(p=>p.number===Number(target));
  if(target!=='group'&&!p) return '<section class="learning-screen"><h1>A történet még nem érhető el.</h1></section>';
  if(p){
    const events=p.events.filter(e=>e.included);
    return '<section class="learning-screen"><p class="eyebrow">PADLÓGÁZ / EGY JÁTÉKOS TÖRTÉNETE</p><h1>Egy ember.<br>'+events.length+' döntési helyzet.</h1><div class="projection-medals">'+Object.keys(MEDALS).map(k=>tag(k,p.medals[k])).join('')+'</div>'+personalInjuries(p)+'<div class="race-ribbon projected-ribbon">'+events.map((e,i)=>raceButton(e,i,true)).join('')+'</div><p class="screen-question">Mikor változott meg,<br>amit a másiktól vártál?</p><p class="small-text">GY · Győztes / V · Vesztes / K · Kórház / D · Döntetlen · A távolság a futam lezárásának mérési pontja. ! · Hiányzó kapcsolati jel.</p></section>';
  }
  return '<section class="learning-screen">'+learningOverview(data,true)+'<p class="screen-question">Ki teremtette meg a győzelem feltételét?<br>És ő mit kapott érte?</p><p class="small-text">Egy futam egy közös kimenetel. Az egyoldalú kitérés egyik résztvevőnek Győztes, a másiknak Vesztes medált jelent.</p></section>';
}

export function transitionSummary(data,person) {
 const transitions = person ? Object.fromEntries(Object.keys(MEDALS).map(key => [key,counts()])) : data.transitions;
 if (person) for (const {prev,next} of person.transitions) transitions[prev.medal][next.medal]++;
 const n=Object.values(transitions).flatMap(Object.values).reduce((a,b)=>a+b,0);
 if(!n && person) return '<p class="report-empty">Ebben a szűrésben még nincs két összevethető, közvetlenül egymást követő futama ennek a játékosnak.</p>';
 if(!n) return '<p class="report-empty">Még nincs összevethető, közvetlenül egymást követő két saját futam ebben a szűrésben. '+data.races.length+' lezárt futam · '+data.unlinked+' azonosítás nélkül · '+data.gaps+' kapcsolati jelhiánnyal. A köztes tesztfutam, megszakítás vagy módváltás is kizárhat egy átmenetet. Próbáld a Mind szűrőt, ha tesztjátékossal is játszottatok.</p>';
 const entries=Object.entries(transitions).flatMap(([from,values])=>Object.entries(values).filter(([,v])=>v).map(([to,n])=>({from,to,n}))).sort((a,b)=>b.n-a.n);
 const top=entries[0];
 return '<p class="transition-explanation"><strong>'+n+' megfigyelt eredményátmenet.</strong> Például: '+top.n+' alkalommal '+MEDALS[top.from]+' után '+MEDALS[top.to]+' következett ugyanannál a játékosnál. A sor az előző, az oszlop a következő saját futam medálja.</p>'+transitionTable({transitions});
}
export function presentationView(state,p) {
 const data=analyse(state.pairs,state.roster,p.scope);
 const scope={human:'Ember–ember',test:'Tesztjátékosos',all:'Minden futam'}[p.scope];
 const label=person=>p.names?esc(person.name):'Játékos '+String(person.number).padStart(2,'0');
 let body='',pages=1,page=p.page;
 if(p.target==='group') body=learningOverview(data,true)+'<p class="screen-question">Ki teremtette meg a győzelem feltételét?</p>';
 if(p.target==='person') {
  const person=data.players.find(x=>x.number===p.person);
  if(!person)body='<h1>A játékos története még nem érhető el.</h1>';
  else {
   const events=person.events.filter(e=>e.included);pages=Math.max(1,Math.ceil(events.length/12));page=Math.min(page,pages-1);
   body='<h1>'+label(person)+'</h1>'+personalSummary(person)+'<div class="race-ribbon projected-ribbon">'+events.slice(page*12,page*12+12).map((e,i)=>raceButton(e,page*12+i,true)).join('')+'</div><p class="screen-question">Mikor változott meg, amit a másiktól vártál?</p>';
  }
 }
 if(p.target==='people') {
  const chunks = timelinePages(data.players);
  pages = Math.max(1,chunks.length);
  page = Math.min(page,pages-1);
  const chunk = chunks[page];
  body = '<h1>Személyes futamsorok</h1>';
  if (chunk) {
   const {group,start,end} = chunk;
   const range = end === start+1 ? String(end) : (start+1)+'–'+end;
   body += '<p>'+range+'. saját futam · GY Győztes / V Vesztes / K Kórház / D Döntetlen</p>'+
     '<div class="projected-lanes" style="--race-columns:'+(end-start)+'">'+group.map(({person,events}) =>
       '<article><h3>'+label(person)+'</h3><div class="race-ribbon">'+events.slice(start,end)
         .map((event,i)=>raceButton(event,start+i,true)).join('')+'</div></article>').join('')+'</div>';
  } else body += '<p>Még nincs lezárt futamsor.</p>';
 }
 if (p.target === 'transitions') {
  const person = data.players.find(player => player.number === p.person);
  body = '<h1>Mi jött utána?</h1>'+(person ? '<p class="transition-subject">'+label(person)+'</p>' : '')+
    transitionSummary(data,person)+'<p class="screen-question">Mit vittél tovább az előző futamból?</p>';
 }
 if(p.target==='guide') {
  const slides=[['Egy konkrét döntés','Mit akartál elérni? Mire számítottál a másiktól, és mire alapoztad ezt?'],['A győzelem másik oldala','A másik kitérése mit tett lehetővé neked? Aki Vesztest kapott, mit védett meg?'],['Mit hittél el?','Miből következtettél arra, hogy a másik engedni fog?'],['Ki viseli az engedés terhét?','Hol várjuk újra és újra ugyanattól az embertől, hogy engedjen?'],['Építsetek lámpát.','Milyen szabályt fogadnál el akkor is, ha legközelebb te kapnál pirosat?'],['Próbáljátok ki.','Kivel, mikor próbálod ki a szabályt, és miből látjátok majd, hogy működik?']];
  pages=slides.length;page=Math.min(page,pages-1);body='<p class="hero-number"><strong>0'+(page+1)+'</strong></p><h1>'+slides[page][0]+'</h1><p class="screen-question">'+slides[page][1]+'</p>';
 }
 return '<section class="learning-screen presentation-screen" data-slide="'+p.target+'"><p class="eyebrow">'+scope+' / '+(p.names?'Nevekkel':'Név nélkül')+'</p>'+body+(pages>1?'<nav class="presentation-pager" aria-label="Kivetített oldalak"><button class="button secondary" data-do="projection-page" data-by="-1"'+(!page?' disabled':'')+'>← Előző</button><span>'+(page+1)+' / '+pages+'</span><button class="button secondary" data-do="projection-page" data-by="1"'+(page>=pages-1?' disabled':'')+'>Következő →</button></nav>':'')+'</section>';
}
export function presentationPages(state,p) {
 const data=analyse(state.pairs,state.roster,p.scope);
 if(p.target==='guide')return 6;
 if(p.target==='person')return Math.max(1,Math.ceil((data.players.find(x=>x.number===p.person)?.events.filter(e=>e.included).length??0)/12));
 if(p.target==='people')return Math.max(1,timelinePages(data.players).length);
 return 1;
}

function timelinePages(players) {
 const rows = players.map(person => ({person,events:person.events.filter(event => event.included)}))
   .filter(row => row.events.length);
 const pages = [];
 const rowsPerPage = 6;
 const racesPerRow = 18;
 for (let i=0; i<rows.length; i+=rowsPerPage) {
  const group = rows.slice(i,i+rowsPerPage);
  const longest = Math.max(...group.map(row => row.events.length));
  for (let start=0; start<longest; start+=racesPerRow) {
   pages.push({group,start,end:Math.min(start+racesPerRow,longest)});
  }
 }
 return pages;
}
