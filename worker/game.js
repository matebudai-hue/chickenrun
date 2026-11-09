export const DISTANCES = [1000, 800, 600, 400, 200, 50, 10];
const LIFE = 8 * 60 * 60 * 1000;
const MAX_PLAYERS = 40;
const MAX_MESSAGES = 10;
const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const encoder = new TextEncoder();

class GameError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const reject = (status, message) => { throw new GameError(status, message); };
const token = () => crypto.randomUUID().replaceAll("-", "");
const code = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), n => CODE_CHARS[n % 32]).join("");
const digest = async (value) => {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
};

const json = (body, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

async function readBody(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) reject(415, "JSON kérés szükséges.");
  const reader = request.body?.getReader();
  if (!reader) reject(400, "Hiányzó adat.");
  const decoder = new TextDecoder();
  let raw = "", size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      reject(413, "Túl hosszú kérés.");
    }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === "object" && !Array.isArray(data)) return data;
  } catch {}
  reject(400, "Érvénytelen adat.");
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function playerName(room, id) {
  if (id === null) return "Tesztjátékos";
  const index = room.players.findIndex(player => player.id === id);
  return room.players[index].label || "Játékos " + (index + 1);
}
function activePair(room, id) {
  const index = room.pairs.findLastIndex(pair => pair.players.includes(id));
  return { pair: room.pairs[index], number: index + 1 };
}
function playerHistory(pair, seat) {
  return pair.history.map(row => ({
    distance: row.distance, at: row.submitted?.[seat] ?? row.at, own: row.choices[seat], other: row.choices[1 - seat],
  }));
}
function outcome(pair, seat) {
  return pair.result === "a" || pair.result === "b"
    ? pair.result === (seat === 0 ? "a" : "b") ? "own" : "other"
    : pair.result;
}
function view(room, auth) {
  const base = { phase: room.phase };
  if (auth === room.host) {
    const results = { a: 0, b: 0, both: 0, crash: 0, stopped: 0 };
    const pairs = room.pairs.map((pair, i) => {
      if (pair.result) results[pair.result]++;
      return {
        number: i + 1, distance: pair.result === "crash" ? 0 : DISTANCES[pair.step],
        ready: pair.result ? 0 : pair.choices.filter(Boolean).length, result: pair.result,
        names: pair.players.map(id => playerName(room, id)), history: pair.history,
      };
    });
    return {
      ...base, role: "host", count: room.players.length, pairs, results,
      queue: (room.queue ?? []).map(id => playerName(room, id)), max: MAX_PLAYERS,
    };
  }
  const player = room.players.find(p => p.key === auth);
  if (!player) reject(403, "Ehhez a szobához nincs hozzáférésed.");
  if (room.phase === "lobby") return { ...base, role: "player", count: room.players.length };
  const { pair, number } = activePair(room, player.id);
  const report = room.pairs.flatMap((match, index) => {
    const seat = match.players.indexOf(player.id);
    return seat < 0 || !match.result ? [] : [{
      number: index + 1, outcome: outcome(match, seat), bot: match.players.includes(null),
      history: playerHistory(match, seat),
    }];
  });
  const details = { ...base, role: "player", queued: room.queue?.includes(player.id) ?? false, report };
  if (!pair) return { ...details, spectator: true };
  const seat = pair.players.indexOf(player.id);
  return {
    ...details, number, step: pair.step, distance: pair.result === "crash" ? 0 : DISTANCES[pair.step],
    waiting: Boolean(pair.choices[seat]), result: pair.result, outcome: outcome(pair, seat),
    messages: pair.messages.map(m => ({ id: m.id, own: m.seat === seat, text: m.text })),
    history: playerHistory(pair, seat),
  };
}
function addPair(room, a, b) {
  // Keep earlier decisions for the reports. Chat only belongs to the latest pair.
  const previous = [activePair(room, a).pair, b === null ? undefined : activePair(room, b).pair];
  for (const pair of previous) {
    if (pair && pair.players.every(id => id === null || id === a || id === b || activePair(room, id).pair !== pair)) {
      pair.messages = [];
    }
  }
  room.pairs.push({
    players: [a, b], step: 0, choices: [null, null], result: null, history: [],
    messages: [], sent: [0, 0],
    ...(b === null ? { botYieldAt: 2 + Math.floor(Math.random() * 5) } : {}),
  });
  room.phase = "running";
}
function start(room) {
  if (room.phase !== "lobby") reject(409, "A futam már elindult.");
  if (!room.players.length) reject(409, "Legalább egy játékos szükséges.");
  const players = shuffle(room.players.map(player => player.id));
  for (let i = 0; i < players.length; i += 2) addPair(room, players[i], players[i + 1] ?? null);
}
function requeue(room, player, action, number) {
  if (room.phase === "lobby" || room.phase === "closed") reject(409, "A futam nem fogad új párokat.");
  const latest = activePair(room, player);
  if (latest.number !== number || (latest.pair && !latest.pair.result)) return false;
  const queue = room.queue ??= [];
  const index = queue.indexOf(player);
  if (action === "cancel") {
    if (index < 0) return false;
    queue.splice(index, 1);
    return true;
  }
  if (index >= 0) return false;
  const previousPartner = id => activePair(room, id).pair?.players.find(other => other !== id);
  const partnerIndex = queue.findIndex(id => id !== previousPartner(player) && player !== previousPartner(id));
  if (partnerIndex < 0) queue.push(player);
  else addPair(room, queue.splice(partnerIndex, 1)[0], player);
  return true;
}
function finishIfDone(room) {
  if (room.pairs.every(pair => pair.result)) room.phase = "finished";
}
function decide(room, pair, seat, input) {
  if (!Number.isInteger(input.step) || !["go", "yield"].includes(input.choice)) {
    reject(400, "Érvénytelen döntés.");
  }
  if (input.step !== pair.step || pair.result) return false;
  if (pair.choices[seat]) return false;
  const now = Date.now();
  const submitted = pair.submitted ??= [null, null];
  pair.choices[seat] = input.choice;
  submitted[seat] = now;
  if (pair.players[1] === null) {
    pair.choices[1] = pair.step >= pair.botYieldAt ? "yield" : "go";
    submitted[1] = now;
  }
  if (!pair.choices.every(Boolean)) return true;
  const [a, b] = pair.choices;
  pair.history.push({ distance: DISTANCES[pair.step], choices: [...pair.choices], at: now, submitted: [...submitted] });
  if (a === "yield" && b === "yield") pair.result = "both";
  else if (a === "yield") pair.result = "a";
  else if (b === "yield") pair.result = "b";
  else if (pair.step === DISTANCES.length - 1) pair.result = "crash";
  else {
    pair.step++;
    pair.choices = [null, null];
    pair.submitted = [null, null];
    pair.sent = [0, 0];
  }
  finishIfDone(room);
  return true;
}
function send(pair, seat, input) {
  if (pair.result || input.step !== pair.step) reject(409, "Ez a döntési pont már lezárult.");
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text || text.length > 240) reject(400, "Az üzenet 1–240 karakter lehet.");
  if (typeof input.id !== "string" || !/^[a-f0-9]{32}$/.test(input.id)) reject(400, "Érvénytelen üzenet.");
  if (pair.messages.some(m => m.seat === seat && m.id === input.id)) return false;
  if (pair.sent[seat] >= MAX_MESSAGES) reject(429, "Ebben a lépésben már elküldted a tíz üzenetedet.");
  pair.messages.push({ seat, id: input.id, text });
  if (pair.messages.length > 48) pair.messages.shift();
  pair.sent[seat]++;
  return true;
}
async function getRoom(store, roomCode) {
  const row = await store.get(roomCode);
  if (!row || row.expires_at < Date.now()) reject(404, "Ez a szoba nem található vagy lejárt.");
  return { row, room: JSON.parse(row.state) };
}
async function change(store, roomCode, mutator) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const { row, room } = await getRoom(store, roomCode);
    const changed = mutator(room);
    if (changed === false || await store.put(roomCode, row.revision, JSON.stringify(room))) return room;
    await new Promise(resolve => setTimeout(resolve, 6 + Math.random() * Math.min(attempt * 5, 100)));
  }
  reject(503, "A szoba foglalt. Próbáld újra.");
}

