"""Loopback-only relay for Seoul TbPublicWifiInfo_GC.

The relay is the only process allowed to use Seoul's legacy HTTP endpoint. It
normalizes and validates rows before exposing them to the main platform.
"""

from __future__ import annotations

import hashlib
import hmac
import http.client
import json
import logging
import os
import socket
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


UPSTREAM_HOST = "openapi.seoul.go.kr"
UPSTREAM_PORT = 8088
SERVICE_ID = "TbPublicWifiInfo_GC"
ALLOWED_BIND_HOSTS = {"127.0.0.1", "::1", "localhost"}


class RelayError(RuntimeError):
    """A safe, non-secret relay failure."""


@dataclass(frozen=True)
class RelayConfig:
    api_key: str
    relay_token: str
    bind_host: str = "127.0.0.1"
    bind_port: int = 18088
    timeout_seconds: int = 15
    retry_count: int = 2
    retry_delay_seconds: float = 1.0
    minimum_refresh_seconds: int = 300
    page_size: int = 1000
    maximum_pages: int = 50
    minimum_rows: int = 1
    maximum_rows: int = 50_000
    maximum_change_ratio: float = 0.30
    minimum_valid_ratio: float = 0.70
    state_path: Path = Path(".tmp/wifi-relay-state.json")

    @classmethod
    def from_environment(cls) -> "RelayConfig":
        config = cls(
            api_key=os.environ.get("SEOUL_OPEN_API_KEY", "").strip(),
            relay_token=os.environ.get("WIFI_RELAY_TOKEN", "").strip(),
            bind_host=os.environ.get("WIFI_RELAY_HOST", "127.0.0.1").strip(),
            bind_port=_env_int("WIFI_RELAY_PORT", 18088),
            timeout_seconds=_env_int("WIFI_RELAY_TIMEOUT_SECONDS", 15),
            retry_count=_env_int("WIFI_RELAY_RETRY_COUNT", 2),
            retry_delay_seconds=_env_float("WIFI_RELAY_RETRY_DELAY_SECONDS", 1.0),
            minimum_refresh_seconds=_env_int("WIFI_RELAY_MIN_REFRESH_SECONDS", 300),
            page_size=_env_int("WIFI_RELAY_PAGE_SIZE", 1000),
            maximum_pages=_env_int("WIFI_RELAY_MAX_PAGES", 50),
            minimum_rows=_env_int("WIFI_RELAY_MIN_ROWS", 1),
            maximum_rows=_env_int("WIFI_RELAY_MAX_ROWS", 50_000),
            maximum_change_ratio=_env_float("WIFI_RELAY_MAX_CHANGE_RATIO", 0.30),
            minimum_valid_ratio=_env_float("WIFI_RELAY_MIN_VALID_RATIO", 0.70),
            state_path=Path(os.environ.get("WIFI_RELAY_STATE_PATH", ".tmp/wifi-relay-state.json")),
        )
        config.validate()
        return config

    def validate(self) -> None:
        if self.bind_host not in ALLOWED_BIND_HOSTS:
            raise RelayError("Relay bind host must be loopback-only.")
        if not self.api_key:
            raise RelayError("SEOUL_OPEN_API_KEY is required.")
        if len(self.relay_token) < 32:
            raise RelayError("WIFI_RELAY_TOKEN must contain at least 32 characters.")
        if not 1024 <= self.bind_port <= 65535:
            raise RelayError("WIFI_RELAY_PORT must be between 1024 and 65535.")
        if not 1 <= self.timeout_seconds <= 60:
            raise RelayError("Relay timeout must be between 1 and 60 seconds.")
        if not 0 <= self.retry_count <= 5:
            raise RelayError("Relay retry count must be between 0 and 5.")
        if not 60 <= self.minimum_refresh_seconds <= 86_400:
            raise RelayError("Relay minimum refresh must be between 60 and 86400 seconds.")
        if not 1 <= self.page_size <= 1000 or not 1 <= self.maximum_pages <= 100:
            raise RelayError("Relay pagination limits are invalid.")
        if not 0.0 < self.minimum_valid_ratio <= 1.0:
            raise RelayError("Minimum valid ratio must be within (0, 1].")
        if not 0.0 <= self.maximum_change_ratio <= 1.0:
            raise RelayError("Maximum change ratio must be within [0, 1].")


