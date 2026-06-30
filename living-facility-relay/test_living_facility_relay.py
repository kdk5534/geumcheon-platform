import tempfile
import unittest
from pathlib import Path

from living_facility_relay import LivingFacilityRelay, RelayConfig, RelayError


class FakeRelay(LivingFacilityRelay):
    def __init__(self, config, pages):
        self.pages = pages
        self.calls = 0
        super().__init__(config, page_loader=self.load_page)

    def load_page(self, service_id, start, end):
        self.calls += 1
        return self.pages.pop(0)


class LivingFacilityRelayTest(unittest.TestCase):
    def config(self, state_path):
        return RelayConfig(
            api_key="secret", relay_token="t" * 40, bind_host="127.0.0.1", bind_port=18089,
            timeout_seconds=2, retry_count=0, retry_delay_seconds=0,
            minimum_refresh_seconds=60, page_size=100, maximum_pages=10,
            minimum_rows=1, maximum_rows=1000, maximum_change_ratio=0.5,
            minimum_valid_ratio=0.5, state_path=state_path,
        )

    def test_rejects_service_outside_allowlist(self):
        with tempfile.TemporaryDirectory() as directory:
            relay = FakeRelay(self.config(Path(directory) / "state.json"), [])
            with self.assertRaisesRegex(RelayError, "allowlist"):
                relay.collect("UnknownService")

    def test_normalizes_coordinates_deduplicates_and_caches(self):
        with tempfile.TemporaryDirectory() as directory:
            page = {"fcltOpenInfo_GC": {"list_total_count": 2, "row": [
                {"FCLT_CD": "A", "FCLT_NM": "복지관", "FCLT_ADDR": "금천구", "LA": "37.45", "LO": "126.90"},
                {"FCLT_CD": "A", "FCLT_NM": "복지관", "FCLT_ADDR": "금천구", "LA": "37.45", "LO": "126.90"},
            ]}}
            relay = FakeRelay(self.config(Path(directory) / "state.json"), [page])
            first = relay.collect("fcltOpenInfo_GC")
            second = relay.collect("fcltOpenInfo_GC")
            self.assertEqual("SUCCESS", first["status"])
            self.assertEqual(1, len(first["rows"]))
            self.assertEqual("A", first["rows"][0]["sourceOriginalId"])
            self.assertEqual("37.45", first["rows"][0]["LAT"])
            self.assertEqual(1, relay.calls)
            self.assertEqual("MISS", first["cache"])
            self.assertEqual("HIT", second["cache"])
            self.assertEqual(first["rows"], second["rows"])

    def test_quality_failure_does_not_replace_previous_count(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            valid = {"ChildCareInfoGC": {"list_total_count": 1, "row": [
                {"STCODE": "1", "CRNAME": "어린이집", "CRADDR": "금천구"}
            ]}}
            relay = FakeRelay(self.config(state), [valid])
            relay.collect("ChildCareInfoGC")
            invalid = {"ChildCareInfoGC": {"list_total_count": 1, "row": [
                {"STCODE": "2", "CRNAME": "", "CRADDR": ""}
            ]}}
            relay.pages.append(invalid)
            relay._cache.clear()
            with self.assertRaisesRegex(RelayError, "[Qq]uality gate"):
                relay.collect("ChildCareInfoGC")
            self.assertEqual(1, relay._previous_counts["ChildCareInfoGC"])


if __name__ == "__main__":
    unittest.main()
