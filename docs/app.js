import { presentationPages } from "./learning.js?v=31";
import { normalizePresentation, changePresentation } from "./presentation.js?v=27";
import { animateRace } from "./live-race.js?v=15";
import { nextReveal, pairStory, legacyPoints, revealDuration, screeningFrames } from "./story.js?v=27";
import { command, readState, saved, secret } from "./connection.js?v=5";
import { enterCode, escape, home, join, moves, outcomes, player, projector, time, trainer, waitingPage } from "./views.js?v=32";

const screen = document.querySelector("#screen");
const connection = document.querySelector("#connection");
const notice = document.querySelector("#notice");
const noticeText = document.querySelector("#notice-text");
const retryButton = document.querySelector("#retry");
const dialog = document.querySelector("#dialog");
const base = new URL("./", location.href);
const params = new URLSearchParams(location.search);
const room = (params.get("room") || "").trim().toUpperCase();
const codeValid = /^[23456789A-HJ-NP-Z]{8}$/;
const mode = params.get("view");
const isTrainer = mode === "host" || mode === "projector";
document.body.dataset.surface = mode === "projector" ? "projector" : !isTrainer && (room || mode === "player") ? "player" : "trainer";
if (document.body.dataset.surface === "player") document.querySelector(".mast .brand")?.remove();
const roomKey = "cr:"+(isTrainer ? "host" : "player")+":"+room;
const decisionKey = "cr:pending-decision:"+room;
const joinKey = "cr:pending-join:"+room;
const createKey = "cr:pending-create";
const projectionModeKey = "cr:projection-mode:"+room;

let auth = saved.get(roomKey);
let state, signature, loadFailure, errorRetry, pollTimer;
let busy = false, polling = false, generation = 0, lastPulse = 0;
let selectedTab = "overview", filter = "human", reportPair, reportPlayer, outcomePlayer, transitionPerson = 0, onlyMessages = false, draft = "", messageRequest, confirmAction;
let reveal, revealTimer, finishRoadHeight, screeningCase, medalFilter;
const screenPositions = new Map();
let selectedGameMode = "steps";
let raceOffset = Date.now() - performance.now(), stopAnimation, turnPending = false;
let chatPending, chatNotice = "", turnAck;
let showPairings = saved.get(projectionModeKey) === "pairings";
let reportTarget = saved.get(projectionModeKey)?.startsWith("learning:") ? saved.get(projectionModeKey).slice(9) : undefined;
const presentationKey = "cr:presentation:"+room;
let presentation;
try {
  const stored = JSON.parse(saved.get(presentationKey) || "{}");
  // Old replays could omit messages, so their saved frame numbers cannot be reused.
  if (stored.target === "case" && Array.isArray(stored.quotes)) stored.step = 0;
  presentation = normalizePresentation(stored);
} catch { presentation = normalizePresentation(); }
let selection = presentation.target === "case" ? [{number:presentation.number}] : [];
filter = presentation.scope;
let projectorWindow, projectionPicker, projectionChoice;
let caseQuery = "";
const projectionChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(presentationKey) : null;
function adoptPresentation(value) {
 const next = normalizePresentation(value);
 if (next.revision < presentation.revision) return;
 presentation = next;
 selection = next.target === "case" ? [{number:next.number}] : [];
 screeningCase = next.number;
 screenPositions.set(next.number,next.step);
 if (state) render();
}
function publishPresentation(patch) {
 presentation = changePresentation(presentation,patch);
 if(state) presentation.page=Math.min(presentation.page,presentationPages(state,presentation)-1);
 saved.set(presentationKey,JSON.stringify(presentation));
 projectionChannel?.postMessage(presentation);
 if(projectorWindow && !projectorWindow.closed) projectorWindow.postMessage({kind:presentationKey,value:presentation},location.origin);
 adoptPresentation(presentation);
}
function openProjector() {
 if (projectorWindow && !projectorWindow.closed) return;
 projectorWindow = window.open(roomLink(room,"projector"),"chicken-projector-"+room);
 if(!projectorWindow) showNotice("A böngésző letiltotta a kivetítőablakot. Engedélyezd a felugró ablakot, majd kattints a Kivetítő megnyitása gombra.");
 else showNotice();
}
projectionChannel?.addEventListener("message",event=>adoptPresentation(event.data));
window.addEventListener("message",event=>{
 if(event.origin!==location.origin || event.data?.kind!==presentationKey) return;
 adoptPresentation(event.data.value);
});
if(mode === "projector") {
 screeningCase = presentation.number;
 screenPositions.set(presentation.number,presentation.step);
 setInterval(()=>{
  try { const next=JSON.parse(saved.get(presentationKey)||"{}"); if(next.revision>presentation.revision) adoptPresentation(next); } catch {}
 },700);
}
let pendingDecision;
try { pendingDecision = JSON.parse(saved.get(decisionKey)); } catch {}
const transcriptCache = new Map();
const opened = new Set();
opened.seen = new Set();

function roomLink(code, view) {
  const url = new URL(base);
  url.searchParams.set("room", code);
  if (view) url.searchParams.set("view", view);
  return url.href;
}

const projectionSections = {
  group:"report-results", person:"report-results", people:"report-timelines",
  transitions:"report-transitions", case:"case-section", guide:"report-guide"
};

function scrollToReportSection(id) {
  const section = document.getElementById(id);
  if (!section) return;
  const header = screen.querySelector(".trainer-sticky");
  const top = section.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight ?? 0) - 12;
  window.scrollTo(0,top);
}

function selectStory(number) {
  if (!state.pairs.some(pair => pair.number === number && pair.result)) return;
  publishPresentation({target:"case",number,scope:filter,page:0,step:0});
}

function endpoint(action) {
  return "/api/rooms/"+room+"/"+action;
}

function setConnection(kind, label) {
  connection.dataset.state = kind;
  connection.textContent = label;
}

