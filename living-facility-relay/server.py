import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from living_facility_relay import ALLOWED_SERVICES, LivingFacilityRelay, RelayConfig, RelayError, _safe_error_code


class Handler(BaseHTTPRequestHandler):
    relay: LivingFacilityRelay

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._json(200, {"status": "UP", "service": "LivingFacilitySeoulOpenAPI"})
            return
        if not self._authorized():
            self._json(401, {"status": "ERROR", "errorCode": "UNAUTHORIZED"})
            return
        if parsed.path == "/v1/status":
            self._json(200, self.relay.status())
            return
        if parsed.path == "/v1/facilities":
            service = parse_qs(parsed.query).get("service", [""])[0]
            try:
                self._json(200, self.relay.collect(service))
            except RelayError as error:
                self._json(503, {"status": "ERROR", "errorCode": _safe_error_code(error)})
            return
        self._json(404, {"status": "ERROR", "errorCode": "NOT_FOUND"})

    def log_message(self, format: str, *args) -> None:
        return

    def _authorized(self) -> bool:
        return self.relay.authorize(self.headers.get("X-Relay-Token"))

    def _json(self, status: int, body: dict) -> None:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            return


def main() -> None:
    config = RelayConfig.from_environment()
    relay = LivingFacilityRelay(config)
    Handler.relay = relay
    server = ThreadingHTTPServer((config.bind_host, config.bind_port), Handler)
    print(f"living_facility_relay_ready={config.bind_host}:{config.bind_port} services={len(ALLOWED_SERVICES)}", flush=True)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
