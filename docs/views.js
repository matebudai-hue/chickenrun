export const moves = { go: "Halad", yield: "Kitér" };
export const outcomes = {
  own: "Te tértél ki", other: "A másik autó tért ki",
  both: "Mindketten kitértek", crash: "Ütközés", stopped: "Tréner lezárta",
};
const statuses = {
  lobby: "A rajtra vár", pending: "Döntésre vár", ready: "Döntés leadva",
  queued: "Új partnerre vár", finished: "Befejezte",
};
const points = [1000, 800, 600, 400, 200, 50, 10];
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

function vehicle(other, x, y) {
  const color = other ? "#8bd5cc" : "#f3b764";
  const turn = other ? " rotate(180)" : "";
  return '<g transform="translate('+x+' '+y+')'+turn+'"><path d="M36-9 129-27v54L36 9Z" fill="url(#beam)"/>'+
    '<rect x="-36" y="-14" width="75" height="30" rx="10" fill="#0b1920" opacity=".8" transform="translate(0 4)"/>'+
    '<rect x="-26" y="-17" width="15" height="34" rx="3" fill="#0a1318"/><rect x="16" y="-17" width="15" height="34" rx="3" fill="#0a1318"/>'+
    '<path d="M-26-14H23q14 0 14 11v6q0 11-14 11h-49q-10 0-10-10v-8q0-10 10-10Z" fill="'+color+'" stroke="#f1f5ee" stroke-opacity=".6"/>'+
    '<path d="M-12-10h20l9 6v8l-9 6h-20l-7-5V-5Z" fill="#263d47"/><path d="M-5-10v20m13-18v16" stroke="#52747d" stroke-width="2"/>'+
    '<path d="M33-9v5m0 8v5" stroke="#fff6d7" stroke-width="4" stroke-linecap="round"/>'+
    '<path d="M-32-8v4m0 8v4" stroke="#a63438" stroke-width="2.5" stroke-linecap="round"/></g>';
}

function road(distance = 1000, first = false, second = false) {
  const spread = 43 + distance * .235;
  return '<svg class="road" viewBox="0 0 760 210" aria-hidden="true">'+
    '<defs><linearGradient id="asphalt" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#34474d"/><stop offset="1" stop-color="#192e36"/></linearGradient>'+
    '<linearGradient id="beam"><stop stop-color="#fff0b0" stop-opacity=".48"/><stop offset="1" stop-color="#fff0b0" stop-opacity="0"/></linearGradient>'+
    '<pattern id="scrub" width="27" height="22" patternUnits="userSpaceOnUse"><path d="M1 18 16 8m8 13 2-1" stroke="#536362" stroke-width="1" opacity=".44"/></pattern></defs>'+
    '<rect width="760" height="210" fill="#23373c"/><rect width="760" height="210" fill="url(#scrub)"/>'+
    '<rect y="43" width="760" height="124" fill="url(#asphalt)"/><path d="M0 48h760M0 162h760" stroke="#e1be7a" stroke-width="2" opacity=".7"/>'+
    '<path d="M0 105h760" stroke="#dfebec" stroke-width="2" stroke-dasharray="22 16" opacity=".38"/>'+
    '<path d="M380 66v78" stroke="#dae6dd" stroke-dasharray="2 5" opacity=".28"/>'+
    vehicle(false, 380-spread, first ? 31 : 105)+vehicle(true, 380+spread, second ? 180 : 105)+'</svg>';
}

export function home(previous, roomLink) {
  return '<div class="landing"><section class="hero"><div class="hero-copy"><p class="eyebrow">ÉLŐ TRÉNINGJÁTÉK</p>'+
    '<h1>Két autó.<br>Egy út.</h1><p>Egy kilométerről indultok egymás felé. Minden döntésnél választhatsz: haladsz vagy kitérsz.</p></div>'+
    road(740)+'</section><div class="entry-grid">'+card("Csatlakozás", '<form id="room-form" class="stack">'+
    field("room-code", "Szobakód", "8 karakter", 'required maxlength="8" autocomplete="off" autocapitalize="characters"')+
    '<button class="button primary">Csatlakozás</button></form>')+
    card("Tréneri felület", '<p>Indíts futamot, vetítsd ki a QR-kódot, és kövesd a párok döntéseit.</p>'+
    action("create", "Trénerként futamot indítok", "secondary")+
    (previous ? '<a class="text-link" href="'+roomLink(previous, "host")+'">Vissza az előző tréneri futamhoz</a>' : ''))+
    '</div></div>';
}

export function waitingPage(room, title, description, actions = "") {
  return '<section class="card centered"><p class="eyebrow">'+(room ? "SZOBA "+room : "CHICKEN RUN")+'</p><h1>'+
    title+'</h1><p>'+description+'</p>'+actions+'</section>';
}