function showNotice(text = "", retry) {
  errorRetry = retry;
  notice.hidden = !text;
  noticeText.textContent = text;
  retryButton.hidden = !retry;
}

function resolveDecision(next) {
  if (!pendingDecision) return;
  if (next.number === pendingDecision.number && next.step === pendingDecision.step && !next.waiting && !next.result) return;
  pendingDecision = null;
  saved.remove(decisionKey);
}

function update(next, started = performance.now()) {
  if (Number.isFinite(next.serverAt)) {
    const received = performance.now();
    raceOffset = next.serverAt + Math.min((received - started) / 2, 200) - received;
    delete next.serverAt;
    if (next.race && !next.result) next.distance = next.race.marks[0][0];
  }
  const previous = state;
  if (turnAck && next.number === turnAck.number && next.race && !next.result) {
    next.race.target ??= turnAck.target;
  }
  if (previous?.number !== next.number) {
    finishRoadHeight = undefined;
    opened.delete("night-report");
    medalFilter = undefined;
    turnAck = undefined;
    turnPending = false;
    chatNotice = "";
    draft = "";
    messageRequest = undefined;
  }
  if (!isTrainer) {
    const raceFinished = next.race && next.history?.length && next.result &&
      previous?.number === next.number && !previous.result;
    const road = screen.querySelector("[data-night-road]");
    if (next.result && previous?.number === next.number && !previous.result) {
      finishRoadHeight = document.body.dataset.keyboard === "true" ? undefined : road?.offsetHeight;
    }
    const shown = Number(road?.dataset.position);
    const transition = raceFinished ? {
      distance: Number.isFinite(shown) ? shown : next.distance,
      started: performance.now(),
    } : next.race ? null : nextReveal(previous,next);
    if (transition) {
      reveal = transition;
      clearTimeout(revealTimer);
      const hold = next.result && !matchMedia("(prefers-reduced-motion: reduce)").matches ? 330 : 20;
      revealTimer = setTimeout(() => { reveal = null; render(); }, revealDuration + hold);
    } else if (previous?.number !== next.number) {
      clearTimeout(revealTimer);
      reveal = null;
    }
  }
  resolveDecision(next);
  const nextSignature = JSON.stringify(isTrainer ? next : { ...next, messages: undefined });
  state = next;
  if (nextSignature === signature) {
    if (!isTrainer && JSON.stringify(previous?.messages) !== JSON.stringify(next.messages)) paintChat();
    return;
  }
  signature = nextSignature;
  render();
}

function nextPoll(delay = 0) {
  clearTimeout(pollTimer);
  if (auth && codeValid.test(room)) pollTimer = setTimeout(poll, delay);
}

async function poll() {
  if (busy || polling || !auth || loadFailure) return;
  polling = true;
  const stamp = generation;
  const query = new URLSearchParams();
  if (isTrainer && state?.queue?.length) query.set("clock", "1");
  const visible = !isTrainer && !document.hidden;
  const pulse = visible && Date.now() - lastPulse > (state?.race && !state.result ? 2000 : 12_000);
  if (pulse) query.set("pulse", "1");
  if (visible && state?.race?.startsAt === null && !state.result && !state.race.ready) {
    query.set("ready", state.number);
  }
  try {
    const started = performance.now();
    const next = await readState(endpoint("state")+(query.size ? "?"+query : ""), auth);
    if (stamp !== generation) return;
    if (pulse) lastPulse = Date.now();
    setConnection("ok", "Kapcsolat rendben");
    update(next,started);
  } catch (error) {
    if (stamp !== generation) return;
    if (error.status === 403 || error.status === 404) {
      loadFailure = error.status;
      setConnection("idle", "");
      render();
    } else {
      setConnection("slow", navigator.onLine ? "Újracsatlakozás…" : "Nincs internetkapcsolat");
    }
  } finally {
    polling = false;
    if (!loadFailure) nextPoll(document.hidden ? 4500 : state?.phase === "closed" ? 3000 : state?.race && !state.result ? 400+Math.random()*100 : state?.queued ? 600 : 1000+Math.random()*250);
  }
}

function lockButtons(lock) {
  screen.querySelectorAll("button").forEach(button => {
    if (lock && !button.disabled) {
      button.dataset.locked = "";
      button.disabled = true;
    } else if (!lock && "locked" in button.dataset) {
      delete button.dataset.locked;
      button.disabled = false;
    }
  });
}

async function perform(path, body, success, retry, label = "Kérés küldése…") {
  if (busy) return;
  busy = true;
  generation++;
  clearTimeout(pollTimer);
  lockButtons(true);
  retryButton.disabled = true;
  showNotice();
  setConnection("working", label);
  try {
    const started = performance.now();
    const next = await command(path, auth, body, () => setConnection("slow", "Lassú kapcsolat · ellenőrzés…"));
    setConnection("ok", "Kapcsolat rendben");
    success(next,started);
  } catch (error) {
    if (error.retryable) {
      setConnection("slow", navigator.onLine ? "A kapcsolat bizonytalan" : "Nincs internetkapcsolat");
      showNotice("A szerver nem igazolta vissza a kérést. Próbáld újra ugyanazt a műveletet.", retry);
    } else {
      setConnection("ok", "Kapcsolat rendben");
      showNotice(error.message);
      if (pendingDecision && path.endsWith("/decision")) {
        pendingDecision = null;
        saved.remove(decisionKey);
        render();
      }
    }
  } finally {
    busy = false;
    lockButtons(false);
    retryButton.disabled = false;
    if (!saved.get(joinKey) || state) nextPoll();
  }
}

function mutate(action, body = {}, onSuccess = update) {
  const labels = { turn: "Kitérés küldése…", decision: "Döntés küldése…", requeue: "Futam előkészítése…", start: "Párosítás…" };
  return perform(endpoint(action), body, onSuccess, () => mutate(action, body, onSuccess), labels[action]);
}

