import { api, d1Store } from "./game.js";
import assets from "./assets.js";

const headers = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const pagesOrigin = "https://matebudai-hue.github.io";

async function handleApi(request, env, ctx) {
  const cors = new Headers({ Vary: "Origin" });
  if (request.headers.get("Origin") === pagesOrigin) {
    cors.set("Access-Control-Allow-Origin", pagesOrigin);
    cors.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    cors.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    cors.set("Access-Control-Max-Age", "600");
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const response = env.DB
    ? await api(request, d1Store(env.DB), promise => ctx.waitUntil(promise))
    : Response.json({ error: "Az adatbázis nem elérhető." }, { status: 503 });
  for (const [key, value] of cors) response.headers.set(key, value);
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, ctx);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Érvénytelen kérés.", { status: 405, headers });
    }
    const asset = assets[url.pathname === "/" ? "/index.html" : url.pathname];
    if (!asset) return new Response("Ez az oldal nem található.", { status: 404, headers });
    return new Response(request.method === "HEAD" ? null : Uint8Array.from(atob(asset.base64), c => c.charCodeAt(0)), {
      headers: { ...headers, "Content-Type": asset.type, "Cache-Control": "no-cache" },
    });
  },
};

