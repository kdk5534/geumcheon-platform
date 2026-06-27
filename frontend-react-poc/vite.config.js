import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function envConfigMiddleware() {
  return {
    name: "gdp-env-config",
    configureServer(server) {
      server.middlewares.use("/env-config.js", (_req, res) => {
        const backend = process.env.BACKEND_API_BASE || "http://localhost:8080";
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.end(`window.__ENV__ = ${JSON.stringify({ BACKEND_API_BASE: backend })};`);
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: process.env.GDP_BASE_PATH || "./",
  plugins: [react(), envConfigMiddleware()],
  server: {
    host: "127.0.0.1",
    port: 3100,
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
  },
  define: {
    __GDP_BUILD_MODE__: JSON.stringify(mode),
  },
}));
