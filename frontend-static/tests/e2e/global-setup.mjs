import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 4173;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rootWithSeparator = `${root}${sep}`;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

export default async function globalSetup() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);
      if (url.pathname === "/env-config.js") {
        response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
        response.end('window.__ENV__ = {"BACKEND_API_BASE":""};');
        return;
      }

      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = resolve(root, decodeURIComponent(pathname).replace(/^[/\\]+/, ""));
      if (filePath !== root && !filePath.startsWith(rootWithSeparator)) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      const body = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", resolve);
  });

  return async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  };
}
