import http from "node:http";

const PORT = Number(process.env.PORT || 3000);

function normalizeHeader(value) {
  if (Array.isArray(value)) return value.join(",");
  return value || "";
}

function cleanCandidate(value) {
  return value
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/^\[|\]$/g, "")
    .replace(/^::ffff:/i, "");
}

function isPublicIpv4(ip) {
  const parts = ip.split(".").map(Number);
  const [a, b, c] = parts;

  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;

  return true;
}

function extractPublicIpv4(value) {
  const text = normalizeHeader(value);
  const candidates = text.split(",").map(cleanCandidate);

  for (const candidate of candidates) {
    const match = candidate.match(/\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/);
    if (match && isPublicIpv4(match[0])) return match[0];
  }

  return null;
}

function getClientIpv4(req) {
  return (
    extractPublicIpv4(req.headers["cf-connecting-ip"]) ||
    extractPublicIpv4(req.headers["x-real-ip"]) ||
    extractPublicIpv4(req.headers["x-forwarded-for"]) ||
    extractPublicIpv4(req.socket.remoteAddress)
  );
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendHtml(res) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });

  res.end(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mi IPv4 Publica</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f5f3ee;
        color: #181716;
      }

      * {
        box-sizing: border-box;
      }

      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top left, rgba(48, 107, 160, 0.18), transparent 32rem),
          linear-gradient(135deg, #f7f3ea 0%, #eef6f4 48%, #f9f7f1 100%);
      }

      main {
        width: min(680px, 100%);
        border: 1px solid rgba(24, 23, 22, 0.14);
        border-radius: 8px;
        padding: clamp(28px, 6vw, 56px);
        background: rgba(255, 255, 255, 0.78);
        box-shadow: 0 24px 70px rgba(24, 23, 22, 0.12);
      }

      p {
        margin: 0;
      }

      .label {
        color: #59605d;
        font-size: 0.9rem;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      #ip {
        margin-top: 16px;
        overflow-wrap: anywhere;
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        font-size: clamp(2.6rem, 9vw, 5.5rem);
        font-weight: 800;
        line-height: 1;
      }

      .status {
        min-height: 1.5rem;
        margin-top: 22px;
        color: #59605d;
        font-size: 1rem;
      }

      button {
        min-height: 44px;
        margin-top: 28px;
        border: 0;
        border-radius: 8px;
        padding: 0 18px;
        background: #1f6f68;
        color: white;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      button:hover {
        background: #185b55;
      }

      button:focus-visible {
        outline: 3px solid rgba(31, 111, 104, 0.35);
        outline-offset: 3px;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          background: #121412;
          color: #f5f3ee;
        }

        body {
          background:
            radial-gradient(circle at top left, rgba(47, 135, 123, 0.26), transparent 32rem),
            linear-gradient(135deg, #111312 0%, #18211f 52%, #171613 100%);
        }

        main {
          border-color: rgba(245, 243, 238, 0.16);
          background: rgba(24, 26, 24, 0.82);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
        }

        .label,
        .status {
          color: #b9c2bd;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <p class="label">Tu IPv4 publica</p>
      <p id="ip">...</p>
      <p id="status" class="status">Detectando desde el servidor...</p>
      <button id="refresh" type="button">Actualizar</button>
    </main>

    <script>
      const ip = document.querySelector("#ip");
      const status = document.querySelector("#status");
      const refresh = document.querySelector("#refresh");

      const sources = [
        { url: "/api/ip", label: "IPv4 detectada desde el servidor." },
        { url: "https://api.ipify.org?format=json", label: "IPv4 detectada desde el navegador." }
      ];

      function isIpv4(value) {
        return typeof value === "string" &&
          /^(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}$/.test(value);
      }

      async function loadIp() {
        ip.textContent = "...";
        status.textContent = "Detectando IPv4 publica...";

        for (const source of sources) {
          try {
            const response = await fetch(source.url, { cache: "no-store" });
            const data = await response.json();
            const candidate = data.ipv4 || data.ip;

            if (response.ok && isIpv4(candidate)) {
              ip.textContent = candidate;
              status.textContent = source.label;
              return;
            }
          } catch {
            continue;
          }
        }

        ip.textContent = "No detectada";
        status.textContent = "No se pudo detectar una IPv4 publica para esta conexion.";
      }

      refresh.addEventListener("click", loadIp);
      loadIp();
    </script>
  </body>
</html>`);
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.url === "/api/ip") {
    const ipv4 = getClientIpv4(req);
    sendJson(res, ipv4 ? 200 : 404, {
      ipv4,
      message: ipv4 ? "IPv4 detectada." : "No se encontro una IPv4 publica."
    });
    return;
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    sendHtml(res);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`IPv4 publica app listening on port ${PORT}`);
});
