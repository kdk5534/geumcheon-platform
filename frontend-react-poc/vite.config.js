import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
function envConfigMiddleware() {
    return {
        name: "gdp-env-config",
        configureServer: function (server) {
            server.middlewares.use("/env-config.js", function (_req, res) {
                var backend = process.env.BACKEND_API_BASE || "http://localhost:8080";
                res.setHeader("Content-Type", "text/javascript; charset=utf-8");
                res.end("window.__ENV__ = ".concat(JSON.stringify({ BACKEND_API_BASE: backend }), ";"));
            });
        },
    };
}
export default defineConfig(function (_a) {
    var mode = _a.mode;
    return ({
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
        build: {
            rollupOptions: {
                input: {
                    main: "index.html",
                    admin: "admin.html",
                },
            },
        },
    });
});
