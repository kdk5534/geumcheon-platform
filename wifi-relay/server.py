from __future__ import annotations

import json
import logging
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from wifi_relay import RelayConfig, RelayError, WifiRelay


class RelayHandler(BaseHTTPRequestHandler):
    relay: WifiRelay

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler contract
        if self.path == "/health":
            self._json(200, {"status": "UP", "service": "TbPublicWifiInfo_GC"})
            return
        if self.path not in {"/v1/public-wifi", "/v1/status"}:
            self._json(404, {"status": "NOT_FOUND"})
            return
        if not self.relay.authorize(self.headers.get("X-Relay-Token")):
            self._json(401, {"status": "UNAUTHORIZED"})
            return
        if self.path == "/v1/status":
            self._json(200, self.relay.status())
            return
        try:
            self._json(200, self.relay.collect())
        except RelayError:
            self._json(503, {"status": "FAILED", "errorCode": self.relay.status()["errorCode"]})

    def log_message(self, format: str, *args: object) -> None:
        logging.info("Relay request from loopback: method=%s path=%s status=%s", self.command, self.path, args[1])

    def _json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    config = RelayConfig.from_environment()
    RelayHandler.relay = WifiRelay(config)
    server = ThreadingHTTPServer((config.bind_host, config.bind_port), RelayHandler)
    logging.info("WiFi relay listening on loopback port %d", config.bind_port)
    server.serve_forever()


if __name__ == "__main__":
    main()
