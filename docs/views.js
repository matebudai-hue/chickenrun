import { carPositions, pairGroups, legacyPoints } from "./story.js?v=15";
import { nightRoad } from "./live-race.js?v=15";

export const moves = { go: "Halad", yield: "Kitér" };
export const outcomes = {
  own: "Te tértél ki", other: "A másik autó tért ki",
  both: "Mindketten kitértek", crash: "Ütközés", stopped: "Félbemaradt",
};
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
  return '<section class="card centered"><p class="eyebrow">'+(room ? "SZOBA "+room : "CHICKEN RUN")+'</p><h1>'+
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
    '" aria-pressed="'+selected+'">'+(selected ? "Leveszem a kivetítőről" : "Kivetítem név nélkül")+'</button>';
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
function reportWorkspace(cases, chosen, selection) {
  const ordered = cases.slice().reverse();
  const current = ordered.find(pair => pair.number === chosen) ?? ordered[0];
  if (!current) return empty("Itt nincs lezárt játék", "A befejezett esetek a megfelelő csoportban jelennek meg.");
  const selected = pair => selection.some(entry => entry.number === pair.number);
  const items = ordered.map(pair =>
    '<button type="button" id="report-case-'+pair.number+'" data-do="report-case" data-number="'+pair.number+
    '" aria-pressed="'+(current === pair)+'"><small>#'+pair.number+'</small><strong>'+pair.names.map(escape).join(" ↔ ")+'</strong>'+
    '<span>'+pairStatus(pair)+(pair.bot ? badge("Tesztjátékos") : "")+(selected(pair) ? badge("Kivetítőn","good") : "")+
    (pair.connectionGap?.some(Boolean) ? badge("Kapcsolati jel hiányzott","warm") : "")+'</span></button>').join("");
  return '<div class="report-workspace"><nav id="report-cases" class="report-cases" aria-label="Lezárt párok">'+items+'</nav>'+
    '<section class="report-detail" data-transcript="'+current.number+'" data-report-story><div class="report-detail-head"><div><h3>'+
    current.names.map(escape).join(" ↔ ")+'</h3><p class="small-text">A pár története · #'+current.number+'</p></div>'+
    projectionButton(current,selected(current))+'</div><div id="report-events" data-transcript-body></div></section></div>';
}
export function trainer(s, context) {
  const { room, tab, opened, roomLink, selection, filter, showPairings, selectedGameMode, reportPair } = context;
  const lobby = s.phase === "lobby", closed = s.phase === "closed", active = s.pairs.filter(p => !p.result);
  const online = s.roster?.filter(p => p.online).length ?? 0;
  const hasPresence = s.roster?.some(p => p.online !== undefined);
  const stage = lobby ? "Váró" : closed ? "Lezárva" : active.length ? "Játék folyamatban" : "Minden pár végzett";
  const cta = lobby ? action("start", "Játék indítása", "primary", !s.count)
    : closed ? action("create", "Új tréningfutam", "primary") : action("stop", "Futam lezárása", "secondary danger");
  const toolbar = '<section class="control"><div class="control-title"><h1>Tréneri pult</h1>'+
    '<span class="control-code" aria-label="Szobakód: '+room+'">'+room+'</span>'+
    badge(stage, lobby ? "warm" : "good")+(!lobby ? badge(s.mode === "timed" ? "45 mp" : "Lépésenként","warm") : "")+
    '</div><div class="control-actions">'+cta+
    action("share", "QR és belépés", "secondary")+
    '<a class="button secondary" href="'+roomLink(room,"projector")+'" target="_blank" rel="noopener">Kivetítő</a></div></section>';
  const stats = [["Résztvevő",s.count,hasPresence ? online+" online" : ""],
    [lobby ? "Induló pár" : "Aktív pár",lobby ? Math.ceil(s.count/2) : active.length,
      !lobby ? s.pairs.length+" játék összesen" : ""],
    lobby ? ["Tesztjátékos",s.count%2,""] : ["Új partnerre vár",s.queue.length,""]];
  if (!lobby) stats.push(s.mode === "timed" ? ["Rajtra váró pár",active.filter(pair => pair.awaitingReady).length,""]
    : ["Leadott döntés",active.reduce((n,p) => n+p.ready,0)+" / "+active.length*2,""]);
  const metrics = '<dl class="control-stats">'+stats.map(([label,value,detail]) =>
    '<div><dt>'+label+'</dt><dd>'+value+(detail ? ' <small>· '+detail+'</small>' : "")+'</dd></div>').join("")+'</dl>';
  const nav = '<nav class="section-nav" aria-label="Tréneri nézetek">'+
    [["overview","Áttekintés"],["players","Játékosok"],["report","Riport"]].map(([id,label]) =>
      '<button class="section-tab" data-do="tab" data-tab="'+id+'" aria-pressed="'+(tab===id)+'">'+label+'</button>').join("")+'</nav>';
  const chooser = lobby ? '<div class="race-modes" role="group" aria-label="Játékmód"><span>Játékmód</span>'+
    [["steps","Döntési pontonként"],["timed","Folyamatos · 45 mp"]].map(([id,title]) =>
      '<label><input id="mode-'+id+'" type="radio" name="game-mode" value="'+id+'"'+(selectedGameMode === id ? " checked" : "")+
      '>'+title+'</label>').join("")+'</div>' : "";
  let body;
  if (tab === "report") {
    const groups = pairGroups(s.pairs);
    const cases = filter === "all" ? s.pairs.filter(pair => pair.result) : groups[filter];
    const filters = '<div class="row story-filters" aria-label="Esetek szűrése">'+
      [["all","Mind"],["human","Ember–ember"],["test","Tesztjátékosos"],["stopped","Félbemaradt"]].map(([key,label]) =>
        '<button id="filter-'+key+'" class="button small secondary" data-do="filter" data-filter="'+key+
        '" aria-pressed="'+(filter === key)+'">'+label+'</button>').join("")+'</div>';
    const projectionLabel = showPairings ? "Párosítások nevekkel" : selection.length+" / 2 név nélküli eset";
    const showNames = '<button id="project-pairings" type="button" class="button small secondary" data-do="project-pairings"'+
      ' aria-pressed="'+showPairings+'"'+(s.pairs.length ? "" : " disabled")+'>'+
      (showPairings ? "Vissza a név nélküli nézetre" : "Párosítások kivetítése nevekkel")+'</button>';
    body = card("Futamriport", '<div class="row between report-tools"><p class="small-text">Kivetítő · '+projectionLabel+'</p><div class="row">'+
      showNames+action("download-host","Döntések és üzenetek · CSV","small secondary",!s.pairs.some(p=>p.result))+'</div></div>'+
      reportTotals(groups)+filters+reportWorkspace(cases,reportPair,selection),"trainer-report");
  } else if (tab === "players") {
    body = card("Játékosok és kapcsolatok", '<p class="muted">A kapcsolat az utolsó bejelentkezések alapján frissül.</p>'+roster(s));
  } else if (lobby) {
    body = '<div class="trainer-grid">'+card("Játékosok a váróban",roster(s))+
      card("Belépés a futamba", '<div class="qr" id="inline-qr"></div><p class="qr-code">'+room+'</p>'+
      action("copy","Belépőlink másolása","secondary")+'<p class="muted">Ha megvan a létszám, indítsd a játékot. A rendszer véletlenszerűen párosít.</p>',"invite")+'</div>';
  } else {
    const done = s.pairs.filter(p=>p.result).length;
    body = queueOverview(s)+card("Párok és döntések", '<p class="muted">'+done+' befejezett játék · az aktív párok felül jelennek meg.</p>'+
      pairList([...active,...s.pairs.filter(p=>p.result).slice().reverse()],opened,selection,true));
  }
  return '<div class="cockpit">'+toolbar+'<div class="control-overview">'+metrics+chooser+'</div>'+nav+body+'</div>';
}

