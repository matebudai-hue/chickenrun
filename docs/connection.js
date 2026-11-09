const backend = location.hostname === "matebudai-hue.github.io"
  ? "https://chicken-run.mbudai.chatgpt.site" : location.origin;

const transientStatus = new Set([408, 425, 429, 500, 502, 503, 504]);

export class RequestError extends Error {
  constructor(message, retryable = false, status = 0) {
    super(message);
    this.retryable = retryable;
    this.status = status;
  }
}

async function request(path, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = {};
    if (options.token) headers.Authorization = "Bearer " + options.token;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(backend + path, {
      headers, credentials: "omit", cache: "no-store", signal: controller.signal,
      method: options.body === undefined ? "GET" : "POST",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      throw new RequestError(data?.error || "A játékszerver nem válaszolt.",
        transientStatus.has(response.status) || response.ok, response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("A játékszerver nem válaszolt időben.", true);
  } finally {
    clearTimeout(timer);
  }
}

export async function readState(path, token) {
  return request(path, { token }, 6500);
}

export async function command(path, token, body, onRetry) {
  try {
    return await request(path, { token, body }, 6500);
  } catch (error) {
    if (!error.retryable) throw error;
    onRetry?.();
    await new Promise(resolve => setTimeout(resolve, 350));
    return request(path, { token, body }, 9000);
  }
}

export const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(16)),
  byte => byte.toString(16).padStart(2, "0")).join("");

const fallback = new Map();
export const saved = {
  get(key) {
    try { return localStorage.getItem(key) ?? fallback.get(key) ?? null; }
    catch { return fallback.get(key) ?? null; }
  },
  set(key, value) {
    fallback.set(key, value);
    try { localStorage.setItem(key, value); } catch {}
  },
  remove(key) {
    fallback.delete(key);
    try { localStorage.removeItem(key); } catch {}
  },
};
