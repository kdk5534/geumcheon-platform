package kr.go.geumcheon.dataplatform.publicdata;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "geumcheon.wifi-relay", name = "schedule-enabled", havingValue = "true")
public class PublicWifiRelayScheduler {

    private static final Logger log = LoggerFactory.getLogger(PublicWifiRelayScheduler.class);
    private final PublicDataCollectorService collectorService;

    public PublicWifiRelayScheduler(PublicDataCollectorService collectorService) {
        this.collectorService = collectorService;
    }

    @Scheduled(cron = "${geumcheon.wifi-relay.cron:0 10 * * * *}")
    public void syncPublicWifi() {
        CollectionRunResult result = collectorService.syncDataset("public-wifi", "scheduled-relay");
        log.info(
                "Public WiFi relay sync finished: status={}, fetched={}, saved={}",
                result.status(), result.fetchedCount(), result.savedCount()
        );
    }
}