function paintChatControls() {
  const button = screen.querySelector("#chat-form button");
  if (button) {
    button.disabled = Boolean(chatPending);
    button.textContent = chatPending ? "Küldés…" : "Küldés";
  }
  const status = screen.querySelector("#chat-status");
  if (status) {
    status.hidden = !chatNotice;
    status.textContent = chatNotice;
  }
}

async function sendChat(request) {
  if (chatPending) return;
  chatPending = request;
  chatNotice = "";
  paintChatControls();
  try {
    await command(endpoint("message"), auth, request);
    if (messageRequest === request) {
      messageRequest = undefined;
      if (draft.trim() === request.text) {
        draft = "";
        const input = screen.querySelector("#message-input");
        if (input) input.value = "";
      }
    }
  } catch (error) {
    if (state.number === request.number && !state.result) {
      chatNotice = error.retryable ? "Az üzenet visszaigazolása elmaradt. Újraküldheted." : error.message;
    }
  } finally {
    chatPending = undefined;
    paintChatControls();
    nextPoll();
  }
}

async function sendTurn(number) {
  if (turnPending) return;
  turnPending = true;
  showNotice();
  const request = command(endpoint("turn"), auth, { number });
  render();
  try {
    const next = await request;
    if (next.turnAck?.number !== number) throw new Error("A szerver nem igazolta vissza a kitérést.");
    if (state.number === number && !state.result) {
      turnAck = next.turnAck;
      state.race.target = turnAck.target;
    }
  } catch (error) {
    if (state.number === number && !state.result && !state.race.target) {
      showNotice(error.retryable ? "A kitérés visszaigazolása elmaradt. Ellenőrizzük az állást." : error.message);
    }
  } finally {
    if (state.number === number) {
      turnPending = false;
      render();
    }
    nextPoll();
  }
}

function createRoom() {
  const key = saved.get(createKey) ?? secret();
  saved.set(createKey, key);
  void perform("/api/rooms", { key }, next => {
    saved.set("cr:host:"+next.room,next.token);
    saved.set("cr:last-host",next.room);
    saved.remove(createKey);
    location.assign(roomLink(next.room,"host"));
  }, createRoom, "Futam létrehozása…");
}

function joinRoom(label) {
  auth ||= secret();
  saved.set(roomKey, auth);
  saved.set(joinKey, label);
  const onJoined = next => {
    saved.remove(joinKey);
    lastPulse = Date.now();
    update(next);
  };
  void perform(endpoint("join"), { label }, onJoined, () => joinRoom(label), "Csatlakozás…");
}

function paintQr(target) {
  if (!target || !window.qrcode) return;
  const qr = window.qrcode(0,"M");
  qr.addData(roomLink(room));
  qr.make();
  target.innerHTML = qr.createSvgTag({cellSize:5,margin:20,scalable:true,alt:"A játékosok belépési QR-kódja"});
}

function revealDialog(content) {
  if (dialog.open) dialog.close();
  dialog.innerHTML = content;
  dialog.showModal();
}

function confirm(title, description, label, callback) {
  confirmAction = callback;
  revealDialog('<div class="stack"><h2 id="dialog-title">'+title+'</h2><p>'+description+'</p>'+
    '<div class="row"><button class="button secondary" data-close autofocus>Mégse</button>'+
    '<button class="button danger" data-confirm>'+label+'</button></div></div>');
}

function share() {
  const link = roomLink(room);
  revealDialog('<div class="stack invite"><h2 id="dialog-title">Belépés a futamba</h2><div class="qr" id="modal-qr"></div>'+
    '<p class="qr-code">'+room+'</p><label for="share-link">Belépőlink</label>'+
    '<input id="share-link" readonly value="'+link+'"><div class="row"><button class="button secondary" data-close>Bezárás</button>'+
    '<button class="button primary" data-copy>Link másolása</button></div><p id="copy-status" class="muted" role="status"></p></div>');
  paintQr(document.querySelector("#modal-qr"));
}

async function copyLink(button) {
  try {
    await navigator.clipboard.writeText(roomLink(room));
    button.textContent = "Link másolva";
  } catch {
    if (!dialog.open) share();
    const input = document.querySelector("#share-link");
    input.focus();
    input.select();
    document.querySelector("#copy-status").textContent = "Jelöld ki és másold a belépőlinket.";
  }
}

function downloadCsv(headings, rows, label) {
  const safe = value => {
    const raw = String(value ?? "");
    const text = /^[\s]*[=+\-@]/.test(raw) ? "'"+raw : raw;
    return '"'+text.replaceAll('"','""')+'"';
  };
  const csv = [headings,...rows].map(row=>row.map(safe).join(";")).join("\r\n");
  downloadFile(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}), "padlogaz-"+room+"-"+label+".csv");
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadDiagnostics(button) {
  button.disabled = true;
  try {
    const report = await readState(endpoint("diagnostics"),auth);
    const file = new Blob([JSON.stringify(report,null,2)+"\n"],{type:"application/json"});
    downloadFile(file,"padlogaz-"+room+"-hibakereses.json");
    showNotice();
  } catch {
    showNotice("A hibakeresési riport letöltése nem sikerült.", () => void downloadDiagnostics(button));
  } finally {
    button.disabled = false;
  }
}

