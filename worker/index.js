import { api, d1Store } from "./game.js";
import assets from "./assets.js";

const headers = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (!env.DB) return Response.json({ error: "Az adatbázis nem elérhető." }, { status: 503 });
      return api(request, d1Store(env.DB));
    }
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

