package kr.go.geumcheon.dataplatform.publicdata;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;

@Component
public class PublicDataAutoSyncRunner {

    private static final Logger log = LoggerFactory.getLogger(PublicDataAutoSyncRunner.class);

    private final PublicDataCollectorService collectorService;

    public PublicDataAutoSyncRunner(PublicDataCollectorService collectorService) {
        this.collectorService = collectorService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!collectorService.isCollectorEnabled()) {
            log.info("Public data collector is disabled.");
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                log.info("Public data collector started.");
                collectorService.syncAll("system");
                log.info("Public data collector finished.");
            } catch (RuntimeException error) {
                log.warn("Public data collector failed: {}", error.getMessage(), error);
            }
        });
    }
}
