package kr.go.geumcheon.dataplatform.publicdata;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AirQualitySchedulerTest {

    @Test
    void schedulesOnlyAirQualityWhenCollectionIsEnabled() {
        PublicDataCollectorService service = mock(PublicDataCollectorService.class);
        when(service.isCollectorEnabled()).thenReturn(true);
        when(service.syncDataset("air-quality", "scheduled-air-quality")).thenReturn(result("success"));

        new AirQualityScheduler(service).syncAirQuality();

        verify(service).syncDataset("air-quality", "scheduled-air-quality");
    }

    @Test
    void skipsExternalCallWhenCollectionIsDisabled() {
        PublicDataCollectorService service = mock(PublicDataCollectorService.class);
        when(service.isCollectorEnabled()).thenReturn(false);

        new AirQualityScheduler(service).syncAirQuality();

        verify(service, never()).syncDataset("air-quality", "scheduled-air-quality");
    }

    private CollectionRunResult result(String status) {
        Instant now = Instant.parse("2026-06-21T00:00:00Z");
        return new CollectionRunResult(
                "air-quality", status, 23, 23, "ok", "https://example.test", now, now, Duration.ZERO
        );
    }
}