function namedPairings(pairs) {
  if (!pairs.length) return empty("Még nincs párosítás", "A játék indítása után itt jelennek meg a párok.");
  const rows = pairs.map(pair => '<tr><th scope="row">'+pair.number+'. játék</th><td>'+time(pair.startedAt)+'</td>'+
    '<td>'+escape(pair.names[0])+'</td><td>'+escape(pair.bot ? "A másik játékos" : pair.names[1])+'</td></tr>').join("");
  return '<div class="table-wrap projection-pairs"><table><thead><tr><th scope="col">Játék</th><th scope="col">Kezdés</th>'+
    '<th scope="col">Egyik játékos</th><th scope="col">Másik játékos</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

export function projector(s, room, selection, showPairings = false, screeningCase) {
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
      : showPairings ? namedPairings(s.pairs) : resultSummary(s.pairs)+
        '<p class="projection-status">'+active+' aktív pár</p>'))+'</div>';
}
export function personalReport(state, opened) {
  if (!state.report?.length) return "";
  const count = state.report.reduce((n, match)=>n+match.history.length,0);
  return card("Saját döntési riport", '<div class="row between"><p class="muted">'+state.report.length+' játék · '+count+' döntés</p>'+
    action("download-player","Letöltés · CSV","secondary small")+'</div><div class="pair-list">'+state.report.map((m,i) => {
    const id = "report-"+m.number;
    return '<details id="'+id+'"'+(opened.has(id) || !opened.seen?.has(id) && i===state.report.length-1 ? " open" : "")+
      '><summary><span class="pair-name"><small>#'+m.number+'</small><strong>'+(m.reason === "ready-timeout" ? "Rajt elmaradt" : outcomes[m.outcome])+'</strong></span>'+
      (m.timed ? badge("45 mp") : "")+'</summary><div class="detail-content">'+
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
  const input = '<form id="chat-form" class="chat-form"><input id="message-input" name="message" aria-label="Üzeneted" placeholder="Üzenet a párodnak…" maxlength="240" autocomplete="off" required><button class="button secondary">Küldés</button></form><p id="chat-status" class="muted" role="status" hidden></p>';
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
function raceResult(s) {
  const title = s.reason === "ready-timeout" ? "A rajt elmaradt" : outcomes[s.outcome];
  const distance = s.history.at(-1)?.distance;
  const detail = s.reason === "ready-timeout" ? "A rajthoz hiányzott egy kapcsolati jelzés."
    : Number.isFinite(distance) ? distance+" m" : "";
  return '<div class="night-result" role="status"><span>FUTAM VÉGE</span><strong>'+title+'</strong>'+
    (detail ? '<small>'+detail+'</small>' : "")+'</div>';
}
function nightPlayer(s, {room,opened,turnPending,pendingDecision,reveal}) {
  const finished = Boolean(s.result);
  const timeLabel = finished ? "Vége" : s.race ? s.race.startsAt === null ? "Rajt előtt" : "Rajt…"
    : (s.step+1)+" / "+(s.totalSteps ?? legacyPoints.length)+". pont";
  const finishControls = finished ? reveal ? '<p class="night-status" role="status">Futam vége</p>'
    : raceResult(s)+'<div class="stack rematch">'+rematch(s)+'</div>' : "";
  const report = finished && !reveal && s.report?.length
    ? '<details id="night-report"'+(opened.has("night-report") ? " open" : "")+
      '><summary>Saját döntési riport</summary>'+personalReport(s,opened)+'</details>' : "";
  return '<section class="night-game'+(finished ? " night-finished" : " night-playing")+
    '" aria-label="Chicken Run · '+(s.race ? "Folyamatos futam" : "Döntési pontonként")+
    '"'+(s.race ? ' data-timed' : '')+(reveal ? ' data-night-reveal' : '')+(s.result === "crash" ? ' data-night-crash' : '')+'>'+
    '<div class="night-id"><span>FUTAM / '+String(s.number).padStart(2,"0")+'</span><span>'+room+'</span></div>'+
    nightRoad(s.distance,timeLabel,s.race || finished ? "" : s.distance+" M",Boolean(s.race && !finished))+
    '<div class="night-console">'+(!finished || !reveal && s.messages.length ? conversation(opened,finished) : "")+
    (finished ? finishControls : '<div class="night-drive-controls">'+
      (s.race ? timedControls(s,turnPending) : stepControls(s,pendingDecision,reveal))+'</div>')+
    '</div>'+report+'</section>';
}
export function player(s, context) {
  const { room } = context;
  if (s.phase === "lobby") return '<div class="player-shell"><div class="banner">'+road(920)+'</div>'+
    waitingPage(room,"A rajtra vársz", "Sikeresen csatlakoztál. A tréner indítja a párosítást.",
      '<p class="lobby-counter"><strong>'+s.count+'</strong> résztvevő a váróban</p>')+'</div>';
  if (s.spectator) return waitingPage(room,"Új játék","",rematch(s));
  return nightPlayer(s,context);
}