export function join(room, previousName) {
  return '<div class="player-shell"><div class="banner">'+road(860)+'</div>'+
    waitingPage(room, "Csatlakozz a futamhoz", "Fiók nélkül játszol. A partnered csak az autódat és az üzeneteidet látja.",
      '<form id="player-form" class="stack">'+field("player-label", "Név vagy becenév · opcionális", "Például: Dóra",
        'maxlength="40" autocomplete="off" value="'+escape(previousName)+'"')+
      '<p class="small-text">A nevet csak a tréner látja.</p><button class="button primary">Csatlakozom</button></form>')+'</div>';
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

function pairList(pairs, opened, trainer = false) {
  if (!pairs.length) return empty("Itt jelennek meg a párok", "A döntések mindkét beküldés után válnak láthatóvá.");
  return '<div class="pair-list">'+pairs.map(pair => {
    const [a,b] = pair.names.map(escape);
    const id = "pair-"+pair.number;
    return '<details id="'+id+'"'+(opened.has(id) ? " open" : "")+'><summary><span class="pair-name"><small>#'+pair.number+
      '</small><strong>'+a+' <span class="muted">↔</span> '+b+'</strong></span><span class="pair-meta">'+
      badge(pair.result ? matchOutcome(pair) : pair.ready+" / 2 leadva", pair.result === "crash" ? "critical" : pair.result ? "good" : "warm")+
      '<small>'+pair.distance+' m</small></span></summary>'+
      '<div class="detail-content">'+decisions(pair.history,a,b,row => row.choices)+
      (trainer && !pair.result ? '<button class="button small secondary" data-do="stop-pair" data-number="'+pair.number+'">Pár lezárása</button>' : "")+
      '</div></details>';
  }).join("")+'</div>';
}

function resultMetrics(s) {
  return '<div class="metrics">'+metric("Az egyik kitért", s.results.a+s.results.b, "A másik haladt", "warm")+
    metric("Mindketten kitértek", s.results.both, "Kölcsönös kitérés", "good")+
    metric("Ütközés", s.results.crash, "Mindketten haladtak", "critical")+
    metric("Lezárva", s.results.stopped, "Tréneri lezárás")+'</div>';
}

export function trainer(s, context) {
  const { room, tab, opened, roomLink } = context;
  const lobby = s.phase === "lobby", closed = s.phase === "closed", active = s.pairs.filter(p => !p.result);
  const online = s.roster?.filter(p => p.online).length ?? 0;
  const hasPresence = s.roster?.some(p => p.online !== undefined);
  const stage = lobby ? "Váró" : closed ? "Lezárva" : active.length ? "Játék folyamatban" : "Minden pár végzett";
  const cta = lobby ? action("start", "Párosítás és indítás", "primary", !s.count)
    : closed ? action("create", "Új tréningfutam", "primary") : action("stop", "Futam lezárása", "secondary danger");
  const toolbar = '<section class="control"><div><p class="eyebrow">TRÉNERI VEZÉRLŐPULT</p><div class="control-title"><h1>Chicken Run</h1>'+
    badge(stage, lobby ? "warm" : "good")+'</div></div><div class="control-actions">'+cta+
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
  let body;
  if (tab === "report") {
    body = card("Futamriport", '<div class="row between"><p class="muted">Minden lezárt játék és döntési pont.</p>'+
      action("download-host","Riport letöltése · CSV","secondary",!s.pairs.some(p=>p.result))+'</div>'+resultMetrics(s)+
      pairList(s.pairs.filter(p=>p.result).slice().reverse(),opened));
  } else if (tab === "players") {
    body = card("Játékosok és kapcsolatok", '<p class="muted">A kapcsolat az utolsó bejelentkezések alapján frissül.</p>'+roster(s));
  } else if (lobby) {
    body = '<div class="trainer-grid">'+card("Játékosok a váróban",roster(s))+
      card("Belépés a futamba", '<div class="qr" id="inline-qr"></div><p class="qr-code">'+room+'</p>'+
      action("copy","Belépőlink másolása","secondary")+'<p class="muted">A játékosok a QR-kóddal vagy a szobakóddal csatlakozhatnak.</p>',"invite")+'</div>';
  } else {
    const done = s.pairs.filter(p=>p.result).length;
    body = card("Párok és döntések", '<p class="muted">'+done+' befejezett játék · az aktív párok felül jelennek meg.</p>'+
      pairList([...active,...s.pairs.filter(p=>p.result).slice().reverse()],opened,true));
  }
  return '<div class="cockpit">'+toolbar+metrics+nav+body+'</div>';
}

export function projector(s, room) {
  const lobby = s.phase === "lobby", active = s.pairs.filter(p=>!p.result).length;
  return '<div class="projection">'+header("KIVETÍTŐ · "+room, "Chicken Run",
    lobby ? "Olvasd be a QR-kódot, vagy add meg a szobakódot." : "A futam összesített állása")+
    (lobby ? card("Belépés",'<div class="qr" id="inline-qr"></div><p class="qr-code">'+room+'</p><p>'+s.count+' résztvevő csatlakozott</p>',"invite")
      : resultMetrics(s)+'<p class="projection-status">'+active+' aktív pár · '+s.queue.length+' játékos vár új partnerre</p>')+'</div>';
}

export function personalReport(state, opened) {
  if (!state.report?.length) return "";
  const count = state.report.reduce((n, match)=>n+match.history.length,0);
  return card("Saját döntési riport", '<div class="row between"><p class="muted">'+state.report.length+' játék · '+count+' döntés</p>'+
    action("download-player","Letöltés · CSV","secondary small")+'</div><div class="pair-list">'+state.report.map((m,i) => {
    const id = "report-"+m.number;
    return '<details id="'+id+'"'+(opened.has(id) || !opened.seen?.has(id) && i===state.report.length-1 ? " open" : "")+
      '><summary><span class="pair-name"><small>#'+m.number+'</small><strong>'+outcomes[m.outcome]+'</strong></span>'+
      (m.bot ? badge("Tesztjátékos") : "")+'</summary><div class="detail-content">'+
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

export function player(s, context) {
  const { room, opened, pendingDecision } = context;
  if (s.phase === "lobby") return '<div class="player-shell"><div class="banner">'+road(920)+'</div>'+
    waitingPage(room,"A rajtra vársz", "Sikeresen csatlakoztál. A tréner indítja a párosítást.",
      '<p class="lobby-counter"><strong>'+s.count+'</strong> résztvevő a váróban</p>')+'</div>';
  if (s.spectator) return waitingPage(room,"Új játék","A párosítás a jelentkezők között történik.",rematch(s));
  const last = s.history.at(-1);
  const finished = Boolean(s.result);
  const choice = pendingDecision?.choice;
  const controls = finished ? '<div class="feedback '+(s.result === "crash" ? "critical" : "good")+'" role="status"><strong>'+
    outcomes[s.outcome]+'</strong><p>A játék véget ért.</p></div><div class="stack rematch">'+rematch(s)+'</div>'
    : s.waiting ? '<div class="feedback good" role="status"><strong>Döntésed rögzítve</strong>'+
      '<p>A másik autó döntésére vársz.</p></div>'
    : choice ? '<div class="feedback warm" role="status"><strong>A döntésed visszaigazolására várunk</strong>'+
      '<p>A választásod: '+moves[choice]+'.</p></div>'+action("retry-decision","Döntés ellenőrzése","secondary")
    : '<div class="action-grid">'+action("go","Haladok","primary")+action("yield","Kitérek","secondary")+'</div>'+
      '<p class="muted">A döntések egyszerre jelennek meg, amikor mindketten leadtátok.</p>';
  const trail = points.map((point,i) => '<span class="'+(i===s.step ? "current" : i<s.step ? "passed" : "")+
    '"'+(i===s.step ? ' aria-current="step"' : "")+'>'+point+'</span>').join("");
  const stage = '<section class="card race-card"><div class="race-meta"><div><p class="eyebrow">TÁVOLSÁG KÖZTETEK</p>'+
    '<p class="distance">'+s.distance+' <span>m</span></p></div>'+badge((s.step+1)+'. pont / '+points.length,"light")+'</div>'+
    road(s.distance,finished && last?.own==="yield",finished && last?.other==="yield")+
    '<div class="legend"><span>● Te</span><span>● A másik autó</span></div>'+
    '<div class="trail" aria-label="Döntési pontok méterben">'+trail+'</div>'+controls+'</section>';
  const chat = card("Üzenetek",'<p class="muted">A párod látja az üzeneted.</p><div class="messages" id="messages" role="log" aria-label="Párbeszéd"></div>'+
    (finished ? "" : '<form id="chat-form" class="chat-form"><input id="message-input" name="message" aria-label="Üzeneted" placeholder="Üzenet a párodnak…" maxlength="240" autocomplete="off" required><button class="button secondary">Küldés</button></form>'),"chat-card");
  return '<div class="play">'+header("SZOBA "+room+" · "+s.number+". JÁTÉK",finished ? "Játék vége" : "Szemben az úton",
    finished ? "Nézd meg a döntéseidet, vagy kérj új partnert." : "Dönts, mit teszel ezen a ponton.")+
    '<div class="play-grid">'+stage+chat+'</div>'+
    (!finished && s.history.length ? card("Eddigi döntések",decisions(s.history,"Te","A másik autó",row=>[row.own,row.other])) : "")+
    personalReport(s,opened)+'</div>';
}