async function downloadTrainerReport(button) {
  button.disabled = true;
  try {
    const { pairs } = await readState(endpoint("transcript"),auth);
    const messages = new Map(pairs.map(pair => [pair.number,pair.messages]));
    const headings = ["Játék","Típus","Távolság (m)","Időpont","Játékos 1","Döntés 1","Játékos 2","Döntés 2","Feladó","Üzenet","Kimenetel","Hiányzó kapcsolati jel"];
    const rows = state.pairs.filter(pair => pair.result).flatMap(pair => {
      const [a,b] = pair.names;
      const connectionNotes = pair.reason === "ready-timeout" ? "Rajt elmaradt" :
        pair.names.filter((_, seat) => pair.connectionGap?.[seat]).join(", ");
      const outcome = pair.result === "a" ? a+" tért ki" : pair.result === "b" ? b+" tért ki" : outcomes[pair.result];
      const decisions = pair.history.map(row => ({
        at:row.at ?? 0, cells:[pair.number,"Döntés",row.distance,time(row.at),a,moves[row.choices[0]],b,moves[row.choices[1]],"","",outcome],
      }));
      const turns = (pair.turns ?? []).flatMap((turn,seat) => turn ? [{
        at:turn.at, cells:[pair.number,"Kitérési kérés",turn.distance,time(turn.at),a,"",b,"",pair.names[seat],
          "Kért pont: "+turn.target+" m",outcome],
      }] : []);
      const chat = (messages.get(pair.number) ?? []).map(row => ({
        at:row.at ?? 0, cells:[pair.number,"Üzenet",row.distance,time(row.at),a,"",b,"",pair.names[row.seat],row.text,outcome],
      }));
      const events = [...chat,...decisions,...turns].sort((first,second) => first.at-second.at);
      return events.length
        ? events.map(row => [...row.cells,connectionNotes])
        : [[pair.number,"Kimenetel","","",a,"",b,"","","",outcome,connectionNotes]];
    });
    downloadCsv(headings,rows,"treneri");
    showNotice();
  } catch (error) {
    showNotice("A riport letöltése nem sikerült. Próbáld újra.", () => void downloadTrainerReport(button));
  } finally {
    button.disabled = false;
  }
}

function revealTitle(pair, event, names) {
  const points = pair.distances ?? legacyPoints;
  const next = points[points.indexOf(event.distance)+1];
  if (event.choices.every(choice => choice === "go")) return !pair.timed && next ? "Tovább "+next+" méterre" : "Ütközés";
  if (event.choices.every(choice => choice === "yield")) return "Mindketten kitértek";
  return names[event.choices.indexOf("yield")]+" tért ki";
}

function paintScreening(target, pair, frames, index, loading) {
  const names = presentation.names ? pair.names.map((name,i)=>pair.bot&&i===1?"Másik játékos":escape(name)) : ["Játékos A","Játékos B"];
  const event = frames[index];
  const closing = event.kind === "reveal" && index === frames.length-1 && pair.result !== "stopped";
  const meters = closing && pair.result === "crash" ? 0 : event.distance;
  let title = "Rajt";
  let detail = "";
  if (loading) title = "Eset betöltése…";
  else if (event.kind === "message") {
    title = names[event.seat]+" üzenete";
    detail = '<blockquote>'+escape(event.text)+'</blockquote>';
  } else if (event.kind === "turn") {
    title = names[event.seat]+" kitérést kért";
    detail = '<p>Kért pont · '+event.target+' m</p>';
  } else if (event.kind === "reveal") {
    title = revealTitle(pair,event,names);
    detail = '<p>'+names.map((name,seat)=>name+' · '+moves[event.choices[seat]]).join(' <span aria-hidden="true">/</span> ')+'</p>';
  } else if (event.kind === "stopped") title = pair.reason === "ready-timeout" ? "A rajt elmaradt" : "Félbemaradt futam";

  if (!target.querySelector(".screening-road")) {
    target.innerHTML = '<div class="screening-story" aria-live="polite"><span data-screen-distance></span><h2 data-screen-title></h2>'+
      '<div data-screen-detail></div></div><div class="screening-road" aria-hidden="true">'+
      '<i class="screening-car car-a"></i><i class="screening-car car-b"></i></div>'+
      '<div class="screening-controls"><button type="button" id="screen-prev" class="button secondary" data-do="screen-step" data-by="-1">← Előző pillanat</button>'+
      '<div class="screening-progress"><progress max="1" value="1" aria-label="A történet állása"></progress><span></span></div>'+
      '<button type="button" id="screen-next" class="button primary" data-do="screen-step" data-by="1">Következő pillanat →</button></div>';
  }
  target.querySelector("[data-screen-distance]").textContent = Number.isFinite(meters) ? meters+" m" : "";
  target.querySelector("[data-screen-title]").innerHTML = title;
  target.querySelector("[data-screen-detail]").innerHTML = detail;
  const road = target.querySelector(".screening-road");
  road.style.setProperty("--gap", (29*Math.pow(Math.min(1500,Math.max(0,meters ?? 1000))/1500,.62))+"%");
  road.toggleAttribute("data-impact", closing && pair.result === "crash");
  road.querySelector(".car-a").classList.toggle("exits", event.choices?.[0] === "yield");
  road.querySelector(".car-b").classList.toggle("exits", event.choices?.[1] === "yield");
  target.querySelector("#screen-prev").disabled = loading || index === 0;
  target.querySelector("#screen-next").disabled = loading || index >= frames.length-1;
  const progress = target.querySelector("progress");
  progress.max = frames.length;
  progress.value = index+1;
  target.querySelector(".screening-progress span").textContent = (index+1)+" / "+frames.length;
}

function renderCaseTimeline(pair, events, loading) {
  const names = pair.names.map(escape);
  let previousDistance;
  const rows = events.map((event,index) => {
    const distance = event.distance;
    const marker = index === 0 || distance !== previousDistance
      ? '<div class="case-distance">'+(Number.isFinite(distance) ? distance+" m" : "Rajt előtti üzenetek")+'</div>' : "";
    previousDistance = distance;
    const clock = '<span class="case-clock">'+time(event.at)+'</span>';
    if (event.kind === "reveal") {
      const cells = event.choices.map((choice,seat) =>
        '<div class="case-choice case-side-'+(seat===0?'a':'b')+'">'+(moves[choice] ?? "–")+'</div>').join("");
      return '<li>'+marker+'<div class="case-lanes case-reveal">'+clock+cells+
        '<p>'+revealTitle(pair,event,names)+'</p></div></li>';
    }
    const kind = event.kind === "message" ? "Üzenet" : event.kind === "choice" ? "Döntés beküldve" : "Kitérés kérése";
    const content = event.kind === "message" ? '<blockquote>'+escape(event.text)+'</blockquote>'
      : event.kind === "choice" ? '<strong>'+moves[event.choice]+'</strong>' : '<strong>'+event.target+' m</strong>';
    const side = event.seat === 0 ? "a" : "b";
    return '<li>'+marker+'<div class="case-lanes">'+clock+'<div class="case-event case-side-'+side+
      '" aria-label="'+names[event.seat]+' · '+kind+'"><small>'+kind+'</small>'+content+'</div></div></li>';
  }).join("");
  return (loading ? '<p class="muted" role="status">Üzenetek betöltése…</p>' : "")+
    (rows ? '<ol class="case-timeline" aria-label="A futam eseményei">'+rows+'</ol>'
      : loading ? "" : '<p class="muted">Ehhez a futamhoz még nincs esemény.</p>');
}

