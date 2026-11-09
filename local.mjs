import { createServer } from "node:http";
import { Readable } from "node:stream";
import { api } from "./worker/game.js";
import { fileURLToPath } from "node:url";

export function memoryStore() {
  const rooms = new Map();
  return {
    get: code => rooms.get(code),
    create(code, expires, state) {
      if (rooms.has(code)) return false;
      rooms.set(code, { revision: 0, expires_at: expires, state });
      return true;
    },
    put(code, revision, state) {
      const row = rooms.get(code);
      if (!row || row.revision !== revision) return false;
      rooms.set(code, { ...row, revision: revision + 1, state });
      return true;
    },
    prune() {
      for (const [code,row] of rooms) if (row.expires_at < Date.now()) rooms.delete(code);
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
      const res = incoming.url.startsWith("/api/") ? await api(req, store) : await assets.fetch(req, {});
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