export function d1Store(db) {
  return {
    get: (code) => db.prepare("SELECT revision, expires_at, state FROM rooms WHERE code = ?").bind(code).first(),
    async create(code, expires, state) {
      const r = await db.prepare("INSERT OR IGNORE INTO rooms (code, expires_at, state) VALUES (?, ?, ?)").bind(code, expires, state).run();
      return r.meta.changes === 1;
    },
    async put(code, revision, state) {
      const r = await db.prepare("UPDATE rooms SET state = ?, revision = revision + 1 WHERE code = ? AND revision = ?").bind(state, code, revision).run();
      return r.meta.changes === 1;
    },
    prune: () => db.prepare("DELETE FROM rooms WHERE expires_at < ?").bind(Date.now()).run(),
  };
}

export async function api(request, store) {
  try {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/rooms") {
      await readBody(request);
      const hostToken = token(), host = await digest(hostToken);
      const initial = JSON.stringify({ host, phase: "lobby", players: [], pairs: [], queue: [] });
      await store.prune();
      for (let attempt = 0; attempt < 4; attempt++) {
        const room = code();
        if (await store.create(room, Date.now() + LIFE, initial)) return json({ room, token: hostToken }, 201);
      }
      reject(503, "A szoba létrehozása nem sikerült. Próbáld újra.");
    }
    const match = url.pathname.match(/^\/api\/rooms\/([23456789A-HJ-NP-Z]{8})\/(join|state|start|stop|decision|message|requeue|cancel)$/);
    if (!match) reject(404, "Ismeretlen kérés.");
    const [, roomCode, action] = match;
    if (request.method !== (action === "state" ? "GET" : "POST")) reject(405, "Érvénytelen kérés.");
    const credential = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{32})$/)?.[1];
    if (!credential) reject(403, "Hiányzó szobakulcs.");
    const auth = await digest(credential);
    if (action === "state") return json(view((await getRoom(store, roomCode)).room, auth));
    const input = await readBody(request);
    const room = await change(store, roomCode, state => {
      if (action === "join") {
        if (state.players.some(p => p.key === auth)) return false;
        if (state.phase !== "lobby") reject(409, "Ez a futam már elindult.");
        if (state.players.length >= MAX_PLAYERS) reject(409, "A szoba megtelt.");
        const label = typeof input.label === "string" ? input.label.trim() : "";
        if (label.length > 40) reject(400, "A név legfeljebb 40 karakter lehet.");
        state.players.push({ id: token(), key: auth, label });
        return true;
      }
      if (action === "start" || action === "stop") {
        if (state.host !== auth) reject(403, "Ez a tréner művelete.");
        if (action === "start") start(state);
        else {
          if (state.phase === "lobby" || state.phase === "closed") return false;
          state.pairs.forEach(pair => { if (!pair.result) pair.result = "stopped"; });
          state.phase = "closed";
          state.queue = [];
        }
        return true;
      }
      const player = state.players.find(p => p.key === auth);
      if (!player) reject(403, "Ehhez a szobához nincs hozzáférésed.");
      if (action === "requeue" || action === "cancel") return requeue(state, player.id, action, input.number);
      const { pair, number } = activePair(state, player.id);
      if (!pair) reject(409, "Nincs aktív párod.");
      if ((input.number ?? 1) !== number) return false;
      const seat = pair.players.indexOf(player.id);
      return action === "decision" ? decide(state, pair, seat, input) : send(pair, seat, input);
    });
    return json(view(room, auth));
  } catch (error) {
    if (error instanceof GameError) return json({ error: error.message }, error.status);
    console.error("Chicken Run: request failed", error?.name);
    return json({ error: "Kapcsolati hiba. Próbáld újra." }, 500);
  }
}