function paintCaseSearch() {
  const input = screen.querySelector("#case-search");
  if (!input) return;
  const fold = text => text.toLocaleLowerCase("hu-HU").normalize("NFD").replace(/\p{Diacritic}/gu,"");
  const query = fold(caseQuery.trim());
  if (input.value !== caseQuery) input.value = caseQuery;
  let count = 0;
  const items = screen.querySelectorAll("#report-cases [data-case-search]");
  for (const item of items) {
    item.hidden = !fold(item.dataset.caseSearch).includes(query);
    if (!item.hidden) count++;
  }
  const countLabel = screen.querySelector("#case-count");
  const text = count+" futam";
  if (countLabel.textContent !== text) countLabel.textContent = text;
  screen.querySelector("#case-no-results").hidden = !items.length || count > 0;
}

function renderPairStory(section, pair, messages, projected, loading = false) {
  if (projected) {
    const frames = screeningFrames(pair,messages);
    const index = Math.min(screenPositions.get(pair.number) ?? 0,frames.length-1);
    section.screening = { pair, frames, index, loading };
    paintScreening(section.querySelector("[data-transcript-body]"),pair,frames,index,loading);
    return;
  }
  const events = pairStory(pair,messages);
  const transcript = section.hasAttribute("data-report-story") ? renderCaseTimeline(pair,events,loading) : renderInlineStory(pair,events,loading);
  section.querySelector("[data-transcript-body]").innerHTML = transcript+
    (pair.result === "stopped" ? '<p class="muted">'+(pair.reason === "ready-timeout"
      ? "A rajthoz nem érkezett meg mindkét játékos kapcsolati jelzése." : "A tréner lezárta a játékot.")+'</p>' : "")+
    (pair.connectionGap?.some(Boolean) ? '<p class="muted">A futam végén hiányzott a kapcsolati jel · '+
      pair.names.filter((_, seat) => pair.connectionGap[seat]).map(escape).join(", ")+'</p>' : "");
}

function renderInlineStory(pair, events, loading) {
  const names = pair.names.map(escape);
  let distance;
  const rows = events.map(event => {
    const showDistance = distance !== event.distance;
    distance = event.distance;
    const marker = showDistance ? '<h4>'+(distance === undefined ? "Korábbi üzenetek" : distance+" m")+'</h4>' : "";
    let content;
    if (event.kind === "message") {
      content = '<strong>'+names[event.seat]+'</strong><blockquote>'+escape(event.text)+'</blockquote>';
    } else if (event.kind === "turn") {
      content = '<strong>'+names[event.seat]+'</strong> · Kitérést kért '+event.target+' m-nél';
    } else if (event.kind === "choice") {
      content = '<strong>'+names[event.seat]+'</strong> · '+moves[event.choice]+' <small>(beküldve)</small>';
    } else {
      const summary = revealTitle(pair,event,names);
      content = '<strong>'+summary+'</strong><span class="story-choices">'+
        names[0]+': '+moves[event.choices[0]]+' · '+names[1]+': '+moves[event.choices[1]]+'</span>';
    }
    return '<li class="story-event event-'+event.kind+'">'+marker+'<div class="story-body">'+
      '<span class="story-time">'+time(event.at)+'</span><div>'+content+'</div></div></li>';
  }).join("");
  return (loading ? '<p class="muted">Üzenetek betöltése…</p>' : "")+
    (rows ? '<ol class="story-events">'+rows+'</ol>' : loading ? "" : '<p class="muted">Ehhez a játékhoz még nincs megjeleníthető esemény.</p>');
}

function stepScreening(by) {
  const section = screen.querySelector(".screening");
  if (!section?.screening || section.screening.loading) return;
  const current = section.screening;
  const index = Math.max(0,Math.min(current.frames.length-1,current.index+by));
  if (index === current.index) return;
  publishPresentation({step:index});
}

function getTranscript(pair) {
  const count = pair.messageCount ?? 0;
  let entry = transcriptCache.get(pair.number);
  if (entry?.count === count) return entry;
  entry = {count};
  if (!count) {
    entry.messages = [];
  } else {
    entry.request = readState(endpoint("transcript")+"?pair="+pair.number,auth).then(result => {
      entry.messages = result.pairs[0]?.messages ?? [];
      return entry.messages;
    }).catch(error => {
      if (transcriptCache.get(pair.number) === entry) transcriptCache.delete(pair.number);
      throw error;
    });
  }
  transcriptCache.set(pair.number,entry);
  return entry;
}

async function stepProjectedCase(by) {
  if (presentation.target !== "case") return;
  const pair = state.pairs.find(p => p.number === presentation.number);
  if (!pair) return;
  try {
    const entry = getTranscript(pair);
    const messages = entry.messages ?? await entry.request;
    if (presentation.target !== "case" || presentation.number !== pair.number) return;
    const frames = screeningFrames(pair,messages);
    const step = Math.max(0,Math.min(frames.length-1,presentation.step+by));
    if (step !== presentation.step) publishPresentation({step});
  } catch {
    showNotice("Az üzeneteket nem sikerült betölteni. Próbáld újra a léptetést.");
  }
}

