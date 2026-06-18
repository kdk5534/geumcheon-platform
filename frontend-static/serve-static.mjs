import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`;
const requestedPort = Number(process.env.PORT || 3000);
const allowPortFallback = !process.env.PORT;
let activePort = requestedPort;

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
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePathname = decodeURIComponent(pathname).replace(/^[/\\]+/, "");
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

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