class WifiRelay:
    def __init__(
        self,
        config: RelayConfig,
        page_loader: Callable[[int, int], dict[str, Any]] | None = None,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.config = config
        self._page_loader = page_loader or self._request_page_with_retry
        self._clock = clock
        self._lock = threading.Lock()
        self._cached_payload: dict[str, Any] | None = None
        self._cached_at = 0.0
        self._last_attempt_at: str | None = None
        self._last_success_at: str | None = None
        self._last_status = "NO_ATTEMPT"
        self._last_error_code: str | None = None
        self._previous_count = self._load_previous_count()

    def authorize(self, presented_token: str | None) -> bool:
        return bool(presented_token) and hmac.compare_digest(
            self.config.relay_token.encode("utf-8"),
            presented_token.encode("utf-8"),
        )

    def status(self) -> dict[str, Any]:
        return {
            "service": SERVICE_ID,
            "status": self._last_status,
            "lastAttemptAt": self._last_attempt_at,
            "lastSuccessAt": self._last_success_at,
            "lastSuccessCount": self._previous_count,
            "errorCode": self._last_error_code,
            "minimumRefreshSeconds": self.config.minimum_refresh_seconds,
            "upstreamPolicy": "FIXED_SEOUL_HTTP_ONLY",
        }

    def collect(self) -> dict[str, Any]:
        now = self._clock()
        with self._lock:
            if self._cached_payload is not None and now - self._cached_at < self.config.minimum_refresh_seconds:
                return dict(self._cached_payload, cache="HIT")
            self._last_attempt_at = _iso_now()
            self._last_status = "RUNNING"
            self._last_error_code = None
            try:
                raw_rows = self._load_all_pages()
                rows, invalid_count, duplicate_count = self._normalize_and_validate(raw_rows)
                self._require_quality(len(raw_rows), len(rows), invalid_count, duplicate_count)
                collected_at = _iso_now()
                payload = {
                    "service": SERVICE_ID,
                    "status": "SUCCESS",
                    "collectedAt": collected_at,
                    "sourceCount": len(raw_rows),
                    "validCount": len(rows),
                    "invalidCount": invalid_count,
                    "duplicateCount": duplicate_count,
                    "rows": rows,
                    "cache": "MISS",
                }
                self._cached_payload = payload
                self._cached_at = now
                self._last_status = "SUCCESS"
                self._last_success_at = collected_at
                self._previous_count = len(rows)
                self._save_state(len(rows), collected_at)
                logging.info("WiFi relay collection succeeded: rows=%d", len(rows))
                return payload
            except Exception as error:
                self._last_status = "FAILED"
                self._last_error_code = _safe_error_code(error)
                logging.warning("WiFi relay collection failed: code=%s", self._last_error_code)
                if isinstance(error, RelayError):
                    raise
                raise RelayError("Upstream collection failed.") from error

    def _load_all_pages(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        total_count: int | None = None
        for page_number in range(1, self.config.maximum_pages + 1):
            start = (page_number - 1) * self.config.page_size + 1
            end = page_number * self.config.page_size
            payload = self._page_loader(start, end)
            service = payload.get(SERVICE_ID)
            if not isinstance(service, dict):
                raise RelayError("Unexpected upstream response contract.")
            result = service.get("RESULT", {})
            if isinstance(result, dict) and result.get("CODE") not in (None, "INFO-000"):
                raise RelayError("Upstream returned a service error.")
            if total_count is None:
                try:
                    total_count = int(service.get("list_total_count", 0))
                except (TypeError, ValueError) as error:
                    raise RelayError("Upstream total count is invalid.") from error
            page_rows = service.get("row", [])
            if not isinstance(page_rows, list):
                raise RelayError("Upstream rows are invalid.")
            rows.extend(item for item in page_rows if isinstance(item, dict))
            if not page_rows or len(rows) >= total_count:
                break
        if total_count is None or len(rows) < total_count:
            raise RelayError("Upstream pagination did not complete within the configured limit.")
        return rows[:total_count]

    def _request_page_with_retry(self, start: int, end: int) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(self.config.retry_count + 1):
            try:
                return self._request_page(start, end)
            except Exception as error:
                last_error = error
                if attempt >= self.config.retry_count:
                    break
                time.sleep(self.config.retry_delay_seconds * (2**attempt))
        if isinstance(last_error, RelayError):
            raise last_error
        raise RelayError("Upstream request failed after retries.") from last_error

    def _request_page(self, start: int, end: int) -> dict[str, Any]:
        # Destination is intentionally assembled from constants only.
        path = f"/{self.config.api_key}/json/{SERVICE_ID}/{start}/{end}/"
        addresses = []
        for item in socket.getaddrinfo(
            UPSTREAM_HOST, UPSTREAM_PORT, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM
        ):
            address = item[4][0]
            if address not in addresses:
                addresses.append(address)
        if not addresses:
            raise RelayError("Upstream destination could not be resolved.")

        last_network_error: Exception | None = None
        for upstream_address in addresses:
            connection = http.client.HTTPConnection(
                upstream_address,
                UPSTREAM_PORT,
                timeout=self.config.timeout_seconds,
            )
            try:
                connection.request("GET", path, headers={
                    "Accept": "application/json",
                    "Host": f"{UPSTREAM_HOST}:{UPSTREAM_PORT}",
                    "User-Agent": "geumcheon-wifi-relay/1.0",
                })
                response = connection.getresponse()
                if response.status != 200:
                    raise RelayError(f"Upstream returned HTTP status {response.status}.")
                body = response.read(20 * 1024 * 1024 + 1)
                if len(body) > 20 * 1024 * 1024:
                    raise RelayError("Upstream response exceeded the size limit.")
                return json.loads(body.decode("utf-8"))
            except TimeoutError as error:
                last_network_error = RelayError("Upstream connection timed out.")
                last_network_error.__cause__ = error
            except ConnectionRefusedError as error:
                last_network_error = RelayError("Upstream connection was refused.")
                last_network_error.__cause__ = error
            except (http.client.HTTPException, OSError) as error:
                last_network_error = RelayError("Upstream network connection failed.")
                last_network_error.__cause__ = error
            except (UnicodeError, json.JSONDecodeError) as error:
                raise RelayError("Upstream JSON response was invalid.") from error
            finally:
                connection.close()
        raise last_network_error or RelayError("Upstream network connection failed.")

    def _normalize_and_validate(
        self, raw_rows: list[dict[str, Any]]
    ) -> tuple[list[dict[str, str]], int, int]:
        rows: list[dict[str, str]] = []
        seen: set[str] = set()
        invalid_count = 0
        duplicate_count = 0
        for raw in raw_rows:
            identifier = _first(raw, "X_SWIFI_WRDNFC_NO", "X_SWIFI_MGR_NO", "ID")
            name = _first(raw, "X_SWIFI_MAIN_NM", "MAIN_NM", "NAME")
            address = " ".join(filter(None, [
                _first(raw, "X_SWIFI_ADRES1", "ADDRESS", "ADDR"),
                _first(raw, "X_SWIFI_ADRES2", "INSTL_FLOR_INFO"),
            ])).strip()
            latitude = _coordinate(raw, "LAT", "Y_DNTS", "LATITUDE")
            longitude = _coordinate(raw, "LNT", "LNG", "X_DNTS", "LONGITUDE")
            if not identifier or not name or latitude is None or longitude is None:
                invalid_count += 1
                continue
            if not (37.42 <= latitude <= 37.51 and 126.85 <= longitude <= 126.93):
                invalid_count += 1
                continue
            duplicate_key = identifier.casefold()
            if duplicate_key in seen:
                duplicate_count += 1
                continue
            seen.add(duplicate_key)
            rows.append({
                "X_SWIFI_WRDNFC_NO": identifier,
                "X_SWIFI_MAIN_NM": name,
                "ADDR": address,
                "LAT": _format_coordinate(latitude),
                "LNT": _format_coordinate(longitude),
                "district": "금천구",
                "sourceService": SERVICE_ID,
            })
        return rows, invalid_count, duplicate_count

    def _require_quality(self, source_count: int, valid_count: int, invalid_count: int, duplicate_count: int) -> None:
        if source_count <= 0:
            raise RelayError("Quality gate rejected an empty source response.")
        valid_ratio = valid_count / source_count
        if valid_ratio < self.config.minimum_valid_ratio:
            raise RelayError("Quality gate rejected the valid-row ratio.")
        if not self.config.minimum_rows <= valid_count <= self.config.maximum_rows:
            raise RelayError("Quality gate rejected the row count range.")
        if self._previous_count and self._previous_count > 0:
            change_ratio = abs(valid_count - self._previous_count) / self._previous_count
            if change_ratio > self.config.maximum_change_ratio:
                raise RelayError("Quality gate rejected the row-count change.")
        if duplicate_count > source_count * (1.0 - self.config.minimum_valid_ratio):
            raise RelayError("Quality gate rejected excessive duplicate identifiers.")

    def _load_previous_count(self) -> int | None:
        try:
            data = json.loads(self.config.state_path.read_text(encoding="utf-8"))
            count = int(data.get("lastSuccessCount", 0))
            self._last_success_at = data.get("lastSuccessAt")
            return count if count > 0 else None
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            return None

    def _save_state(self, count: int, collected_at: str) -> None:
        self.config.state_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.config.state_path.with_suffix(self.config.state_path.suffix + ".tmp")
        temporary.write_text(
            json.dumps({"lastSuccessCount": count, "lastSuccessAt": collected_at}, ensure_ascii=False),
            encoding="utf-8",
        )
        temporary.replace(self.config.state_path)


def _first(row: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _coordinate(row: dict[str, Any], *keys: str) -> float | None:
    value = _first(row, *keys)
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _format_coordinate(value: float) -> str:
    return f"{value:.8f}".rstrip("0").rstrip(".")


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _safe_error_code(error: Exception) -> str:
    text = str(error).lower()
    if "quality gate" in text:
        return "QUALITY_GATE"
    if "timeout" in text or "timed out" in text:
        return "TIMEOUT"
    if "refused" in text:
        return "CONNECTION_REFUSED"
    if "http status" in text:
        return "UPSTREAM_HTTP_STATUS"
    if "network connection" in text:
        return "NETWORK_ERROR"
    if "contract" in text or "json" in text or "response" in text:
        return "UPSTREAM_CONTRACT"
    return "UPSTREAM_UNAVAILABLE"


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError as error:
        raise RelayError(f"{name} must be an integer.") from error


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, str(default)))
    except ValueError as error:
        raise RelayError(f"{name} must be numeric.") from error
