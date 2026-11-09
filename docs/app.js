import { command, readState, saved, secret } from "./connection.js?v=3";
import { escape, home, join, moves, outcomes, player, projector, time, trainer, waitingPage } from "./views.js?v=3";

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
const roomKey = "cr:"+(isTrainer ? "host" : "player")+":"+room;
const decisionKey = "cr:pending-decision:"+room;
const joinKey = "cr:pending-join:"+room;
const createKey = "cr:pending-create";

let auth = saved.get(roomKey);
let state, signature, loadFailure, errorRetry, pollTimer;
let busy = false, polling = false, generation = 0, lastPulse = 0;
let selectedTab = "overview", draft = "", messageRequest, confirmAction;
let pendingDecision;
try { pendingDecision = JSON.parse(saved.get(decisionKey)); } catch {}
const opened = new Set();
opened.seen = new Set();

function roomLink(code, view) {
  const url = new URL(base);
  url.searchParams.set("room", code);
  if (view) url.searchParams.set("view", view);
  return url.href;
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

function update(next) {
  const previous = state;
  if (previous?.number !== next.number) {
    draft = "";
    messageRequest = undefined;
  }
  resolveDecision(next);
  const nextSignature = JSON.stringify(next);
  state = next;
  if (nextSignature === signature) return;
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
  const pulse = !isTrainer && Date.now() - lastPulse > 12_000;
  try {
    const next = await readState(endpoint("state")+(pulse ? "?pulse=1" : ""), auth);
    if (stamp !== generation) return;
    if (pulse) lastPulse = Date.now();
    setConnection("ok", "Kapcsolat rendben");
    update(next);
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
    if (!loadFailure) nextPoll(document.hidden ? 4500 : state?.phase === "closed" ? 3000 : 1000+Math.random()*250);
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
    const next = await command(path, auth, body, () => setConnection("slow", "Lassú kapcsolat · ellenőrzés…"));
    setConnection("ok", "Kapcsolat rendben");
    success(next);
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
  const labels = { decision: "Döntés küldése…", requeue: "Új partner keresése…", start: "Párosítás…" };
  return perform(endpoint(action), body, onSuccess, () => mutate(action, body, onSuccess), labels[action]);
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

function downloadReport(personal) {
  const headings = ["Játék","Kimenetel","Távolság (m)","Időpont","Játékos 1","Döntés 1","Játékos 2","Döntés 2"];
  const result = pair => pair.result === "a" ? pair.names[0]+" tért ki"
    : pair.result === "b" ? pair.names[1]+" tért ki" : outcomes[pair.result];
  const matches = personal ? state.report : state.pairs.filter(p=>p.result);
  const rows = matches.flatMap(pair => {
    const [a,b] = personal ? ["Te", pair.bot ? "Tesztjátékos" : "A másik autó"] : pair.names;
    const outcome = personal ? outcomes[pair.outcome] : result(pair);
    return (pair.history.length ? pair.history : [{}]).map(row => {
      const [first,second] = personal ? [row.own,row.other] : row.choices ?? [];
      return [pair.number,outcome,row.distance,time(row.at),a,moves[first],b,moves[second]];
    });
  });
  const safe = value => {
    const raw = String(value ?? "");
    const text = /^[\s]*[=+\-@]/.test(raw) ? "'"+raw : raw;
    return '"'+text.replaceAll('"','""')+'"';
  };
  const csv = [headings,...rows].map(row=>row.map(safe).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = "chicken-run-"+room+(personal ? "-sajat" : "-treneri")+".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function paintChat() {
  const log = document.querySelector("#messages");
  if (!log) return;
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
  if (input) input.value = draft;
}

function render() {
  for (const item of screen.querySelectorAll("details[id]")) {
    opened.seen.add(item.id);
    if (item.open) opened.add(item.id);
    else opened.delete(item.id);
  }
  const active = document.activeElement;
  const focusId = screen.contains(active) ? active.id : "";
  const selection = focusId === "message-input" ? [active.selectionStart,active.selectionEnd] : null;
  const log = document.querySelector("#messages");
  const oldScroll = log?.scrollTop ?? 0;
  const stickToBottom = !log || log.scrollHeight-log.clientHeight-oldScroll < 36;
  const context = { room, roomLink, opened, tab:selectedTab, pendingDecision };
  if (!room) {
    const previous = saved.get("cr:last-host");
    screen.innerHTML = home(codeValid.test(previous ?? "") ? previous : null, roomLink);
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
    screen.innerHTML = projector(state,room);
  } else if (isTrainer) {
    screen.innerHTML = trainer(state,context);
  } else {
    screen.innerHTML = player(state,context);
    paintChat();
    const nextLog = document.querySelector("#messages");
    if (nextLog) nextLog.scrollTop = stickToBottom ? nextLog.scrollHeight : oldScroll;
  }
  paintQr(document.querySelector("#inline-qr"));
  const restore = focusId && document.getElementById(focusId);
  if (restore) {
    restore.focus({preventScroll:true});
    if (selection) restore.setSelectionRange(...selection);
  }
  if (busy) lockButtons(true);
}

function sendDecision(choice) {
  pendingDecision ??= { number:state.number, step:state.step, choice };
  saved.set(decisionKey,JSON.stringify(pendingDecision));
  const body = pendingDecision;
  render();
  void mutate("decision",body);
}

retryButton.addEventListener("click", () => errorRetry?.());
screen.addEventListener("input", event => {
  if (event.target.id === "message-input") draft = event.target.value;
});
screen.addEventListener("submit", event => {
  event.preventDefault();
  if (busy) return;
  const data = new FormData(event.target);
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
    void mutate("message",messageRequest,next => {
      if (draft.trim() === text) draft = "";
      messageRequest = undefined;
      update(next);
    });
  }
});
screen.addEventListener("click", event => {
  const button = event.target.closest("[data-do]");
  if (!button || busy) return;
  const action = button.dataset.do;
  if (action === "create") createRoom();
  else if (action === "start") void mutate("start",{count:state.count});
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
    render();
    screen.querySelector('[data-tab="'+selectedTab+'"]').focus();
  } else if (action === "share") share();
  else if (action === "copy") void copyLink(button);
  else if (action === "download-host" || action === "download-player") downloadReport(action === "download-player");
});
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
window.addEventListener("online", () => nextPoll());
window.addEventListener("offline", () => setConnection("slow","Nincs internetkapcsolat"));
document.addEventListener("visibilitychange", () => { if (!document.hidden) nextPoll(); });

render();
if (auth && codeValid.test(room)) {
  setConnection("working","Kapcsolódás…");
  const pendingJoin = saved.get(joinKey);
  if (!isTrainer && pendingJoin !== null) joinRoom(pendingJoin);
  else nextPoll();
}