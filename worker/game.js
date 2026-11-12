import { finishRace, newRace, nextExit, markReady, raceElapsed, raceDistance, raceEnd, raceReady, RACE_MARKS, stopRace } from "./race.js";

export const DISTANCES = [1000, 800, 600, 400, 200, 100, 50, 10];
const LEGACY_DISTANCES = [1000, 800, 600, 400, 200, 50, 10];
const distancesFor = pair => pair.distanceVersion === 2 ? DISTANCES : LEGACY_DISTANCES;
const LIFE = 8 * 60 * 60 * 1000;
const MAX_PLAYERS = 40;
const MAX_MESSAGES = 10;
const BOT_FIRST_YIELD_STEP = DISTANCES.indexOf(200);
const BOT_YIELD_STEPS = DISTANCES.length - BOT_FIRST_YIELD_STEP;
const ONLINE_WINDOW = 45_000;
const CONNECTION_GAP = 6_000;
const REMATCH_WAIT = 30_000;
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
const validToken = /^[a-f0-9]{32}$/;
const code = hash => hash.slice(0, 16).match(/../g).map(hex => CODE_CHARS[parseInt(hex, 16) % 32]).join("");
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
  return room.players[index]?.label || "Játékos " + (index + 1);
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
function distanceFor(pair) {
  if (!pair.race) return pair.result === "crash" ? 0 : distancesFor(pair)[pair.step];
  return pair.history.at(-1)?.distance ?? raceDistance(raceElapsed(pair.race, pair.race.stoppedAt ?? Date.now()));
}
function view(room, auth, online) {
  const base = { phase: room.phase, mode: room.mode ?? "steps" };
  if (auth === room.host) {
    const results = { a: 0, b: 0, both: 0, crash: 0, stopped: 0 };
    const pairs = room.pairs.map((pair, i) => {
      if (pair.result) results[pair.result]++;
      return {
        number: i + 1, distance: distanceFor(pair),
        distances: distancesFor(pair),
        ready: pair.result ? 0 : pair.race ? pair.race.turns.filter((turn,seat) => turn && pair.players[seat] !== null).length : pair.choices.filter(Boolean).length,
        result: pair.result,
        ...(pair.race ? {
          timed: true, awaitingReady: pair.race.startsAt === null && !pair.result,
          readyPlayers: pair.race.ready?.filter((ready, seat) => ready && pair.players[seat] !== null).length,
          connectionGap: pair.race.connectionGap,
          turns: pair.result ? pair.race.turns.map(turn => turn && turn.at < (pair.race.stoppedAt ?? raceEnd(pair.race)[1]) ? turn : null) : undefined,
        } : {}),
        playerNumbers: pair.players.map(id => id === null ? null : room.players.findIndex(player => player.id === id) + 1),
        names: pair.players.map(id => playerName(room, id)), history: pair.history, bot: pair.players.includes(null),
        reason: pair.reason,
        messageCount: pair.messageCount ?? pair.messages.length,
        startedAt: pair.startedAt,
      };
    });
    return {
      ...base, role: "host", count: room.players.length, pairs, results,
      queue: (room.queue ?? []).map(id => playerName(room, id)), max: MAX_PLAYERS,
      roster: room.players.map((player, index) => {
        const { pair, number } = activePair(room, player.id);
        const seat = pair?.players.indexOf(player.id);
        const queued = room.queue?.includes(player.id);
        const status = queued ? "queued" : !pair ? "lobby" : pair.result ? "finished" :
          pair.race ? pair.race.startsAt === null ? "starting" : "driving" : pair.choices[seat] ? "ready" : "pending";
        return {
          number: index + 1, name: playerName(room, player.id), match: number || null, status,
          queueUntil: queued ? room.queueUntil?.[player.id] : undefined,
          partner: pair ? playerName(room, pair.players[1 - seat]) : null,
          ...(online ? { online: online.has(player.id) } : {}),
        };
      }),
    };
  }
  const player = room.players.find(p => p.key === auth);
  if (!player) reject(403, "Ehhez a szobához nincs hozzáférésed.");
  if (room.phase === "lobby") return { ...base, role: "player", count: room.players.length };
  const { pair, number } = activePair(room, player.id);
  const report = room.pairs.flatMap((match, index) => {
    const seat = match.players.indexOf(player.id);
    return seat < 0 || !match.result ? [] : [{
      number: index + 1, outcome: outcome(match, seat),
      history: playerHistory(match, seat),
      reason: match.reason,
      ...(match.race ? {
        timed: true, target: match.race.turns[seat]?.target,
        connectionGap: match.race.connectionGap?.[seat],
      } : {}),
    }];
  });
  const details = { ...base, role: "player", queued: room.queue?.includes(player.id) ?? false, report };
  if (!pair) return { ...details, spectator: true };
  const seat = pair.players.indexOf(player.id);
  return {
    ...details, number, step: pair.step, distance: distanceFor(pair),
    totalSteps: distancesFor(pair).length,
    ...(pair.race ? {
      race: { startsAt:pair.race.startsAt, marks:RACE_MARKS, target:pair.race.turns[seat]?.target ?? null,
        ready:pair.race.ready?.[seat], readyUntil:pair.race.readyUntil },
      serverAt:Date.now(),
    } : {}),
    waiting: Boolean(pair.choices[seat]), result: pair.result, outcome: outcome(pair, seat), reason: pair.reason,
    messages: pair.messages.map(m => ({ id: m.id, own: m.seat === seat, text: m.text })),
    history: playerHistory(pair, seat),
  };
}
function botPlan() {
  const draw = Math.floor(Math.random() * (BOT_YIELD_STEPS + 1));
  return draw < BOT_YIELD_STEPS ? BOT_FIRST_YIELD_STEP + draw : null;
}
function addPair(room, a, b) {
  // The archive holds new messages. Keep any older messages that predate it.
  const previous = [activePair(room, a).pair, b === null ? undefined : activePair(room, b).pair];
  for (const pair of previous) {
    if (pair && pair.players.every(id => id === null || id === a || id === b || activePair(room, id).pair !== pair)) {
      pair.legacyMessages ??= pair.messages.filter(message => message.at === undefined);
      pair.messageCount ??= pair.messages.length;
      pair.messages = [];
    }
  }
  const now = Date.now();
  const plan = b === null ? botPlan() : null;
  const race = room.mode === "timed" ? newRace(now, DISTANCES[plan], room.readyGate, b === null) : null;
  room.pairs.push({
    players: [a, b], startedAt: race ? race.startsAt : now, distanceVersion: 2, step: 0, choices: [null, null], result: null, history: [],
    messages: [], sent: [0, 0],
    ...(race ? { race } : b === null ? { botYieldAt: plan } : {}),
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
  const deadlines = room.queueUntil ??= {};
  const index = queue.indexOf(player);
  if (action === "cancel") {
    if (index < 0) return false;
    queue.splice(index, 1);
    delete deadlines[player];
    return true;
  }
  if (index >= 0) return false;
  const previousPartner = id => activePair(room, id).pair?.players.find(other => other !== id);
  const partnerIndex = queue.findIndex(id => id !== previousPartner(player) && player !== previousPartner(id));
  if (partnerIndex < 0) {
    queue.push(player);
    deadlines[player] = Date.now() + REMATCH_WAIT;
  } else {
    const [partner] = queue.splice(partnerIndex, 1);
    delete deadlines[partner];
    addPair(room, partner, player);
  }
  return true;
}
function queueIsDue(room, now) {
  return room.queue?.some(id => !room.queueUntil?.[id] || room.queueUntil[id] <= now);
}
function settleQueue(room, now) {
  if (room.phase === "closed" || !queueIsDue(room, now)) return false;
  const deadlines = room.queueUntil ??= {};
  room.queue = room.queue.filter(id => {
    deadlines[id] ??= now + REMATCH_WAIT;
    if (deadlines[id] > now) return true;
    delete deadlines[id];
    addPair(room, id, null);
    return false;
  });
  return true;
}
function finishIfDone(room) {
  if (room.phase !== "closed" && room.pairs.every(pair => pair.result)) room.phase = "finished";
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
    pair.botDueAt = now + 10_000 + Math.floor(Math.random() * 5001);
  } else if (pair.choices.every(Boolean)) {
    resolveStep(room, pair, now);
  }
  return true;
}
function resolveStep(room, pair, now) {
  const submitted = pair.submitted;
  const [a, b] = pair.choices;
  const distances = distancesFor(pair);
  pair.history.push({ distance: distances[pair.step], choices: [...pair.choices], at: now, submitted: [...submitted] });
  if (a === "yield" && b === "yield") pair.result = "both";
  else if (a === "yield") pair.result = "a";
  else if (b === "yield") pair.result = "b";
  else if (pair.step === distances.length - 1) pair.result = "crash";
  else {
    pair.step++;
    pair.choices = [null, null];
    pair.submitted = [null, null];
    pair.sent = [0, 0];
  }
  finishIfDone(room);
}
async function recordTurn(store, code, auth, number, receivedAt) {
  const { room } = await getRoom(store, code);
  const player = room.players.find(p => p.key === auth);
  if (!player) reject(403, "Ehhez a szobához nincs hozzáférésed.");
  const pair = Number.isInteger(number) ? room.pairs[number - 1] : undefined;
  const seat = pair?.players.indexOf(player.id) ?? -1;
  if (seat < 0 || !pair.race) reject(409, "Ebben a futamban nem tudsz kitérni.");
  const prior = pair.race.turns[seat];
  const end = Math.min(pair.race.stoppedAt ?? Infinity, raceEnd(pair.race)[1]);
  if (prior && prior.at <= receivedAt && prior.at < end) {
    return { ...view(room, auth), turnAck: { number, target: prior.target } };
  }
  const turn = receivedAt < end && nextExit(pair.race, receivedAt);
  if (!turn) reject(409, "Ehhez a kitéréshez már nincs elérhető pont.");

  // Persist the ingress time independently of the room's chat and settlement writes.
  await store.saveTurn(code, number, seat, turn);
  const { room: updated } = await getRoom(store, code);
  const race = updated.pairs[number - 1].race;
  const accepted = race.turns[seat];
  if (!accepted || accepted.at >= Math.min(race.stoppedAt ?? Infinity, raceEnd(race)[1])) {
    reject(409, "Ez a futam a kitérés beérkezése előtt véget ért.");
  }
  return { ...view(updated, auth), turnAck: { number, target: accepted.target } };
}
function stopPair(pair, now) {
  if (pair.result) return;
  pair.result = "stopped";
  if (pair.race) stopRace(pair.race,now);
}
function timedRaceIsDue(pair, now) {
  return !pair.result && pair.race && (raceReady(pair.race,now) || readyExpired(pair, now));
}
function readyExpired(pair, now) {
  return pair.race?.startsAt === null && pair.race.readyUntil <= now;
}
function botIsDue(pair, now) {
  return !pair.result && Number.isFinite(pair.botDueAt) && pair.botDueAt <= now;
}
function settleDuePairs(room, now, seen) {
  let changed = false;
  for (const pair of room.pairs) {
    if (timedRaceIsDue(pair,now)) {
      if (readyExpired(pair, now)) {
        pair.reason = "ready-timeout";
        stopPair(pair, now);
        finishIfDone(room);
        changed = true;
        continue;
      }
      if (pair.race.ready && seen) {
        const [, end] = raceEnd(pair.race);
        pair.race.connectionGap = pair.players.map(id => id !== null &&
          end - Math.max(pair.race.startsAt, seen.get(id) ?? 0) >= CONNECTION_GAP);
      }
      const { result, history } = finishRace(pair.race);
      pair.result = result;
      pair.history.push(history);
      finishIfDone(room);
      changed = true;
      continue;
    }
    if (!botIsDue(pair, now)) continue;
    pair.choices[1] = Number.isInteger(pair.botYieldAt) && pair.step >= pair.botYieldAt ? "yield" : "go";
    pair.submitted[1] = pair.botDueAt;
    delete pair.botDueAt;
    resolveStep(room, pair, now);
    changed = true;
  }
  return changed;
}
function send(pair, number, seat, input, receivedAt) {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text || text.length > 240) reject(400, "Az üzenet 1–240 karakter lehet.");
  if (typeof input.id !== "string" || !/^[a-f0-9]{32}$/.test(input.id)) reject(400, "Érvénytelen üzenet.");
  if (pair.messages.some(m => m.seat === seat && m.id === input.id)) return false;
  const now = pair.race ? receivedAt : Date.now();
  if (pair.result || (pair.race ? now >= raceEnd(pair.race)[1] : input.step !== pair.step || botIsDue(pair,now))) {
    reject(409, "A játék ezen pontja már lezárult.");
  }
  if (pair.sent[seat] >= MAX_MESSAGES) reject(429, pair.race ? "Ebben a futamban már elküldted a tíz üzenetedet." : "Ebben a lépésben már elküldted a tíz üzenetedet.");
  pair.legacyMessages ??= pair.messages.filter(message => message.at === undefined);
  const message = { seat, id: input.id, text, at: now, distance: pair.race ? raceDistance(raceElapsed(pair.race, now)) : distanceFor(pair) };
  pair.messageCount = (pair.messageCount ?? pair.messages.length) + 1;
  pair.messages.push(message);
  if (pair.messages.length > 48) pair.messages.shift();
  pair.sent[seat]++;
  return { number, ...message };
}
async function getRoom(store, roomCode) {
  const row = await store.get(roomCode);
  if (!row || row.expires_at < Date.now()) reject(404, "Ez a szoba nem található vagy lejárt.");
  const room = JSON.parse(row.state);
  const reconciled = new Set();
  for (const { number, seat, ...turn } of JSON.parse(row.turns ?? "[]")) {
    const pair = room.pairs[number - 1];
    if (!pair?.race) continue;
    const prior = pair.race.turns[seat];
    if (prior && prior.at <= turn.at) continue;
    pair.race.turns[seat] = turn;
    if (pair.result && pair.result !== "stopped") reconciled.add(pair);
  }
  // A valid request delayed during storage can correct a provisionally settled race.
  for (const pair of reconciled) {
    const { result, history } = finishRace(pair.race);
    pair.result = result;
    pair.history[pair.history.length - 1] = history;
  }
  return { row, room };
}
async function change(store, roomCode, mutator) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const { row, room } = await getRoom(store, roomCode);
    const changed = mutator(room);
    if (changed === false || await store.put(roomCode, row.revision, JSON.stringify(room), typeof changed === "object" ? changed : undefined)) return room;
    await new Promise(resolve => setTimeout(resolve, 6 + Math.random() * Math.min(attempt * 5, 100)));
  }
  reject(503, "A szoba foglalt. Próbáld újra.");
}