function paintPairStories() {
  if (!isTrainer || !state?.pairs) return;
  const projected = mode === "projector";
  const selector = projected ? "[data-transcript]" : "details[open] [data-transcript], [data-report-story]";
  for (const section of screen.querySelectorAll(selector)) {
    const number = Number(section.dataset.transcript);
    const pair = state.pairs.find(p => p.number === number);
    if (!pair) continue;
    const entry = getTranscript(pair);
    const count = String(entry.count);
    if (entry.messages) {
      if (section.dataset.loaded !== count) renderPairStory(section,pair,entry.messages,projected);
      section.dataset.loaded = count;
      continue;
    }
    if (section.dataset.loading === count) continue;
    section.dataset.loading = count;
    renderPairStory(section,pair,[],projected,true);
    void entry.request.then(messages => {
      if (!section.isConnected || transcriptCache.get(number) !== entry) return;
      renderPairStory(section,pair,messages,projected);
      section.dataset.loaded = count;
    }, () => {
      if (!section.isConnected) return;
      delete section.dataset.loading;
      section.querySelector("[data-transcript-body]").insertAdjacentHTML("afterbegin",
        '<button type="button" class="button small secondary" data-do="retry-transcript">Üzenetek újratöltése</button>');
    });
  }
}
function paintQueue() {
  for (const timer of screen.querySelectorAll("[data-queue-until]")) {
    const seconds = Math.max(0, Math.ceil((Number(timer.dataset.queueUntil) - performance.now() - raceOffset) / 1000));
    const label = seconds ? seconds+" mp" : "Párosítás…";
    if (timer.textContent !== label) timer.textContent = label;
  }
}

function keyboardInset() {
  const viewport = window.visualViewport;
  const inset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
  document.body.dataset.keyboard = String(document.activeElement?.id === "message-input" && inset > 80);
  document.body.style.setProperty("--keyboard-inset", inset+"px");
  if (viewport) document.body.style.setProperty("--visual-height", viewport.height+"px");
}

function paintChat() {
  const log = document.querySelector("#messages");
  if (!log) return;
  const bottom = log.scrollHeight - log.clientHeight - log.scrollTop < 36;
  const scrollTop = log.scrollTop;
  const latest = state.messages.at(-1);
  const sender = document.querySelector("#latest-sender");
  const preview = document.querySelector("#latest-message");
  const label = latest ? latest.own ? "Te" : "A másik autó" : "Üzenetek";
  const message = latest?.text ?? "Még nincs üzenet.";
  if (sender.textContent !== label) sender.textContent = label;
  if (preview.textContent !== message) preview.textContent = message;
  log.replaceChildren();
  if (!state.messages.length) log.innerHTML = '<p class="muted">Még nincs üzenet.</p>';
  for (const item of state.messages) {
    const line = document.createElement("p");
    line.className = "message"+(item.own ? " own" : "");
    const label = document.createElement("strong");
    label.textContent = item.own ? "Te" : "A másik autó";
    line.append(label,document.createTextNode(item.text));
    log.append(line);
  }
  const input = document.querySelector("#message-input");
  if (input && input.value !== draft) input.value = draft;
  log.scrollTop = bottom ? log.scrollHeight : scrollTop;
  paintChatControls();
}

// Scale the entire slide only when its natural layout exceeds the available area.
const projectorFit = mode === "projector" && typeof ResizeObserver !== "undefined"
  ? new ResizeObserver(fitProjector) : null;
projectorFit?.observe(screen);

function fitProjector() {
  const slide = screen.firstElementChild;
  if (!slide?.classList.contains("projector-slide")) return;
  const scale = Math.min(1, screen.clientWidth / slide.scrollWidth, screen.clientHeight / slide.scrollHeight);
  slide.style.setProperty("--slide-scale", String(scale));
  slide.style.setProperty("--slide-offset", Math.max(0, (screen.clientHeight - slide.scrollHeight * scale) / 2)+"px");
}

