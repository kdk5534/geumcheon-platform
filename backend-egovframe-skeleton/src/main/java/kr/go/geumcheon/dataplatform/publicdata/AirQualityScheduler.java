package kr.go.geumcheon.dataplatform.publicdata;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
        prefix = "geumcheon.air-quality",
        name = "schedule-enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class AirQualityScheduler {

    private static final Logger log = LoggerFactory.getLogger(AirQualityScheduler.class);
    private final PublicDataCollectorService collectorService;

    public AirQualityScheduler(PublicDataCollectorService collectorService) {
        this.collectorService = collectorService;
    }

    @Scheduled(cron = "${geumcheon.air-quality.cron:0 5 */3 * * *}")
    public void syncAirQuality() {
        if (!collectorService.isCollectorEnabled()) {
            log.info("Air quality collector is disabled.");
            return;
        }
        CollectionRunResult result = collectorService.syncDataset("air-quality", "scheduled-air-quality");
        log.info(
                "Air quality sync finished: status={}, fetched={}, saved={}",
                result.status(), result.fetchedCount(), result.savedCount()
        );
    }
}