export function d1Store(db) {
  return {
    async listArchive(prefix) {
      const {results} = await db.prepare("SELECT json_remove(state, '$.report') AS entry FROM rooms WHERE code LIKE ? ORDER BY rowid DESC")
        .bind(prefix + "%").all();
      return results.map(row => JSON.parse(row.entry));
    },
    get: code => db.prepare(`
      SELECT revision, expires_at, state, (
        SELECT json_group_array(json_object('number', pair, 'seat', seat,
          'at', at, 'target', target, 'offset', offset, 'distance', distance))
        FROM race_turns WHERE code = rooms.code
      ) AS turns FROM rooms WHERE code = ?
    `).bind(code).first(),
    async saveTurn(code, number, seat, turn) {
      const insert = db.prepare(`
        INSERT INTO race_turns (code, pair, seat, at, target, offset, distance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code, pair, seat) DO UPDATE SET at=excluded.at, target=excluded.target,
          offset=excluded.offset, distance=excluded.distance WHERE excluded.at < race_turns.at
      `).bind(code, number, seat, turn.at, turn.target, turn.offset, turn.distance);
      await db.batch([insert, db.prepare("UPDATE rooms SET revision = revision + 1 WHERE code = ?").bind(code)]);
    },
    async seen(code) {
      const { results } = await db.prepare("SELECT player, seen_at FROM presence WHERE code = ?").bind(code).all();
      return new Map(results.map(row => [row.player, row.seen_at]));
    },
    async create(code, expires, state) {
      const r = await db.prepare("INSERT OR IGNORE INTO rooms (code, expires_at, state) VALUES (?, ?, ?)").bind(code, expires, state).run();
      return r.meta.changes === 1;
    },
    async put(code, revision, state, message) {
      const update = db.prepare("UPDATE rooms SET state = ?, revision = revision + 1 WHERE code = ? AND revision = ?")
        .bind(state, code, revision);
      if (!message) return (await update.run()).meta.changes === 1;
      // Both writes use the same revision in one transaction.
      const insert = db.prepare("INSERT OR IGNORE INTO chat (code, pair, seat, id, text, at, distance) SELECT code, ?, ?, ?, ?, ?, ? FROM rooms WHERE code = ? AND revision = ?")
        .bind(message.number, message.seat, message.id, message.text, message.at, message.distance, code, revision);
      const [, result] = await db.batch([insert, update]);
      return result.meta.changes === 1;
    },
    async transcript(code, number) {
      const columns = "SELECT pair AS number, seat, id, text, at, distance FROM chat WHERE code = ?";
      const statement = number
        ? db.prepare(columns + " AND pair = ? ORDER BY rowid").bind(code, number)
        : db.prepare(columns + " ORDER BY pair, rowid").bind(code);
      return (await statement.all()).results;
    },
    async pulse(code, id, minimumInterval = 0) {
      const now = Date.now();
      await db.prepare("INSERT INTO presence (code, player, seen_at) VALUES (?, ?, ?) ON CONFLICT(code, player) DO UPDATE SET seen_at = excluded.seen_at WHERE presence.seen_at < excluded.seen_at - ?")
        .bind(code, id, now, minimumInterval).run();
    },
    async online(code) {
      const { results } = await db.prepare("SELECT player FROM presence WHERE code = ? AND seen_at > ?")
        .bind(code, Date.now() - ONLINE_WINDOW).all();
      return new Set(results.map(row => row.player));
    },
    prune: () => db.prepare("DELETE FROM rooms WHERE expires_at < ?").bind(Date.now()).run(),
  };
}

