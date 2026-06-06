package kr.go.geumcheon.dataplatform.publicdata;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;

@Component
@ConditionalOnProperty(prefix = "geumcheon.collector", name = "schedule-enabled", havingValue = "true")
public class PublicDataCollectorScheduler {

    private static final Logger log = LoggerFactory.getLogger(PublicDataCollectorScheduler.class);

    private final PublicDataCollectorService collectorService;

    public PublicDataCollectorScheduler(PublicDataCollectorService collectorService) {
        this.collectorService = collectorService;
    }

    @Scheduled(cron = "${geumcheon.collector.cron:0 0 4 * * *}")
    public void runScheduledSync() {
        if (!collectorService.isCollectorEnabled()) {
            log.info("Public data collector is disabled.");
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                log.info("Public data collector scheduled run started.");
                collectorService.syncAll("scheduled");
                log.info("Public data collector scheduled run finished.");
            } catch (RuntimeException error) {
                log.warn("Public data collector scheduled run failed: {}", error.getMessage(), error);
            }
        });
    }
}
