const ALLOWED_ORIGIN = "https://the-good-tiger.github.io";
const IDENTITY_ORIGIN = "https://identity.nba.com";

function responseHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, private, max-age=0",
    "Content-Type": "application/json",
    "Pragma": "no-cache",
    "Vary": "Origin"
  };
}

function json(origin, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin)
  });
}

function findCode(value) {
  if (typeof value === "string" && /^[A-Za-z0-9]{6}$/.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const code = findCode(item);
      if (code) return code;
    }
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/code/i.test(key) && typeof item === "string" && /^[A-Za-z0-9]{6}$/.test(item)) return item;
    }
    for (const item of Object.values(value)) {
      const code = findCode(item);
      if (code) return code;
    }
  }
  return null;
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== ALLOWED_ORIGIN) {
      return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseHeaders(origin) });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/session") {
      const deviceId = crypto.randomUUID();
      const upstream = await fetch(`${IDENTITY_ORIGIN}/api/v1/devices/${deviceId}/codes`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0"
        },
        cf: { cacheTtl: 0, cacheEverything: false }
      });

      if (!upstream.ok) return json(origin, { error: "code_generation_failed" }, 502);

      const body = await upstream.json();
      const code = findCode(body);
      if (!code) return json(origin, { error: "code_missing" }, 502);

      return json(origin, { deviceId, code });
    }

    if (request.method === "GET" && url.pathname === "/poll") {
      const deviceId = url.searchParams.get("device") || "";
      const code = url.searchParams.get("code") || "";
      if (!/^[0-9a-f-]{36}$/i.test(deviceId) || !/^[A-Za-z0-9]{6}$/.test(code)) {
        return json(origin, { error: "invalid_session" }, 400);
      }

      const upstream = await fetch(`${IDENTITY_ORIGIN}/api/v1/devices/${deviceId}/codes/${code}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0"
        },
        cf: { cacheTtl: 0, cacheEverything: false }
      });

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders(origin)
      });
    }

    return json(origin, { error: "not_found" }, 404);
  }
};