async function stateView(store, roomCode, room, auth, pulse = false, defer) {
  if (auth === room.host && store.seen && room.readyGate && room.phase === "running") {
    const seen = await store.seen(roomCode);
    const cutoff = Date.now() - CONNECTION_GAP;
    return view(room, auth, new Set([...seen].filter(([, at]) => at > cutoff).map(([id]) => id)));
  }
  if (auth === room.host && store.online) return view(room, auth, await store.online(roomCode));
  const projection = view(room, auth);
  if (pulse && store.pulse) {
    const player = room.players.find(p => p.key === auth);
    const write = store.pulse(roomCode, player.id).catch(() => {});
    if (defer) defer(write);
    else await write;
  }
  return projection;
}

async function transcript(store, roomCode, room, number) {
  const archived = await store.transcript(roomCode, number);
  const selected = number ? [[number, room.pairs[number - 1]]] : room.pairs.map((pair, index) => [index + 1, pair]);
  const byPair = new Map(selected.map(([index, pair]) => [
    index, (pair.legacyMessages ?? pair.messages.filter(message => message.at === undefined)).slice(),
  ]));
  for (const { number: index, ...message } of archived) {
    byPair.get(index)?.push(message);
  }
  return [...byPair].map(([index, messages]) => ({
    number: index, messages: messages.map(({ seat, text, at, distance }) => ({ seat, text, at, distance })),
  }));
}

