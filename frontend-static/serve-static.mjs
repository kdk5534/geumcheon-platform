import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`;
const requestedPort = Number(process.env.PORT || 3000);
const allowPortFallback = !process.env.PORT;
let activePort = requestedPort;

// 프론트엔드에 노출할 화이트리스트 키 목록 (DB 비밀번호 등은 절대 포함 금지)
const FRONTEND_ENV_KEYS = ["ENABLE_SAMPLE_DATA", "APPROVED_LANGUAGES", "ENABLE_BACKEND_API", "ENABLE_EXTERNAL_ASSETS"];

/** 프로젝트 루트의 .env 파일을 파싱해 KEY=VALUE 맵을 반환한다. */
async function loadEnv() {
  const envPath = resolve(root, "../.env");
  try {
    const raw = await readFile(envPath, "utf-8");
    return Object.fromEntries(
      raw.split(/\r?\n/)
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const idx = line.indexOf("=");
          return idx > -1 ? [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] : null;
        })
        .filter(Boolean)
    );
  } catch {
    return {};
  }
}

let cachedEnvJs = null;
async function getEnvConfigJs() {
  if (cachedEnvJs) return cachedEnvJs;
  const fileEnv = await loadEnv();
  const env = { ...fileEnv, ...process.env };
  const pub = {};
  for (const key of FRONTEND_ENV_KEYS) {
    if (env[key]) pub[key] = env[key];
  }
  pub.BACKEND_API_BASE = env.BACKEND_API_BASE || env.APP_BASE_URL || "";
  cachedEnvJs = `window.__ENV__ = ${JSON.stringify(pub)};`;
  return cachedEnvJs;
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${activePort}`);
    const pathname = url.pathname;

    // 프론트엔드 공개 환경변수 (화이트리스트 키만 노출)
    if (pathname === "/env-config.js") {
      const js = await getEnvConfigJs();
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      response.end(js);
      return;
    }

    const resolvedPathname = pathname === "/" ? "/index.html" : pathname;
    const safePathname = decodeURIComponent(resolvedPathname).replace(/^[/\\]+/, "");
    const filePath = resolve(join(root, safePathname));

    if (filePath !== root && !filePath.startsWith(rootWithSeparator)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve(port);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });
}

async function start() {
  const maxAttempts = allowPortFallback ? 10 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = requestedPort + attempt;

    try {
      const boundPort = await listen(port);
      activePort = boundPort;
      console.log(`Geumcheon frontend running at http://localhost:${boundPort}`);
      return;
    } catch (error) {
      if (error.code !== "EADDRINUSE" || attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.closeAllConnections?.();
  server.close();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
