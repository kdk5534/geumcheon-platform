"""Loopback-only relay for selected Seoul OpenAPI living-facility services.

This relay is intentionally separate from the Wi-Fi relay.  It is the only
process allowed to call the approved Seoul legacy HTTP endpoint for the first
wave of living-facility datasets, and it exposes only normalized, validated
JSON to the Spring Boot application on loopback.
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
ALLOWED_BIND_HOSTS = {"127.0.0.1", "::1", "localhost"}
ALLOWED_SERVICES = {
    "fcltOpenInfo_GC",
    "LOCALDATA_114602_GC",
    "LOCALDATA_010101_GC",
    "LOCALDATA_010106_GC",
    "ChildCareInfoGC",
}
SERVICE_REQUIRED_FIELDS = {
    "fcltOpenInfo_GC": ("FCLT_NM", "FCLT_ADDR"),
    "LOCALDATA_114602_GC": ("MNG_NO", "BPLC_NM"),
    "LOCALDATA_010101_GC": ("MGTNO", "BPLCNM"),
    "LOCALDATA_010106_GC": ("MGTNO", "BPLCNM"),
    "ChildCareInfoGC": ("STCODE", "CRNAME", "CRADDR"),
}


class RelayError(RuntimeError):
    """A safe, non-secret relay failure."""


@dataclass(frozen=True)
class RelayConfig:
    api_key: str
    relay_token: str
    bind_host: str = "127.0.0.1"
    bind_port: int = 18089
    timeout_seconds: int = 5
    retry_count: int = 2
    retry_delay_seconds: float = 1.0
    minimum_refresh_seconds: int = 300
    page_size: int = 1000
    maximum_pages: int = 20
    minimum_rows: int = 1
    maximum_rows: int = 10_000
    maximum_change_ratio: float = 0.50
    minimum_valid_ratio: float = 0.60
    state_path: Path = Path(".tmp/living-facility-relay-state.json")

    @classmethod
    def from_environment(cls) -> "RelayConfig":
        config = cls(
            api_key=os.environ.get("SEOUL_OPEN_API_KEY", "").strip(),
            relay_token=os.environ.get("LIVING_FACILITY_RELAY_TOKEN", "").strip(),
            bind_host=os.environ.get("LIVING_FACILITY_RELAY_HOST", "127.0.0.1").strip(),
            bind_port=_env_int("LIVING_FACILITY_RELAY_PORT", 18089),
            timeout_seconds=_env_int("LIVING_FACILITY_RELAY_TIMEOUT_SECONDS", 5),
            retry_count=_env_int("LIVING_FACILITY_RELAY_RETRY_COUNT", 2),
            retry_delay_seconds=_env_float("LIVING_FACILITY_RELAY_RETRY_DELAY_SECONDS", 1.0),
            minimum_refresh_seconds=_env_int("LIVING_FACILITY_RELAY_MIN_REFRESH_SECONDS", 300),
            page_size=_env_int("LIVING_FACILITY_RELAY_PAGE_SIZE", 1000),
            maximum_pages=_env_int("LIVING_FACILITY_RELAY_MAX_PAGES", 20),
            minimum_rows=_env_int("LIVING_FACILITY_RELAY_MIN_ROWS", 1),
            maximum_rows=_env_int("LIVING_FACILITY_RELAY_MAX_ROWS", 10_000),
            maximum_change_ratio=_env_float("LIVING_FACILITY_RELAY_MAX_CHANGE_RATIO", 0.50),
            minimum_valid_ratio=_env_float("LIVING_FACILITY_RELAY_MIN_VALID_RATIO", 0.60),
            state_path=Path(os.environ.get(
                "LIVING_FACILITY_RELAY_STATE_PATH",
                ".tmp/living-facility-relay-state.json",
            )),
        )
        config.validate()
        return config

    def validate(self) -> None:
        if self.bind_host not in ALLOWED_BIND_HOSTS:
            raise RelayError("Relay bind host must be loopback-only.")
        if not self.api_key:
            raise RelayError("SEOUL_OPEN_API_KEY is required.")
        if len(self.relay_token) < 32:
            raise RelayError("LIVING_FACILITY_RELAY_TOKEN must contain at least 32 characters.")
        if not 1024 <= self.bind_port <= 65535:
            raise RelayError("Relay port must be between 1024 and 65535.")
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


class LivingFacilityRelay:
    def __init__(
        self,
        config: RelayConfig,
        page_loader: Callable[[str, int, int], dict[str, Any]] | None = None,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.config = config
        self._page_loader = page_loader or self._request_page_with_retry
        self._clock = clock
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._last_attempt_at: str | None = None
        self._last_success_at: str | None = None
        self._last_status = "NO_ATTEMPT"
        self._last_error_code: str | None = None
        self._previous_counts = self._load_previous_counts()

    def authorize(self, presented_token: str | None) -> bool:
        return bool(presented_token) and hmac.compare_digest(
            self.config.relay_token.encode("utf-8"),
            presented_token.encode("utf-8"),
        )

    def status(self) -> dict[str, Any]:
        return {
            "service": "LivingFacilitySeoulOpenAPI",
            "allowedServices": sorted(ALLOWED_SERVICES),
            "status": self._last_status,
            "lastAttemptAt": self._last_attempt_at,
            "lastSuccessAt": self._last_success_at,
            "lastSuccessCounts": dict(self._previous_counts),
            "errorCode": self._last_error_code,
            "minimumRefreshSeconds": self.config.minimum_refresh_seconds,
            "upstreamPolicy": "ALLOWLISTED_SEOUL_HTTP_ONLY",
        }

    def collect(self, service_id: str) -> dict[str, Any]:
        service_id = _require_allowed_service(service_id)
        now = self._clock()
        with self._lock:
            cached = self._cache.get(service_id)
            if cached and now - cached[0] < self.config.minimum_refresh_seconds:
                return dict(cached[1], cache="HIT")
            self._last_attempt_at = _iso_now()
            self._last_status = "RUNNING"
            self._last_error_code = None
            try:
                raw_rows = self._load_all_pages(service_id)
                rows, invalid_count, duplicate_count = self._normalize_and_validate(service_id, raw_rows)
                self._require_quality(service_id, len(raw_rows), len(rows), duplicate_count)
                collected_at = _iso_now()
                payload = {
                    "service": service_id,
                    "sourceService": service_id,
                    "status": "SUCCESS",
                    "collectedAt": collected_at,
                    "sourceCount": len(raw_rows),
                    "validCount": len(rows),
                    "invalidCount": invalid_count,
                    "duplicateCount": duplicate_count,
                    "rows": rows,
                    "cache": "MISS",
                }
                self._cache[service_id] = (now, payload)
                self._last_status = "SUCCESS"
                self._last_success_at = collected_at
                self._previous_counts[service_id] = len(rows)
                self._save_state(collected_at)
                logging.info("Living facility relay collection succeeded: service=%s rows=%d", service_id, len(rows))
                return payload
            except Exception as error:
                self._last_status = "FAILED"
                self._last_error_code = _safe_error_code(error)
                logging.warning("Living facility relay collection failed: service=%s code=%s", service_id, self._last_error_code)
                if isinstance(error, RelayError):
                    raise
                raise RelayError("Upstream collection failed.") from error

    def _load_all_pages(self, service_id: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        total_count: int | None = None
        for page_number in range(1, self.config.maximum_pages + 1):
            start = (page_number - 1) * self.config.page_size + 1
            end = page_number * self.config.page_size
            payload = self._page_loader(service_id, start, end)
            service = payload.get(service_id)
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

    def _request_page_with_retry(self, service_id: str, start: int, end: int) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(self.config.retry_count + 1):
            try:
                return self._request_page(service_id, start, end)
            except Exception as error:
                last_error = error
                if attempt >= self.config.retry_count:
                    break
                time.sleep(self.config.retry_delay_seconds * (2**attempt))
        if isinstance(last_error, RelayError):
            raise last_error
        raise RelayError("Upstream request failed after retries.") from last_error

    def _request_page(self, service_id: str, start: int, end: int) -> dict[str, Any]:
        service_id = _require_allowed_service(service_id)
        path = f"/{self.config.api_key}/json/{service_id}/{start}/{end}/"
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
        request_deadline = time.monotonic() + self.config.timeout_seconds
        for upstream_address in addresses:
            remaining_seconds = request_deadline - time.monotonic()
            if remaining_seconds <= 0:
                break
            connection = http.client.HTTPConnection(
                upstream_address,
                UPSTREAM_PORT,
                timeout=max(0.1, remaining_seconds),
            )
            try:
                connection.request("GET", path, headers={
                    "Accept": "application/json",
                    "Host": f"{UPSTREAM_HOST}:{UPSTREAM_PORT}",
                    "User-Agent": "geumcheon-living-facility-relay/1.0",
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
        self,
        service_id: str,
        raw_rows: list[dict[str, Any]],
    ) -> tuple[list[dict[str, str]], int, int]:
        rows: list[dict[str, str]] = []
        seen: set[str] = set()
        invalid_count = 0
        duplicate_count = 0
        for raw in raw_rows:
            row = {str(key): _clean(value) for key, value in raw.items()}
            if not _required_fields_present(service_id, row):
                invalid_count += 1
                continue
            identifier = _natural_key(service_id, row)
            if not identifier:
                invalid_count += 1
                continue
            duplicate_key = hashlib.sha256(f"{service_id}:{identifier}".casefold().encode("utf-8")).hexdigest()
            if duplicate_key in seen:
                duplicate_count += 1
                continue
            seen.add(duplicate_key)
            lat, lon = _coordinate_pair(row)
            if (lat is None) != (lon is None):
                invalid_count += 1
                continue
            if lat is not None and not (37.42 <= lat <= 37.51 and 126.85 <= lon <= 126.93):
                invalid_count += 1
                continue
            row["sourceService"] = service_id
            row["sourceOriginalId"] = identifier
            row["district"] = "금천구"
            if lat is not None and lon is not None:
                row["LAT"] = _format_coordinate(lat)
                row["LNG"] = _format_coordinate(lon)
            rows.append(row)
        return rows, invalid_count, duplicate_count

    def _require_quality(self, service_id: str, source_count: int, valid_count: int, duplicate_count: int) -> None:
        if source_count <= 0:
            raise RelayError("Quality gate rejected an empty source response.")
        valid_ratio = valid_count / source_count
        if valid_ratio < self.config.minimum_valid_ratio:
            raise RelayError("Quality gate rejected the valid-row ratio.")
        if not self.config.minimum_rows <= valid_count <= self.config.maximum_rows:
            raise RelayError("Quality gate rejected the row count range.")
        previous_count = self._previous_counts.get(service_id)
        if previous_count and previous_count > 0:
            change_ratio = abs(valid_count - previous_count) / previous_count
            if change_ratio > self.config.maximum_change_ratio:
                raise RelayError("Quality gate rejected the row-count change.")
        if duplicate_count > source_count * (1.0 - self.config.minimum_valid_ratio):
            raise RelayError("Quality gate rejected excessive duplicate identifiers.")

    def _load_previous_counts(self) -> dict[str, int]:
        try:
            data = json.loads(self.config.state_path.read_text(encoding="utf-8"))
            counts = data.get("lastSuccessCounts", {})
            self._last_success_at = data.get("lastSuccessAt")
            if not isinstance(counts, dict):
                return {}
            return {key: int(value) for key, value in counts.items() if key in ALLOWED_SERVICES and int(value) > 0}
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            return {}

    def _save_state(self, collected_at: str) -> None:
        self.config.state_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.config.state_path.with_suffix(self.config.state_path.suffix + ".tmp")
        temporary.write_text(
            json.dumps({
                "lastSuccessCounts": self._previous_counts,
                "lastSuccessAt": collected_at,
            }, ensure_ascii=False),
            encoding="utf-8",
        )
        temporary.replace(self.config.state_path)


def _require_allowed_service(service_id: str) -> str:
    service_id = (service_id or "").strip()
    if service_id not in ALLOWED_SERVICES:
        raise RelayError("Requested service is not in the approved allowlist.")
    return service_id


def _required_fields_present(service_id: str, row: dict[str, str]) -> bool:
    return all(row.get(key) for key in SERVICE_REQUIRED_FIELDS[service_id])


def _natural_key(service_id: str, row: dict[str, str]) -> str:
    if service_id == "fcltOpenInfo_GC":
        return row.get("FCLT_CD") or f"{row.get('FCLT_NM', '')}|{row.get('FCLT_ADDR', '')}"
    if service_id == "LOCALDATA_114602_GC":
        return row.get("MNG_NO") or f"{row.get('BPLC_NM', '')}|{row.get('LOTNO_ADDR', '') or row.get('ROAD_NM_ADDR', '')}"
    if service_id in {"LOCALDATA_010101_GC", "LOCALDATA_010106_GC"}:
        return row.get("MGTNO") or f"{row.get('BPLCNM', '')}|{row.get('RDNWHLADDR', '') or row.get('SITEWHLADDR', '')}"
    if service_id == "ChildCareInfoGC":
        return row.get("STCODE") or f"{row.get('CRNAME', '')}|{row.get('CRADDR', '')}"
    return ""


def _coordinate_pair(row: dict[str, str]) -> tuple[float | None, float | None]:
    lat = _coordinate(row, "LAT", "LA", "REFINE_WGS84_LAT")
    lon = _coordinate(row, "LNG", "LO", "REFINE_WGS84_LOGT")
    return lat, lon


def _coordinate(row: dict[str, str], *keys: str) -> float | None:
    for key in keys:
        value = row.get(key)
        if value:
            try:
                return float(value)
            except ValueError:
                return None
    return None


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\x00", "").strip()


def _format_coordinate(value: float) -> str:
    return f"{value:.8f}".rstrip("0").rstrip(".")


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _safe_error_code(error: Exception) -> str:
    text = str(error).lower()
    if "allowlist" in text:
        return "SERVICE_NOT_ALLOWED"
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
