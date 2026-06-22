from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from wifi_relay import RelayConfig, RelayError, UPSTREAM_HOST, UPSTREAM_PORT, WifiRelay


TOKEN = "relay-test-token-with-at-least-32-characters"


def row(identifier: str, latitude: str = "37.4568", longitude: str = "126.8954") -> dict[str, str]:
    return {
        "X_SWIFI_WRDNFC_NO": identifier,
        "X_SWIFI_MAIN_NM": f"AP {identifier}",
        "X_SWIFI_ADRES1": "서울특별시 금천구",
        "LAT": latitude,
        "LNT": longitude,
    }


class WifiRelayTest(unittest.TestCase):
    def config(self, state_path: Path, **overrides: object) -> RelayConfig:
        values = dict(api_key="secret-key", relay_token=TOKEN, state_path=state_path, minimum_refresh_seconds=300)
        values.update(overrides)
        return RelayConfig(**values)

    def test_normalizes_deduplicates_and_caches_valid_rows(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            calls: list[tuple[int, int]] = []

            def loader(start: int, end: int) -> dict:
                calls.append((start, end))
                return {"TbPublicWifiInfo_GC": {"list_total_count": 4, "RESULT": {"CODE": "INFO-000"}, "row": [row("1"), row("1"), row("2"), row("3")]}}

            relay = WifiRelay(self.config(Path(directory) / "state.json"), loader, clock=lambda: 1000.0)
            first = relay.collect()
            second = relay.collect()

            self.assertEqual(3, first["validCount"])
            self.assertEqual(1, first["duplicateCount"])
            self.assertEqual("금천구", first["rows"][0]["district"])
            self.assertEqual("HIT", second["cache"])
            self.assertEqual([(1, 1000)], calls)

    def test_rejects_missing_fields_and_out_of_range_coordinates(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            payload = {"TbPublicWifiInfo_GC": {"list_total_count": 3, "RESULT": {"CODE": "INFO-000"}, "row": [row("1"), row("2", "38.0"), {"LAT": "37.45", "LNT": "126.89"}]}}
            relay = WifiRelay(self.config(Path(directory) / "state.json", minimum_valid_ratio=0.70), lambda *_: payload)
            with self.assertRaisesRegex(RelayError, "valid-row ratio"):
                relay.collect()
            self.assertEqual("QUALITY_GATE", relay.status()["errorCode"])

    def test_rejects_large_change_and_preserves_previous_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            state.write_text('{"lastSuccessCount":100,"lastSuccessAt":"2026-06-20T00:00:00Z"}', encoding="utf-8")
            payload = {"TbPublicWifiInfo_GC": {"list_total_count": 50, "RESULT": {"CODE": "INFO-000"}, "row": [row(str(index)) for index in range(50)]}}
            relay = WifiRelay(self.config(state), lambda *_: payload)
            with self.assertRaisesRegex(RelayError, "row-count change"):
                relay.collect()
            self.assertEqual(100, relay.status()["lastSuccessCount"])

    def test_requires_loopback_strong_token_and_fixed_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RelayError, "loopback"):
                self.config(Path(directory) / "state.json", bind_host="0.0.0.0").validate()
            with self.assertRaisesRegex(RelayError, "32 characters"):
                self.config(Path(directory) / "state.json", relay_token="short").validate()

    def test_token_comparison_does_not_accept_wrong_token(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            relay = WifiRelay(self.config(Path(directory) / "state.json"), lambda *_: {})
            self.assertTrue(relay.authorize(TOKEN))
            self.assertFalse(relay.authorize("wrong-token"))
            self.assertFalse(relay.authorize(None))

    @patch("wifi_relay.http.client.HTTPConnection")
    @patch("wifi_relay.socket.getaddrinfo")
    def test_upstream_request_uses_only_fixed_seoul_destination(
        self, getaddrinfo: MagicMock, http_connection: MagicMock
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            getaddrinfo.return_value = [(2, 1, 6, "", ("203.0.113.10", UPSTREAM_PORT))]
            response = MagicMock(status=200)
            response.read.return_value = b'{"TbPublicWifiInfo_GC":{"list_total_count":0,"row":[]}}'
            connection = http_connection.return_value
            connection.getresponse.return_value = response
            relay = WifiRelay(self.config(Path(directory) / "state.json"))

            relay._request_page(1, 5)

            getaddrinfo.assert_called_once_with(
                UPSTREAM_HOST, UPSTREAM_PORT, family=0, type=1
            )
            connection.request.assert_called_once()
            method, path = connection.request.call_args.args
            headers = connection.request.call_args.kwargs["headers"]
            self.assertEqual("GET", method)
            self.assertEqual("/secret-key/json/TbPublicWifiInfo_GC/1/5/", path)
            self.assertEqual(f"{UPSTREAM_HOST}:{UPSTREAM_PORT}", headers["Host"])


if __name__ == "__main__":
    unittest.main()
