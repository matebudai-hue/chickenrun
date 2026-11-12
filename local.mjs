import { createServer } from "node:http";
import { Readable } from "node:stream";
import { api } from "./worker/game.js";
import { xyApi } from "./worker/xy.js";
import { fileURLToPath } from "node:url";

export function memoryStore() {
  const rooms = new Map();
  const presence = new Map();
  const chat = new Map();
  const turns = new Map();
  return {
    listArchive(prefix) {
      return [...rooms].reverse().filter(([code]) => code.startsWith(prefix)).map(([, row]) => {
        const {report, ...entry} = JSON.parse(row.state);
        return entry;
      });
    },
    get(code) {
      const row = rooms.get(code);
      return row && { ...row, turns: JSON.stringify([...(turns.get(code)?.values() ?? [])]) };
    },
    saveTurn(code, number, seat, turn) {
      const row = rooms.get(code);
      if (!turns.has(code)) turns.set(code, new Map());
      const entries = turns.get(code);
      const key = number + ":" + seat;
      const prior = entries.get(key);
      if (!prior || turn.at < prior.at) entries.set(key, { number, seat, ...turn });
      rooms.set(code, { ...row, revision: row.revision + 1 });
    },
    seen: code => new Map(presence.get(code)),
    create(code, expires, state) {
      if (rooms.has(code)) return false;
      rooms.set(code, { revision: 0, expires_at: expires, state });
      return true;
    },
    put(code, revision, state, message) {
      const row = rooms.get(code);
      if (!row || row.revision !== revision) return false;
      rooms.set(code, { ...row, revision: revision + 1, state });
      if (message) {
        if (!chat.has(code)) chat.set(code, new Map());
        const key = [message.number,message.seat,message.id].join(":");
        if (!chat.get(code).has(key)) chat.get(code).set(key,message);
      }
      return true;
    },
    transcript(code, number) {
      return [...(chat.get(code)?.values() ?? [])].filter(message => !number || message.number === number);
    },
    async pulse(code, id) {
      if (!presence.has(code)) presence.set(code, new Map());
      presence.get(code).set(id, Date.now());
    },
    online(code) {
      return new Set([...(presence.get(code) ?? [])].filter(([, at]) => at > Date.now() - 45_000).map(([id]) => id));
    },
    prune() {
      for (const [code,row] of rooms) {
        if (row.expires_at >= Date.now()) continue;
        rooms.delete(code);
        presence.delete(code);
        chat.delete(code);
        turns.delete(code);
      }
    },
  };
}
export function localServer(assets) {
  const store = memoryStore();
  return createServer(async (incoming, outgoing) => {
    try {
      const req = new Request("http://localhost"+incoming.url, {
        method: incoming.method, headers: incoming.headers,
        ...(["GET", "HEAD"].includes(incoming.method) ? {} : { body: Readable.toWeb(incoming), duplex: "half" }),
      });
      const res = incoming.url.startsWith("/api/xy/") ? await xyApi(req, store)
        : incoming.url.startsWith("/api/") ? await api(req, store) : await assets.fetch(req, {});
      outgoing.writeHead(res.status, Object.fromEntries(res.headers));
      outgoing.end(Buffer.from(await res.arrayBuffer()));
    } catch {
      outgoing.writeHead(500);
      outgoing.end("Kapcsolati hiba.");
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await import("./build.mjs");
  const { default: assets } = await import("./dist/server/index.js");
  const port = Number(process.env.PORT || 8080);
  localServer(assets).listen(port, "127.0.0.1", () => console.log("Chicken Run: http://localhost:"+port));
}