function render() {
  for (const item of screen.querySelectorAll("details[id]")) {
    opened.seen.add(item.id);
    if (item.open) opened.add(item.id);
    else opened.delete(item.id);
  }
  const active = document.activeElement;
  const focusId = screen.contains(active) ? active.id : "";
  const keepChatFocus = active.matches("#night-chat > summary");
  const caret = ["message-input","case-search"].includes(focusId) ? [active.selectionStart,active.selectionEnd] : null;
  stopAnimation?.();
  const log = document.querySelector("#messages");
  const oldScroll = log?.scrollTop ?? 0;
  const stickToBottom = !log || log.scrollHeight-log.clientHeight-oldScroll < 36;
  const ribbonScrolls = [...screen.querySelectorAll(".race-ribbon")].map(el=>el.scrollLeft);
  const caseScroll = screen.querySelector("#report-cases")?.scrollTop;
  const storyScroll = screen.querySelector("#report-events")?.scrollTop;
  const storyNumber = screen.querySelector("[data-report-story]")?.dataset.transcript;
  const context = { room, roomLink, opened, tab:selectedTab, pendingDecision, selection, filter, reportPair, reportPlayer, outcomePlayer, transitionPerson, reportTarget, presentation, projectionPicker, projectionChoice, onlyMessages, reveal, showPairings, selectedGameMode, turnPending, medalFilter };
  if (!room) {
    const previous = saved.get("cr:last-host");
    screen.innerHTML = mode === "player" ? enterCode() : home(codeValid.test(previous ?? "") ? previous : null, roomLink);
  } else if (!codeValid.test(room) || loadFailure === 404) {
    screen.innerHTML = waitingPage("", "A futam nem érhető el", "Ellenőrizd a szobakódot, vagy olvasd be újra a tréner QR-kódját.",
      '<a class="button secondary" href="./">Vissza a főoldalra</a>');
  } else if (isTrainer && (!auth || loadFailure === 403)) {
    screen.innerHTML = waitingPage(room,"Tréneri hozzáférés", "Ezt a nézetet a futamot indító böngészőből tudod megnyitni.",
      '<a class="button secondary" href="./">Vissza a főoldalra</a>');
  } else if (!state && !isTrainer && (!auth || saved.get(joinKey) !== null || loadFailure === 403)) {
    screen.innerHTML = join(room,saved.get(joinKey) ?? "");
  } else if (!state) {
    screen.innerHTML = waitingPage(room,"Kapcsolódás…","A futam állását töltjük be.");
  } else if (mode === "projector") {
    projectorFit?.disconnect();
    screen.innerHTML = '<div class="projector-slide">'+projector(state,room,selection,false,screeningCase,undefined,presentation)+'</div>';
    paintPairStories();
    fitProjector();
    projectorFit?.observe(screen);
    projectorFit?.observe(screen.firstElementChild);
  } else if (isTrainer) {
    screen.innerHTML = trainer(state,context);
    paintCaseSearch();
    paintPairStories();
    screen.querySelectorAll(".race-ribbon").forEach((el,i)=>{el.scrollLeft=ribbonScrolls[i]??0;});
    const cases = screen.querySelector("#report-cases");
    const story = screen.querySelector("[data-report-story]");
    if (story) reportPair = Number(story.dataset.transcript);
    if (cases && caseScroll) cases.scrollTop = caseScroll;
    if (cases && story?.dataset.transcript !== storyNumber) {
      const selected = cases.querySelector('[aria-pressed="true"]:not([hidden])');
      if (selected) {
        const bounds = cases.getBoundingClientRect();
        const item = selected.getBoundingClientRect();
        if (item.top < bounds.top || item.bottom > bounds.bottom) {
          cases.scrollTop += item.top - bounds.top;
        }
      }
    }
    if (story && story.dataset.transcript === storyNumber && storyScroll) {
      story.querySelector("#report-events").scrollTop = storyScroll;
    }
  } else {
    screen.innerHTML = player(state,context);
    if (state.result && finishRoadHeight) {
      screen.querySelector(".night-game")?.style.setProperty("--finish-road-height",finishRoadHeight+"px");
    }
    paintChat();
    const nextLog = document.querySelector("#messages");
    if (nextLog) nextLog.scrollTop = stickToBottom ? nextLog.scrollHeight : oldScroll;
    stopAnimation = animateRace(screen,state,() => performance.now()+raceOffset,() => busy,reveal);
  }
  paintQr(document.querySelector("#inline-qr"));
  const restore = keepChatFocus ? screen.querySelector("#night-chat > summary") : focusId && document.getElementById(focusId);
  if (restore) {
    restore.focus({preventScroll:true});
    if (caret) restore.setSelectionRange(...caret);
  }
  if (busy) lockButtons(true);
  paintQueue();
  keyboardInset();
}

function sendDecision(choice) {
  pendingDecision ??= { number:state.number, step:state.step, choice };
  saved.set(decisionKey,JSON.stringify(pendingDecision));
  const body = pendingDecision;
  render();
  void mutate("decision",body);
}

