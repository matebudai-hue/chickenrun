import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
const files = {
  "/index.html": "text/html; charset=utf-8",
  "/style.css": "text/css; charset=utf-8",
  "/app.js": "text/javascript; charset=utf-8",
  "/connection.js": "text/javascript; charset=utf-8",
  "/story.js": "text/javascript; charset=utf-8",
  "/views.js": "text/javascript; charset=utf-8",
  "/display-latin.woff2": "font/woff2",
  "/display-latin-ext.woff2": "font/woff2",
  "/FONT-LICENSE.txt": "text/plain; charset=utf-8",
  "/icon.svg": "image/svg+xml",
  "/qr.js": "text/javascript; charset=utf-8",
  "/road.jpg": "image/jpeg",
  "/QR-LICENSE.txt": "text/plain; charset=utf-8",
};
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([path,type]) => [
  path, { type, base64: (await readFile("docs"+path)).toString("base64") },
])));
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await Promise.all([
  writeFile("dist/server/assets.js", "export default "+JSON.stringify(assets)+";\n"),
  copyFile("worker/index.js", "dist/server/index.js"),
  copyFile("worker/game.js", "dist/server/game.js"),
  copyFile(".openai/hosting.json", "dist/.openai/hosting.json"),
]);

