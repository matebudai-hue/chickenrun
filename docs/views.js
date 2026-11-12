import { injuryCard } from "./injuries.js?v=1";
import { analyse, outcomeReport, learningPeople, learningPatterns, learningGuide, learningProjection, presentationView } from "./learning.js?v=32";
import { carPositions, pairGroups, legacyPoints } from "./story.js?v=27";
import { nightRoad } from "./live-race.js?v=15";

export const moves = { go: "Halad", yield: "Kitér" };
export const outcomes = {
  own: "Te tértél ki", other: "A másik autó tért ki",
  both: "Mindketten kitértek", crash: "Ütközés", stopped: "Félbemaradt",
};
const medals = { other:"Győztes", own:"Vesztes", crash:"Kórház", both:"Döntetlen" };
const statuses = {
  lobby: "A rajtra vár", pending: "Döntésre vár", ready: "Döntés leadva",
  queued: "Új partnerre vár", finished: "Befejezte", starting: "A rajtra vár", driving: "Futam folyamatban",
};
export const time = at => at ? new Date(at).toLocaleTimeString("hu-HU") : "–";
export const escape = value => String(value ?? "").replace(/[&<>"']/g,
  char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const badge = (label, kind = "") => '<span class="badge '+kind+'">'+label+'</span>';
const action = (id, label, style = "", disabled = false) =>
  '<button type="button" class="button '+style+'" data-do="'+id+'"'+(disabled ? " disabled" : "")+'>'+label+'</button>';
const metric = (label, value, hint, kind = "") =>
  '<div class="metric '+kind+'"><span>'+label+'</span><strong>'+value+'</strong><small>'+hint+'</small></div>';
const header = (label, title, body) =>
  '<header class="heading"><p class="eyebrow">'+label+'</p><h1>'+title+'</h1><p>'+body+'</p></header>';
const empty = (title, body) => '<div class="empty"><strong>'+title+'</strong><p>'+body+'</p></div>';
const card = (title, body, extra = "") => '<section class="card '+extra+'"><h2>'+title+'</h2>'+body+'</section>';
const field = (id, label, placeholder, attrs = "") =>
  '<label for="'+id+'">'+label+'</label><input id="'+id+'" name="'+id+'" placeholder="'+placeholder+'" '+attrs+'>';

function vehicle(other, [x,y]) {
  const color = other ? "#a6e4ec" : "#ffb34a";
  return '<g transform="translate('+x+' '+y+')"><g transform="'+(other?'rotate(180)':'rotate(0)')+'"><path d="M36-9 129-27v54L36 9Z" fill="url(#beam)"/>'+
    '<rect x="-36" y="-14" width="75" height="30" rx="10" fill="#0b1920" opacity=".8" transform="translate(0 4)"/>'+
    '<rect x="-26" y="-17" width="15" height="34" rx="3" fill="#0a1318"/><rect x="16" y="-17" width="15" height="34" rx="3" fill="#0a1318"/>'+
    '<path d="M-26-14H23q14 0 14 11v6q0 11-14 11h-49q-10 0-10-10v-8q0-10 10-10Z" fill="'+color+'" stroke="#f1f5ee" stroke-opacity=".6"/>'+
    '<path d="M-12-10h20l9 6v8l-9 6h-20l-7-5V-5Z" fill="#263d47"/><path d="M-5-10v20m13-18v16" stroke="#52747d" stroke-width="2"/>'+
    '<path d="M33-9v5m0 8v5" stroke="#fff6d7" stroke-width="4" stroke-linecap="round"/>'+
    '<path d="M-32-8v4m0 8v4" stroke="#a63438" stroke-width="2.5" stroke-linecap="round"/></g></g>';
}

function road(distance) {
  const [a,b] = carPositions(distance);
  return '<svg class="road" viewBox="0 0 760 210" aria-hidden="true">'+
    '<defs><linearGradient id="beam"><stop stop-color="#fff3ca" stop-opacity=".6"/><stop offset="1" stop-color="#fff3ca" stop-opacity="0"/></linearGradient>'+
    '<pattern id="road-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="#5d655a" opacity=".4"/></pattern></defs>'+
    '<rect width="760" height="210" fill="#262c26"/><rect width="760" height="210" fill="url(#road-grid)"/>'+
    '<rect y="44" width="760" height="122" fill="#141917"/>'+
    '<path d="M0 48h760M0 162h760" stroke="#cbbe96" stroke-width="2"/>'+
    '<path d="M0 58h760M0 152h760" stroke="#3b4038" stroke-width="1"/>'+
    '<path d="M0 105h760" stroke="#aba78a" stroke-width="2" stroke-dasharray="20 15" opacity=".65"/>'+
    '<path d="M380 57v97m-9-94h18m-18 90h18" stroke="#d9d2b6" stroke-dasharray="3 5" opacity=".52"/>'+
    '<path d="M18 25h24m-12-12v24m688 148h24m-12-12v24" stroke="#8e987c" opacity=".65"/>'+    vehicle(false,a)+vehicle(true,b)+'</svg>';
}

export function home(previous, roomLink) {
  return '<div class="cockpit"><section class="control"><h1>Tréneri pult</h1><div class="control-actions">'+
    action("create","Új futam és QR-kód","primary")+
    (previous ? '<a class="button secondary" href="'+roomLink(previous,"host")+'">Előző futam</a>' : '')+
    '</div></section></div>';
}

export function enterCode() {
  return waitingPage("", "Csatlakozás", "Add meg a trénernél látható szobakódot.",
    '<form id="room-form" class="stack">'+field("room-code", "Szobakód", "8 karakter",
      'required maxlength="8" autocomplete="off" autocapitalize="characters"')+
    '<button class="button primary">Csatlakozás</button></form>');
}
export function waitingPage(room, title, description, actions = "") {
  return '<section class="card centered"><p class="eyebrow">'+(room ? "SZOBA "+room : "PADLÓGÁZ")+'</p><h1>'+
    title+'</h1><p>'+description+'</p>'+actions+'</section>';
}

export function join(room, previousName) {
  return '<div class="player-shell"><div class="banner">'+road(860)+'</div>'+
    waitingPage(room, "Csatlakozz a futamhoz", "Fiók nélkül játszol. A párodnak névtelen maradsz.",
      '<form id="player-form" class="stack">'+field("player-label", "Név vagy becenév · opcionális", "Például: Dóra",
        'maxlength="40" autocomplete="off" value="'+escape(previousName)+'"')+
      '<p class="small-text">A tréner a megbeszélésen névvel vagy becenévvel is megmutathatja a párosításokat, és visszanézheti az üzeneteket.</p><button class="button primary">Csatlakozom</button></form>')+'</div>';
}

const matchOutcome = pair => pair.result === "a" ? escape(pair.names[0])+" tért ki"
  : pair.result === "b" ? escape(pair.names[1])+" tért ki" : outcomes[pair.result];

function decisions(history, a, b, read) {
  if (!history.length) return '<p class="muted">Még nincs közösen lezárt döntési pont.</p>';
  return '<div class="table-wrap"><table class="decision-table"><thead><tr><th scope="col">Távolság</th>'+
    '<th scope="col">'+a+'</th><th scope="col">'+b+'</th><th scope="col">Időpont</th></tr></thead><tbody>'+
    history.map(row => {
      const [first, second] = read(row);
      return '<tr><td>'+row.distance+' m</td><td>'+badge(moves[first], first)+'</td><td>'+badge(moves[second], second)+'</td><td>'+
        time(row.at)+'</td></tr>';
    }).join("")+'</tbody></table></div>';
}

function queueTimer(until) {
  return until ? '<span data-queue-until="'+until+'">30 mp</span>' : "";
}
function queueOverview(state) {
  const waiting = state.roster?.filter(player => player.status === "queued") ?? [];
  if (!waiting.length) return "";
  return card("Új partnerre várnak", '<ul class="queue-list">'+waiting.map(player =>
    '<li><strong>'+escape(player.name)+'</strong> · '+queueTimer(player.queueUntil)+'</li>').join("")+
    '</ul><p class="muted">Ha lejár a várakozás, a játékos tesztjátékost kap.</p>');
}
function roster(state) {
  if (!state.roster?.length) return empty("Még senki sem csatlakozott", "Mutasd meg a QR-kódot, vagy oszd meg a belépőlinket.");
  return '<div class="table-wrap roster"><table><thead><tr><th scope="col">Játékos</th><th scope="col">Kapcsolat</th>'+
    '<th scope="col">Állapot</th><th scope="col">Játék</th><th scope="col">Partner</th></tr></thead><tbody>'+
    state.roster.map(p => '<tr><th scope="row">'+escape(p.name)+'</th><td>'+
      badge(p.online === undefined ? "–" : p.online ? "Online" : "Nem észlelhető", p.online ? "good" : "")+'</td><td>'+
      badge(statuses[p.status], p.status === "ready" ? "good" : p.status === "queued" ? "warm" : "")+
      (p.status === "queued" ? " "+queueTimer(p.queueUntil)+' <button type="button" class="text-link" data-do="test-pair" data-player="'+p.number+
        '" data-number="'+(p.match ?? 0)+'">Tesztjátékost adok</button>' : "")+
      '</td><td>'+(p.match ?? "–")+'</td><td>'+escape(p.partner ?? "–")+'</td></tr>').join("")+'</tbody></table></div>';
}

function pairStatus(pair) {
  return badge(pair.reason === "ready-timeout" ? "Rajt elmaradt" : pair.result ? matchOutcome(pair)
    : pair.awaitingReady ? pair.readyPlayers+" / "+(pair.bot ? 1 : 2)+" a rajtnál"
    : pair.timed ? "Futam folyamatban" : pair.ready+" / 2 leadva",
    pair.result === "crash" ? "critical" : pair.result ? "good" : "warm");
}
function projectionButton(pair, selected) {
  return '<button id="project-pair-'+pair.number+'" type="button" class="button small secondary" data-do="project-pair" data-number="'+pair.number+
    '" aria-pressed="'+selected+'">'+(selected ? "Újra kivetítem" : "Kivetítem")+'</button>';
}
function pairList(pairs, opened, selection, trainer = false) {
  if (!pairs.length) return empty("Itt jelennek meg a párok", "A döntések mindkét beküldés után válnak láthatóvá.");
  return '<div class="pair-list">'+pairs.map(pair => {
    const [a,b] = pair.names.map(escape);
    const id = "pair-"+pair.number;
    const selected = selection.some(entry => entry.number === pair.number);
    return '<details id="'+id+'"'+(opened.has(id) ? " open" : "")+'><summary><span class="pair-name"><small>#'+pair.number+
      '</small><strong>'+a+' <span class="muted">↔</span> '+b+'</strong></span><span class="pair-meta">'+
      pairStatus(pair)+
      (pair.connectionGap?.some(Boolean) ? badge("Kapcsolati jel hiányzott","warm") : "")+
      '<small>'+(pair.messageCount ?? 0)+' üzenet · '+pair.distance+' m</small>'+(selected ? badge('Kivetítőn','good') : '')+'</span></summary>'+
      '<div class="detail-content">'+
      (pair.result ? projectionButton(pair,selected) : "")+
      '<section class="trainer-transcript" data-transcript="'+pair.number+'"><h3>A pár története</h3><div data-transcript-body></div></section>'+
      (trainer && !pair.result ? '<button class="button small secondary" data-do="stop-pair" data-number="'+pair.number+'">Pár lezárása</button>' : "")+
      '</div></details>';
  }).join("")+'</div>';
}

function resultCounts(pairs) {
  const counts = { a:0, b:0, both:0, crash:0 };
  for (const pair of pairs) counts[pair.result]++;
  return counts;
}
function resultMetrics(pairs) {
  const counts = resultCounts(pairs);
  return '<div class="metrics outcome-metrics">'+metric("Az egyik kitért", counts.a+counts.b, "A másik haladt", "warm")+
    metric("Mindketten kitértek", counts.both, "Kölcsönös kitérés", "good")+
    metric("Ütközés", counts.crash, "Mindketten haladtak", "critical")+'</div>';
}

function resultSummary(pairs) {
  const completed = pairs.filter(pair => pair.result && pair.result !== "stopped");
  const stopped = pairs.filter(pair => pair.result === "stopped").length;
  return '<div class="result-groups"><section><h3>'+completed.length+' befejezett játék</h3>'+
    resultMetrics(completed)+'</section>'+
    (stopped ? '<p class="muted">Félbemaradt játék: '+stopped+'</p>' : '')+'</div>';
}
function reportTotals(groups) {
  const group = (label,pairs) => {
    const count = resultCounts(pairs);
    return '<div><strong>'+label+' · '+pairs.length+'</strong><span>'+ (count.a+count.b) +' egy kitérés</span>'+
      '<span>'+count.both+' kölcsönös</span><span>'+count.crash+' ütközés</span></div>';
  };
  return '<div class="report-totals">'+group("Ember–ember",groups.human)+
    (groups.test.length ? group("Tesztjátékosos",groups.test) : "")+
    (groups.stopped.length ? '<span>Félbemaradt · '+groups.stopped.length+'</span>' : "")+'</div>';
}
function reportWorkspace(cases, chosen, selection, onlyMessages) {
  const ordered = cases.slice().reverse();
  const current = ordered.find(pair => pair.number === chosen) ?? ordered[0];
  const selected = pair => selection.some(entry => entry.number === pair.number);
  const items = ordered.map(pair => {
    const names = escape(pair.names.join(" ↔ "));
    const messages = pair.messageCount ?? 0;
    return '<button type="button" id="report-case-'+pair.number+'" data-do="report-case" data-number="'+pair.number+
      '" data-case-search="'+escape(pair.number+" #"+pair.number+" "+pair.names.join(" "))+'" aria-pressed="'+(current === pair)+'">'+
      '<small>#'+pair.number+'</small><strong>'+names+'</strong><span>'+pairStatus(pair)+
      (messages ? badge(messages+" üzenet","warm") : '')+(pair.bot ? badge("Tesztjátékos") : "")+
      (selected(pair) ? badge("Kivetítőn","good") : "")+'</span></button>';
  }).join("");
  const list = '<div class="case-browser"><div class="case-browser-tools"><label for="case-search">Futam keresése</label>'+
    '<input id="case-search" type="search" placeholder="Név vagy futamszám" autocomplete="off" aria-controls="report-cases">'+
    '<div class="case-browser-filters"><button id="case-message-filter" class="button secondary small" type="button" data-do="report-messages" aria-pressed="'+
    !!onlyMessages+'">Csak üzenetes futamok</button><span id="case-count" role="status">'+ordered.length+' futam</span></div></div>'+
    '<nav id="report-cases" class="report-cases" aria-label="Lezárt futamok">'+items+'</nav>'+
    '<p id="case-no-results" class="muted" hidden>Nincs találat erre a keresésre.</p></div>';
  if (!current) return '<div class="report-workspace">'+list+
    empty("Itt nincs lezárt futam",onlyMessages ? "Kapcsold ki az üzenetszűrőt a többi futamhoz." : "Válts a fejlécben futamszűrőt.")+'</div>';
  const [a,b] = current.names.map(escape);
  const detail = '<section class="report-detail" data-transcript="'+current.number+'" data-report-story aria-label="A kiválasztott futam">'+
    '<div class="report-detail-head"><div><h3>Futam #'+current.number+'</h3><div class="case-result">'+pairStatus(current)+
    '<span>'+(current.messageCount ?? 0)+' üzenet</span>'+(current.bot ? '<span>Tesztjátékos</span>' : '')+'</div></div>'+
    projectionButton(current,selected(current))+'</div>'+
    '<div class="case-timeline-head case-lanes"><span>Időpont</span><strong class="case-side-a">'+a+'</strong><strong class="case-side-b">'+b+'</strong></div>'+
    '<div id="report-events" data-transcript-body></div></section>';
  return '<div class="report-workspace">'+list+detail+'</div>';
}
export function trainer(s, context) {
  const { room, tab, opened, roomLink, selection, filter, selectedGameMode, reportPair, reportPlayer, outcomePlayer, transitionPerson, onlyMessages, projectionPicker, projectionChoice, presentation = {target:"group",names:false,scope:"human",page:0} } = context;
  const lobby = s.phase === "lobby", closed = s.phase === "closed", active = s.pairs.filter(p => !p.result);
  const online = s.roster?.filter(p => p.online).length ?? 0;
  const hasPresence = s.roster?.some(p => p.online !== undefined);
  const stage = lobby ? "Váró" : closed ? "Lezárva" : active.length ? "Játék folyamatban" : "Minden pár végzett";
  const cta = lobby ? action("start", "Játék indítása", "primary", !s.count)
    : closed ? action("create", "Új tréningfutam", "primary") : action("stop", "Futam lezárása", "secondary danger");
  const nav = '<nav class="section-nav" aria-label="Tréneri nézetek">'+
    [["overview","Áttekintés"],["report","Riport"]].map(([id,label]) =>
      '<button type="button" id="trainer-tab-'+id+'" class="section-tab" data-do="tab" data-tab="'+id+'" aria-pressed="'+(tab===id)+'">'+label+'</button>').join("")+'</nav>';
  const toolbar = '<section class="control"><div class="control-title"><h1>Tréneri pult</h1>'+
    '<span class="control-code" aria-label="Szobakód: '+room+'">'+room+'</span>'+
    badge(stage, lobby ? "warm" : "good")+(!lobby ? badge(s.mode === "timed" ? "45 mp" : "Lépésenként","warm") : "")+
    '</div><div class="control-actions">'+cta+nav+
    action("share", "QR és belépés", "secondary")+
    action("open-projector","Kivetítő megnyitása","secondary")+'</div></section>';
  const stats = [["Résztvevő",s.count,hasPresence ? online+" online" : ""],
    [lobby ? "Induló pár" : "Aktív pár",lobby ? Math.ceil(s.count/2) : active.length,""],
    lobby ? ["Tesztjátékos",s.count%2,""] : ["Új partnerre vár",s.queue.length,""]];
  if (!lobby) stats.splice(1,0,["Lezárt futam",s.pairs.filter(pair=>pair.result && pair.result !== "stopped").length,""]);
  if (!lobby) stats.push(s.mode === "timed" ? ["Rajtra váró pár",active.filter(pair => pair.awaitingReady).length,""]
    : ["Leadott döntés",active.reduce((n,p) => n+p.ready,0)+" / "+active.length*2,""]);
  const metrics = '<dl class="control-stats">'+stats.map(([label,value,detail]) =>
    '<div><dt>'+label+'</dt><dd>'+value+(detail ? ' <small>· '+detail+'</small>' : "")+'</dd></div>').join("")+'</dl>';
  const chooser = lobby ? '<div class="race-modes" role="group" aria-label="Játékmód"><span>Játékmód</span>'+
    [["steps","Döntési pontonként"],["timed","Folyamatos · 45 mp"]].map(([id,title]) =>
      '<label><input id="mode-'+id+'" type="radio" name="game-mode" value="'+id+'"'+(selectedGameMode === id ? " checked" : "")+
      '>'+title+'</label>').join("")+'</div>' : "";
  let body;
  if (tab === "report") {
    const data = analyse(s.pairs,s.roster,filter === "stopped" ? "human" : filter);
    const cases = reportCases(s.pairs,filter).filter(pair=>!onlyMessages||pair.messageCount>0);
    const scope = {all:"Minden futam",human:"Ember–ember",test:"Tesztjátékosos"}[filter] ?? "Ember–ember";
    const details = [[data.active,"folyamatban"],[data.stopped,"félbemaradt"],[data.test,"tesztjátékosos"],
      [data.gaps,"hiányzó kapcsolati jellel"],[data.unlinked,"résztvevő-azonosítás nélkül"]]
      .filter(([count]) => count).map(([count,label]) => count+" "+label);
    const timelineHelp = '<details class="report-help" id="timeline-help"'+(opened.has("timeline-help")?' open':'')+'>'+
      '<summary>Jelmagyarázat</summary><p>GY · Győztes / V · Vesztes / K · Kórház / D · Döntetlen. '+
      'T · Tesztjátékosos futam. ! · Hiányzó kapcsolati jel. A méter a futam lezárását jelöli. '+
      'A sorok a játékosok saját futamsorrendjét mutatják.</p></details>';
    body = '<div class="debrief-dashboard trainer-report-layout">'+
      '<section class="report-panel report-summary" id="report-results" aria-label="Futameredmények" tabindex="-1">'+outcomeReport(data,outcomePlayer)+
      '<div class="report-scope"><strong>'+scope+' · '+data.races.length+' lezárt futam összesen</strong>'+
      details.map(item=>'<span>'+item+'</span>').join("")+'</div></section>'+
      '<section class="debrief-section report-panel" id="report-timelines" tabindex="-1">'+
      '<div class="report-section-head"><div><h3>Személyes futamsorok</h3><p>A név az egyéni történetet, a medál a futamot nyitja meg.</p></div>'+
      projectSection("people","Futamsorok kivetítése")+'</div>'+timelineHelp+learningPeople(data,reportPlayer)+'</section>'+
      learningPatterns(data,transitionPerson)+
      '<section class="debrief-section report-panel" id="case-section" tabindex="-1"><div class="report-section-head">'+
      '<h3>Egy futam két oldala</h3><div class="row">'+
      action("download-host","Döntések és üzenetek · CSV","small secondary",!s.pairs.some(p=>p.result))+
      '</div></div>'+reportWorkspace(cases,reportPair,selection,onlyMessages)+
      '<p class="trainer-question">Mire számítottál ezen a ponton, és miért? Mit tudtál akkor a másik szándékáról?</p></section>'+
      learningGuide(opened)+'</div>';
  } else if (lobby) {
    body = '<div class="trainer-grid">'+connectionsCard(s)+
      card("Belépés a futamba", '<div class="qr" id="inline-qr"></div><p class="qr-code">'+room+'</p>'+
      action("copy","Belépőlink másolása","secondary")+'<p class="muted">Ha megvan a létszám, indítsd a játékot. A rendszer véletlenszerűen párosít.</p>',"invite")+'</div>';
  } else {
    body = queueOverview(s)+connectionsCard(s)+card("Párok és döntések",
      pairList([...active,...s.pairs.filter(p=>p.result).slice().reverse()],opened,selection,true))+
      '<footer>'+action("download-diagnostics","Hibakeresési riport · JSON","small secondary",!s.pairs.length)+'</footer>';
  }
  return '<div class="cockpit"><header class="trainer-sticky">'+toolbar+projectionControls(s,filter,presentation,projectionPicker,projectionChoice,{reportPair,reportPlayer,outcomePlayer,transitionPerson})+'</header><div class="trainer-content">'+(tab === "report" && !lobby ? '' : '<div class="control-overview">'+metrics+chooser+'</div>')+body+'</div></div>';
}

function connectionsCard(state) {
  return card("Játékosok és kapcsolatok", '<p class="muted">A kapcsolat az utolsó bejelentkezések alapján frissül.</p>'+roster(state));
}

function namedPairings(pairs) {
  if (!pairs.length) return empty("Még nincs párosítás", "A játék indítása után itt jelennek meg a párok.");
  const rows = pairs.map(pair => '<tr><th scope="row">'+pair.number+'. játék</th><td>'+time(pair.startedAt)+'</td>'+
    '<td>'+escape(pair.names[0])+'</td><td>'+escape(pair.bot ? "A másik játékos" : pair.names[1])+'</td></tr>').join("");
  return '<div class="table-wrap projection-pairs"><table><thead><tr><th scope="col">Játék</th><th scope="col">Kezdés</th>'+
    '<th scope="col">Egyik játékos</th><th scope="col">Másik játékos</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

export function projector(s, room, selection, showPairings = false, screeningCase, reportTarget, presentation) {
  if(presentation && s.phase !== "lobby") {
    if(presentation.target !== "case") return presentationView(s,presentation);
    const pair=s.pairs.find(p=>p.number===presentation.number&&p.result);
    return pair ? '<div class="projection"><div class="screening-head"><h1>'+(presentation.names?pair.names.map((name,i)=>escape(pair.bot&&i===1?"Másik játékos":name)).join(" ↔ "):"Egy futam két oldala")+'</h1></div><section class="screening" data-transcript="'+pair.number+'"><div data-transcript-body></div></section></div>' : '<p>A kiválasztott futam még nem érhető el.</p>';
  }
  if (reportTarget && s.phase !== "lobby") return learningProjection(s,reportTarget);
  const lobby = s.phase === "lobby", active = s.pairs.filter(p=>!p.result).length;
  const cases = selection.map(entry => s.pairs.find(pair => pair.number === entry.number && pair.result)).filter(Boolean);
  const chosen = cases.find(pair => pair.number === screeningCase) ?? cases[0];
  const title = lobby ? "Belépés" : showPairings ? "Ki kivel játszott?" : chosen ? "Futam visszanézése" : "Összesített állás";
  const chooser = cases.length < 2 ? '<span class="eyebrow">Eset 1</span>' : '<nav class="row" aria-label="Kivetített esetek">'+cases.map((pair,index) =>
    '<button type="button" id="screen-case-'+pair.number+'" data-do="screen-case" data-number="'+pair.number+
    '" aria-pressed="'+(pair === chosen)+'" class="button small secondary">Eset '+(index+1)+'</button>').join("")+'</nav>';
  const story = chosen ? '<div class="screening-head"><h1>'+title+'</h1>'+chooser+'</div>'+
    '<section class="screening" data-transcript="'+chosen.number+'"><div data-transcript-body></div></section>' : "";
  return '<div class="projection">'+(!lobby && !showPairings && chosen ? story :
    '<div class="screening-head"><h1>'+title+'</h1></div>'+
    (lobby ? card("Csatlakozás",'<div class="qr" id="inline-qr"></div><p class="qr-code">'+room+'</p><p>'+s.count+' résztvevő csatlakozott</p>',"invite")
      : showPairings ? namedPairings(s.pairs) : learningProjection(s,"group")+
        '<p class="projection-status">'+active+' aktív pár</p>'))+'</div>';
}
function personalResult(match) {
  if (match.reason === "ready-timeout") return "A rajt elmaradt";
  if (match.outcome === "crash") return "Ütköztetek";
  const distance = match.history.at(-1)?.distance;
  return outcomes[match.outcome] + (Number.isFinite(distance) && match.outcome !== "stopped" ? " · "+distance+" m" : "");
}

export function personalReport(state, opened, medalFilter) {
  if (!state.report?.length) return "";
  const matches = medalFilter ? state.report.filter(match => match.outcome === medalFilter) : state.report;
  const controls = '<p class="muted" aria-live="polite">'+(medalFilter ? medals[medalFilter]+' · ' : '')+matches.length+' futam</p>';
  if (!matches.length) return card("Saját döntési riport",controls+'<p class="muted">Ehhez a medálhoz még nincs futamod.</p>',"report");
  return card("Saját döntési riport", controls+'<div class="pair-list">'+matches.map((m,i) => {
    const id = "report-"+m.number;
    return '<details id="'+id+'"'+(opened.has(id) || !medalFilter && !opened.seen?.has(id) && i===matches.length-1 ? " open" : "")+
      '><summary><span class="pair-name"><small>#'+m.number+'</small><strong>'+personalResult(m)+'</strong></span>'+
      '<span class="pair-meta">'+(medals[m.outcome] ? badge(medals[m.outcome]) : "")+(m.timed ? badge("45 mp") : "")+
      '</span></summary><div class="detail-content">'+
      (m.reason === "ready-timeout" ? '<p class="muted">A rajt kapcsolati okból elmaradt.</p>' :
        m.timed && m.outcome !== "stopped" ? '<p class="muted">'+(m.target ? "Kért kitérés: "+m.target+" m." :
          m.connectionGap ? "A futam végén nem érkezett kapcsolati jel." : "Továbbhaladás kitérési kérés nélkül.")+'</p>' : "")+
      decisions(m.history,"Te","A másik autó", row=>[row.own,row.other])+'</div></details>';
  }).join("")+'</div>',"report");
}

function rematch(s) {
  if (s.phase === "closed") return '<p class="muted">A tréner lezárta a futamot. A riportod itt elérhető.</p>';
  if (s.queued) return '<div class="feedback warm"><strong role="status">A következő futam előkészítése…</strong></div>'+
    action("cancel","Mégsem","secondary");
  return action("requeue","Új játékot indítok","primary");
}

function conversation(opened, finished) {
  const input = '<form id="chat-form" class="chat-form"><input id="message-input" name="message" aria-label="Üzeneted" placeholder="Üzenet a párodnak…" maxlength="240" autocomplete="off" required><button type="submit" class="button secondary" aria-label="Üzenet küldése">Küldés</button></form><p id="chat-status" class="muted" role="status" hidden></p>';
  return '<div class="night-comms"><details id="night-chat"'+(opened.has("night-chat") ? " open" : "")+
    '><summary aria-label="Üzenetelőzmények"><span id="latest-sender" class="night-sender">Üzenetek</span><span id="latest-message" aria-live="polite">Még nincs üzenet.</span></summary>'+
    '<div class="night-chat-history"><p class="chat-privacy">Az üzeneteket a párod és a tréner látja.</p><div class="messages" id="messages" aria-label="Párbeszéd"></div></div>'+
    '</details>'+(finished ? "" : input)+'</div>';
}
function timedControls(s, turnPending) {
  if (s.race.startsAt === null) return '<p class="night-status" role="status">'+
    (s.race.ready ? "A párod képernyőjére várunk…" : "Kapcsolódás a rajthoz…")+'</p>';
  if (s.race.target) return '<p class="night-status" role="status">Kitérés rögzítve · '+s.race.target+' m</p>';
  if (turnPending) return '<p class="night-status" role="status">Kitérés elküldve…</p>';
  return '<div class="night-actions">'+action("turn",'Kitérek <span aria-hidden="true">↗</span>',"primary",true)+'</div>'+
    '<p class="night-hint" data-race-hint>Kitérés a következő pontnál</p>';
}
function stepControls(s, pendingDecision, reveal) {
  if (s.waiting) return '<p class="night-status" role="status">Döntésed rögzítve <small>A másik autóra vársz.</small></p>';
  if (pendingDecision) return '<p class="night-status" role="status">A döntésed visszaigazolására várunk.</p>'+
    action("retry-decision","Döntés ellenőrzése","secondary");
  return '<div class="night-actions steps">'+action("go","Haladok","secondary",Boolean(reveal))+
    action("yield",'Kitérek <span aria-hidden="true">↗</span>',"primary",Boolean(reveal))+'</div>';
}
function medalCounts(report) {
  const counts = { other:0, own:0, crash:0, both:0 };
  for (const match of report ?? []) {
    if (Object.hasOwn(counts,match.outcome)) counts[match.outcome]++;
  }
  return counts;
}

function medalCollection(counts, medalFilter) {
  return '<div class="night-medals" role="group" aria-label="Saját medáljaid">'+Object.entries(medals).map(([outcome,label]) =>
    '<button type="button" class="night-medal" data-do="filter-player-report" data-medal="'+outcome+
    '" aria-controls="night-report" aria-pressed="'+(medalFilter===outcome)+'"><span>'+label+'</span><strong>'+
    counts[outcome]+'</strong></button>'
  ).join("")+'</div>';
}

function raceResult(s) {
  const title = s.reason === "ready-timeout" ? "A rajt elmaradt" : medals[s.outcome] ?? outcomes[s.outcome];
  const distance = s.history.at(-1)?.distance;
  const detail = s.reason === "ready-timeout" ? "A rajthoz hiányzott egy kapcsolati jelzés."
    : Number.isFinite(distance) ? distance+" m" : "";
  return '<div class="night-result" role="status"><span>FUTAM VÉGE</span><strong>'+title+'</strong>'+
    (detail ? '<small>'+detail+'</small>' : "")+'</div>';
}
function nightPlayer(s, {room,opened,turnPending,pendingDecision,reveal,medalFilter}) {
  const finished = Boolean(s.result);
  const counts = medalCounts(s.report);
  const timeLabel = finished ? "Vége" : s.race ? s.race.startsAt === null ? "Rajt előtt" : "Rajt…"
    : (s.step+1)+" / "+(s.totalSteps ?? legacyPoints.length)+". pont";
  const finishControls = finished ? reveal ? '<p class="night-status" role="status">Futam vége</p>'
    : raceResult(s)+injuryCard(counts.crash,{fresh:s.outcome === "crash"})+medalCollection(counts,medalFilter)+'<div class="stack rematch">'+rematch(s)+'</div>' : "";
  const report = finished && !reveal && s.report?.length
    ? '<details id="night-report"'+(opened.has("night-report") ? " open" : "")+
      '><summary>Saját döntési riport</summary>'+personalReport(s,opened,medalFilter)+'</details>' : "";
  return '<section class="night-game'+(finished ? " night-finished" : " night-playing")+
    '" aria-label="Padlógáz · '+(s.race ? "Folyamatos futam" : "Döntési pontonként")+
    '"'+(s.race ? ' data-timed' : '')+(reveal ? ' data-night-reveal' : '')+(s.result === "crash" ? ' data-night-crash' : '')+'>'+
    '<div class="night-id"><span>PADLÓGÁZ · FUTAM / '+String(s.number).padStart(2,"0")+'</span></div>'+
    (!finished ? conversation(opened,false) : "")+
    nightRoad(s.distance,timeLabel,s.race || finished ? "" : s.distance+" M",Boolean(s.race && !finished))+
    '<div class="night-console">'+(finished && !reveal && s.messages.length ? conversation(opened,true) : "")+
    (finished ? finishControls : injuryCard(counts.crash)+'<div class="night-drive-controls">'+
      (s.race ? timedControls(s,turnPending) : stepControls(s,pendingDecision,reveal))+'</div>')+
    '</div>'+report+'</section>';
}
export function player(s, context) {
  const { room } = context;
  if (s.phase === "lobby") return '<div class="player-shell"><div class="banner">'+road(920)+'</div>'+
    waitingPage("","A rajtra vársz", "Sikeresen csatlakoztál. A tréner indítja a párosítást.",
      '<p class="lobby-counter"><strong>'+s.count+'</strong> résztvevő a váróban</p>')+'</div>';
  if (s.spectator) return waitingPage("","Új játék","",rematch(s));
  return nightPlayer(s,context);
}

function projectSection(target,label){return '<div class="section-project"><button class="button secondary small" data-do="project-section" data-target="'+target+'">'+label+'</button></div>';}
function raceFilters(filter) {
  const options = [["all","Mind"],["human","Ember–ember"],["test","Tesztjátékosos"]];
  return '<div class="row story-filters" role="group" aria-label="Futamok szűrése">'+options.map(([key,label]) =>
    '<button id="filter-'+key+'" class="button secondary small" data-do="filter" data-filter="'+key+'" aria-pressed="'+(filter===key)+'">'+label+'</button>').join('')+'</div>';
}
function reportCases(pairs, filter) {
  return filter === "all" ? pairs.filter(pair => pair.result) : pairGroups(pairs)[filter] ?? [];
}
function projectionSelection(state, filter, p, picker, choice, report) {
  if (!picker) return "";
  const transitions = picker === "transitions";
  const individual = picker === "person" || transitions;
  const items = individual
    ? analyse(state.pairs,state.roster,filter).players.filter(player => player.events.some(event => event.included))
        .map(player => [player.number, player.name+" · R"+String(player.number).padStart(2,"0")])
    : reportCases(state.pairs,filter).slice().reverse().map(pair =>
        [pair.number,"#"+pair.number+" · "+pair.names.join(" ↔ ")+(pair.messageCount ? " · "+pair.messageCount+" üzenet" : "")]);
  if (transitions) items.unshift([0,"Csoport"]);
  const selected = choice ?? (transitions ? report.transitionPerson : individual
    ? report.outcomePlayer ?? report.reportPlayer ?? p.person : report.reportPair ?? p.number);
  const options = items.map(([number,label]) => '<option value="'+number+'"'+(number === selected ? ' selected' : '')+'>'+escape(label)+'</option>').join("");
  return '<form id="projection-picker" class="projection-picker"><label for="projection-choice">'+(transitions?"Kinek a futamai?":individual?"Játékos":"Futam")+'</label>'+
    '<select id="projection-choice" name="choice"'+(items.length?'':' disabled')+'>'+
    (options || '<option>'+(individual?"Ebben a szűrésben még nincs egyéni eredmény.":"Ebben a szűrésben még nincs lezárt futam.")+'</option>')+
    '</select><button class="button secondary small" type="submit"'+(items.length?'':' disabled')+'>Kivetítem</button></form>';
}
function projectionControls(state,filter,p,picker,choice,report) {
  const labels = {group:'Csoportkép',person:'Egyéni eredmények',people:'Személyes futamsorok',transitions:'Mi jött utána?',case:'Egy futam két oldala',guide:'Kivezetési kérdések'};
  const step = p.target === 'case';
  const paged = ['guide','person','people'].includes(p.target);
  const navigation = step || paged ? '<div class="row"><button class="button secondary small" data-do="'+(step?'project-step':'projection-page')+'" data-by="-1">'+(step?'← Pillanat':'← Oldal')+'</button>'+
    (step?'':'<span>'+(p.page+1)+'. oldal</span>')+'<button class="button secondary small" data-do="'+(step?'project-step':'projection-page')+'" data-by="1">'+(step?'Pillanat →':'Oldal →')+'</button></div>' : '';
  const shortcuts = state.phase === "lobby" ? '' : '<div class="projection-shortcuts" role="group" aria-label="Kivetíthető nézetek">'+
    Object.entries(labels).map(([target,label]) => {
      const opensPicker = ["person","case","transitions"].includes(target);
      const stateAttributes = opensPicker ? ' aria-expanded="'+(picker===target)+'"' : ' aria-pressed="'+(p.target===target)+'"';
      return '<button type="button" id="projection-shortcut-'+target+'" class="button secondary small" data-do="'+
        (opensPicker?'projection-pick':'project-section')+'" data-target="'+target+'"'+stateAttributes+'>'+label+'</button>';
    }).join('')+'</div>';
  return '<section class="projection-desk" aria-label="Kivetítő vezérlése"><div class="projection-settings">'+raceFilters(filter)+
    '<button type="button" id="projection-names" class="button secondary small" data-do="projection-names" aria-pressed="'+p.names+'">'+
    (p.names?'Nevek látszanak':'Név nélkül')+'</button>'+
    '<div class="projection-status-line"><span class="eyebrow">Kivetítő</span><strong>'+
    (state.phase === "lobby" ? "Belépés" : step ? "Futam #"+p.number : labels[p.target])+'</strong>'+
    (state.phase === "lobby" ? '' : navigation)+'</div></div>'+
    (state.phase === "lobby" ? '' : shortcuts+projectionSelection(state,filter,p,picker,choice,report))+'</section>';
}