retryButton.addEventListener("click", () => errorRetry?.());
screen.addEventListener("change", event => {
  if (event.target.name === "game-mode") selectedGameMode = event.target.value;
});
screen.addEventListener("input", event => {
  if (event.target.id === "message-input") draft = event.target.value;
  if (event.target.id === "case-search") {
    caseQuery = event.target.value;
    paintCaseSearch();
  }
});
screen.addEventListener("submit", event => {
  event.preventDefault();
  if (busy) return;
  const data = new FormData(event.target);
  if (event.target.id === "projection-picker") {
    if (!data.has("choice")) return;
    const number = Number(data.get("choice"));
    const target = projectionPicker;
    projectionPicker = projectionChoice = undefined;
    if (target === "case") {
      reportPair = number;
      caseQuery = "";
      const pair = state.pairs.find(pair => pair.number === number);
      if (!pair?.messageCount) onlyMessages = false;
      selectStory(number);
    } else if (target === "person") {
      outcomePlayer = number;
      publishPresentation({target,person:number,scope:filter,page:0});
    } else if (target === "transitions") {
      transitionPerson = number;
      publishPresentation({target,person:number,scope:filter,page:0});
    }
    scrollToReportSection(projectionSections[target]);
    screen.querySelector("#projection-shortcut-"+target)?.focus({preventScroll:true});
    return;
  }
  if (event.target.id === "room-form") {
    const code = String(data.get("room-code")).trim().toUpperCase();
    if (!codeValid.test(code)) return showNotice("Nyolckarakteres szobakódot adj meg.");
    location.assign(roomLink(code));
  }
  if (event.target.id === "player-form") {
    loadFailure = undefined;
    joinRoom(String(data.get("player-label")).trim());
  }
  if (event.target.id === "chat-form" && draft.trim()) {
    const text = draft.trim();
    const number = state.number;
    const step = state.step;
    if (!messageRequest || messageRequest.text !== text || messageRequest.number !== number || messageRequest.step !== step) {
      messageRequest = { number, step, text, id:secret() };
    }
    void sendChat(messageRequest);
  }
});
screen.addEventListener("click", event => {
  const button = event.target.closest("[data-do]");
  if (!button || busy) return;
  const action = button.dataset.do;
  if (action === "create") createRoom();
  else if (action === "start") void mutate("start",{count:state.count,mode:selectedGameMode,readyGate:true});
  else if (action === "turn") void sendTurn(state.number);
  else if (action === "go" || action === "yield") sendDecision(action);
  else if (action === "retry-decision") sendDecision(pendingDecision.choice);
  else if (action === "requeue" || action === "cancel") void mutate(action,{number:state.number ?? 0});
  else if (action === "stop") confirm("Lezárod a futamot?",
    "Az aktív játékok és az újrapárosítás véget érnek. Az eddigi riportok elérhetők maradnak.","Futam lezárása",() => void mutate("stop"));
  else if (action === "stop-pair") confirm("Lezárod ezt a párt?",
    "A többi pár folytatja a játékot. A lezárt döntési pontok megmaradnak a riportban.","Pár lezárása",
    () => void mutate("stop-pair",{number:Number(button.dataset.number)}));
  else if (action === "test-pair") void mutate("test-pair",{player:Number(button.dataset.player),number:Number(button.dataset.number)});
  else if (action === "tab") {
    selectedTab = button.dataset.tab;
    projectionPicker = projectionChoice = undefined;
    render();
    window.scrollTo(0,0);
    screen.querySelector('[data-tab="'+selectedTab+'"]').focus();
  } else if (action === "share") share();
  else if (action === "copy") void copyLink(button);
  else if (action === "download-diagnostics") void downloadDiagnostics(button);
  else if (action === "download-host") void downloadTrainerReport(button);
  else if (action === "filter-player-report") {
    const report = screen.querySelector("#night-report");
    if (!report) return;
    medalFilter = button.dataset.medal;
    report.open = true;
    render();
    const updated = screen.querySelector("#night-report");
    updated.querySelector("summary").focus({preventScroll:true});
    updated.scrollIntoView({block:"start"});
  }
  else if (action === "retry-transcript") paintPairStories();
  else if (action === "screen-step") stepScreening(Number(button.dataset.by));
  else if (action === "screen-case") {
    screeningCase = Number(button.dataset.number);
    render();
  }
  else if (action === "report-player") {
    reportPlayer = Number(button.dataset.player);
    render();
    screen.querySelector("#learning-person")?.scrollIntoView({block:"nearest"});
  } else if (action === "project-learning") {
    const value=button.dataset.player;
    publishPresentation({target:value==='group'?'group':'person',person:Number(value)||0,scope:filter,page:0});
  } else if (action === "project-transitions") {
    publishPresentation({target:"transitions",person:transitionPerson,scope:filter,page:0});
  } else if(action === "open-projector") openProjector();
  else if(action === "projection-names") publishPresentation({names:!presentation.names});
  else if (action === "projection-pick") {
    const target = button.dataset.target;
    projectionPicker = projectionPicker === target ? undefined : target;
    projectionChoice = undefined;
    selectedTab = "report";
    render();
    scrollToReportSection(projectionSections[target]);
    if (projectionPicker) screen.querySelector("#projection-choice:not(:disabled)")?.focus({preventScroll:true});
  } else if (action === "project-section") {
    projectionPicker = projectionChoice = undefined;
    const target = button.dataset.target;
    const shortcut = button.id === "projection-shortcut-"+target;
    if (shortcut) {
      selectedTab = "report";
      if (target === "group") outcomePlayer = undefined;
    }
    publishPresentation({target,scope:filter,page:0});
    if (shortcut) scrollToReportSection(projectionSections[target]);
  }
  else if(action === "projection-page") publishPresentation({page:Math.max(0,presentation.page+Number(button.dataset.by))});
  else if (action === "project-step") void stepProjectedCase(Number(button.dataset.by));
  else if (action === "report-case") {
    reportPair = Number(button.dataset.number);
    if (!button.closest("#report-cases")) {
      caseQuery = "";
      if (!state.pairs.find(pair => pair.number === reportPair)?.messageCount) onlyMessages = false;
    }
    selectedTab = "report";
    render();
    scrollToReportSection("case-section");
  } else if (action === "report-messages") {
    onlyMessages = !onlyMessages;
    render();
  } else if (action === "filter") {
    const scrollTop = window.scrollY;
    filter = button.dataset.filter;
    publishPresentation({scope:filter,page:0});
    window.scrollTo(0,scrollTop);
  } else if (action === "project-pair") selectStory(Number(button.dataset.number));
  else if (action === "project-pairings") publishPresentation({names:!presentation.names});
});
screen.addEventListener("change", event => {
  if (event.target.id === "projection-choice") projectionChoice = Number(event.target.value);
  if (event.target.id === "outcome-player") {
    outcomePlayer = Number(event.target.value) || undefined;
    render();
  } else if (event.target.id === "transition-person") {
    transitionPerson = Number(event.target.value);
    render();
  }
});
screen.addEventListener("toggle", event => {
  if (event.target.id === "night-chat" && event.target.open) {
    const log = event.target.querySelector("#messages");
    log.scrollTop = log.scrollHeight;
  } else if (event.target.matches("details[open]")) paintPairStories();
}, true);
dialog.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if ("close" in button.dataset) dialog.close();
  if ("confirm" in button.dataset) {
    dialog.close();
    confirmAction?.();
    confirmAction = undefined;
  }
  if ("copy" in button.dataset) void copyLink(button);
});
window.addEventListener("storage",event=>{
 if(event.key!==presentationKey || !event.newValue)return;
 try{adoptPresentation(JSON.parse(event.newValue));}catch{}
});
if (mode === "projector") window.addEventListener("keydown", event => {
  if (!screen.querySelector(".screening") || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  stepScreening(event.key === "ArrowLeft" ? -1 : 1);
});
window.addEventListener("online", () => nextPoll());
window.addEventListener("offline", () => setConnection("slow","Nincs internetkapcsolat"));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    lastPulse = 0;
    nextPoll();
  }
});
window.visualViewport?.addEventListener("resize", keyboardInset);
window.visualViewport?.addEventListener("scroll", keyboardInset);
screen.addEventListener("focusin", keyboardInset);
screen.addEventListener("focusout", () => setTimeout(keyboardInset, 0));
setInterval(paintQueue, 250);

render();
if (auth && codeValid.test(room)) {
  setConnection("working","Kapcsolódás…");
  const pendingJoin = saved.get(joinKey);
  if (!isTrainer && pendingJoin !== null) joinRoom(pendingJoin);
  else nextPoll();
}