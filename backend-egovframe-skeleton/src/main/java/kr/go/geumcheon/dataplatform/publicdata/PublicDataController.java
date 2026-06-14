package kr.go.geumcheon.dataplatform.publicdata;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public")
public class PublicDataController {

    private final PublicDataCollectorService collectorService;
    private final PublicDataRepository repository;
    private final String runtimeMode;

    public PublicDataController(
            PublicDataCollectorService collectorService,
            PublicDataRepository repository,
            @Value("${geumcheon.runtime.mode:db}") String runtimeMode
    ) {
        this.collectorService = collectorService;
        this.repository = repository;
        this.runtimeMode = runtimeMode;
    }

    @GetMapping("/api-sources")
    public ApiResponse<List<ApiSourceSummary>> apiSources() {
        return ApiResponse.ok(collectorService.loadApiSources(), sourceMode());
    }

    @GetMapping("/api-logs")
    public ApiResponse<List<ApiLogSummary>> apiLogs() {
        return ApiResponse.ok(collectorService.loadApiLogs(), sourceMode());
    }

    @GetMapping("/stores")
    public ApiResponse<List<StoreSummary>> stores() {
        return ApiResponse.ok(repository.listStores(), sourceMode());
    }

    @GetMapping("/air-quality")
    public ApiResponse<List<AirQualitySummary>> airQuality() {
        return ApiResponse.ok(repository.listAirQuality(), sourceMode());
    }

    private String sourceMode() {
        return "mock".equalsIgnoreCase(runtimeMode) ? "mock" : "db";
    }
}