export async function api(request, store, defer) {
  try {
    const receivedAt = Date.now();
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/rooms") {
      const input = await readBody(request);
      if (input.key !== undefined && (typeof input.key !== "string" || !validToken.test(input.key))) reject(400, "Érvénytelen futamkulcs.");
      const hostToken = input.key ?? token();
      const host = await digest(hostToken);
      const initial = JSON.stringify({ host, phase: "lobby", players: [], pairs: [], queue: [] });
      for (let attempt = 0; attempt < 4; attempt++) {
        const room = code(await digest(host + ":" + attempt));
        if (await store.create(room, Date.now() + LIFE, initial)) {
          const pruning = Promise.resolve(store.prune()).catch(() => {});
          if (defer) defer(pruning);
          else await pruning;
          return json({ room, token: hostToken }, 201);
        }
        const row = await store.get(room);
        if (row && row.expires_at >= Date.now() && JSON.parse(row.state).host === host) {
          return json({ room, token: hostToken });
        }
      }
      reject(503, "A szoba létrehozása nem sikerült. Próbáld újra.");
    }
    const match = url.pathname.match(/^\/api\/rooms\/([23456789A-HJ-NP-Z]{8})\/(join|state|start|stop|decision|turn|message|requeue|cancel|stop-pair|test-pair|transcript)$/);
    if (!match) reject(404, "Ismeretlen kérés.");
    const [, roomCode, action] = match;
    if (request.method !== (["state", "transcript"].includes(action) ? "GET" : "POST")) reject(405, "Érvénytelen kérés.");
    const credential = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{32})$/)?.[1];
    if (!credential) reject(403, "Hiányzó szobakulcs.");
    const auth = await digest(credential);
    if (action === "transcript") {
      const { room } = await getRoom(store, roomCode);
      if (room.host !== auth) reject(403, "Az üzenetváltást csak a tréner tekintheti meg.");
      const requested = url.searchParams.get("pair");
      const number = requested === null ? null : Number(requested);
      if (number !== null && (!Number.isInteger(number) || number < 1 || number > room.pairs.length)) {
        reject(404, "Ez a pár nem található.");
      }
      return json({ pairs: await transcript(store, roomCode, room, number) });
    }
    if (action === "state") {
      let { room } = await getRoom(store, roomCode);
      if (room.host !== auth && !room.players.some(player => player.key === auth)) {
        reject(403, "Ehhez a szobához nincs hozzáférésed.");
      }
      // An authenticated poll settles durable deadlines, even after a reload.
      const now = Date.now();
      const member = room.players.find(player => player.key === auth);
      const requested = Number(url.searchParams.get("ready"));
      const latest = member ? activePair(room, member.id) : {};
      const needsReady = latest.number === requested && latest.pair?.race?.startsAt === null &&
        !latest.pair.result && !latest.pair.race.ready[latest.pair.players.indexOf(member.id)];
      const timedDue = room.pairs.some(pair => timedRaceIsDue(pair, now));
      if (needsReady || timedDue || queueIsDue(room, now) || room.pairs.some(pair => botIsDue(pair, now))) {
        const seen = timedDue && store.seen ? await store.seen(roomCode) : undefined;
        room = await change(store, roomCode, current => {
          const time = Date.now();
          let changed = settleDuePairs(current, time, seen);
          changed = settleQueue(current, time) || changed;
          if (!needsReady) return changed;
          const { pair, number } = activePair(current, member.id);
          if (number !== requested || pair.result) return changed;
          if (!markReady(pair.race, pair.players.indexOf(member.id), time)) return changed;
          pair.startedAt = pair.race.startsAt;
          return true;
        });
      }
      const projection = await stateView(store, roomCode, room, auth, url.searchParams.has("pulse"), defer);
      if (projection.role === "host" && url.searchParams.has("clock")) projection.serverAt = Date.now();
      return json(projection);
    }
    const input = await readBody(request);
    if (action === "turn") {
      const recording = recordTurn(store, roomCode, auth, input.number, receivedAt);
      if (defer) defer(recording.catch(() => {}));
      return json(await recording);
    }
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
      if (["start", "stop", "stop-pair", "test-pair"].includes(action)) {
        if (state.host !== auth) reject(403, "Ez a tréner művelete.");
        if (action === "test-pair") {
          const player = state.players[input.player - 1];
          const index = player ? state.queue?.indexOf(player.id) ?? -1 : -1;
          if (index < 0 || activePair(state, player.id).number !== input.number) return false;
          state.queue.splice(index, 1);
          delete (state.queueUntil ?? {})[player.id];
          addPair(state, player.id, null);
          return true;
        }
        if (action === "stop-pair") {
          const pair = state.pairs[input.number - 1];
          if (!pair || pair.result) return false;
          stopPair(pair,receivedAt);
          finishIfDone(state);
          return true;
        }
        if (action === "start") {
          if (state.phase !== "lobby") return false;
          if (Number.isInteger(input.count) && state.players.length !== input.count) {
            reject(409, "Közben változott a létszám. Ellenőrizd a várót, és indítsd újra a párosítást.");
          }
          if (input.mode !== undefined && !["steps","timed"].includes(input.mode)) reject(400, "Érvénytelen játékmód.");
          state.mode = input.mode ?? "steps";
          state.readyGate = state.mode === "timed" && input.readyGate === true;
          start(state);
        }
        else {
          if (state.phase === "lobby" || state.phase === "closed") return false;
          state.pairs.forEach(pair => stopPair(pair,receivedAt));
          state.phase = "closed";
          state.queue = [];
          state.queueUntil = {};
        }
        return true;
      }
      const player = state.players.find(p => p.key === auth);
      if (!player) reject(403, "Ehhez a szobához nincs hozzáférésed.");
      if (action === "requeue" || action === "cancel") {
        const changed = settleQueue(state, Date.now());
        return requeue(state, player.id, action, input.number) || changed;
      }
      const { pair, number } = activePair(state, player.id);
      if (!pair) reject(409, "Nincs aktív párod.");
      if ((input.number ?? 1) !== number) return false;
      const seat = pair.players.indexOf(player.id);
      if (action === "decision") {
        if (pair.race) reject(409, "Ebben a futamban a Kitérés gombbal döntesz.");
        return decide(state,pair,seat,input);
      }
      return send(pair,number,seat,input,receivedAt);
    });
    return json(await stateView(store, roomCode, room, auth, action === "join", defer));
  } catch (error) {
    if (error instanceof GameError) return json({ error: error.message }, error.status);
    console.error("Chicken Run: request failed", error?.name);
    return json({ error: "Kapcsolati hiba. Próbáld újra." }, 500);
  }
}


