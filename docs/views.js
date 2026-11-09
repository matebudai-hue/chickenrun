import { carPositions, pairGroups, legacyPoints, revealDuration } from "./story.js?v=10";

export const moves = { go: "Halad", yield: "Kitér" };
export const outcomes = {
  own: "Te tértél ki", other: "A másik autó tért ki",
  both: "Mindketten kitértek", crash: "Ütközés", stopped: "Tréner lezárta",
};
const statuses = {
  lobby: "A rajtra vár", pending: "Döntésre vár", ready: "Döntés leadva",
  queued: "Új partnerre vár", finished: "Befejezte",
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

function vehicle(other, [x,y], from, elapsed) {
  const color = other ? "#a6e4ec" : "#ffb34a";
  const animation = from ? ' class="car-motion" style="--dx:'+(from[0]-x)+'px;--dy:'+(from[1]-y)+'px;--delay:-'+elapsed+'ms"' : "";
  return '<g transform="translate('+x+' '+y+')"><g'+animation+'><g transform="'+(other?'rotate(180)':'rotate(0)')+'"><path d="M36-9 129-27v54L36 9Z" fill="url(#beam)"/>'+
    '<rect x="-36" y="-14" width="75" height="30" rx="10" fill="#0b1920" opacity=".8" transform="translate(0 4)"/>'+
    '<rect x="-26" y="-17" width="15" height="34" rx="3" fill="#0a1318"/><rect x="16" y="-17" width="15" height="34" rx="3" fill="#0a1318"/>'+
    '<path d="M-26-14H23q14 0 14 11v6q0 11-14 11h-49q-10 0-10-10v-8q0-10 10-10Z" fill="'+color+'" stroke="#f1f5ee" stroke-opacity=".6"/>'+
    '<path d="M-12-10h20l9 6v8l-9 6h-20l-7-5V-5Z" fill="#263d47"/><path d="M-5-10v20m13-18v16" stroke="#52747d" stroke-width="2"/>'+
    '<path d="M33-9v5m0 8v5" stroke="#fff6d7" stroke-width="4" stroke-linecap="round"/>'+
    '<path d="M-32-8v4m0 8v4" stroke="#a63438" stroke-width="2.5" stroke-linecap="round"/></g></g></g>';
}

function road(distance = 1000, first = false, second = false, reveal = null) {
  const [a,b] = carPositions(distance,first,second);
  const elapsed = reveal ? performance.now() - reveal.started : 0;
  const [previousA,previousB] = reveal && elapsed < revealDuration ? carPositions(reveal.distance) : [];
  return '<svg class="road" viewBox="0 0 760 210" aria-hidden="true">'+
    '<defs><linearGradient id="beam"><stop stop-color="#fff3ca" stop-opacity=".6"/><stop offset="1" stop-color="#fff3ca" stop-opacity="0"/></linearGradient>'+
    '<pattern id="road-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="#5d655a" opacity=".4"/></pattern></defs>'+
    '<rect width="760" height="210" fill="#262c26"/><rect width="760" height="210" fill="url(#road-grid)"/>'+
    '<rect y="44" width="760" height="122" fill="#141917"/>'+
    '<path d="M0 48h760M0 162h760" stroke="#cbbe96" stroke-width="2"/>'+
    '<path d="M0 58h760M0 152h760" stroke="#3b4038" stroke-width="1"/>'+
    '<path d="M0 105h760" stroke="#aba78a" stroke-width="2" stroke-dasharray="20 15" opacity=".65"/>'+
    '<path d="M380 57v97m-9-94h18m-18 90h18" stroke="#d9d2b6" stroke-dasharray="3 5" opacity=".52"/>'+
    '<path d="M18 25h24m-12-12v24m688 148h24m-12-12v24" stroke="#8e987c" opacity=".65"/>'+    vehicle(false,a,previousA,elapsed)+vehicle(true,b,previousB,elapsed)+'</svg>';
}

function coverArt() {
  return '<svg class="cover-art" viewBox="0 0 800 500" aria-hidden="true">'+
    '<defs><linearGradient id="beam"><stop stop-color="#fff0c6" stop-opacity=".76"/><stop offset="1" stop-color="#fff0c6" stop-opacity="0"/></linearGradient>'+
    '<pattern id="cover-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0v30" fill="none" stroke="#53604d" opacity=".6"/></pattern>'+
    '<pattern id="cover-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0v9" stroke="#a5ae90" opacity=".38"/></pattern></defs>'+
    '<rect width="800" height="500" fill="#292f27"/><rect width="800" height="500" fill="url(#cover-grid)"/>'+
    '<path d="M32 100h166v86H32zM600 317h166v110H600z" fill="url(#cover-hatch)"/>'+
    '<path d="M44 39h35m-17-17v34m662 398h34m-17-17v34M400 16v468m-384-234h768" stroke="#a5ae90" stroke-width="1" opacity=".55"/>'+
    '<g transform="rotate(-22 400 250)"><rect x="-140" y="167" width="1080" height="166" fill="#171b17"/>'+
    '<path d="M-140 169h1080M-140 331h1080" stroke="#e1d6ad" stroke-width="3"/>'+
    '<path d="M-140 180h1080M-140 320h1080" stroke="#bcb296" stroke-width="1" opacity=".52"/>'+
    '<path d="M-140 250h1080" stroke="#bcb296" stroke-dasharray="28 22" stroke-width="2" opacity=".65"/>'+
    '<path d="M394 181v138m12-138v138" stroke="#bcb296" stroke-dasharray="3 8" opacity=".45"/>'+
    vehicle(false,[158,250])+vehicle(true,[642,250])+'</g>'+
    '<path d="M56 370h114m-114 12h81M630 124h114m-81 12h81" stroke="#f2c85f" stroke-width="2" opacity=".8"/>'+
    '<path d="M33 442h32m-32-1v-32m734-351h-32m32 1v32" fill="none" stroke="#f2c85f" stroke-width="2"/></svg>';
}
export function home(previous, roomLink) {
  return '<div class="landing"><section class="card trainer-entry"><p class="eyebrow">TRÉNERI VEZÉRLŐPULT</p>'+
    '<h1 class="cover-title">Chicken<br>Run</h1><div class="row cover-actions">'+action("create","Új futam és QR-kód","primary")+
    (previous ? '<a class="button secondary" href="'+roomLink(previous,"host")+'">Vissza az előző futamhoz</a>' : '')+
    '</div></section><div class="entry-art">'+coverArt()+'</div></div>';
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

function roster(state) {
  if (!state.roster?.length) return empty("Még senki sem csatlakozott", "Mutasd meg a QR-kódot, vagy oszd meg a belépőlinket.");
  return '<div class="table-wrap roster"><table><thead><tr><th scope="col">Játékos</th><th scope="col">Kapcsolat</th>'+
    '<th scope="col">Állapot</th><th scope="col">Játék</th><th scope="col">Partner</th></tr></thead><tbody>'+
    state.roster.map(p => '<tr><th scope="row">'+escape(p.name)+'</th><td>'+
      badge(p.online === undefined ? "–" : p.online ? "Online" : "Nem észlelhető", p.online ? "good" : "")+'</td><td>'+
      badge(statuses[p.status], p.status === "ready" ? "good" : p.status === "queued" ? "warm" : "")+
      (p.status === "queued" ? ' <button type="button" class="text-link" data-do="test-pair" data-player="'+p.number+
        '" data-number="'+(p.match ?? 0)+'">Tesztjátékost adok</button>' : "")+
      '</td><td>'+(p.match ?? "–")+'</td><td>'+escape(p.partner ?? "–")+'</td></tr>').join("")+'</tbody></table></div>';
}

function pairList(pairs, opened, selection, trainer = false) {
  if (!pairs.length) return empty("Itt jelennek meg a párok", "A döntések mindkét beküldés után válnak láthatóvá.");
  return '<div class="pair-list">'+pairs.map(pair => {
    const [a,b] = pair.names.map(escape);
    const id = "pair-"+pair.number;
    const selected = selection.some(entry => entry.number === pair.number);
    return '<details id="'+id+'"'+(opened.has(id) ? " open" : "")+'><summary><span class="pair-name"><small>#'+pair.number+
      '</small><strong>'+a+' <span class="muted">↔</span> '+b+'</strong></span><span class="pair-meta">'+
      badge(pair.result ? matchOutcome(pair) : pair.ready+" / 2 leadva", pair.result === "crash" ? "critical" : pair.result ? "good" : "warm")+
      '<small>'+(pair.messageCount ?? 0)+' üzenet · '+pair.distance+' m</small>'+(selected ? badge('Kivetítőn','good') : '')+'</span></summary>'+
      '<div class="detail-content">'+
      (pair.result ? '<button id="project-pair-'+pair.number+'" type="button" class="button small secondary" data-do="project-pair" data-number="'+pair.number+
        '" aria-pressed="'+selected+'">'+(selected ? "Leveszem a kivetítőről" : "Kivetítem név nélkül")+'</button>' : "")+
      '<section class="trainer-transcript" data-transcript="'+pair.number+'"><h3>A pár története</h3><div data-transcript-body></div></section>'+
      (trainer && !pair.result ? '<button class="button small secondary" data-do="stop-pair" data-number="'+pair.number+'">Pár lezárása</button>' : "")+
      '</div></details>';
  }).join("")+'</div>';
}

function resultMetrics(pairs) {
  const counts = { a:0, b:0, both:0, crash:0 };
  for (const pair of pairs) counts[pair.result]++;
  return '<div class="metrics outcome-metrics">'+metric("Az egyik kitért", counts.a+counts.b, "A másik haladt", "warm")+
    metric("Mindketten kitértek", counts.both, "Kölcsönös kitérés", "good")+
    metric("Ütközés", counts.crash, "Mindketten haladtak", "critical")+'</div>';
}

function resultSummary(groups) {
  return '<div class="result-groups"><section><h3>Ember–ember · '+groups.human.length+' játék</h3>'+
    resultMetrics(groups.human)+'</section>'+
    (groups.test.length ? '<section><h3>Tesztjátékos ellen · '+groups.test.length+' játék</h3>'+resultMetrics(groups.test)+'</section>' : '')+
    (groups.stopped.length ? '<p class="muted">Tréner által lezárt, félbemaradt játék: '+groups.stopped.length+'</p>' : '')+'</div>';
}
export function trainer(s, context) {
  const { room, tab, opened, roomLink, selection, filter, showPairings, selectedGameMode } = context;
  const lobby = s.phase === "lobby", closed = s.phase === "closed", active = s.pairs.filter(p => !p.result);
  const online = s.roster?.filter(p => p.online).length ?? 0;
  const hasPresence = s.roster?.some(p => p.online !== undefined);
  const stage = lobby ? "Váró" : closed ? "Lezárva" : active.length ? "Játék folyamatban" : "Minden pár végzett";
  const cta = lobby ? action("start", "Játék indítása", "primary", !s.count)
    : closed ? action("create", "Új tréningfutam", "primary") : action("stop", "Futam lezárása", "secondary danger");
  const toolbar = '<section class="control"><div><p class="eyebrow">TRÉNERI VEZÉRLŐPULT</p><div class="control-title"><h1>Chicken Run</h1>'+
    badge(stage, lobby ? "warm" : "good")+(s.mode === "timed" ? badge("45 mp","warm") : "")+'</div></div><div class="control-actions">'+cta+
    action("share", "QR és belépés", "secondary")+
    '<a class="button secondary" href="'+roomLink(room,"projector")+'" target="_blank" rel="noopener">Kivetítő</a></div></section>';
  const metrics = '<div class="metrics">'+metric("Résztvevők", s.count, hasPresence ? online+" online" : "Csatlakozott játékosok", "good")+
    metric(lobby ? "Induló párok" : "Aktív párok", lobby ? Math.ceil(s.count/2) : active.length,
      lobby && s.count%2 ? "Egy tesztjátékossal" : lobby ? "Véletlen párosítás" : s.pairs.length+" játék összesen")+
    metric(lobby ? "Szobakód" : "Leadott döntések", lobby ? room : active.reduce((n,p) => n+p.ready,0)+" / "+active.length*2,
      lobby ? "Fiók nélküli belépés" : "Az aktuális döntési pontokon", "warm")+
    metric(lobby ? "Tesztjátékos" : "Új partnerre vár", lobby ? s.count%2 : s.queue.length,
      lobby ? "Páratlan létszámnál automatikus" : "A résztvevők maguk jelentkeznek")+'</div>';
  const nav = '<nav class="section-nav" aria-label="Tréneri nézetek">'+
    [["overview","Áttekintés"],["players","Játékosok"],["report","Riport"]].map(([id,label]) =>
      '<button class="section-tab" data-do="tab" data-tab="'+id+'" aria-pressed="'+(tab===id)+'">'+label+'</button>').join("")+'</nav>';
  const chooser = lobby ? '<fieldset class="race-modes"><legend>Játékmód</legend>'+
    [["steps","Döntési pontonként","Két gomb · minden pontnál választanak"],
     ["timed","Folyamatos futam","45 mp · 1500 m · egyetlen Kitérek gomb"]].map(([id,title,description]) =>
      '<label><input type="radio" name="game-mode" value="'+id+'"'+(selectedGameMode === id ? " checked" : "")+
      '><span><strong>'+title+'</strong><small>'+description+'</small></span></label>').join("")+'</fieldset>' : "";
  let body;
  if (tab === "report") {
    const groups = pairGroups(s.pairs);
    const cases = filter === "all" ? s.pairs.filter(pair => pair.result) : groups[filter];
    const filters = '<div class="row story-filters" aria-label="Esetek szűrése">'+
      [["all","Mind"],["human","Ember–ember"],["test","Tesztjátékosos"],["stopped","Félbemaradt"]].map(([key,label]) =>
        '<button id="filter-'+key+'" class="button small secondary" data-do="filter" data-filter="'+key+
        '" aria-pressed="'+(filter === key)+'">'+label+'</button>').join("")+'</div>';
    const projectionLabel = showPairings ? "Párosítások nevekkel" : selection.length+" / 2 név nélküli eset";
    const showNames = '<button id="project-pairings" type="button" class="button secondary" data-do="project-pairings"'+
      ' aria-pressed="'+showPairings+'"'+(s.pairs.length ? "" : " disabled")+'>'+
      (showPairings ? "Vissza a név nélküli nézetre" : "Párosítások kivetítése nevekkel")+'</button>';
    body = card("Futamriport", '<div class="row between"><p class="muted">Kivetítő · '+projectionLabel+'</p><div class="row">'+
      showNames+action("download-host","Döntések és üzenetek letöltése · CSV","secondary",!s.pairs.some(p=>p.result))+'</div></div>'+resultSummary(groups)+filters+
      (cases.length ? pairList(cases.slice().reverse(),opened,selection) : empty("Itt nincs lezárt játék", "A befejezett esetek a megfelelő csoportban jelennek meg.")));
  } else if (tab === "players") {
    body = card("Játékosok és kapcsolatok", '<p class="muted">A kapcsolat az utolsó bejelentkezések alapján frissül.</p>'+roster(s));
  } else if (lobby) {
    body = '<div class="trainer-grid">'+card("Játékosok a váróban",roster(s))+
      card("Belépés a futamba", '<div class="qr" id="inline-qr"></div><p class="qr-code">'+room+'</p>'+
      action("copy","Belépőlink másolása","secondary")+'<p class="muted">Ha megvan a létszám, indítsd a játékot. A rendszer véletlenszerűen párosít.</p>',"invite")+'</div>';
  } else {
    const done = s.pairs.filter(p=>p.result).length;
    body = card("Párok és döntések", '<p class="muted">'+done+' befejezett játék · az aktív párok felül jelennek meg.</p>'+
      pairList([...active,...s.pairs.filter(p=>p.result).slice().reverse()],opened,selection,true));
  }
  return '<div class="cockpit">'+toolbar+chooser+metrics+nav+body+'</div>';
}

function namedPairings(pairs) {
  if (!pairs.length) return empty("Még nincs párosítás", "A játék indítása után itt jelennek meg a párok.");
  const rows = pairs.map(pair => '<tr><th scope="row">'+pair.number+'. játék</th><td>'+time(pair.startedAt)+'</td>'+
    '<td>'+escape(pair.names[0])+'</td><td>'+escape(pair.names[1])+'</td></tr>').join("");
  return '<div class="table-wrap projection-pairs"><table><thead><tr><th scope="col">Játék</th><th scope="col">Kezdés</th>'+
    '<th scope="col">Egyik játékos</th><th scope="col">Másik játékos</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

export function projector(s, room, selection, showPairings = false) {
  const lobby = s.phase === "lobby", active = s.pairs.filter(p=>!p.result).length;
  const cases = selection.map(entry => s.pairs.find(pair => pair.number === entry.number && pair.result)).filter(Boolean);
  const stories = '<div class="projection-stories">'+cases.map((pair,index) =>
    card("Eset "+(index+1), '<section data-transcript="'+pair.number+'"><div data-transcript-body></div></section>','projection-case')).join("")+'</div>';
  return '<div class="projection">'+header("KIVETÍTŐ · "+room, "Chicken Run",
    lobby ? "Olvasd be a QR-kódot, vagy add meg a szobakódot." : showPairings ? "Ki kivel játszott?" : cases.length ? "Kiválasztott esetek" : "A futam összesített állása")+
    (lobby ? card("Belépés",'<div class="qr" id="inline-qr"></div><p class="qr-code">'+room+'</p><p>'+s.count+' résztvevő csatlakozott</p>',"invite")
      : showPairings ? namedPairings(s.pairs) : cases.length ? stories : resultSummary(pairGroups(s.pairs))+
        '<p class="projection-status">'+active+' aktív pár · '+s.queue.length+' játékos vár új partnerre</p>')+'</div>';
}
export function personalReport(state, opened) {
  if (!state.report?.length) return "";
  const count = state.report.reduce((n, match)=>n+match.history.length,0);
  return card("Saját döntési riport", '<div class="row between"><p class="muted">'+state.report.length+' játék · '+count+' döntés</p>'+
    action("download-player","Letöltés · CSV","secondary small")+'</div><div class="pair-list">'+state.report.map((m,i) => {
    const id = "report-"+m.number;
    return '<details id="'+id+'"'+(opened.has(id) || !opened.seen?.has(id) && i===state.report.length-1 ? " open" : "")+
      '><summary><span class="pair-name"><small>#'+m.number+'</small><strong>'+outcomes[m.outcome]+'</strong></span>'+
      (m.timed ? badge("45 mp") : "")+(m.bot ? badge("Tesztjátékos") : "")+'</summary><div class="detail-content">'+
      (m.timed ? '<p class="muted">'+(m.target ? "Kért kitérés: "+m.target+" m." : "Továbbhaladás kitérési kérés nélkül.")+'</p>' : "")+
      decisions(m.history,"Te","A másik autó", row=>[row.own,row.other])+'</div></details>';
  }).join("")+'</div>',"report");
}

function rematch(s) {
  if (s.phase === "closed") return '<p class="muted">A tréner lezárta a futamot. A riportod itt elérhető.</p>';
  if (s.queued) return '<div class="feedback warm" role="status"><strong>Új partnerre vársz</strong>'+
    '<p>A játék automatikusan elindul, amikor akad egy másik jelentkező.</p></div>'+action("cancel","Kilépek a várólistáról","secondary");
  return action("requeue","Új játékot indítok","primary")+
    '<p class="muted">A következő játékhoz másik jelentkezőt keresünk.</p>';
}

function conversation(finished) {
  return card("Üzenetek",'<p class="muted">Az üzeneteket a párod és a tréner látja.</p><div class="messages" id="messages" role="log" aria-label="Párbeszéd"></div>'+
    (finished ? "" : '<form id="chat-form" class="chat-form"><input id="message-input" name="message" aria-label="Üzeneted" placeholder="Üzenet a párodnak…" maxlength="240" autocomplete="off" required><button class="button secondary">Küldés</button></form>'),"chat-card");
}

function timedPlayer(s, {room,opened,turnPending}) {
  const finished = Boolean(s.result);
  const last = s.history.at(-1);
  const controls = finished ? '<div class="feedback '+(s.result === "crash" ? "critical" : "good")+'" role="status"><strong>'+
    outcomes[s.outcome]+'</strong><p>A játék véget ért.</p></div><div class="stack rematch">'+rematch(s)+'</div>'
    : s.race.target ? '<div class="feedback good" role="status"><strong>Kitérés rögzítve · '+s.race.target+' m</strong></div>'
    : turnPending ? '<div class="feedback warm" role="status"><strong>Kitérés elküldve…</strong></div>'
    : '<div class="action-grid timed-action">'+action("turn","Kitérek","primary",true)+'</div>';
  const stage = '<section class="card race-card timed-race"'+(finished ? "" : ' data-live-race')+'><div class="race-meta">'+
    '<div><p class="eyebrow">TÁVOLSÁG KÖZTETEK</p><p class="distance"><b data-race-distance>'+s.distance+'</b> <span>m</span></p></div>'+
    '<span class="badge light" data-race-time>'+ (finished ? "Vége" : "Rajt…")+'</span></div>'+
    (finished ? "" : '<progress max="45000" value="0" aria-label="Eltelt játékidő"></progress>')+
    '<div class="live-road">'+road(s.distance,finished && last?.own==="yield",finished && last?.other==="yield")+
    '<span class="race-flash" data-race-mark aria-hidden="true" hidden></span></div>'+
    '<div class="legend"><span>● Te</span><span>● A másik autó</span></div>'+controls+'</section>';
  return '<div class="play">'+header("SZOBA "+room+" · "+s.number+". JÁTÉK",finished ? "Játék vége" : "Folyamatos futam",
    finished ? "Itt találod a futamod eredményét." : "Az autó halad. A gombbal a következő pontnál térsz ki.")+
    '<div class="play-grid">'+stage+(finished ? personalReport(s,opened) : conversation(false))+'</div>'+
    (finished && s.messages.length ? '<details id="closed-chat" class="closed-chat"'+(opened.has("closed-chat") ? " open" : "")+
      '><summary>Lezárt üzenetváltás</summary>'+conversation(true)+'</details>' : finished ? "" : personalReport(s,opened))+'</div>';
}
export function player(s, context) {
  const { room, opened, pendingDecision, reveal } = context;
  if (s.phase === "lobby") return '<div class="player-shell"><div class="banner">'+road(920)+'</div>'+
    waitingPage(room,"A rajtra vársz", "Sikeresen csatlakoztál. A tréner indítja a párosítást.",
      '<p class="lobby-counter"><strong>'+s.count+'</strong> résztvevő a váróban</p>')+'</div>';
  if (s.spectator) return waitingPage(room,"Új játék","A párosítás a jelentkezők között történik.",rematch(s));
  if (s.race) return timedPlayer(s,context);
  const last = s.history.at(-1);
  const finished = Boolean(s.result);
  const choice = pendingDecision?.choice;
  const revealing = Boolean(reveal);
  const controls = finished ? '<div class="feedback '+(s.result === "crash" ? "critical" : "good")+'" role="status"><strong>'+
    outcomes[s.outcome]+'</strong><p>A játék véget ért.</p></div><div class="stack rematch">'+rematch(s)+'</div>'
    : s.waiting ? '<div class="feedback good" role="status"><strong>Döntésed rögzítve</strong>'+
      '<p>A másik autó döntésére vársz.</p></div>'
    : choice ? '<div class="feedback warm" role="status"><strong>A döntésed visszaigazolására várunk</strong>'+
      '<p>A választásod: '+moves[choice]+'.</p></div>'+action("retry-decision","Döntés ellenőrzése","secondary")
    : '<div class="action-grid">'+action("go","Haladok","primary",revealing)+action("yield","Kitérek","primary",revealing)+'</div>';

  const stage = '<section class="card race-card"><div class="race-meta"><div><p class="eyebrow">TÁVOLSÁG KÖZTETEK</p>'+
    '<p class="distance">'+s.distance+' <span>m</span></p></div>'+badge((s.step+1)+'. pont / '+(s.totalSteps ?? legacyPoints.length),"light")+'</div>'+
    road(s.distance,finished && last?.own==="yield",finished && last?.other==="yield",reveal)+
    '<div class="legend"><span>● Te</span><span>● A másik autó</span></div>'+
    (last ? '<p class="decision-reveal" role="status"><strong>'+
      (s.result && s.result !== "stopped" ? "Az utolsó döntés" : "Mindketten továbbmentetek")+'</strong>'+
      '<span>'+last.distance+' m · Te: '+moves[last.own]+' · A másik autó: '+moves[last.other]+'</span></p>' : "")+
    controls+'</section>';
  const chat = conversation(finished);
  return '<div class="play">'+header("SZOBA "+room+" · "+s.number+". JÁTÉK",finished ? "Játék vége" : "Szemben az úton",
    finished ? (s.phase === "closed" ? "Itt találod a döntéseidet." : "Nézd meg a döntéseidet, vagy kérj új partnert.") : "Haladsz tovább vagy kitérsz?")+
    '<div class="play-grid">'+stage+(finished ? personalReport(s,opened) : chat)+'</div>'+
    (finished && s.messages.length ? '<details id="closed-chat" class="closed-chat"'+(opened.has("closed-chat") ? " open" : "")+
      '><summary>Lezárt üzenetváltás</summary>'+chat+'</details>' : finished ? "" : personalReport(s,opened))+'</div>';
}